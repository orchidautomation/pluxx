#!/usr/bin/env node

import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const npmCacheDir = mkdtempSync(join(tmpdir(), 'pluxx-npm-cache-'))

try {
  const result = spawnSync('npm', ['pack', ...process.argv.slice(2)], {
    encoding: 'utf8',
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(process.env.NPM_CONFIG_CACHE ? {} : { NPM_CONFIG_CACHE: npmCacheDir }),
    },
  })

  process.exit(result.status ?? 1)
} finally {
  if (existsSync(npmCacheDir)) {
    rmSync(npmCacheDir, { recursive: true, force: true })
  }
}
