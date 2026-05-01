#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const mode = process.argv[2] ?? 'bootstrap'
const runtimeRoot = resolve(process.cwd(), 'passthrough/runtime')
const stateDir = resolve(runtimeRoot, 'state')
mkdirSync(stateDir, { recursive: true })

if (mode === 'sync-policy' || mode === 'bootstrap') {
  writeFileSync(resolve(stateDir, 'policy-sync.json'), JSON.stringify({ status: 'ready', source: 'local-fixture' }, null, 2) + '\n')
}

if (mode === 'refresh-health' || mode === 'bootstrap') {
  writeFileSync(resolve(stateDir, 'service-health.json'), JSON.stringify({ status: 'ready', environment: process.env.CHANGEOPS_ENVIRONMENT ?? 'unknown' }, null, 2) + '\n')
}

process.stdout.write(`risk-score mode: ${mode}\n`)
