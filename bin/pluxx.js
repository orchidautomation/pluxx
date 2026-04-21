#!/usr/bin/env node

import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const binDir = dirname(fileURLToPath(import.meta.url))
const distCliPath = resolve(binDir, '..', 'dist', 'cli', 'index.js')
const sourceCliPath = resolve(binDir, '..', 'src', 'cli', 'index.ts')
const cliPath = existsSync(distCliPath)
  ? distCliPath
  : process.versions.bun
    ? sourceCliPath
    : null

if (!cliPath) {
  console.error('pluxx CLI bundle not found.')
  console.error('Run `bun run build` in this checkout, or install the published npm package.')
  process.exit(1)
}

const cli = await import(pathToFileURL(cliPath).href)
if (typeof cli.main !== 'function') {
  console.error('pluxx launcher failed to resolve the CLI entrypoint.')
  process.exit(1)
}

await cli.main()
