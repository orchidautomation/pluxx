import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  materializeProofReceipt,
  ProofManifestSchema,
  ProofReceiptSpecSchema,
  upsertProofReceipt,
  type ProofManifest,
  type ProofReceiptSpec,
} from '../src/proof-freshness'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const specIndex = args.indexOf('--spec')
const manifestIndex = args.indexOf('--manifest')
if (specIndex === -1 || !args[specIndex + 1]) {
  console.error('Usage: npm run proof:receipt -- --spec <receipt-spec.json> [--manifest docs/proof-manifest.json]')
  process.exit(1)
}

const specPath = resolve(root, args[specIndex + 1]!)
const manifestPath = resolve(root, manifestIndex === -1 ? 'docs/proof-manifest.json' : args[manifestIndex + 1]!)
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }
const manifest: ProofManifest = ProofManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))
const spec: ProofReceiptSpec = ProofReceiptSpecSchema.parse(JSON.parse(readFileSync(specPath, 'utf8')))
const receipt = materializeProofReceipt(spec, {
  commitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  packageVersion: packageJson.version,
  timestamp: new Date().toISOString(),
})

const updated = upsertProofReceipt({
  ...manifest,
  canonicalVersion: packageJson.version,
  expectedTag: `v${packageJson.version}`,
}, receipt)
writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`)
console.log(`Updated ${manifestPath} with receipt ${receipt.id} (${receipt.tier}, ${receipt.freshness}).`)
