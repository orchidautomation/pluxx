import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { replaceGeneratedCoreFourPrimitiveSection } from '../src/compatibility/core-four-primitives'
import { renderCompatibilityMatrixMarkdown, renderCompatibilityMatrixMdx } from '../src/compatibility/matrix'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const compatibilityPath = resolve(rootDir, 'docs', 'compatibility.md')

writeFileSync(compatibilityPath, renderCompatibilityMatrixMarkdown())
console.log(`Wrote ${compatibilityPath}`)

const siteCompatibilityPath = resolve(rootDir, 'site', 'how-it-works', 'compatibility-limits.mdx')
writeFileSync(siteCompatibilityPath, renderCompatibilityMatrixMdx())
console.log(`Wrote ${siteCompatibilityPath}`)

for (const outputPath of [
  resolve(rootDir, 'docs', 'core-four-primitive-matrix.md'),
  resolve(rootDir, 'site', 'overview', 'core-four-primitive-matrix.mdx'),
]) {
  const current = readFileSync(outputPath, 'utf-8')
  writeFileSync(outputPath, replaceGeneratedCoreFourPrimitiveSection(current))
  console.log(`Wrote ${outputPath}`)
}
