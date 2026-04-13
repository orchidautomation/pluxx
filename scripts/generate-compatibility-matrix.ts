import { resolve } from 'path'
import { renderCompatibilityMatrixMarkdown } from '../src/compatibility/matrix'

const outputPath = resolve(import.meta.dir, '..', 'docs', 'compatibility.md')

await Bun.write(outputPath, renderCompatibilityMatrixMarkdown())
console.log(`Wrote ${outputPath}`)
