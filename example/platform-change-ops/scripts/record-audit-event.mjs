#!/usr/bin/env node
const mode = process.argv[2] ?? 'capture'
process.stdout.write(`audit-event mode: ${mode}\n`)
