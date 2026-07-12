import { lookup } from 'node:dns/promises'
import { request as requestHttp, type IncomingHttpHeaders, type RequestOptions } from 'node:http'
import { request as requestHttps } from 'node:https'
import { BlockList, isIP } from 'node:net'

export const REMOTE_FETCH_TIMEOUT_MS = 10_000
export const REMOTE_FETCH_MAX_BYTES = 1_048_576
export const REMOTE_FETCH_MAX_REDIRECTS = 5

const BLOCKED_IPV4_ADDRESSES = new BlockList()
const BLOCKED_IPV6_ADDRESSES = new BlockList()

for (const [network, prefix, family] of [
  ['0.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.0.0.0', 24, 'ipv4'],
  ['192.0.2.0', 24, 'ipv4'],
  ['192.88.99.0', 24, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'],
  ['198.51.100.0', 24, 'ipv4'],
  ['203.0.113.0', 24, 'ipv4'],
  ['224.0.0.0', 4, 'ipv4'],
  ['240.0.0.0', 4, 'ipv4'],
  ['::', 128, 'ipv6'],
  ['::1', 128, 'ipv6'],
  ['::ffff:0:0', 96, 'ipv6'],
  ['64:ff9b::', 96, 'ipv6'],
  ['100::', 64, 'ipv6'],
  ['2001::', 32, 'ipv6'],
  ['2001:2::', 48, 'ipv6'],
  ['2001:10::', 28, 'ipv6'],
  ['2001:20::', 28, 'ipv6'],
  ['2001:db8::', 32, 'ipv6'],
  ['2002::', 16, 'ipv6'],
  ['3fff::', 20, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
  ['ff00::', 8, 'ipv6'],
] as const) {
  if (family === 'ipv4') {
    BLOCKED_IPV4_ADDRESSES.addSubnet(network, prefix, family)
  } else {
    BLOCKED_IPV6_ADDRESSES.addSubnet(network, prefix, family)
  }
}

export interface SafeRemoteFetchOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  allowedContentTypes: string[]
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
}

export interface SafeRemoteFetchResult {
  url: string
  status: number
  statusText: string
  headers: Headers
  text: string
}

interface ResolvedAddress {
  address: string
  family: 4 | 6
}

interface RawRemoteResponse {
  status: number
  statusText: string
  headers: Headers
  body: AsyncIterable<Uint8Array | string>
  cancel?: () => void
}

interface SafeRemoteFetchTestHooks {
  resolveHostname(hostname: string): Promise<ResolvedAddress[]>
  request(
    url: URL,
    address: ResolvedAddress,
    options: Required<Pick<SafeRemoteFetchOptions, 'method'>> & SafeRemoteFetchOptions & { signal: AbortSignal },
  ): Promise<RawRemoteResponse>
}

let testHooks: SafeRemoteFetchTestHooks | null = null

export function setSafeRemoteFetchTestHooks(hooks: SafeRemoteFetchTestHooks | null): void {
  testHooks = hooks
}

export function createFetchBackedSafeRemoteFetchTestHooks(
  resolveHostname: SafeRemoteFetchTestHooks['resolveHostname'] = async () => [{ address: '93.184.216.34', family: 4 }],
): SafeRemoteFetchTestHooks {
  return {
    resolveHostname,
    async request(url, _address, options) {
      const response = await globalThis.fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        redirect: 'manual',
        signal: options.signal,
      })
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body ?? emptyBody(),
        cancel: () => { void response.body?.cancel().catch(() => undefined) },
      }
    },
  }
}

export async function assertSafeRemoteUrl(value: string): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Unsafe remote URL: ${JSON.stringify(value)} is not a valid URL.`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsafe remote URL: protocol ${JSON.stringify(url.protocol)} is not allowed.`)
  }
  if (url.username || url.password) {
    throw new Error('Unsafe remote URL: embedded credentials are not allowed.')
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error(`Unsafe remote URL: hostname ${JSON.stringify(hostname || url.hostname)} is not allowed.`)
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
    : await resolveHostname(hostname)
  if (addresses.length === 0) {
    throw new Error(`Unsafe remote URL: hostname ${JSON.stringify(hostname)} did not resolve.`)
  }

  for (const address of addresses) {
    if (!isPublicAddress(address)) {
      throw new Error(`Unsafe remote URL: address ${JSON.stringify(address.address)} is private or reserved.`)
    }
  }

  return { url, addresses }
}

