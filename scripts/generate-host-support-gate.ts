import { writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { renderHostSupportGateMarkdown } from '../src/compatibility/host-support-gate'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(rootDir, 'docs', 'new-host-support-gate.md')

writeFileSync(outputPath, renderHostSupportGateMarkdown())
console.log(`Wrote ${outputPath}`)
