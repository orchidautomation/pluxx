import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'

function pipeToWeb(stream: NodeJS.ReadableStream | null): ReadableStream | null {
  if (!stream) return null
  return Readable.toWeb(stream as never) as ReadableStream
}

const setupDir = dirname(fileURLToPath(import.meta.url))
const fakeBinDir = resolve(setupDir, 'bin')
process.env.PATH = `${fakeBinDir}:${process.env.PATH ?? ''}`

let ephemeralPort = 41000

globalThis.Bun = {
  spawn(argv: string[], options: {
    cwd?: string
    env?: Record<string, string>
    stdout?: 'pipe' | 'inherit'
    stderr?: 'pipe' | 'inherit'
    stdin?: 'pipe' | 'inherit'
  } = {}) {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: [
        options.stdin ?? 'pipe',
        options.stdout ?? 'pipe',
        options.stderr ?? 'pipe',
      ],
    })

    return {
      stdout: pipeToWeb(child.stdout),
      stderr: pipeToWeb(child.stderr),
      exited: new Promise<number>((resolveExit) => {
        child.on('close', (code) => resolveExit(code ?? 0))
      }),
      kill(signal?: NodeJS.Signals | number) {
        child.kill(signal)
      },
    }
  },
  async write(path: string, data: string | Uint8Array) {
    mkdirSync(dirname(path), { recursive: true })
    await writeFile(path, data)
  },
  serve(options: {
    port: number
    fetch: (request: Request) => Response | Promise<Response>
  }) {
    const port = options.port === 0 ? ephemeralPort++ : options.port
    const server = createServer(async (req, res) => {
      const url = `http://127.0.0.1:${port}${req.url ?? '/'}`
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
      })
      const response = await options.fetch(request)

      res.statusCode = response.status
      response.headers.forEach((value, key) => {
        res.setHeader(key, value)
      })
      const body = response.body ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0)
      res.end(body)
    })
    server.listen(port, '127.0.0.1')

    return {
      port,
      stop() {
        server.close()
      },
    }
  },
} as never
