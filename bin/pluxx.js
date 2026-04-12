#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const binDir = dirname(fileURLToPath(import.meta.url))
const cliPath = resolve(binDir, '..', 'src', 'cli', 'index.ts')

if (process.versions.bun) {
  await import(pathToFileURL(cliPath).href)
} else {
  const bunBinary = process.platform === 'win32' ? 'bun.exe' : 'bun'
  const result = spawnSync(bunBinary, [cliPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error && 'code' in result.error && result.error.code === 'ENOENT') {
    console.error('pluxx currently requires Bun at runtime.')
    console.error('Install Bun from https://bun.sh or run pluxx from a Bun workspace.')
    process.exit(1)
  }

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }

  process.exit(result.status ?? 1)
}
