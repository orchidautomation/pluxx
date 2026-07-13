import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  findCanonicalDocProblems,
  ProofManifestSchema,
  validateProofManifest,
  type ProofManifest,
} from '../src/proof-freshness'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }
const manifestPath = resolve(root, 'docs', 'proof-manifest.json')
const canonicalDocs = [
  'docs/start-here.md',
  'docs/todo/queue.md',
  'docs/todo/master-backlog.md',
  'docs/roadmap.md',
  'docs/release-distribution-proof-map.md',
  'docs/proof-and-install.md',
  'docs/first-proof-demo-asset-pack.md',
  'docs/proof-freshness.md',
  'docs/pluxx-self-hosted-core-four-proof.md',
  'docs/strategy/firecrawl-connector-docs-ingestion-proof.md',
]

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

const parsedManifest = ProofManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, 'utf8')))
if (!parsedManifest.success) {
  console.error(`Proof manifest schema validation failed:\n${parsedManifest.error.message}`)
  process.exit(1)
}
const manifest: ProofManifest = parsedManifest.data
const expectedTag = `v${packageJson.version}`
const tagExists = git('tag', '--list', expectedTag) === expectedTag
const problems = validateProofManifest(manifest, {
  packageVersion: packageJson.version,
  expectedTagExists: tagExists,
  releaseTagUnderValidation: process.env.PLUXX_RELEASE_TAG,
  now: new Date(),
  isCommitReachable: (sha) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: root, stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  },
})

const documents: Record<string, string> = {}
for (const path of canonicalDocs) {
  const absolutePath = resolve(root, path)
  if (!existsSync(absolutePath)) {
    problems.push(`Canonical proof document is missing: ${path}.`)
    continue
  }
  documents[path] = readFileSync(absolutePath, 'utf8')
}
problems.push(...findCanonicalDocProblems(documents, packageJson.version))

for (const claim of manifest.claims) {
  if (!existsSync(resolve(root, claim.evidencePath))) problems.push(`Claim ${claim.id} evidencePath does not exist: ${claim.evidencePath}.`)
}

if (problems.length > 0) {
  console.error('Proof freshness check failed:')
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

console.log(`Proof freshness check passed for ${packageJson.version}: ${manifest.claims.length} claims, ${manifest.receipts.length} receipts.`)
