#!/usr/bin/env node

import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const DIST_DIR = resolve(ROOT, 'dist')

rmSync(DIST_DIR, { recursive: true, force: true })
mkdirSync(DIST_DIR, { recursive: true })

await build({
  absWorkingDir: ROOT,
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  logLevel: 'info',
})

await build({
  absWorkingDir: ROOT,
  entryPoints: ['src/cli/entry.ts'],
  outfile: 'dist/cli/index.js',
  bundle: true,
  external: ['jiti'],
  format: 'esm',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  logLevel: 'info',
})
