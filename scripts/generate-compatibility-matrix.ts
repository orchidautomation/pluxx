import { writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { renderCompatibilityMatrixMarkdown } from '../src/compatibility/matrix'

const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'compatibility.md')

writeFileSync(outputPath, renderCompatibilityMatrixMarkdown())
console.log(`Wrote ${outputPath}`)
