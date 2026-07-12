import { afterEach, describe, expect, it } from 'bun:test'
import {
  REMOTE_FETCH_MAX_BYTES,
  assertSafeRemoteUrl,
  safeRemoteFetchText,
  setSafeRemoteFetchTestHooks,
} from '../src/cli/safe-remote-fetch'

afterEach(() => {
  setSafeRemoteFetchTestHooks(null)
})

describe('safe remote fetch', () => {
  it('rejects non-HTTP protocols and local hostnames before requesting them', async () => {
    await expect(assertSafeRemoteUrl('file:///etc/passwd')).rejects.toThrow('protocol "file:" is not allowed')
    await expect(assertSafeRemoteUrl('http://localhost/admin')).rejects.toThrow('hostname "localhost" is not allowed')
    await expect(assertSafeRemoteUrl('http://127.0.0.1/admin')).rejects.toThrow('private or reserved')
    await expect(assertSafeRemoteUrl('http://2130706433/admin')).rejects.toThrow('private or reserved')
    await expect(assertSafeRemoteUrl('http://0x7f000001/admin')).rejects.toThrow('private or reserved')
    await expect(assertSafeRemoteUrl('http://[::1]/admin')).rejects.toThrow('private or reserved')
    await expect(assertSafeRemoteUrl('http://[::ffff:127.0.0.1]/admin')).rejects.toThrow('private or reserved')
    await expect(assertSafeRemoteUrl('https://[3fff::1]/docs')).rejects.toThrow('private or reserved')
  })

  it('allows ordinary globally routable IPv6 addresses', async () => {
    await expect(assertSafeRemoteUrl('https://[2001:4860:4860::8888]/docs')).resolves.toMatchObject({
      addresses: [{ address: '2001:4860:4860::8888', family: 6 }],
    })
  })

  it('rejects hostnames when any DNS answer is private or reserved', async () => {
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ],
      request: async () => { throw new Error('request should not run') },
    })

    await expect(assertSafeRemoteUrl('https://rebind.example')).rejects.toThrow('169.254.169.254')
  })

  it('falls through validated public DNS answers when one connection fails', async () => {
    const attempted: string[] = []
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '1.1.1.1', family: 4 },
      ],
      request: async (_url, address) => {
        attempted.push(address.address)
        if (address.address === '8.8.8.8') throw new Error('connect failed')
        return rawResponse(200, 'ok', { 'content-type': 'text/plain' })
      },
    })

    const response = await safeRemoteFetchText('https://docs.example/', {
      allowedContentTypes: ['text/plain'],
    })
    expect(response.text).toBe('ok')
    expect(attempted).toEqual(['8.8.8.8', '1.1.1.1'])
  })

  it('validates every redirect target and rejects redirects to private networks', async () => {
    let requestCount = 0
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async () => {
        requestCount += 1
        return rawResponse(302, '', { location: 'http://127.0.0.1/private' })
      },
    })

    await expect(safeRemoteFetchText('https://docs.example/start', {
      allowedContentTypes: ['text/html'],
    })).rejects.toThrow('private or reserved')
    expect(requestCount).toBe(1)
  })

  it('does not forward credentials or body headers across redirects', async () => {
    const requestHeaders: Array<Record<string, string> | undefined> = []
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async (_url, _address, options) => {
        requestHeaders.push(options.headers)
        return requestHeaders.length === 1
          ? rawResponse(302, '', { location: 'https://other.example/landing' })
          : rawResponse(200, 'ok', { 'content-type': 'text/plain' })
      },
    })

    await safeRemoteFetchText('https://docs.example/start', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer private',
        Cookie: 'session=private',
        'Proxy-Authorization': 'Basic private',
        'Content-Type': 'application/json',
        'Content-Length': '2',
        'X-Request-ID': 'safe-to-forward',
      },
      body: '{}',
      allowedContentTypes: ['text/plain'],
    })

    expect(requestHeaders[1]).toEqual({ 'X-Request-ID': 'safe-to-forward' })
  })

  it('cancels redirect responses that cannot be followed', async () => {
    let cancelCount = 0
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async () => ({
        ...rawResponse(302, ''),
        cancel: () => { cancelCount += 1 },
      }),
    })

    await expect(safeRemoteFetchText('https://docs.example/start', {
      allowedContentTypes: ['text/html'],
    })).rejects.toThrow('did not include a Location header')
    expect(cancelCount).toBe(1)

    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async () => ({
        ...rawResponse(302, '', { location: 'https://other.example/' }),
        cancel: () => { cancelCount += 1 },
      }),
    })
    await expect(safeRemoteFetchText('https://docs.example/start', {
      allowedContentTypes: ['text/html'],
      maxRedirects: 0,
    })).rejects.toThrow('exceeded 0 redirects')
    expect(cancelCount).toBe(2)
  })

  it('bounds response size and rejects unsupported content types', async () => {
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async () => rawResponse(200, 'x'.repeat(REMOTE_FETCH_MAX_BYTES + 1), {
        'content-type': 'text/html',
      }),
    })
    await expect(safeRemoteFetchText('https://docs.example/large', {
      allowedContentTypes: ['text/html'],
    })).rejects.toThrow(`${REMOTE_FETCH_MAX_BYTES} byte limit`)

    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async () => rawResponse(200, 'binary', { 'content-type': 'application/octet-stream' }),
    })
    await expect(safeRemoteFetchText('https://docs.example/archive', {
      allowedContentTypes: ['text/html'],
    })).rejects.toThrow('unsupported content type')
  })

  it('preserves bounded HTTP error responses regardless of content type', async () => {
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async () => rawResponse(502, 'upstream failed', { 'content-type': 'application/octet-stream' }),
    })

    const response = await safeRemoteFetchText('https://api.example/failure', {
      allowedContentTypes: ['application/json'],
    })
    expect(response.status).toBe(502)
    expect(response.statusText).toBe('Upstream Error')
    expect(response.text).toBe('upstream failed')
  })

  it('bounds stalled requests by time', async () => {
    let aborted = false
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async (_url, _address, options) => {
        options.signal.addEventListener('abort', () => { aborted = true }, { once: true })
        return new Promise(() => {})
      },
    })

    await expect(safeRemoteFetchText('https://docs.example/slow', {
      allowedContentTypes: ['text/html'],
      timeoutMs: 5,
    })).rejects.toThrow('timed out after 5ms')
    expect(aborted).toBe(true)
  })

  it('applies the deadline while reading a stalled response body', async () => {
    let bodyAborted = false
    setSafeRemoteFetchTestHooks({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async (_url, _address, options) => ({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/html' }),
        body: (async function* () {
          yield Buffer.from('<main>partial')
          await new Promise<void>((resolvePromise) => {
            options.signal.addEventListener('abort', () => {
              bodyAborted = true
              resolvePromise()
            }, { once: true })
          })
        })(),
      }),
    })

    await expect(safeRemoteFetchText('https://docs.example/slow-body', {
      allowedContentTypes: ['text/html'],
      timeoutMs: 5,
    })).rejects.toThrow('timed out after 5ms')
    expect(bodyAborted).toBe(true)
  })
})

function rawResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return {
    status,
    statusText: status === 200 ? 'OK' : status === 302 ? 'Found' : 'Upstream Error',
    headers: new Headers(headers),
    body: bodyStream(body),
  }
}

async function* bodyStream(body: string): AsyncIterable<Uint8Array> {
  yield Buffer.from(body)
}