export async function safeRemoteFetchText(
  value: string,
  options: SafeRemoteFetchOptions,
): Promise<SafeRemoteFetchResult> {
  const timeoutMs = options.timeoutMs ?? REMOTE_FETCH_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? REMOTE_FETCH_MAX_BYTES
  const maxRedirects = options.maxRedirects ?? REMOTE_FETCH_MAX_REDIRECTS
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      reject(new Error(`Remote fetch timed out after ${timeoutMs}ms.`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      fetchRedirect(value, options, controller.signal, maxBytes, maxRedirects, 0),
      timeoutPromise,
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function fetchRedirect(
  value: string,
  options: SafeRemoteFetchOptions,
  signal: AbortSignal,
  maxBytes: number,
  maxRedirects: number,
  redirectCount: number,
): Promise<SafeRemoteFetchResult> {
  const { url, addresses } = await assertSafeRemoteUrl(value)
  let raw: RawRemoteResponse | undefined
  let lastError: unknown
  for (const address of addresses) {
    try {
      raw = await requestRemote(url, address, {
        ...options,
        method: options.method ?? 'GET',
        signal,
      })
      break
    } catch (error) {
      lastError = error
      if (signal.aborted) throw error
    }
  }
  if (!raw) {
    throw lastError instanceof Error ? lastError : new Error('Remote fetch failed for every validated address.')
  }

  if (raw.status >= 300 && raw.status < 400) {
    const location = raw.headers.get('location')
    if (!location) {
      raw.cancel?.()
      throw new Error(`Remote fetch redirect ${raw.status} did not include a Location header.`)
    }
    if (redirectCount >= maxRedirects) {
      raw.cancel?.()
      throw new Error(`Remote fetch exceeded ${maxRedirects} redirects.`)
    }
    await drainBody(raw.body, maxBytes, raw.cancel)
    const next = new URL(location, url).toString()
    const method = options.method ?? 'GET'
    const redirectAsGet = raw.status === 303 || ((raw.status === 301 || raw.status === 302) && method === 'POST')
    const nextBody = redirectAsGet ? undefined : options.body
    return fetchRedirect(next, {
      ...options,
      method: redirectAsGet ? 'GET' : method,
      body: nextBody,
      headers: sanitizeRedirectHeaders(options.headers, nextBody === undefined),
    }, signal, maxBytes, maxRedirects, redirectCount + 1)
  }

  const contentType = normalizeContentType(raw.headers.get('content-type'))
  const isSuccess = raw.status >= 200 && raw.status < 300
  if (isSuccess && (!contentType || !options.allowedContentTypes.some((allowed) => contentType === allowed || contentType.endsWith(`+${allowed.split('/')[1]}`)))) {
    raw.cancel?.()
    throw new Error(`Remote fetch returned unsupported content type ${JSON.stringify(contentType || 'missing')}.`)
  }

  return {
    url: url.toString(),
    status: raw.status,
    statusText: raw.statusText,
    headers: raw.headers,
    text: await readBody(raw.body, maxBytes, raw.cancel),
  }
}

async function resolveHostname(hostname: string): Promise<ResolvedAddress[]> {
  if (testHooks) return testHooks.resolveHostname(hostname)
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  return addresses.map(({ address, family }) => ({ address, family: family as 4 | 6 }))
}

function isPublicAddress({ address, family }: ResolvedAddress): boolean {
  if (family === 4) {
    return !BLOCKED_IPV4_ADDRESSES.check(address, 'ipv4')
  }
  const first = address.replace(/^\[/, '').split(':', 1)[0]?.toLowerCase() ?? ''
  const globallyRoutable = first.startsWith('2') || first.startsWith('3')
  return globallyRoutable && !BLOCKED_IPV6_ADDRESSES.check(address, 'ipv6')
}

async function requestRemote(
  url: URL,
  address: ResolvedAddress,
  options: Required<Pick<SafeRemoteFetchOptions, 'method'>> & SafeRemoteFetchOptions & { signal: AbortSignal },
): Promise<RawRemoteResponse> {
  if (testHooks) return testHooks.request(url, address, options)

  return new Promise((resolvePromise, reject) => {
    const request = url.protocol === 'https:' ? requestHttps : requestHttp
    const requestOptions: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: options.method,
      headers: {
        Accept: options.allowedContentTypes.join(', '),
        'User-Agent': 'Pluxx/remote-docs-ingestion',
        ...options.headers,
      },
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions.all) {
          const allCallback = callback as unknown as (
            error: NodeJS.ErrnoException | null,
            addresses: ResolvedAddress[],
          ) => void
          allCallback(null, [address])
          return
        }
        callback(null, address.address, address.family)
      },
      signal: options.signal,
    }
    const req = request(requestOptions, (response) => {
      resolvePromise({
        status: response.statusCode ?? 0,
        statusText: response.statusMessage ?? '',
        headers: headersFromNode(response.headers),
        body: response,
        cancel: () => response.destroy(),
      })
    })
    req.on('error', (error) => {
      if (options.signal.aborted) return
      reject(error)
    })
    if (options.body) req.write(options.body)
    req.end()
  })
}

function headersFromNode(headers: IncomingHttpHeaders): Headers {
  const normalized = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) normalized.append(name, entry)
    } else if (value !== undefined) {
      normalized.set(name, String(value))
    }
  }
  return normalized
}

async function readBody(
  body: AsyncIterable<Uint8Array | string>,
  maxBytes: number,
  cancel?: () => void,
): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of body) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > maxBytes) {
      cancel?.()
      throw new Error(`Remote fetch exceeded ${maxBytes} byte limit.`)
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function drainBody(
  body: AsyncIterable<Uint8Array | string>,
  maxBytes: number,
  cancel?: () => void,
): Promise<void> {
  await readBody(body, maxBytes, cancel)
}

function normalizeContentType(value: string | null): string {
  return (value ?? '').split(';', 1)[0]!.trim().toLowerCase()
}

function sanitizeRedirectHeaders(
  headers: Record<string, string> | undefined,
  stripBodyHeaders: boolean,
): Record<string, string> | undefined {
  if (!headers) return undefined
  const blocked = new Set([
    'authorization',
    'cookie',
    'proxy-authorization',
    'host',
    'content-length',
    ...(stripBodyHeaders ? ['content-type'] : []),
  ])
  const sanitized = Object.fromEntries(
    Object.entries(headers).filter(([name]) => !blocked.has(name.toLowerCase())),
  )
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

async function* emptyBody(): AsyncIterable<Uint8Array> {
  // Empty response bodies still need an async iterable for the shared reader.
}
