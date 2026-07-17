import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { resolve } from 'path'
import { spawnSync } from 'child_process'
import { tmpdir } from 'os'
import type { PluginConfig, TargetPlatform } from '../schema'
import { collectRuntimeInheritedStdioEnvVars, collectUserConfigEntries, defaultUserConfigEnvVar } from '../user-config'
import { getPublishReloadInstruction } from '../distribution-lifecycle'
import { collectNativeMcpAuthUserConfigEntries } from '../mcp-native-overrides'

type PublishChannel = 'npm' | 'github-release'
type PublishAssetKind = 'archive' | 'installer' | 'manifest' | 'checksum'
type ReleaseArchiveVariant = 'versioned' | 'latest'

interface CommandResult {
  status: number | null
  stdout: string
  stderr: string
}

type CommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => CommandResult

export interface PublishPlanOptions {
  requestedChannels?: PublishChannel[]
  version?: string
  tag?: string
  dryRun?: boolean
  allowDirty?: boolean
  rootDir?: string
  runCommand?: CommandRunner
}

export interface PublishAssetPlan {
  kind: PublishAssetKind
  name: string
  path: string
  platform?: TargetPlatform
  variant?: ReleaseArchiveVariant
}

export interface PublishCheck {
  name: string
  ok: boolean
  code: string
  detail?: string
}

export interface PublishPlan {
  command: 'publish'
  dryRun: boolean
  version: string
  tag: string
  channels: {
    npm: {
      enabled: boolean
      explicit: boolean
      packageName?: string
      packageDir?: string
      wouldPublish: boolean
    }
    githubRelease: {
      enabled: boolean
      explicit: boolean
      repo?: string
      releaseTag?: string
      wouldCreateRelease: boolean
      assets: PublishAssetPlan[]
    }
  }
  checks: PublishCheck[]
}

export interface PublishRunResult extends PublishPlan {
  ok: boolean
  execution?: {
    npm?: { ok: boolean; action: 'published' | 'already-published' | 'failed'; verified: boolean; detail?: string }
    githubRelease?: { ok: boolean; action: 'created' | 'reconciled' | 'failed'; verified: boolean; detail?: string }
  }
}

interface ReleaseArtifactContext {
  repo: string
  version: string
  releaseTag: string
  builtTargets: TargetPlatform[]
  installerTargets: Array<typeof INSTALLER_TARGETS[number]>
  assetBaseURL: string
}

interface PreparedNpmArtifact {
  tempRoot: string
  filepath?: string
  integrity?: string
  error?: string
}

const INSTALLER_TARGETS = ['claude-code', 'cursor', 'codex', 'opencode'] as const satisfies readonly TargetPlatform[]

function runCommandDefault(command: string, args: string[], options?: { cwd?: string }): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options?.cwd,
    encoding: 'utf-8',
  })

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function isRemoteNotFound(result: CommandResult, channel: PublishChannel): boolean {
  if (result.status === 0) return false
  const detail = `${result.stderr}\n${result.stdout}`.toLowerCase()
  return channel === 'npm'
    ? detail.includes('e404') || detail.includes('404 not found') || detail.includes('is not in this registry')
    : detail.includes('release not found') || detail.includes('http 404') || detail.trim() === 'missing'
}

function isTargetNpmBacked(platform: TargetPlatform): boolean {
  return platform === 'opencode'
}

function isInstallerTarget(platform: TargetPlatform): platform is typeof INSTALLER_TARGETS[number] {
  return INSTALLER_TARGETS.includes(platform as typeof INSTALLER_TARGETS[number])
}

function resolveRequestedChannels(options: PublishPlanOptions): {
  requested: Set<PublishChannel>
  explicit: { npm: boolean; githubRelease: boolean }
} {
  const requested = new Set<PublishChannel>(options.requestedChannels ?? [])
  return {
    requested,
    explicit: {
      npm: requested.has('npm'),
      githubRelease: requested.has('github-release'),
    },
  }
}

function getBuiltTargets(rootDir: string, config: PluginConfig): TargetPlatform[] {
  return config.targets.filter((platform) =>
    existsSync(resolve(rootDir, config.outDir, platform)),
  )
}

function getPublishableBuiltTargets(rootDir: string, config: PluginConfig): TargetPlatform[] {
  return getBuiltTargets(rootDir, config).filter(isInstallerTarget)
}

function getArchiveAssetName(pluginName: string, platform: TargetPlatform, version: string, variant: ReleaseArchiveVariant): string {
  return variant === 'versioned'
    ? `${pluginName}-${platform}-v${version}.tar.gz`
    : `${pluginName}-${platform}-latest.tar.gz`
}

function getInstallerScriptName(platform: typeof INSTALLER_TARGETS[number]): string {
  return `install-${platform}.sh`
}

function buildReleaseAssets(rootDir: string, config: PluginConfig, version: string, targets: TargetPlatform[]): PublishAssetPlan[] {
  const assets: PublishAssetPlan[] = []

  for (const platform of targets) {
    const bundlePath = resolve(rootDir, config.outDir, platform)
    assets.push({
      kind: 'archive',
      platform,
      variant: 'versioned',
      name: getArchiveAssetName(config.name, platform, version, 'versioned'),
      path: bundlePath,
    })
    assets.push({
      kind: 'archive',
      platform,
      variant: 'latest',
      name: getArchiveAssetName(config.name, platform, version, 'latest'),
      path: bundlePath,
    })
  }

  const installerTargets = targets.filter(isInstallerTarget)
  for (const platform of installerTargets) {
    assets.push({
      kind: 'installer',
      platform,
      name: getInstallerScriptName(platform),
      path: '(generated installer script)',
    })
  }

  if (installerTargets.length > 0) {
    assets.push({
      kind: 'installer',
      name: 'install.sh',
      path: '(generated installer script)',
    })
    assets.push({
      kind: 'installer',
      name: 'install-all.sh',
      path: '(generated installer script)',
    })
  }

  assets.push({
    kind: 'manifest',
    name: 'release-manifest.json',
    path: '(generated manifest)',
  })
  assets.push({
    kind: 'checksum',
    name: 'SHA256SUMS.txt',
    path: '(generated checksums)',
  })

  return assets
}

function readNpmPackageIdentity(rootDir: string, config: PluginConfig): { packageName?: string; packageVersion?: string; packageDir?: string } {
  const packageDir = resolve(rootDir, config.outDir, 'opencode')
  const packageJsonPath = resolve(packageDir, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return {}
  }

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string; version?: string }
    return {
      packageName: pkg.name,
      packageVersion: pkg.version,
      packageDir,
    }
  } catch {
    return {
      packageDir,
    }
  }
}

function readBuiltTargetVersion(rootDir: string, config: PluginConfig, platform: TargetPlatform): string | undefined {
  const relativePath = platform === 'claude-code'
    ? '.claude-plugin/plugin.json'
    : platform === 'cursor'
      ? '.cursor-plugin/plugin.json'
      : platform === 'codex'
        ? '.codex-plugin/plugin.json'
        : platform === 'opencode'
          ? 'package.json'
          : undefined
  if (!relativePath) return undefined

  const filepath = resolve(rootDir, config.outDir, platform, relativePath)
  if (!existsSync(filepath)) return undefined
  try {
    const payload = JSON.parse(readFileSync(filepath, 'utf-8')) as { version?: unknown }
    return typeof payload.version === 'string' ? payload.version : undefined
  } catch {
    return undefined
  }
}

function parseGithubRepoSlug(value: string | undefined): string | undefined {
  if (!value) return undefined

  const normalized = value
    .trim()
    .replace(/^git\+/, '')
    .replace(/^ssh:\/\//, '')
    .replace(/\.git$/, '')

  const githubUrlMatch = normalized.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)$/i)
  if (githubUrlMatch) return githubUrlMatch[1]

  const sshMatch = normalized.match(/^git@github\.com:([^/]+\/[^/]+)$/i)
  if (sshMatch) return sshMatch[1]

  return undefined
}

function resolveGithubRepo(rootDir: string, config: PluginConfig, runCommand: CommandRunner): string | undefined {
  const configuredRepo = parseGithubRepoSlug(config.repository)
  if (configuredRepo) return configuredRepo

  const remote = runCommand('git', ['config', '--get', 'remote.origin.url'], { cwd: rootDir })
  if (remote.status === 0) {
    return parseGithubRepoSlug(remote.stdout.trim())
  }

  return undefined
}

function collectChecks(args: {
  rootDir: string
  config: PluginConfig
  npmEnabled: boolean
  githubReleaseEnabled: boolean
  allowDirty: boolean
  packageDir?: string
  packageName?: string
  packageVersion?: string
  githubRepo?: string
  publishVersion: string
  runCommand: CommandRunner
}): PublishCheck[] {
  const builtTargets = getPublishableBuiltTargets(args.rootDir, args.config)
  const identityMismatches = [
    ...(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(args.publishVersion)
      ? []
      : [`requested version is not valid semantic version: ${args.publishVersion}`]),
    ...(args.publishVersion === args.config.version
      ? []
      : [`requested ${args.publishVersion} != source config ${args.config.version}`]),
    ...builtTargets.flatMap((platform) => {
      const builtVersion = readBuiltTargetVersion(args.rootDir, args.config, platform)
      if (!builtVersion) return [`${platform} built identity is missing or unreadable`]
      return builtVersion !== args.publishVersion ? [`${platform} ${builtVersion} != requested ${args.publishVersion}`] : []
    }),
    ...(args.npmEnabled && !args.packageVersion
      ? ['npm package version is missing or unreadable']
      : args.packageVersion && args.packageVersion !== args.publishVersion
        ? [`npm package ${args.packageVersion} != requested ${args.publishVersion}`]
        : []),
  ]
  const checks: PublishCheck[] = [
    {
      name: 'artifacts-exist',
      ok: builtTargets.length > 0,
      code: 'artifacts-exist',
      detail: builtTargets.length > 0
        ? `Built targets: ${builtTargets.join(', ')}`
        : `No built platform outputs found in ${args.config.outDir}/`,
    },
    {
      name: 'release-identity',
      ok: identityMismatches.length === 0,
      code: 'release-identity',
      detail: identityMismatches.length === 0
        ? `Source and built release identities agree on ${args.publishVersion}.`
        : identityMismatches.join('; '),
    },
  ]

  const gitStatus = args.runCommand('git', ['status', '--porcelain'], { cwd: args.rootDir })
  checks.push({
    name: 'git-clean',
    ok: args.allowDirty || (gitStatus.status === 0 && gitStatus.stdout.trim() === ''),
    code: 'git-clean',
    detail: args.allowDirty
      ? 'Working tree cleanliness check skipped via --allow-dirty.'
      : gitStatus.status !== 0
      ? (gitStatus.stderr || gitStatus.stdout || 'Unable to read git status')
      : gitStatus.stdout.trim() === ''
        ? 'Working tree is clean.'
        : 'Working tree has uncommitted changes.',
  })

  if (args.npmEnabled) {
    checks.push({
      name: 'npm-package-ready',
      ok: Boolean(args.packageDir && existsSync(resolve(args.packageDir, 'package.json')) && args.packageName),
      code: 'npm-package-ready',
      detail: args.packageDir
        ? `OpenCode package dir: ${args.packageDir}`
        : 'No npm-backed target package found.',
    })

    const npmAuth = args.runCommand('npm', ['whoami'], { cwd: args.rootDir })
    checks.push({
      name: 'npm-auth',
      ok: npmAuth.status === 0,
      code: 'npm-auth',
      detail: npmAuth.status === 0
        ? (npmAuth.stdout.trim() || 'npm auth OK')
        : (npmAuth.stderr || npmAuth.stdout || 'npm auth unavailable'),
    })
  }

  if (args.githubReleaseEnabled) {
    const ghAuth = args.runCommand('gh', ['auth', 'status'], { cwd: args.rootDir })
    checks.push({
      name: 'github-release-auth',
      ok: ghAuth.status === 0,
      code: 'github-release-auth',
      detail: ghAuth.status === 0
        ? 'gh auth OK'
        : (ghAuth.stderr || ghAuth.stdout || 'gh auth unavailable'),
    })
    checks.push({
      name: 'github-release-repo',
      ok: Boolean(args.githubRepo),
      code: 'github-release-repo',
      detail: args.githubRepo
        ? `Resolved GitHub repo: ${args.githubRepo}`
        : 'Could not resolve a GitHub repository slug from config.repository or remote.origin.url.',
    })
  }

  return checks
}

export function planPublish(config: PluginConfig, options: PublishPlanOptions = {}): PublishPlan {
  const rootDir = options.rootDir ?? process.cwd()
  const runCommand = options.runCommand ?? runCommandDefault
  const builtTargets = getPublishableBuiltTargets(rootDir, config)
  const { requested, explicit } = resolveRequestedChannels(options)
  const defaultNpm = builtTargets.some(isTargetNpmBacked)
  const defaultGithubRelease = builtTargets.length > 0
  const npmEnabled = explicit.npm ? true : (requested.size === 0 ? defaultNpm : false)
  const githubReleaseEnabled = explicit.githubRelease ? true : (requested.size === 0 ? defaultGithubRelease : false)
  const version = options.version ?? config.version
  const tag = options.tag ?? 'latest'
  const { packageDir, packageName, packageVersion } = readNpmPackageIdentity(rootDir, config)
  const githubRepo = githubReleaseEnabled
    ? resolveGithubRepo(rootDir, config, runCommand)
    : undefined
  const checks = collectChecks({
    rootDir,
    config,
    npmEnabled,
    githubReleaseEnabled,
    allowDirty: options.allowDirty ?? false,
    packageDir,
    packageName,
    packageVersion,
    githubRepo,
    publishVersion: version,
    runCommand,
  })

  return {
    command: 'publish',
    dryRun: options.dryRun ?? false,
    version,
    tag,
    channels: {
      npm: {
        enabled: npmEnabled,
        explicit: explicit.npm,
        packageName,
        packageDir,
        wouldPublish: npmEnabled,
      },
      githubRelease: {
        enabled: githubReleaseEnabled,
        explicit: explicit.githubRelease,
        repo: githubRepo,
        releaseTag: githubReleaseEnabled ? `v${version}` : undefined,
        wouldCreateRelease: githubReleaseEnabled,
        assets: githubReleaseEnabled ? buildReleaseAssets(rootDir, config, version, builtTargets) : [],
      },
    },
    checks,
  }
}

function getDisplayName(config: PluginConfig): string {
  return config.brand?.displayName ?? config.name
}

function getHomepageUrl(config: PluginConfig, repo: string): string {
  return config.brand?.websiteURL ?? config.repository ?? `https://github.com/${repo}`
}

function getAuthorName(config: PluginConfig): string {
  return config.author?.name ?? 'Pluxx'
}

function buildAssetBaseUrl(repo: string): string {
  return `https://github.com/${repo}/releases/latest/download`
}

function buildReleaseManifest(config: PluginConfig, context: ReleaseArtifactContext): string {
  const archives = context.builtTargets.map((platform) => ({
    platform,
    versionedAsset: getArchiveAssetName(config.name, platform, context.version, 'versioned'),
    latestAsset: getArchiveAssetName(config.name, platform, context.version, 'latest'),
    latestUrl: `${context.assetBaseURL}/${getArchiveAssetName(config.name, platform, context.version, 'latest')}`,
  }))

  const installers = context.installerTargets.map((platform) => ({
    platform,
    script: getInstallerScriptName(platform),
    url: `${context.assetBaseURL}/${getInstallerScriptName(platform)}`,
    command: `curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 ${context.assetBaseURL}/${getInstallerScriptName(platform)} | bash`,
  }))

  const manifest = {
    version: 1,
    plugin: {
      name: config.name,
      displayName: getDisplayName(config),
      description: config.description,
      version: context.version,
      author: config.author,
      license: config.license,
      repository: config.repository,
      homepage: getHomepageUrl(config, context.repo),
    },
    githubRelease: {
      repo: context.repo,
      tag: context.releaseTag,
      latestBaseUrl: context.assetBaseURL,
    },
    assets: {
      archives,
      installers,
      install: installers.length > 0
        ? {
            script: 'install.sh',
            url: `${context.assetBaseURL}/install.sh`,
            command: `bash <(curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 ${context.assetBaseURL}/install.sh) --agents -y`,
          }
        : undefined,
      installAll: installers.length > 0
        ? {
            script: 'install-all.sh',
            url: `${context.assetBaseURL}/install-all.sh`,
            command: `curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 ${context.assetBaseURL}/install-all.sh | bash`,
          }
        : undefined,
      checksums: 'SHA256SUMS.txt',
    },
  }

  return `${JSON.stringify(manifest, null, 2)}\n`
}

function renderInstallAllScript(installerTargets: Array<typeof INSTALLER_TARGETS[number]>): string {
  return `#!/usr/bin/env bash
set -euo pipefail

REPO="\${PLUXX_PLUGIN_REPO:-__REPO__}"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

BASE_URL="\${PLUXX_RELEASE_BASE_URL:-https://github.com/\${REPO}/releases/latest/download}"
curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$BASE_URL/release-manifest.json" -o "$TMP_DIR/release-manifest.json"
curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$BASE_URL/SHA256SUMS.txt" -o "$TMP_DIR/SHA256SUMS.txt"
curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$BASE_URL/install.sh" -o "$TMP_DIR/install.sh"

PLUXX_VERIFY_ROOT="$TMP_DIR" PLUXX_VERIFY_SUMS="$TMP_DIR/SHA256SUMS.txt" PLUXX_EXPECTED_PLUGIN="PLUGIN_PLACEHOLDER" node <<'NODE'
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const entries = fs.readFileSync(process.env.PLUXX_VERIFY_SUMS, 'utf8')
  .split(/\\r?\\n/)
  .map((line) => line.match(/^([a-f0-9]{64})  (.+)$/))
for (const name of ['release-manifest.json', 'install.sh']) {
  const match = entries.find((entry) => entry && entry[2] === name)
  if (!match) throw new Error('Release checksum inventory does not include ' + name)
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(process.env.PLUXX_VERIFY_ROOT, name))).digest('hex')
  if (actual !== match[1]) throw new Error('Checksum mismatch for ' + name)
}
const manifest = JSON.parse(fs.readFileSync(path.join(process.env.PLUXX_VERIFY_ROOT, 'release-manifest.json'), 'utf8'))
if (manifest.version !== 1 || manifest.plugin?.name !== process.env.PLUXX_EXPECTED_PLUGIN) {
  throw new Error('Release manifest identity mismatch')
}
NODE

bash "$TMP_DIR/install.sh" --agents "$@"
`.replaceAll('__REPO__', 'REPO_PLACEHOLDER').replaceAll('__DISPLAY_NAME__', 'DISPLAY_PLACEHOLDER')
}

function renderTopLevelInstallScript(installerTargets: Array<typeof INSTALLER_TARGETS[number]>): string {
  const targetCases = installerTargets.map((platform) => `    --${platform})
      targets+=("${platform}")
      shift
      ;;`).join('\n')
  const targetList = installerTargets.map((platform) => `"${platform}"`).join(' ')
  const defaultTarget = installerTargets.includes('codex') ? 'codex' : installerTargets[0]

  return `#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Install DISPLAY_PLACEHOLDER release assets.

Usage:
  bash <(curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 https://github.com/REPO_PLACEHOLDER/releases/latest/download/install.sh) --agents -y

Options:
  --agents, --all       Install supported agent plugin bundles.
${installerTargets.map((platform) => `  --${platform.padEnd(18)} Install only the ${platform} plugin bundle.`).join('\n')}
  -y, --yes             Noninteractive mode where supported by downstream installers.
  --repo OWNER/REPO     Override the GitHub repository.
  --version VERSION     Install a specific release version or tag.
  --base-url URL        Override the release asset base URL.
  -h, --help            Show this help.

Environment:
  PLUXX_PLUGIN_REPO     Default repository. Defaults to REPO_PLACEHOLDER.
  PLUXX_PLUGIN_VERSION  Release version or tag. Defaults to latest.
  PLUXX_RELEASE_BASE_URL
                        Release asset base URL override.
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

repo="\${PLUXX_PLUGIN_REPO:-REPO_PLACEHOLDER}"
version="\${PLUXX_PLUGIN_VERSION:-latest}"
base_url="\${PLUXX_RELEASE_BASE_URL:-}"
yes=0
agents=0
targets=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --agents|--all)
      agents=1
      shift
      ;;
${targetCases}
    -y|--yes)
      yes=1
      shift
      ;;
    --repo)
      repo="$2"
      shift 2
      ;;
    --repo=*)
      repo="\${1#*=}"
      shift
      ;;
    --version)
      version="$2"
      shift 2
      ;;
    --version=*)
      version="\${1#*=}"
      shift
      ;;
    --base-url)
      base_url="$2"
      shift 2
      ;;
    --base-url=*)
      base_url="\${1#*=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

need_cmd curl
need_cmd mktemp
need_cmd bash
need_cmd node

if [ -z "$base_url" ]; then
  if [ "$version" = "latest" ]; then
    base_url="https://github.com/$repo/releases/latest/download"
  else
    tag="$version"
    case "$tag" in
      v*) ;;
      *) tag="v$tag" ;;
    esac
    base_url="https://github.com/$repo/releases/download/$tag"
  fi
fi

if [ "$agents" = "1" ]; then
  targets=(${targetList})
elif [ "\${#targets[@]}" -eq 0 ]; then
  targets=("${defaultTarget}")
fi

if [ "$yes" = "1" ]; then
  export PLUXX_CODEX_ENABLE_PLUGIN_HOOKS="\${PLUXX_CODEX_ENABLE_PLUGIN_HOOKS:-1}"
fi
export PLUXX_PLUGIN_VERSION="$version"
export PLUXX_RELEASE_BASE_URL="$base_url"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

release_manifest="$tmp_dir/release-manifest.json"
release_checksums="$tmp_dir/SHA256SUMS.txt"
curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$base_url/release-manifest.json" -o "$release_manifest"
curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$base_url/SHA256SUMS.txt" -o "$release_checksums"

verify_release_asset() {
  local filepath="$1"
  local asset_name="$2"
  PLUXX_VERIFY_FILE="$filepath" PLUXX_VERIFY_NAME="$asset_name" PLUXX_VERIFY_SUMS="$release_checksums" node <<'NODE'
const crypto = require('crypto')
const fs = require('fs')
const filepath = process.env.PLUXX_VERIFY_FILE
const name = process.env.PLUXX_VERIFY_NAME
const match = fs.readFileSync(process.env.PLUXX_VERIFY_SUMS, 'utf8')
  .split(/\\r?\\n/)
  .map((line) => line.match(/^([a-f0-9]{64})  (.+)$/))
  .find((entry) => entry && entry[2] === name)
if (!match) throw new Error('Release checksum inventory does not include ' + name)
const actual = crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex')
if (actual !== match[1]) throw new Error('Checksum mismatch for ' + name)
NODE
}

verify_release_asset "$release_manifest" "release-manifest.json"
PLUXX_RELEASE_MANIFEST="$release_manifest" PLUXX_EXPECTED_PLUGIN="PLUGIN_PLACEHOLDER" PLUXX_REQUESTED_VERSION="$version" node <<'NODE'
const fs = require('fs')
const manifest = JSON.parse(fs.readFileSync(process.env.PLUXX_RELEASE_MANIFEST, 'utf8'))
if (manifest.version !== 1 || manifest.plugin?.name !== process.env.PLUXX_EXPECTED_PLUGIN) {
  throw new Error('Release manifest identity mismatch')
}
const requested = process.env.PLUXX_REQUESTED_VERSION
if (requested !== 'latest' && manifest.plugin?.version !== requested.replace(/^v/, '')) {
  throw new Error('Release manifest version does not match requested version')
}
NODE

run_installer() {
  local target="$1"
  local installer="$tmp_dir/install-$target.sh"
  local url="$base_url/install-$target.sh"

  if [ "$agents" = "1" ] && [ "$target" = "claude-code" ] && ! command -v claude >/dev/null 2>&1; then
    echo "Skipping Claude Code bundle because the claude CLI is not available on PATH." >&2
    echo "Run with --claude-code to require Claude Code installation and fail if prerequisites are missing." >&2
    return 0
  fi

  case "$target" in
    claude-code)
      export PLUXX_CLAUDE_BUNDLE_URL="\${PLUXX_CLAUDE_BUNDLE_URL:-$base_url/CLAUDE_BUNDLE_PLACEHOLDER}"
      ;;
    cursor)
      export PLUXX_CURSOR_BUNDLE_URL="\${PLUXX_CURSOR_BUNDLE_URL:-$base_url/CURSOR_BUNDLE_PLACEHOLDER}"
      ;;
    codex)
      export PLUXX_CODEX_BUNDLE_URL="\${PLUXX_CODEX_BUNDLE_URL:-$base_url/CODEX_BUNDLE_PLACEHOLDER}"
      ;;
    opencode)
      export PLUXX_OPENCODE_BUNDLE_URL="\${PLUXX_OPENCODE_BUNDLE_URL:-$base_url/OPENCODE_BUNDLE_PLACEHOLDER}"
      ;;
    *)
      echo "Unsupported target: $target" >&2
      exit 1
      ;;
  esac

  echo "Installing DISPLAY_PLACEHOLDER for $target..."
  curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$url" -o "$installer"
  verify_release_asset "$installer" "install-$target.sh"
  chmod +x "$installer"
  if [ "$yes" = "1" ]; then
    bash "$installer" --yes
  else
    bash "$installer"
  fi
}

for target in "\${targets[@]}"; do
  run_installer "$target"
done

echo "DISPLAY_PLACEHOLDER install complete."
`
}

function collectInstallerUserConfigEntries(config: PluginConfig, platforms: TargetPlatform[]) {
  const baseEntries = collectUserConfigEntries(config, platforms)
  return [
    ...baseEntries,
    ...collectNativeMcpAuthUserConfigEntries(config, platforms, baseEntries),
  ]
}

function renderInstallerUserConfigSnippet(config: PluginConfig, platform: TargetPlatform, installDirVariable: string): string {
  const runtimeEnvVars = [...collectRuntimeInheritedStdioEnvVars(config, [platform])]
  const runtimeEnvVarSet = new Set(runtimeEnvVars)
  const entries = collectInstallerUserConfigEntries(config, [platform])
    .map((entry) => ({
      key: entry.key,
      title: entry.title,
      type: entry.type ?? 'string',
      required: entry.required !== false,
      envVar: entry.envVar ?? defaultUserConfigEnvVar(entry.key),
    }))
    .filter((entry) => !runtimeEnvVarSet.has(entry.envVar))

  if (entries.length === 0) return ''
  const preserveSecretReferences = platform === 'codex'
  const runtimeEnvPattern = runtimeEnvVars.length > 0
    ? runtimeEnvVars.join('|')
    : '__PLUXX_NO_RUNTIME_ENV_MATCH__'

  const promptLines = entries.map((entry) => {
    const functionName = entry.type === 'secret' ? 'pluxx_prompt_secret_config' : 'pluxx_prompt_text_config'
    return `${functionName} ${JSON.stringify(entry.key)} ${JSON.stringify(entry.envVar)} ${JSON.stringify(entry.title)} ${entry.required ? '1' : '0'}`
  })

  return `
PLUXX_USER_CONFIG_SPEC="$(cat <<'PLUXX_USER_CONFIG_JSON'
${JSON.stringify(entries)}
PLUXX_USER_CONFIG_JSON
)"
PLUXX_REUSED_USER_CONFIG=0
PLUXX_PRESERVE_SECRET_REFS="${preserveSecretReferences ? '1' : '0'}"
PLUXX_RUNTIME_ENV_VARS='${JSON.stringify(runtimeEnvVars)}'
export PLUXX_PRESERVE_SECRET_REFS
export PLUXX_RUNTIME_ENV_VARS

pluxx_is_placeholder_secret() {
  case "$1" in
    *dummy*|*Dummy*|*DUMMY*|*placeholder*|*Placeholder*|*PLACEHOLDER*|*example*|*Example*|*EXAMPLE*|*changeme*|*CHANGE_ME*|*replace*me*|*Replace*Me*|*your*key*|*YOUR*KEY*|*api*key*here*|*API*KEY*HERE*|*token*here*|*TOKEN*HERE*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

pluxx_is_runtime_env_var() {
  case "$1" in
    ${runtimeEnvPattern})
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

pluxx_saved_config_value() {
  local key="$1"
  local env_var="$2"

  if pluxx_is_runtime_env_var "$env_var"; then
    return 1
  fi

  if [[ -z "\${PLUXX_SAVED_USER_CONFIG_PATH:-}" || ! -f "$PLUXX_SAVED_USER_CONFIG_PATH" ]]; then
    return 1
  fi

  PLUXX_SAVED_CONFIG_KEY="$key" PLUXX_SAVED_CONFIG_ENV_VAR="$env_var" node <<'NODE'
const fs = require('fs')

const filepath = process.env.PLUXX_SAVED_USER_CONFIG_PATH
const key = process.env.PLUXX_SAVED_CONFIG_KEY
const envVar = process.env.PLUXX_SAVED_CONFIG_ENV_VAR
const preserveSecretRefs = process.env.PLUXX_PRESERVE_SECRET_REFS === '1'

try {
  const payload = JSON.parse(fs.readFileSync(filepath, 'utf8'))
  const candidates = [
    payload && payload.env && envVar ? payload.env[envVar] : undefined,
    payload && payload.values && key ? payload.values[key] : undefined,
    preserveSecretRefs && payload && payload.envRefs && envVar && payload.envRefs[envVar] === envVar ? envVar : undefined,
  ]

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue
    if (!['string', 'number', 'boolean'].includes(typeof candidate)) continue
    const value = String(candidate)
    if (value === '') continue
    process.stdout.write(value)
    process.exit(0)
  }
} catch {}

process.exit(1)
NODE
}

pluxx_can_prompt_config() {
  [[ -r /dev/tty && -w /dev/tty ]] && { [[ -t 0 ]] || [[ -t 1 ]] || [[ -t 2 ]]; }
}

pluxx_prompt_secret_config() {
  local key="$1"
  local env_var="$2"
  local label="$3"
  local required="$4"
  local current_value="\${!env_var:-}"
  local saved_value_invalid=0

  if [[ -z "$current_value" && "\${PLUXX_RECONFIGURE:-0}" != "1" ]]; then
    local saved_value=""
    if saved_value="$(pluxx_saved_config_value "$key" "$env_var")"; then
      if pluxx_is_placeholder_secret "$saved_value"; then
        saved_value_invalid=1
        echo "Ignoring placeholder-looking saved config for $env_var." >&2
      else
        current_value="$saved_value"
        PLUXX_REUSED_USER_CONFIG=1
      fi
    fi
  fi

  if [[ -z "$current_value" && "$required" == "1" ]]; then
    if pluxx_can_prompt_config; then
      read -r -s -p "$label [$env_var]: " current_value </dev/tty
      echo >/dev/tty
    else
      if [[ "$saved_value_invalid" == "1" ]]; then
        echo "Refusing placeholder-looking saved config for $env_var. Set a real value and rerun the installer." >&2
      else
        echo "Missing required config: export $env_var before running this installer." >&2
      fi
      exit 1
    fi
  fi

  if [[ -n "$current_value" ]] && pluxx_is_placeholder_secret "$current_value"; then
    echo "Refusing placeholder-looking secret for $env_var. Set a real value and rerun the installer." >&2
    exit 1
  fi

  export "$env_var=$current_value"
}

pluxx_prompt_text_config() {
  local key="$1"
  local env_var="$2"
  local label="$3"
  local required="$4"
  local current_value="\${!env_var:-}"

  if [[ -z "$current_value" && "\${PLUXX_RECONFIGURE:-0}" != "1" ]]; then
    local saved_value=""
    if saved_value="$(pluxx_saved_config_value "$key" "$env_var")"; then
      current_value="$saved_value"
      PLUXX_REUSED_USER_CONFIG=1
    fi
  fi

  if [[ -z "$current_value" && "$required" == "1" ]]; then
    if pluxx_can_prompt_config; then
      read -r -p "$label [$env_var]: " current_value </dev/tty
    else
      echo "Missing required config: export $env_var before running this installer." >&2
      exit 1
    fi
  fi

  export "$env_var=$current_value"
}

${promptLines.join('\n')}

if [[ "$PLUXX_REUSED_USER_CONFIG" == "1" ]]; then
  echo "Found existing $PLUGIN_NAME config; reusing saved install values."
fi

export PLUXX_USER_CONFIG_SPEC
export PLUXX_INSTALL_DIR="${installDirVariable}"

node <<'NODE'
const fs = require('fs')
const path = require('path')

const installDir = process.env.PLUXX_INSTALL_DIR
const spec = JSON.parse(process.env.PLUXX_USER_CONFIG_SPEC || '[]')
const runtimeEnvVars = new Set(JSON.parse(process.env.PLUXX_RUNTIME_ENV_VARS || '[]'))
const preserveSecretReferences = ${preserveSecretReferences ? 'true' : 'false'}

if (installDir && spec.length > 0) {
  const env = {}
  const values = {}
  const envRefs = {}
  const secretKeys = []
  const secretEnv = []
  let hasSecret = false
  const secretEnvVars = new Set(
    spec
      .filter((entry) => entry && entry.type === 'secret' && typeof entry.envVar === 'string' && entry.envVar !== '')
      .map((entry) => entry.envVar),
  )

  for (const entry of spec) {
    if (entry.envVar && runtimeEnvVars.has(entry.envVar)) continue
    if (entry.type === 'secret') {
      hasSecret = true
      if (preserveSecretReferences) {
        if (entry.key) secretKeys.push(entry.key)
        if (entry.envVar) secretEnv.push(entry.envVar)
      }
    }
    const value = process.env[entry.envVar]
    if (value === undefined || value === '') continue
    if (preserveSecretReferences && entry.type === 'secret') {
      envRefs[entry.envVar] = entry.envVar
      continue
    }
    values[entry.key] = value
    env[entry.envVar] = value
  }

  const installedUserConfig = {
    ...(Object.keys(values).length > 0 ? { values } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(Object.keys(envRefs).length > 0 ? { envRefs } : {}),
    ...(hasSecret ? { secretStorage: preserveSecretReferences ? 'env-ref' : 'materialized' } : {}),
    ...(preserveSecretReferences && secretKeys.length > 0 ? { secretKeys: [...new Set(secretKeys)].sort() } : {}),
    ...(preserveSecretReferences && secretEnv.length > 0 ? { secretEnv: [...new Set(secretEnv)].sort() } : {}),
  }
  const hasInstalledUserConfig = Object.keys(installedUserConfig).length > 0

  if (hasInstalledUserConfig) {
    fs.writeFileSync(
      path.join(installDir, '.pluxx-user.json'),
      JSON.stringify(installedUserConfig, null, 2) + '\\n',
    )
  }

  const envScriptPath = path.join(installDir, 'scripts/check-env.sh')
  if (hasInstalledUserConfig && fs.existsSync(envScriptPath)) {
    fs.writeFileSync(
      envScriptPath,
      '#!/usr/bin/env bash\\nset -euo pipefail\\n# pluxx install materialized required config for this local plugin install.\\nexit 0\\n',
    )
  }

  const materialize = (value) =>
    typeof value === 'string'
      ? value.replace(
        /\\$\\{([A-Za-z_][A-Za-z0-9_]*)\\}/g,
        (_match, name) => (preserveSecretReferences && secretEnvVars.has(name) ? '${' + name + '}' : (env[name] || '${' + name + '}')),
      )
      : value

  const materializeRecord = (record) => {
    if (!record || typeof record !== 'object') return record
    const next = {}
    for (const [key, value] of Object.entries(record)) {
      next[key] = materialize(value)
    }
    return next
  }

  const materializeStdioEnvRecord = (record) => {
    if (!record || typeof record !== 'object') return undefined
    const next = {}
    for (const [key, value] of Object.entries(record)) {
      const runtimeReference = typeof value === 'string'
        ? value.match(/^\\$\\{([A-Za-z_][A-Za-z0-9_]*)\\}$/)
        : null
      if (runtimeReference && runtimeEnvVars.has(runtimeReference[1])) continue
      next[key] = materialize(value)
    }
    return Object.keys(next).length > 0 ? next : undefined
  }

  for (const relativePath of ['.mcp.json', 'mcp.json']) {
    const filepath = path.join(installDir, relativePath)
    if (!fs.existsSync(filepath)) continue

    const payload = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    for (const server of Object.values(payload.mcpServers || {})) {
      if (!server || typeof server !== 'object') continue
      const isStdio = typeof server.command === 'string' || Array.isArray(server.args)

      if (server.env) {
        if (isStdio) {
          const nextEnv = materializeStdioEnvRecord(server.env)
          if (nextEnv) server.env = nextEnv
          else delete server.env
        } else {
          server.env = materializeRecord(server.env)
        }
      }

      if (!preserveSecretReferences && server.bearer_token_env_var && env[server.bearer_token_env_var]) {
        server.http_headers = {
          ...(server.http_headers || {}),
          Authorization: 'Bearer ' + env[server.bearer_token_env_var],
        }
        delete server.bearer_token_env_var
      }

      if (!preserveSecretReferences && server.env_http_headers && typeof server.env_http_headers === 'object') {
        server.http_headers = {
          ...(server.http_headers || {}),
        }
        for (const [headerName, envVar] of Object.entries(server.env_http_headers)) {
          if (env[envVar]) server.http_headers[headerName] = env[envVar]
        }
        delete server.env_http_headers
      }

      if (server.headers) {
        server.headers = materializeRecord(server.headers)
      }
      if (server.http_headers) {
        server.http_headers = materializeRecord(server.http_headers)
      }
    }

    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2) + '\\n')
  }
}
NODE
`
}

function hasInstallerUserConfig(config: PluginConfig, platform: TargetPlatform): boolean {
  return collectInstallerUserConfigEntries(config, [platform]).length > 0
}

function renderInstallerSavedUserConfigCaptureSnippet(config: PluginConfig, platform: TargetPlatform, installDirVariable: string): string {
  if (!hasInstallerUserConfig(config, platform)) return ''

  return `
PLUXX_SAVED_USER_CONFIG_PATH=""
if [[ "\${PLUXX_RECONFIGURE:-0}" != "1" && -f "${installDirVariable}/.pluxx-user.json" ]]; then
  PLUXX_SAVED_USER_CONFIG_PATH="$TMP_DIR/pluxx-saved-user-config.json"
  cp "${installDirVariable}/.pluxx-user.json" "$PLUXX_SAVED_USER_CONFIG_PATH"
fi
export PLUXX_SAVED_USER_CONFIG_PATH
`
}

function renderInstallerMcpPathMaterializationSnippet(platform: TargetPlatform, installDirVariable: string, runtimeRootVariable = installDirVariable): string {
  if (platform !== 'codex') return ''

  return `
export PLUXX_INSTALL_DIR="${installDirVariable}"
export PLUXX_RUNTIME_ROOT="${runtimeRootVariable}"

node <<'NODE'
const fs = require('fs')
const path = require('path')

const installDir = process.env.PLUXX_INSTALL_DIR
const runtimeRoot = process.env.PLUXX_RUNTIME_ROOT || installDir

if (installDir) {
  const materializeInstalledStdioPath = (value) => {
    if (typeof value !== 'string') return value

    const normalized = value.replace(/\\\\/g, '/')
    const rootRef = normalized.match(/^\\$\\{(?:CLAUDE_PLUGIN_ROOT|CURSOR_PLUGIN_ROOT|PLUGIN_ROOT)\\}[\\\\/](.+)$/)

    if (rootRef) {
      return path.resolve(runtimeRoot, rootRef[1])
    }

    if (normalized.startsWith('./') || normalized.startsWith('../')) {
      return path.resolve(runtimeRoot, normalized)
    }

    return value
  }

  for (const relativePath of ['.mcp.json', 'mcp.json']) {
    const filepath = path.join(installDir, relativePath)
    if (!fs.existsSync(filepath)) continue

    const payload = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    let changed = false

    for (const server of Object.values(payload.mcpServers || {})) {
      if (!server || typeof server !== 'object') continue

      if (typeof server.command === 'string') {
        const nextCommand = materializeInstalledStdioPath(server.command)
        changed ||= nextCommand !== server.command
        server.command = nextCommand
      }

      if (Array.isArray(server.args)) {
        const nextArgs = server.args.map(materializeInstalledStdioPath)
        changed ||= nextArgs.some((value, index) => value !== server.args[index])
        server.args = nextArgs
      }
    }

    if (changed) {
      fs.writeFileSync(filepath, JSON.stringify(payload, null, 2) + '\\n')
    }
  }
}
NODE
`
}

function renderInstallerRuntimeBootstrapSnippet(installDirVariable: string): string {
  return `
if [[ -f "${installDirVariable}/.pluxx-runtime.json" || -f "${installDirVariable}/scripts/bootstrap-runtime.sh" ]]; then
  export PLUXX_RUNTIME_CANDIDATE_ROOT="${installDirVariable}"
  export PLUXX_RUNTIME_STORE_ROOT="\${PLUXX_RUNTIME_STORE_ROOT:-$HOME/.pluxx/runtimes}"
  export PLUGIN_NAME PLUXX_TX_PLATFORM

  node <<'NODE'
const crypto = require('crypto')
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')

const candidateRoot = process.env.PLUXX_RUNTIME_CANDIDATE_ROOT
const pluginName = process.env.PLUGIN_NAME || 'unknown-plugin'
const installerPlatform = process.env.PLUXX_TX_PLATFORM || 'unknown-platform'
const contractVersion = 'pluxx.shared-native-runtime.v1'
if (!candidateRoot || !process.env.PLUXX_RUNTIME_STORE_ROOT) process.exit(2)

const configPath = path.join(candidateRoot, '.pluxx-runtime.json')
let bootstrapRelativePath = 'scripts/bootstrap-runtime.sh'
const bootstrapFailure = (status) => {
  const error = new Error('Runtime bootstrap failed with exit status ' + status + '.')
  error.exitStatus = status || 1
  return error
}
process.on('uncaughtException', (error) => {
  console.error(error && error.stack ? error.stack : String(error))
  process.exitCode = Number.isInteger(error && error.exitStatus) ? error.exitStatus : 1
})
const bootstrapLocal = () => {
  console.log('Preparing local plugin runtime dependencies...')
  const result = childProcess.spawnSync('bash', [path.join(candidateRoot, bootstrapRelativePath)], {
    cwd: candidateRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw bootstrapFailure(result.status)
}

if (!fs.existsSync(configPath)) {
  bootstrapLocal()
  process.exit(0)
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const isSafeRelativePath = (value) => typeof value === 'string'
  && value.length > 0
  && !path.isAbsolute(value)
  && !value.replace(/\\\\/g, '/').split('/').includes('..')
if (config.schema !== 'pluxx.shared-runtime-config.v1'
  || config.namespace !== pluginName
  || !isSafeRelativePath(config.bootstrap)
  || !isSafeRelativePath(config.output)
  || path.normalize(config.output) === '.'
  || !Array.isArray(config.inputs)
  || config.inputs.length === 0
  || !config.inputs.every(isSafeRelativePath)) {
  throw new Error('Invalid .pluxx-runtime.json shared runtime contract.')
}
const hasDeclaredLockfile = config.inputs.some((relativePath) => {
  const basename = path.basename(relativePath).toLowerCase()
  return basename === 'bun.lockb' || /(?:^|[-_.])(lock|lockfile|shrinkwrap)(?:[-_.]|$)/.test(basename)
})
if (!hasDeclaredLockfile) {
  console.error('Shared runtime inputs do not declare a deterministic lockfile; preparing runtime in the host bundle instead.')
  bootstrapRelativePath = config.bootstrap
  bootstrapLocal()
  process.exit(0)
}
const resolvedOutput = path.resolve(candidateRoot, config.output)
for (const runtimeInput of [config.bootstrap, ...config.inputs]) {
  const resolvedInput = path.resolve(candidateRoot, runtimeInput)
  const relativeToOutput = path.relative(resolvedOutput, resolvedInput)
  if (relativeToOutput === '' || (!relativeToOutput.startsWith('..') && !path.isAbsolute(relativeToOutput))) {
    throw new Error('Shared runtime output must not contain its bootstrap or declared inputs.')
  }
}
bootstrapRelativePath = config.bootstrap

const inputPaths = [...new Set([config.bootstrap, ...config.inputs])].sort()
const digest = crypto.createHash('sha256')
digest.update(contractVersion + '\\0' + process.platform + '\\0' + process.arch + '\\0' + (process.versions.modules || 'unknown-node-abi') + '\\0')
digest.update(JSON.stringify(config) + '\\0')
for (const relativePath of inputPaths) {
  const filepath = path.resolve(candidateRoot, relativePath)
  const relative = path.relative(candidateRoot, filepath)
  const stats = fs.lstatSync(filepath)
  if (relative.startsWith('..') || !stats.isFile() || stats.isSymbolicLink()) {
    throw new Error('Shared runtime input must be a regular file inside the bundle: ' + relativePath)
  }
  digest.update(relativePath + '\\0')
  digest.update(fs.readFileSync(filepath))
  digest.update('\\0')
}

const fingerprint = digest.digest('hex')
fs.mkdirSync(process.env.PLUXX_RUNTIME_STORE_ROOT, { recursive: true, mode: 0o700 })
fs.chmodSync(process.env.PLUXX_RUNTIME_STORE_ROOT, 0o700)
const storeRoot = fs.realpathSync(process.env.PLUXX_RUNTIME_STORE_ROOT)
const entryRoot = path.join(storeRoot, 'entries', fingerprint)
const generationsRoot = path.join(entryRoot, 'generations')
const currentPath = path.join(entryRoot, 'current')
const lockPath = path.join(storeRoot, 'locks', fingerprint + '.lock')
const stageRoot = path.join(storeRoot, 'staging', fingerprint + '-' + process.pid + '-' + crypto.randomBytes(6).toString('hex'))
const makeTreeWritable = (filepath) => {
  if (!fs.existsSync(filepath)) return
  const stats = fs.lstatSync(filepath)
  if (stats.isSymbolicLink()) return
  fs.chmodSync(filepath, stats.isDirectory() ? 0o700 : (stats.mode | 0o600))
  if (stats.isDirectory()) for (const entry of fs.readdirSync(filepath)) makeTreeWritable(path.join(filepath, entry))
}
const removeTree = (filepath) => {
  makeTreeWritable(filepath)
  fs.rmSync(filepath, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
}
for (const directory of [path.dirname(entryRoot), generationsRoot, path.dirname(lockPath), path.dirname(stageRoot)]) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
}

const sleep = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
const processAlive = (pid) => {
  try { process.kill(pid, 0); return true } catch (error) { return error && error.code === 'EPERM' }
}
let ownedLockNonce
const releaseLock = () => {
  if (!ownedLockNonce) return
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(lockPath, 'owner.json'), 'utf8'))
    if (owner.nonce === ownedLockNonce) removeTree(lockPath)
  } catch {}
  ownedLockNonce = undefined
}
const acquireLock = () => {
  const timeoutMs = Math.max(0, Number(process.env.PLUXX_RUNTIME_LOCK_TIMEOUT_SECONDS || 120) * 1000)
  const started = Date.now()
  while (true) {
    const candidateLock = lockPath + '.candidate-' + process.pid + '-' + crypto.randomBytes(4).toString('hex')
    try {
      const nonce = crypto.randomBytes(16).toString('hex')
      fs.mkdirSync(candidateLock, { mode: 0o700 })
      fs.writeFileSync(path.join(candidateLock, 'owner.json'), JSON.stringify({ pid: process.pid, nonce, startedAt: new Date().toISOString() }) + '\\n', { mode: 0o600 })
      fs.renameSync(candidateLock, lockPath)
      ownedLockNonce = nonce
      return true
    } catch (error) {
      removeTree(candidateLock)
      if (!error || !['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error
      let stale = false
      try {
        const owner = JSON.parse(fs.readFileSync(path.join(lockPath, 'owner.json'), 'utf8'))
        stale = !Number.isInteger(owner.pid) || owner.pid <= 0 || !processAlive(owner.pid)
      } catch {
        try { stale = Date.now() - fs.statSync(lockPath).mtimeMs > 2000 } catch { stale = true }
      }
      if (stale) {
        const recoveryLock = lockPath + '.recovery'
        let recoveryAcquired = false
        let staleLockRemoved = false
        try {
          fs.mkdirSync(recoveryLock, { mode: 0o700 })
          recoveryAcquired = true
          let stillStale = false
          try {
            const owner = JSON.parse(fs.readFileSync(path.join(lockPath, 'owner.json'), 'utf8'))
            stillStale = !Number.isInteger(owner.pid) || owner.pid <= 0 || !processAlive(owner.pid)
          } catch {
            try { stillStale = Date.now() - fs.statSync(lockPath).mtimeMs > 2000 } catch { stillStale = false }
          }
          if (stillStale) {
            removeTree(lockPath)
            staleLockRemoved = true
          }
        } catch (recoveryError) {
          if (!recoveryError || recoveryError.code !== 'EEXIST') throw recoveryError
        } finally {
          if (recoveryAcquired) try { fs.rmdirSync(recoveryLock) } catch {}
        }
        if (staleLockRemoved) continue
      }
      if (Date.now() - started >= timeoutMs) return false
      sleep(250)
    }
  }
}

const outputWithin = (root, filepath) => {
  const relative = path.relative(root, filepath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
const collectMetadata = (root) => {
  const entries = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const filepath = path.join(directory, entry.name)
      const relativePath = path.relative(root, filepath).replace(/\\\\/g, '/')
      const stats = fs.lstatSync(filepath)
      if (stats.isSymbolicLink()) {
        const resolved = fs.realpathSync(filepath)
        if (!outputWithin(root, resolved)) throw new Error('Shared runtime symlink escapes its output: ' + relativePath)
        entries.push({ path: relativePath, kind: 'symlink', target: fs.readlinkSync(filepath) })
      } else if (stats.isDirectory()) {
        visit(filepath)
      } else if (stats.isFile()) {
        entries.push({ path: relativePath, kind: 'file', size: stats.size, mtimeMs: stats.mtimeMs, mode: stats.mode & 0o777 })
      } else {
        throw new Error('Unsupported shared runtime entry: ' + relativePath)
      }
    }
  }
  visit(root)
  return entries
}
const harden = (root) => {
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filepath = path.join(directory, entry.name)
      const stats = fs.lstatSync(filepath)
      if (stats.isSymbolicLink()) continue
      if (stats.isDirectory()) { visit(filepath); fs.chmodSync(filepath, stats.mode & ~0o222) }
      else if (stats.isFile()) fs.chmodSync(filepath, stats.mode & ~0o222)
    }
  }
  visit(root)
  fs.chmodSync(root, fs.statSync(root).mode & ~0o222)
}
const readCurrentGeneration = () => {
  try {
    if (!fs.lstatSync(currentPath).isSymbolicLink()) return undefined
    const target = fs.readlinkSync(currentPath)
    const generation = path.resolve(entryRoot, target)
    if (!outputWithin(generationsRoot, generation) || generation === generationsRoot) return undefined
    const manifest = JSON.parse(fs.readFileSync(path.join(generation, 'manifest.json'), 'utf8'))
    const outputRoot = path.join(generation, config.output)
    const outputStats = fs.lstatSync(outputRoot)
    if (!outputStats.isDirectory() || outputStats.isSymbolicLink()) return undefined
    if (manifest.schema !== contractVersion
      || manifest.fingerprint !== fingerprint
      || manifest.namespace !== pluginName
      || manifest.platform !== process.platform
      || manifest.arch !== process.arch
      || manifest.nodeAbi !== (process.versions.modules || 'unknown-node-abi')
      || JSON.stringify(collectMetadata(outputRoot)) !== JSON.stringify(manifest.entries)) return undefined
    return generation
  } catch { return undefined }
}
const buildGeneration = (repairing) => {
  console.log((repairing ? 'Repairing incomplete Pluxx native runtime ' : 'Preparing shared Pluxx native runtime ') + fingerprint + '.')
  removeTree(stageRoot)
  fs.cpSync(candidateRoot, stageRoot, { recursive: true })
  const stageOutput = path.join(stageRoot, config.output)
  fs.rmSync(stageOutput, { recursive: true, force: true })
  const bootstrapPath = path.join(stageRoot, config.bootstrap)
  const result = childProcess.spawnSync('bash', [bootstrapPath], { cwd: stageRoot, env: process.env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw bootstrapFailure(result.status)
  const outputStats = fs.lstatSync(stageOutput)
  if (!outputStats.isDirectory() || outputStats.isSymbolicLink()) throw new Error('Shared runtime bootstrap did not create the configured output directory.')
  collectMetadata(stageOutput)
  const generation = path.join(generationsRoot, Date.now() + '-' + process.pid + '-' + crypto.randomBytes(5).toString('hex'))
  fs.mkdirSync(generation, { recursive: true, mode: 0o700 })
  const generationOutput = path.join(generation, config.output)
  fs.mkdirSync(path.dirname(generationOutput), { recursive: true })
  fs.renameSync(stageOutput, generationOutput)
  harden(generationOutput)
  const manifest = {
    schema: contractVersion,
    fingerprint,
    namespace: pluginName,
    platform: process.platform,
    arch: process.arch,
    nodeAbi: process.versions.modules || 'unknown-node-abi',
    preparedBy: installerPlatform,
    entries: collectMetadata(generationOutput),
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(generation, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\\n', { mode: 0o444 })
  const nextCurrent = path.join(entryRoot, '.current-' + process.pid + '-' + crypto.randomBytes(5).toString('hex'))
  fs.symlinkSync(path.relative(entryRoot, generation), nextCurrent, 'dir')
  fs.renameSync(nextCurrent, currentPath)
  removeTree(stageRoot)
  return generation
}

if (!acquireLock()) {
  console.error('Could not acquire shared runtime lock for ' + fingerprint + '; preparing runtime in the host bundle instead.')
  bootstrapLocal()
  process.exit(0)
}

try {
  let generation = readCurrentGeneration()
  if (generation) console.log('Reusing prepared Pluxx native runtime ' + fingerprint + '.')
  else generation = buildGeneration(fs.existsSync(currentPath))

  const candidateOutput = path.join(candidateRoot, config.output)
  fs.rmSync(candidateOutput, { recursive: true, force: true })
  let leasePath
  try {
    if (process.env.PLUXX_RUNTIME_DISABLE_LINK === '1') throw new Error('shared runtime linking is disabled')
    fs.mkdirSync(path.dirname(candidateOutput), { recursive: true })
    fs.symlinkSync(path.join(entryRoot, 'current', config.output), candidateOutput, 'dir')
    const leaseRoot = path.join(storeRoot, 'leases', fingerprint)
    fs.mkdirSync(leaseRoot, { recursive: true, mode: 0o700 })
    leasePath = path.join(leaseRoot, process.ppid + '-' + crypto.randomBytes(6).toString('hex') + '.json')
    fs.writeFileSync(leasePath, JSON.stringify({
      schema: 'pluxx.shared-native-runtime-lease.v1',
      fingerprint,
      ownerPid: process.ppid,
      createdAt: new Date().toISOString(),
    }) + '\\n', { mode: 0o600, flag: 'wx' })
    fs.writeFileSync(path.join(candidateRoot, '.pluxx-runtime-ref.json'), JSON.stringify({
      schema: 'pluxx.shared-native-runtime-ref-candidate.v1',
      storeRoot,
      fingerprint,
      runtimeEntry: path.join(entryRoot, 'current'),
      leasePath,
    }, null, 2) + '\\n', { mode: 0o600 })
  } catch (error) {
    console.error('Could not link the shared runtime; preparing runtime in the host bundle instead: ' + error.message)
    if (leasePath) fs.rmSync(leasePath, { force: true })
    fs.rmSync(candidateOutput, { recursive: true, force: true })
    bootstrapLocal()
  }
} finally {
  removeTree(stageRoot)
  releaseLock()
}
NODE
fi
`
}

function renderInstallerCodexAgentRegistrationSnippet(installDirVariable: string): string {
  return `
export PLUXX_INSTALL_DIR="${installDirVariable}"
export PLUXX_CODEX_HOME_DIR="\${CODEX_HOME:-$HOME/.codex}"
export PLUGIN_NAME

node <<'NODE'
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const installDir = process.env.PLUXX_INSTALL_DIR
const codexHome = process.env.PLUXX_CODEX_HOME_DIR
const pluginName = process.env.PLUGIN_NAME
if (!installDir || !codexHome || !pluginName) process.exit(0)
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pluginName)) {
  throw new Error('Cannot register Codex agents for an invalid plugin name.')
}

fs.rmSync(path.join(codexHome, 'plugins/cache/local-plugins', pluginName), {
  recursive: true,
  force: true,
})

const sourceRoot = path.join(installDir, '.codex/agents')
const globalAgentRoot = path.join(codexHome, 'agents')
const agentRoot = path.join(globalAgentRoot, pluginName)
const ownershipPath = path.join(codexHome, 'pluxx/agent-installs', pluginName + '.json')
const ownershipSchema = 'pluxx.codex-agent-install.v1'

const walkToml = (root) => {
  if (!fs.existsSync(root)) return []
  const files = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const filepath = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...walkToml(filepath))
    else if (entry.isFile() && entry.name.endsWith('.toml')) files.push(filepath)
  }
  return files.sort()
}

const hash = (content) => crypto.createHash('sha256').update(content).digest('hex')
const readString = (content, key) => {
  const match = content.match(new RegExp('^\\\\s*' + key + '\\\\s*=\\\\s*("(?:\\\\\\\\.|[^"\\\\\\\\])*")', 'm'))
  if (!match) return undefined
  try { return JSON.parse(match[1]) } catch { return undefined }
}
const hasAssignment = (content, key) => new RegExp('^\\\\s*' + key + '\\\\s*=', 'm').test(content)
const safeRelative = (value) => {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) return false
  const normalized = value.replace(/\\\\/g, '/')
  return normalized !== '..' && !normalized.startsWith('../') && !normalized.includes('/../')
}
const resolveAgentPath = (relativePath) => {
  if (!safeRelative(relativePath)) throw new Error('Unsafe Codex agent ownership path: ' + relativePath)
  const filepath = path.resolve(agentRoot, relativePath)
  if (filepath === agentRoot || !filepath.startsWith(agentRoot + path.sep)) {
    throw new Error('Unsafe Codex agent ownership path: ' + relativePath)
  }
  return filepath
}

const agents = []
const sourceNames = new Set()
for (const sourcePath of walkToml(sourceRoot)) {
  const content = fs.readFileSync(sourcePath, 'utf8')
  const name = readString(content, 'name')
  const description = readString(content, 'description')
  if (!name || !description || !hasAssignment(content, 'developer_instructions')) {
    throw new Error('Invalid Codex custom agent at ' + sourcePath + ': name, description, and developer_instructions are required.')
  }
  if (sourceNames.has(name)) throw new Error('Duplicate bundled Codex agent name: ' + name)
  sourceNames.add(name)
  const relativePath = path.relative(sourceRoot, sourcePath).replace(/\\\\/g, '/')
  agents.push({ name, relativePath, content, sha256: hash(content) })
}

let previous = { schema: ownershipSchema, pluginName, agents: [] }
if (fs.existsSync(ownershipPath)) {
  previous = JSON.parse(fs.readFileSync(ownershipPath, 'utf8'))
  if (previous.schema !== ownershipSchema || previous.pluginName !== pluginName || !Array.isArray(previous.agents)) {
    throw new Error('Invalid Codex agent ownership record: ' + ownershipPath)
  }
  for (const agent of previous.agents) {
    if (!agent || typeof agent.name !== 'string' || !safeRelative(agent.relativePath) || !/^[a-f0-9]{64}$/.test(agent.sha256 || '')) {
      throw new Error('Invalid Codex agent ownership entry: ' + ownershipPath)
    }
  }
}

const replaceableOwnedPaths = new Set()
for (const agent of previous.agents) {
  const ownedPath = resolveAgentPath(agent.relativePath)
  if (!fs.existsSync(ownedPath)) continue
  if (hash(fs.readFileSync(ownedPath, 'utf8')) === agent.sha256) {
    replaceableOwnedPaths.add(ownedPath)
  }
}

const expectedPaths = new Map(agents.map((agent) => [agent.name, resolveAgentPath(agent.relativePath)]))
for (const filepath of walkToml(globalAgentRoot)) {
  if (replaceableOwnedPaths.has(filepath)) continue
  const name = readString(fs.readFileSync(filepath, 'utf8'), 'name')
  const expectedPath = expectedPaths.get(name)
  if (expectedPath && filepath !== expectedPath) {
    throw new Error('Codex agent name collision for "' + name + '": ' + filepath)
  }
}

const previousByPath = new Map(previous.agents.map((agent) => [agent.relativePath, agent]))
for (const agent of agents) {
  const destination = resolveAgentPath(agent.relativePath)
  if (fs.existsSync(destination)) {
    const currentHash = hash(fs.readFileSync(destination, 'utf8'))
    const owned = previousByPath.get(agent.relativePath)
    if (currentHash !== agent.sha256 && (!owned || owned.sha256 !== currentHash)) {
      throw new Error('Refusing to replace modified or unowned Codex agent "' + agent.name + '" at ' + destination)
    }
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, agent.content)
}

const nextPaths = new Set(agents.map((agent) => agent.relativePath))
let removed = 0
for (const owned of previous.agents) {
  if (nextPaths.has(owned.relativePath)) continue
  const destination = resolveAgentPath(owned.relativePath)
  if (!fs.existsSync(destination)) continue
  if (hash(fs.readFileSync(destination, 'utf8')) === owned.sha256) {
    fs.rmSync(destination, { force: true })
    removed += 1
  } else {
    console.warn('Preserved user-modified Codex agent at ' + destination)
  }
}

if (agents.length > 0) {
  fs.mkdirSync(path.dirname(ownershipPath), { recursive: true })
  fs.writeFileSync(ownershipPath, JSON.stringify({
    schema: ownershipSchema,
    pluginName,
    agents: agents.map(({ name, relativePath, sha256 }) => ({ name, relativePath, sha256 })),
  }, null, 2) + '\\n')
} else {
  fs.rmSync(ownershipPath, { force: true })
}

if (agents.length > 0 || removed > 0) {
  console.log('Registered ' + agents.length + ' Codex custom agent(s) under ' + agentRoot + (removed ? '; removed ' + removed + ' stale owned registration(s)' : ''))
}
NODE
`
}

function renderInstallerCodexPluginHooksSnippet(installDirVariable: string): string {
  return `
export PLUXX_INSTALL_DIR="${installDirVariable}"

trap - ERR
set +e
node <<'NODE'
const fs = require('fs')
const path = require('path')

const installDir = process.env.PLUXX_INSTALL_DIR
if (!installDir) process.exit(0)

const manifestPath = path.join(installDir, '.codex-plugin/plugin.json')
const standardHooksPath = path.join(installDir, 'hooks/hooks.json')
let hasPluginHooks = fs.existsSync(standardHooksPath)

if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const manifestHooks = manifest.hooks
    hasPluginHooks ||= typeof manifestHooks === 'string' && manifestHooks.trim().length > 0
    hasPluginHooks ||= Array.isArray(manifestHooks) && manifestHooks.length > 0
    hasPluginHooks ||= manifestHooks && typeof manifestHooks === 'object' && Object.keys(manifestHooks).length > 0
    hasPluginHooks ||= manifestHooks === true
  } catch {}
}

process.exit(hasPluginHooks ? 0 : 2)
NODE
PLUXX_CODEX_BUNDLE_HAS_HOOKS="$?"
set -e
trap rollback_install ERR

if [[ "$PLUXX_CODEX_BUNDLE_HAS_HOOKS" == "0" ]]; then
  CODEX_HOME_DIR="\${CODEX_HOME:-$HOME/.codex}"
  CODEX_CONFIG_PATH="\${PLUXX_CODEX_CONFIG_PATH:-$CODEX_HOME_DIR/config.toml}"
  PLUXX_CODEX_HOOKS_MODE="\${PLUXX_CODEX_ENABLE_PLUGIN_HOOKS:-prompt}"

  export CODEX_CONFIG_PATH
  if node <<'NODE'
const fs = require('fs')
const filepath = process.env.CODEX_CONFIG_PATH

function stripTomlComment(line) {
  let quote = null
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (quote && char === '\\\\') {
      escaped = true
      continue
    }
    if (char === '"' || char === "'") {
      quote = quote === char ? null : quote || char
      continue
    }
    if (!quote && char === '#') return line.slice(0, index)
  }
  return line
}

function isTomlTrue(rawValue) {
  return /^true\\b/i.test(rawValue.trim())
}

let text = ''
try {
  text = fs.readFileSync(filepath, 'utf8')
} catch {
  process.exit(1)
}
const lines = text.split(/\\r?\\n/)
let tableName = ''
for (const line of lines) {
  const trimmed = stripTomlComment(line).trim()
  if (!trimmed) continue
  const tableMatch = trimmed.match(/^\\[([^\\]]+)\\]$/)
  if (tableMatch) {
    tableName = tableMatch[1].trim()
    continue
  }
  if (tableName === '') {
    const dottedMatch = trimmed.match(/^features\\.hooks\\s*=\\s*(.+)$/)
    if (dottedMatch && isTomlTrue(dottedMatch[1])) process.exit(0)
    const inlineMatch = trimmed.match(/^features\\s*=\\s*(.+)$/)
    if (inlineMatch && /\\bhooks\\s*=\\s*true\\b/i.test(inlineMatch[1])) process.exit(0)
  }
  if (tableName !== 'features') continue
  const match = trimmed.match(/^hooks\\s*=\\s*(.+)$/)
  if (match && isTomlTrue(match[1])) process.exit(0)
}
process.exit(1)
NODE
  then
    echo "Codex plugin-bundled hooks already enabled in $CODEX_CONFIG_PATH."
  else
    PLUXX_ENABLE_CODEX_HOOKS="0"
    case "$PLUXX_CODEX_HOOKS_MODE" in
      1|true|TRUE|yes|YES|always|ALWAYS)
        PLUXX_ENABLE_CODEX_HOOKS="1"
        ;;
      0|false|FALSE|no|NO|never|NEVER|skip|SKIP)
        PLUXX_ENABLE_CODEX_HOOKS="0"
        ;;
      *)
        if [[ -r /dev/tty ]]; then
          echo "This Codex plugin bundle includes startup hooks." >/dev/tty
          echo "Codex requires [features].hooks = true before plugin-bundled hooks can run." >/dev/tty
          read -r -p "Enable Codex plugin-bundled hooks in $CODEX_CONFIG_PATH now? [Y/n] " PLUXX_CODEX_HOOKS_REPLY </dev/tty
          case "$PLUXX_CODEX_HOOKS_REPLY" in
            n|N|no|NO)
              PLUXX_ENABLE_CODEX_HOOKS="0"
              ;;
            *)
              PLUXX_ENABLE_CODEX_HOOKS="1"
              ;;
          esac
        fi
        ;;
    esac

    if [[ "$PLUXX_ENABLE_CODEX_HOOKS" == "1" ]]; then
      mkdir -p "$(dirname "$CODEX_CONFIG_PATH")"
      node <<'NODE'
const fs = require('fs')
const path = require('path')

const filepath = process.env.CODEX_CONFIG_PATH

function stripTomlComment(line) {
  let quote = null
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (quote && char === '\\\\') {
      escaped = true
      continue
    }
    if (char === '"' || char === "'") {
      quote = quote === char ? null : quote || char
      continue
    }
    if (!quote && char === '#') return line.slice(0, index)
  }
  return line
}

let text = ''
try {
  text = fs.readFileSync(filepath, 'utf8')
} catch {}

const lines = text.split(/\\r?\\n/)
if (lines.length === 1 && lines[0] === '') lines.pop()

let start = -1
let end = lines.length
let firstTopLevelFeaturesDotted = -1
let topLevelPluginHooksDotted = -1
let topLevelInlineFeatures = -1
let tableName = ''
for (let index = 0; index < lines.length; index += 1) {
  const trimmed = stripTomlComment(lines[index]).trim()
  const tableMatch = trimmed.match(/^\\[([^\\]]+)\\]$/)
  if (tableMatch) tableName = tableMatch[1].trim()

  if (trimmed === '[features]') {
    start = index
    break
  }

  if (tableName === '') {
    if (/^features\\.[A-Za-z0-9_-]+\\s*=/.test(trimmed) && firstTopLevelFeaturesDotted < 0) {
      firstTopLevelFeaturesDotted = index
    }
    if (/^features\\.hooks\\s*=/.test(trimmed)) {
      topLevelPluginHooksDotted = index
    }
    if (/^features\\s*=\\s*\\{/.test(trimmed)) {
      topLevelInlineFeatures = index
    }
  }
}

if (start >= 0) {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\\s*\\[[^\\]]+\\]/.test(stripTomlComment(lines[index]))) {
      end = index
      break
    }
  }

  let updated = false
  for (let index = start + 1; index < end; index += 1) {
    if (/^hooks\\s*=/.test(stripTomlComment(lines[index]).trim())) {
      lines[index] = 'hooks = true'
      updated = true
    }
  }
  if (!updated) lines.splice(start + 1, 0, 'hooks = true')
} else if (topLevelPluginHooksDotted >= 0) {
  lines[topLevelPluginHooksDotted] = 'features.hooks = true'
} else if (firstTopLevelFeaturesDotted >= 0) {
  lines.splice(firstTopLevelFeaturesDotted + 1, 0, 'features.hooks = true')
} else if (topLevelInlineFeatures >= 0 && lines[topLevelInlineFeatures].includes('}')) {
  if (/\\bhooks\\s*=/.test(lines[topLevelInlineFeatures])) {
    lines[topLevelInlineFeatures] = lines[topLevelInlineFeatures].replace(
      /\\bhooks\\s*=\\s*(true|false)\\b/i,
      'hooks = true',
    )
  } else {
    lines[topLevelInlineFeatures] = lines[topLevelInlineFeatures].replace(/}/, ', hooks = true }')
  }
} else {
  if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('')
  lines.push('[features]', 'hooks = true')
}

fs.mkdirSync(path.dirname(filepath), { recursive: true })
fs.writeFileSync(filepath, lines.join('\\n') + '\\n')
NODE
      echo "Enabled Codex plugin-bundled hooks in $CODEX_CONFIG_PATH."
      echo "Restart or refresh Codex before relying on plugin startup hooks."
    else
      echo "Codex plugin-bundled hooks are not enabled. Startup hooks from this plugin will not run until you add this to $CODEX_CONFIG_PATH:" >&2
      echo "[features]" >&2
      echo "hooks = true" >&2
      echo "Then restart or refresh Codex before relying on plugin startup hooks." >&2
      echo "Set PLUXX_CODEX_ENABLE_PLUGIN_HOOKS=1 before running this installer to enable it noninteractively." >&2
    fi
  fi
fi
`
}

function renderReleaseAssetVerificationSnippet(args: {
  archiveVariable: string
  bundlePathVariable: string
  expectedArchiveName: string
  expectedPlatform: TargetPlatform
}): string {
  return `
RELEASE_BASE_URL="\${PLUXX_RELEASE_BASE_URL:-https://github.com/\${REPO}/releases/download/vVERSION_PLACEHOLDER}"
RELEASE_MANIFEST_PATH="\${PLUXX_RELEASE_MANIFEST_PATH:-}"
RELEASE_CHECKSUMS_PATH="\${PLUXX_RELEASE_CHECKSUMS_PATH:-}"

if [[ -n "${args.bundlePathVariable}" ]]; then
  LOCAL_RELEASE_DIR="$(dirname "${args.bundlePathVariable}")"
  RELEASE_MANIFEST_PATH="\${RELEASE_MANIFEST_PATH:-$LOCAL_RELEASE_DIR/release-manifest.json}"
  RELEASE_CHECKSUMS_PATH="\${RELEASE_CHECKSUMS_PATH:-$LOCAL_RELEASE_DIR/SHA256SUMS.txt}"
fi

RELEASE_MANIFEST="$TMP_DIR/release-manifest.json"
RELEASE_CHECKSUMS="$TMP_DIR/SHA256SUMS.txt"

if [[ -n "$RELEASE_MANIFEST_PATH" ]]; then
  cp "$RELEASE_MANIFEST_PATH" "$RELEASE_MANIFEST"
else
  curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$RELEASE_BASE_URL/release-manifest.json" -o "$RELEASE_MANIFEST"
fi

if [[ -n "$RELEASE_CHECKSUMS_PATH" ]]; then
  cp "$RELEASE_CHECKSUMS_PATH" "$RELEASE_CHECKSUMS"
else
  curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$RELEASE_BASE_URL/SHA256SUMS.txt" -o "$RELEASE_CHECKSUMS"
fi

verify_release_asset() {
  local filepath="$1"
  local asset_name="$2"
  PLUXX_VERIFY_FILE="$filepath" PLUXX_VERIFY_NAME="$asset_name" PLUXX_VERIFY_SUMS="$RELEASE_CHECKSUMS" node <<'NODE'
const crypto = require('crypto')
const fs = require('fs')

const filepath = process.env.PLUXX_VERIFY_FILE
const assetName = process.env.PLUXX_VERIFY_NAME
const sumsPath = process.env.PLUXX_VERIFY_SUMS
const lines = fs.readFileSync(sumsPath, 'utf8').split(/\\r?\\n/)
const match = lines.map((line) => line.match(/^([a-f0-9]{64})  (.+)$/)).find((entry) => entry && entry[2] === assetName)
if (!match) throw new Error('Release checksum inventory does not include ' + assetName)
const actual = crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex')
if (actual !== match[1]) throw new Error('Checksum mismatch for ' + assetName)
NODE
}

verify_release_asset "$RELEASE_MANIFEST" "release-manifest.json"
verify_release_asset "${args.archiveVariable}" "${args.expectedArchiveName}"

PLUXX_RELEASE_MANIFEST="$RELEASE_MANIFEST" PLUXX_EXPECTED_PLUGIN="$PLUGIN_NAME" PLUXX_EXPECTED_PLATFORM="${args.expectedPlatform}" PLUXX_EXPECTED_VERSION="VERSION_PLACEHOLDER" node <<'NODE'
const fs = require('fs')
const manifest = JSON.parse(fs.readFileSync(process.env.PLUXX_RELEASE_MANIFEST, 'utf8'))
const expectedPlugin = process.env.PLUXX_EXPECTED_PLUGIN
const expectedPlatform = process.env.PLUXX_EXPECTED_PLATFORM
const expectedVersion = process.env.PLUXX_EXPECTED_VERSION
if (manifest.version !== 1) throw new Error('Unsupported release manifest version')
if (manifest.plugin?.name !== expectedPlugin) throw new Error('Release manifest plugin identity mismatch')
if (manifest.plugin?.version !== expectedVersion) throw new Error('Release manifest version mismatch')
const archive = manifest.assets?.archives?.find((entry) => entry.platform === expectedPlatform)
if (!archive || archive.latestAsset !== '${args.expectedArchiveName}') {
  throw new Error('Release manifest archive identity mismatch for ' + expectedPlatform)
}
NODE

while IFS= read -r archive_entry; do
  normalized="\${archive_entry#./}"
  case "$normalized" in
    ""|/*|..|../*|*/..|*/../*|*\\*)
      echo "Unsafe archive path rejected: $archive_entry" >&2
      exit 1
      ;;
  esac
done < <(tar -tzf "${args.archiveVariable}")

while IFS= read -r archive_detail; do
  case "\${archive_detail:0:1}" in
    -|d) ;;
    *)
      echo "Unsafe archive member type rejected: $archive_detail" >&2
      exit 1
      ;;
  esac
done < <(tar -tvzf "${args.archiveVariable}")
`
}

function renderInstallerTransactionHelpers(platform: 'claude-code' | 'cursor' | 'codex' | 'opencode'): string {
  return `
PLUXX_TX_PLATFORM="${platform}"
PLUXX_TX_STAGE=""
PLUXX_TX_BACKUP=""
PLUXX_TX_SWAPPED=0
PLUXX_TX_SWAP_STARTED=0
PLUXX_TX_COMMITTED=0
PLUXX_TX_HAD_INSTALL=0
PLUXX_TX_LOCK=""
PLUXX_TX_OWNERSHIP_PATH=""
PLUXX_TX_OWNED_ROOT=""
PLUXX_TX_OWNED_PATHS=()
PLUXX_TX_OWNED_BACKUPS=()
PLUXX_TX_OWNED_EXISTED=()

pluxx_tx_backup_owned_path() {
  local owned_path="$1"
  if [[ -z "$PLUXX_TX_OWNED_ROOT" ]]; then
    PLUXX_TX_OWNED_ROOT="$TMP_DIR/pluxx-owned-state"
    mkdir -p "$PLUXX_TX_OWNED_ROOT"
  fi
  local index="\${#PLUXX_TX_OWNED_PATHS[@]}"
  local backup_path="$PLUXX_TX_OWNED_ROOT/$index"
  PLUXX_TX_OWNED_PATHS+=("$owned_path")
  PLUXX_TX_OWNED_BACKUPS+=("$backup_path")
  if [[ -e "$owned_path" || -L "$owned_path" ]]; then
    cp -R "$owned_path" "$backup_path"
    PLUXX_TX_OWNED_EXISTED+=("1")
  else
    PLUXX_TX_OWNED_EXISTED+=("0")
  fi
}

pluxx_tx_restore_owned_paths() {
  local count="\${#PLUXX_TX_OWNED_PATHS[@]}"
  local index
  for ((index=count - 1; index>=0; index--)); do
    local owned_path="\${PLUXX_TX_OWNED_PATHS[$index]}"
    rm -rf "$owned_path"
    if [[ "\${PLUXX_TX_OWNED_EXISTED[$index]}" == "1" ]]; then
      mkdir -p "$(dirname "$owned_path")"
      cp -R "\${PLUXX_TX_OWNED_BACKUPS[$index]}" "$owned_path"
    fi
  done
}

pluxx_tx_discard_owned_paths() {
  [[ -z "$PLUXX_TX_OWNED_ROOT" ]] || rm -rf "$PLUXX_TX_OWNED_ROOT"
  PLUXX_TX_OWNED_ROOT=""
  PLUXX_TX_OWNED_PATHS=()
  PLUXX_TX_OWNED_BACKUPS=()
  PLUXX_TX_OWNED_EXISTED=()
}

pluxx_tx_cleanup() {
  if [[ "$PLUXX_TX_COMMITTED" == "1" ]]; then
    [[ -z "$PLUXX_TX_BACKUP" ]] || rm -rf "$PLUXX_TX_BACKUP"
  elif [[ "$PLUXX_TX_SWAP_STARTED" == "1" ]]; then
    if [[ "$PLUXX_TX_HAD_INSTALL" == "1" && ( -e "$PLUXX_TX_BACKUP" || -L "$PLUXX_TX_BACKUP" ) ]]; then
      rm -rf "$INSTALL_DIR"
      mv "$PLUXX_TX_BACKUP" "$INSTALL_DIR"
    elif [[ "$PLUXX_TX_HAD_INSTALL" == "0" && ! -e "$PLUXX_TX_STAGE" && ! -L "$PLUXX_TX_STAGE" ]]; then
      rm -rf "$INSTALL_DIR"
    fi
    pluxx_tx_restore_owned_paths
  fi
  [[ -z "$PLUXX_TX_STAGE" ]] || rm -rf "$PLUXX_TX_STAGE"
  pluxx_tx_discard_owned_paths
  [[ -z "$PLUXX_TX_LOCK" ]] || rm -rf "$PLUXX_TX_LOCK"
}

pluxx_begin_install_transaction() {
  local bundle_dir="$1"
  local nonce="$$-$RANDOM"
  PLUXX_TX_STAGE="$(dirname "$INSTALL_DIR")/.$PLUGIN_NAME.pluxx-stage-$nonce"
  PLUXX_TX_BACKUP="$(dirname "$INSTALL_DIR")/.$PLUGIN_NAME.pluxx-backup-$nonce"
  local lock_root="\${PLUXX_INSTALL_LOCK_ROOT:-$HOME/.pluxx/install-locks}"
  local lock_path="$lock_root/$PLUGIN_NAME-$PLUXX_TX_PLATFORM.lock"
  mkdir -p "$lock_root"
  trap '' HUP INT TERM
  if ! mkdir "$lock_path"; then
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
    echo "Another install transaction is active for $INSTALL_DIR. If no installer is running, inspect and remove $lock_path before retrying." >&2
    exit 1
  fi
  PLUXX_TX_LOCK="$lock_path"
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
  local ownership_path_file="$TMP_DIR/pluxx-ownership-path"
  export INSTALL_DIR PLUGIN_NAME PLUXX_TX_PLATFORM PLUXX_TX_STAGE PLUXX_TX_BACKUP
  export PLUXX_TX_OWNERSHIP_PATH_FILE="$ownership_path_file"
  export PLUXX_BUNDLE_DIR="$bundle_dir"
  node <<'NODE'
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const installDir = process.env.INSTALL_DIR
const pluginName = process.env.PLUGIN_NAME
const platform = process.env.PLUXX_TX_PLATFORM
const stage = process.env.PLUXX_TX_STAGE
const home = path.resolve(process.env.HOME)
const resolvedInstallDir = path.resolve(installDir)
const conventionalRoots = [path.join('.claude', 'plugins'), path.join('.cursor', 'plugins'), path.join('.codex', 'plugins'), path.join('.config', 'opencode')].map((value) => path.join(home, value))
const ownershipRoot = conventionalRoots.some((root) => resolvedInstallDir === root || resolvedInstallDir.startsWith(root + path.sep))
  ? path.join(home, '.pluxx/install-ownership')
  : path.join(path.dirname(resolvedInstallDir), '.pluxx-install-ownership')
const ownershipPath = path.join(ownershipRoot, pluginName, platform + '.json')
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const walk = (root) => {
  if (!fs.existsSync(root)) return []
  const result = []
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const filepath = path.join(dir, entry.name)
      const relativePath = path.relative(root, filepath).replace(/\\\\/g, '/')
      const stats = fs.lstatSync(filepath)
      if (stats.isSymbolicLink()) result.push({ path: relativePath, kind: 'symlink', sha256: hash(fs.readlinkSync(filepath)) })
      else if (stats.isDirectory()) visit(filepath)
      else if (stats.isFile()) result.push({ path: relativePath, kind: 'file', sha256: hash(fs.readFileSync(filepath)) })
    }
  }
  visit(root)
  return result
}
const refuseUnownedInstall = (reason) => {
  throw new Error('Refusing to replace unowned install at ' + installDir + ': ' + reason + '. Move it aside or uninstall it manually, then retry.')
}
const manifestRelativePathByPlatform = {
  'claude-code': '.claude-plugin/plugin.json',
  cursor: '.cursor-plugin/plugin.json',
  codex: '.codex-plugin/plugin.json',
  opencode: 'package.json',
}
const readJson = (filepath, label) => {
  if (!fs.existsSync(filepath)) refuseUnownedInstall('missing ' + label)
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'))
  } catch {
    refuseUnownedInstall('malformed ' + label)
  }
}
const identityName = (manifest) => {
  if (!manifest || typeof manifest !== 'object') return undefined
  return typeof manifest.name === 'string' && manifest.name.trim() !== '' ? manifest.name.trim() : undefined
}
const assertTrustedLegacyInstall = () => {
  const manifestRelativePath = manifestRelativePathByPlatform[platform]
  if (!manifestRelativePath) refuseUnownedInstall('unsupported platform ' + platform)
  const installedManifest = readJson(path.join(installDir, manifestRelativePath), 'installed host manifest')
  const candidateManifest = readJson(path.join(process.env.PLUXX_BUNDLE_DIR, manifestRelativePath), 'candidate host manifest')
  const installedName = identityName(installedManifest)
  const candidateName = identityName(candidateManifest)
  if (!installedName || !candidateName || installedName !== candidateName) {
    refuseUnownedInstall('installed host manifest identity does not match candidate bundle')
  }
}
if (fs.existsSync(installDir)) {
  if (!fs.existsSync(ownershipPath)) {
    const legacy = walk(installDir)
    if (!legacy.every((entry) => entry.path === '.pluxx-user.json')) {
      assertTrustedLegacyInstall()
    }
  } else {
    const record = JSON.parse(fs.readFileSync(ownershipPath, 'utf8'))
    if (record.schema !== 'pluxx.install-ownership.v1' || record.pluginName !== pluginName || record.platform !== platform || path.resolve(record.installPath) !== path.resolve(installDir) || !Array.isArray(record.entries)) {
      throw new Error('Invalid install ownership record: ' + ownershipPath)
    }
    const expected = new Map(record.entries.map((entry) => [entry.path, entry]))
    const actual = new Map(walk(installDir).map((entry) => [entry.path, entry]))
    for (const [entryPath, entry] of expected) {
      const current = actual.get(entryPath)
      if (!current || current.kind !== entry.kind || current.sha256 !== entry.sha256) throw new Error('Refusing to replace modified installed file: ' + entryPath)
    }
    for (const entryPath of actual.keys()) if (!expected.has(entryPath)) throw new Error('Refusing to replace unowned installed file: ' + entryPath)
  }
}
fs.cpSync(process.env.PLUXX_BUNDLE_DIR, stage, { recursive: true })
fs.writeFileSync(process.env.PLUXX_TX_OWNERSHIP_PATH_FILE, ownershipPath)
NODE
  PLUXX_TX_OWNERSHIP_PATH="$(<"$ownership_path_file")"
  pluxx_tx_backup_owned_path "$PLUXX_TX_OWNERSHIP_PATH"
}

pluxx_swap_install_transaction() {
  if [[ -e "$INSTALL_DIR" || -L "$INSTALL_DIR" ]]; then PLUXX_TX_HAD_INSTALL=1; fi
  PLUXX_TX_SWAP_STARTED=1
  if [[ "$PLUXX_TX_HAD_INSTALL" == "1" ]]; then mv "$INSTALL_DIR" "$PLUXX_TX_BACKUP"; fi
  mv "$PLUXX_TX_STAGE" "$INSTALL_DIR"
  PLUXX_TX_SWAPPED=1
}

pluxx_commit_install_transaction() {
  export INSTALL_DIR PLUGIN_NAME PLUXX_TX_PLATFORM
  node <<'NODE'
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const root = path.resolve(process.env.INSTALL_DIR)
const runtimeCandidatePath = path.join(root, '.pluxx-runtime-ref.json')
let runtimeCandidate
if (fs.existsSync(runtimeCandidatePath)) {
  runtimeCandidate = JSON.parse(fs.readFileSync(runtimeCandidatePath, 'utf8'))
  fs.rmSync(runtimeCandidatePath, { force: true })
}
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const entries = []
const visit = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const filepath = path.join(dir, entry.name)
    const relativePath = path.relative(root, filepath).replace(/\\\\/g, '/')
    const stats = fs.lstatSync(filepath)
    if (stats.isSymbolicLink()) entries.push({ path: relativePath, kind: 'symlink', sha256: hash(fs.readlinkSync(filepath)) })
    else if (stats.isDirectory()) visit(filepath)
    else if (stats.isFile()) entries.push({ path: relativePath, kind: 'file', sha256: hash(fs.readFileSync(filepath)) })
  }
}
visit(root)
const home = path.resolve(process.env.HOME)
const conventionalRoots = [path.join('.claude', 'plugins'), path.join('.cursor', 'plugins'), path.join('.codex', 'plugins'), path.join('.config', 'opencode')].map((value) => path.join(home, value))
const ownershipRoot = conventionalRoots.some((managedRoot) => root === managedRoot || root.startsWith(managedRoot + path.sep))
  ? path.join(home, '.pluxx/install-ownership')
  : path.join(path.dirname(root), '.pluxx-install-ownership')
const ownershipPath = path.join(ownershipRoot, process.env.PLUGIN_NAME, process.env.PLUXX_TX_PLATFORM + '.json')
fs.mkdirSync(path.dirname(ownershipPath), { recursive: true })
const temporary = ownershipPath + '.tmp-' + process.pid + '-' + crypto.randomBytes(5).toString('hex')
fs.writeFileSync(temporary, JSON.stringify({
  schema: 'pluxx.install-ownership.v1',
  pluginName: process.env.PLUGIN_NAME,
  platform: process.env.PLUXX_TX_PLATFORM,
  installPath: root,
  kind: 'copy',
  entries,
}, null, 2) + '\\n', { mode: 0o600 })
fs.renameSync(temporary, ownershipPath)

const commitRuntimeReference = () => {
  const runtimeRefPath = (storeRoot) => path.join(
    storeRoot,
    'refs',
    process.env.PLUGIN_NAME,
    process.env.PLUXX_TX_PLATFORM + '-' + hash(root).slice(0, 16) + '.json',
  )
  if (!runtimeCandidate) {
    const configuredStoreRoot = process.env.PLUXX_RUNTIME_STORE_ROOT || path.join(path.resolve(process.env.HOME), '.pluxx/runtimes')
    if (!fs.existsSync(configuredStoreRoot)) return
    const storeRoot = fs.realpathSync(configuredStoreRoot)
    const staleRef = runtimeRefPath(storeRoot)
    fs.rmSync(staleRef, { force: true })
    return
  }
  if (runtimeCandidate.schema !== 'pluxx.shared-native-runtime-ref-candidate.v1'
    || typeof runtimeCandidate.storeRoot !== 'string'
    || !/^[a-f0-9]{64}$/.test(runtimeCandidate.fingerprint)
    || typeof runtimeCandidate.runtimeEntry !== 'string'
    || typeof runtimeCandidate.leasePath !== 'string') {
    throw new Error('Invalid committed shared runtime reference candidate.')
  }
  const storeRoot = fs.realpathSync(runtimeCandidate.storeRoot)
  const expectedEntry = path.join(storeRoot, 'entries', runtimeCandidate.fingerprint, 'current')
  if (path.resolve(runtimeCandidate.runtimeEntry) !== expectedEntry) {
    throw new Error('Shared runtime reference points outside its fingerprint entry.')
  }
  const expectedLeaseRoot = path.join(storeRoot, 'leases', runtimeCandidate.fingerprint)
  const resolvedLeasePath = path.resolve(runtimeCandidate.leasePath)
  if (!resolvedLeasePath.startsWith(expectedLeaseRoot + path.sep)) {
    throw new Error('Shared runtime lease points outside its fingerprint lease root.')
  }
  const refRoot = path.join(storeRoot, 'refs')
  const refPath = runtimeRefPath(storeRoot)
  fs.mkdirSync(path.dirname(refPath), { recursive: true, mode: 0o700 })
  const ref = {
    schema: 'pluxx.shared-native-runtime-ref.v1',
    pluginName: process.env.PLUGIN_NAME,
    platform: process.env.PLUXX_TX_PLATFORM,
    installPath: root,
    runtimeEntry: expectedEntry,
    fingerprint: runtimeCandidate.fingerprint,
    updatedAt: new Date().toISOString(),
  }
  const temporaryRef = refPath + '.tmp-' + process.pid + '-' + crypto.randomBytes(5).toString('hex')
  fs.writeFileSync(temporaryRef, JSON.stringify(ref, null, 2) + '\\n', { mode: 0o600 })
  fs.renameSync(temporaryRef, refPath)
  try { fs.rmSync(resolvedLeasePath, { force: true }) } catch (error) {
    console.error('Warning: could not remove committed shared runtime lease: ' + error.message)
  }

  try {
  const liveFingerprints = new Set()
  const graceMs = Math.max(0, Number(process.env.PLUXX_RUNTIME_GC_GRACE_SECONDS || 604800) * 1000)
  const makeWritable = (filepath) => {
    if (!fs.existsSync(filepath)) return
    const stats = fs.lstatSync(filepath)
    if (stats.isSymbolicLink()) return
    fs.chmodSync(filepath, stats.isDirectory() ? 0o700 : (stats.mode | 0o600))
    if (stats.isDirectory()) for (const entry of fs.readdirSync(filepath)) makeWritable(path.join(filepath, entry))
  }
  const removeTree = (filepath) => {
    makeWritable(filepath)
    fs.rmSync(filepath, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  }
  const visitRefs = (directory) => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filepath = path.join(directory, entry.name)
      if (entry.isDirectory()) visitRefs(filepath)
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const candidate = JSON.parse(fs.readFileSync(filepath, 'utf8'))
          if (candidate.schema !== 'pluxx.shared-native-runtime-ref.v1'
            || typeof candidate.installPath !== 'string') {
            fs.rmSync(filepath, { force: true })
          } else if (!fs.existsSync(candidate.installPath)) {
            const updatedAt = Date.parse(candidate.updatedAt || '')
            if (Number.isFinite(updatedAt) && Date.now() - updatedAt < graceMs && /^[a-f0-9]{64}$/.test(candidate.fingerprint)) {
              liveFingerprints.add(candidate.fingerprint)
            } else {
              fs.rmSync(filepath, { force: true })
            }
          } else if (/^[a-f0-9]{64}$/.test(candidate.fingerprint)) {
            liveFingerprints.add(candidate.fingerprint)
          }
        } catch { fs.rmSync(filepath, { force: true }) }
      }
    }
  }
  visitRefs(refRoot)

  const leasesRoot = path.join(storeRoot, 'leases')
  if (fs.existsSync(leasesRoot)) {
    for (const fingerprintEntry of fs.readdirSync(leasesRoot, { withFileTypes: true })) {
      if (!fingerprintEntry.isDirectory() || !/^[a-f0-9]{64}$/.test(fingerprintEntry.name)) continue
      const fingerprintLeaseRoot = path.join(leasesRoot, fingerprintEntry.name)
      for (const leaseEntry of fs.readdirSync(fingerprintLeaseRoot, { withFileTypes: true })) {
        if (!leaseEntry.isFile() || !leaseEntry.name.endsWith('.json')) continue
        const leaseFile = path.join(fingerprintLeaseRoot, leaseEntry.name)
        try {
          const lease = JSON.parse(fs.readFileSync(leaseFile, 'utf8'))
          if (lease.schema === 'pluxx.shared-native-runtime-lease.v1'
            && lease.fingerprint === fingerprintEntry.name
            && Number.isInteger(lease.ownerPid)
            && lease.ownerPid > 0) {
            try { process.kill(lease.ownerPid, 0); liveFingerprints.add(fingerprintEntry.name); continue } catch (error) {
              if (error && error.code === 'EPERM') { liveFingerprints.add(fingerprintEntry.name); continue }
            }
          }
        } catch {}
        fs.rmSync(leaseFile, { force: true })
      }
    }
  }

  const entriesRoot = path.join(storeRoot, 'entries')
  if (fs.existsSync(entriesRoot)) {
    for (const entry of fs.readdirSync(entriesRoot, { withFileTypes: true })) {
      const filepath = path.join(entriesRoot, entry.name)
      if (!entry.isDirectory()) continue
      if (!liveFingerprints.has(entry.name)) {
        if (fs.existsSync(path.join(storeRoot, 'locks', entry.name + '.lock'))) continue
        if (Date.now() - fs.statSync(filepath).mtimeMs >= graceMs) removeTree(filepath)
        continue
      }
      const generationsRoot = path.join(filepath, 'generations')
      let currentGeneration
      try { currentGeneration = path.resolve(filepath, fs.readlinkSync(path.join(filepath, 'current'))) } catch {}
      if (!fs.existsSync(generationsRoot)) continue
      for (const generation of fs.readdirSync(generationsRoot, { withFileTypes: true })) {
        const generationPath = path.join(generationsRoot, generation.name)
        if (!generation.isDirectory() || generationPath === currentGeneration) continue
        if (Date.now() - fs.statSync(generationPath).mtimeMs >= graceMs) removeTree(generationPath)
      }
    }
  }
  } catch (error) {
    console.error('Warning: could not prune shared runtime store: ' + error.message)
  }
}

commitRuntimeReference()
NODE
}

pluxx_discard_install_transaction() {
  PLUXX_TX_SWAP_STARTED=0
  PLUXX_TX_SWAPPED=0
  PLUXX_TX_HAD_INSTALL=0
  PLUXX_TX_STAGE=""
  if ! rm -rf "$PLUXX_TX_BACKUP"; then echo "Warning: could not remove install backup $PLUXX_TX_BACKUP" >&2; fi
  pluxx_tx_discard_owned_paths
  if ! rm -rf "$PLUXX_TX_LOCK"; then echo "Warning: could not remove install lock $PLUXX_TX_LOCK" >&2; fi
  PLUXX_TX_LOCK=""
  PLUXX_TX_COMMITTED=0
}

pluxx_finalize_install_transaction() {
  pluxx_commit_install_transaction
  PLUXX_TX_COMMITTED=1
  pluxx_discard_install_transaction
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
`
}

function renderInstallClaudeCodeScript(config: PluginConfig): string {
  return `#!/usr/bin/env bash
set -Eeuo pipefail

REPO="\${PLUXX_PLUGIN_REPO:-REPO_PLACEHOLDER}"
PLUGIN_NAME="\${PLUXX_PLUGIN_NAME:-PLUGIN_PLACEHOLDER}"
MARKETPLACE_NAME="\${PLUXX_CLAUDE_MARKETPLACE_NAME:-PLUGIN_PLACEHOLDER-releases}"
BUNDLE_URL="\${PLUXX_CLAUDE_BUNDLE_URL:-https://github.com/\${REPO}/releases/download/vVERSION_PLACEHOLDER/CLAUDE_BUNDLE_PLACEHOLDER}"
INSTALL_ROOT="\${PLUXX_CLAUDE_MARKETPLACE_DIR:-$HOME/.claude/plugins/data/$MARKETPLACE_NAME}"
INSTALL_DIR="$INSTALL_ROOT/plugins/$PLUGIN_NAME"
SKIP_INSTALL="\${PLUXX_CLAUDE_SKIP_INSTALL:-0}"
BUNDLE_PATH="\${PLUXX_CLAUDE_BUNDLE_PATH:-}"
AUTHOR_NAME="\${PLUXX_PLUGIN_AUTHOR:-AUTHOR_PLACEHOLDER}"
HOMEPAGE_URL="\${PLUXX_PLUGIN_HOMEPAGE:-HOMEPAGE_PLACEHOLDER}"
DESCRIPTION_FALLBACK="\${PLUXX_PLUGIN_DESCRIPTION:-DESCRIPTION_PLACEHOLDER}"
${renderInstallerTransactionHelpers('claude-code')}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd tar
need_cmd mktemp
need_cmd grep
need_cmd sed
need_cmd node

if [[ "$SKIP_INSTALL" != "1" ]]; then
  need_cmd curl
  need_cmd claude
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  pluxx_tx_cleanup
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

BUNDLE_ARCHIVE="$TMP_DIR/${config.name}-claude-code.tar.gz"

if [[ -n "$BUNDLE_PATH" ]]; then
  cp "$BUNDLE_PATH" "$BUNDLE_ARCHIVE"
else
  curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$BUNDLE_URL" -o "$BUNDLE_ARCHIVE"
fi

${renderReleaseAssetVerificationSnippet({ archiveVariable: '$BUNDLE_ARCHIVE', bundlePathVariable: '$BUNDLE_PATH', expectedArchiveName: getArchiveAssetName(config.name, 'claude-code', config.version, 'latest'), expectedPlatform: 'claude-code' })}
tar -xzf "$BUNDLE_ARCHIVE" -C "$TMP_DIR"

BUNDLE_DIR="$TMP_DIR/claude-code"
PLUGIN_MANIFEST="$BUNDLE_DIR/.claude-plugin/plugin.json"

if [[ ! -f "$PLUGIN_MANIFEST" ]]; then
  echo "Downloaded bundle does not contain a Claude plugin manifest." >&2
  exit 1
fi

VERSION="$(grep -E '"version"' "$PLUGIN_MANIFEST" | head -n1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\\1/')"
DESCRIPTION="$(grep -E '"description"' "$PLUGIN_MANIFEST" | head -n1 | sed -E 's/.*"description"[[:space:]]*:[[:space:]]*"([^"]+)".*/\\1/')"

mkdir -p "$INSTALL_ROOT/.claude-plugin" "$INSTALL_ROOT/plugins"
${renderInstallerSavedUserConfigCaptureSnippet(config, 'claude-code', '$INSTALL_DIR')}
pluxx_begin_install_transaction "$BUNDLE_DIR"
${renderInstallerUserConfigSnippet(config, 'claude-code', '$PLUXX_TX_STAGE')}
${renderInstallerMcpPathMaterializationSnippet('claude-code', '$PLUXX_TX_STAGE', '$INSTALL_DIR')}
${renderInstallerRuntimeBootstrapSnippet('$PLUXX_TX_STAGE')}
pluxx_tx_backup_owned_path "$INSTALL_ROOT/.claude-plugin/marketplace.json"
pluxx_tx_backup_owned_path "$HOME/.claude/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME"
pluxx_swap_install_transaction

cat > "$INSTALL_ROOT/.claude-plugin/marketplace.json" <<JSON
{
  "name": "$MARKETPLACE_NAME",
  "owner": {
    "name": "$AUTHOR_NAME"
  },
  "plugins": [
    {
      "name": "$PLUGIN_NAME",
      "source": "./plugins/$PLUGIN_NAME",
      "description": "\${DESCRIPTION:-$DESCRIPTION_FALLBACK}",
      "version": "\${VERSION:-${config.version}}",
      "author": {
        "name": "$AUTHOR_NAME"
      },
      "license": "${config.license}",
      "homepage": "$HOMEPAGE_URL"
    }
  ]
}
JSON

if [[ "$SKIP_INSTALL" == "1" ]]; then
  pluxx_finalize_install_transaction
  echo "Prepared Claude marketplace at: $INSTALL_ROOT"
  echo "Plugin bundle is at: $INSTALL_ROOT/plugins/$PLUGIN_NAME"
  exit 0
fi

if claude plugin marketplace list --json | grep -q "\\"name\\": \\"$MARKETPLACE_NAME\\""; then
  claude plugin marketplace update "$MARKETPLACE_NAME" >/dev/null
else
  claude plugin marketplace add "$INSTALL_ROOT" >/dev/null
fi

claude plugin uninstall "\${PLUGIN_NAME}@\${MARKETPLACE_NAME}" --scope user >/dev/null 2>&1 || true
claude plugin install "\${PLUGIN_NAME}@\${MARKETPLACE_NAME}" --scope user
pluxx_finalize_install_transaction

echo
echo "Installed \${PLUGIN_NAME}@\${MARKETPLACE_NAME} into Claude Code user scope."
echo "${getPublishReloadInstruction('claude-code')}"
`
}

function renderInstallCursorScript(config: PluginConfig): string {
  return `#!/usr/bin/env bash
set -Eeuo pipefail

REPO="\${PLUXX_PLUGIN_REPO:-REPO_PLACEHOLDER}"
PLUGIN_NAME="\${PLUXX_PLUGIN_NAME:-PLUGIN_PLACEHOLDER}"
BUNDLE_URL="\${PLUXX_CURSOR_BUNDLE_URL:-https://github.com/\${REPO}/releases/download/vVERSION_PLACEHOLDER/CURSOR_BUNDLE_PLACEHOLDER}"
INSTALL_DIR="\${PLUXX_CURSOR_INSTALL_DIR:-$HOME/.cursor/plugins/local/$PLUGIN_NAME}"
BUNDLE_PATH="\${PLUXX_CURSOR_BUNDLE_PATH:-}"
${renderInstallerTransactionHelpers('cursor')}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd tar
need_cmd mktemp
need_cmd curl
need_cmd node

TMP_DIR="$(mktemp -d)"
cleanup() {
  pluxx_tx_cleanup
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

BUNDLE_ARCHIVE="$TMP_DIR/${config.name}-cursor.tar.gz"

if [[ -n "$BUNDLE_PATH" ]]; then
  cp "$BUNDLE_PATH" "$BUNDLE_ARCHIVE"
else
  curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$BUNDLE_URL" -o "$BUNDLE_ARCHIVE"
fi

${renderReleaseAssetVerificationSnippet({ archiveVariable: '$BUNDLE_ARCHIVE', bundlePathVariable: '$BUNDLE_PATH', expectedArchiveName: getArchiveAssetName(config.name, 'cursor', config.version, 'latest'), expectedPlatform: 'cursor' })}
tar -xzf "$BUNDLE_ARCHIVE" -C "$TMP_DIR"

BUNDLE_DIR="$TMP_DIR/cursor"
PLUGIN_MANIFEST="$BUNDLE_DIR/.cursor-plugin/plugin.json"

if [[ ! -f "$PLUGIN_MANIFEST" ]]; then
  echo "Downloaded bundle does not contain a Cursor plugin manifest." >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
${renderInstallerSavedUserConfigCaptureSnippet(config, 'cursor', '$INSTALL_DIR')}
pluxx_begin_install_transaction "$BUNDLE_DIR"
${renderInstallerUserConfigSnippet(config, 'cursor', '$PLUXX_TX_STAGE')}
${renderInstallerMcpPathMaterializationSnippet('cursor', '$PLUXX_TX_STAGE', '$INSTALL_DIR')}
${renderInstallerRuntimeBootstrapSnippet('$PLUXX_TX_STAGE')}
pluxx_swap_install_transaction
pluxx_finalize_install_transaction

echo "Installed $PLUGIN_NAME to $INSTALL_DIR"
echo "${getPublishReloadInstruction('cursor')}"
`
}

function renderInstallCodexScript(config: PluginConfig): string {
  return `#!/usr/bin/env bash
set -Eeuo pipefail

REPO="\${PLUXX_PLUGIN_REPO:-REPO_PLACEHOLDER}"
PLUGIN_NAME="\${PLUXX_PLUGIN_NAME:-PLUGIN_PLACEHOLDER}"
BUNDLE_URL="\${PLUXX_CODEX_BUNDLE_URL:-https://github.com/\${REPO}/releases/download/vVERSION_PLACEHOLDER/CODEX_BUNDLE_PLACEHOLDER}"
INSTALL_DIR="\${PLUXX_CODEX_INSTALL_DIR:-$HOME/.codex/plugins/$PLUGIN_NAME}"
MARKETPLACE_PATH="\${PLUXX_CODEX_MARKETPLACE_PATH:-$HOME/.agents/plugins/marketplace.json}"
BUNDLE_PATH="\${PLUXX_CODEX_BUNDLE_PATH:-}"
MARKETPLACE_NAME="\${PLUXX_CODEX_MARKETPLACE_NAME:-$PLUGIN_NAME-local}"
MARKETPLACE_DISPLAY_NAME="\${PLUXX_CODEX_MARKETPLACE_DISPLAY_NAME:-DISPLAY_PLACEHOLDER Local}"
${renderInstallerTransactionHelpers('codex')}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd tar
need_cmd mktemp
need_cmd node

TMP_DIR="$(mktemp -d)"
cleanup() {
  pluxx_tx_cleanup
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

BUNDLE_ARCHIVE="$TMP_DIR/${config.name}-codex.tar.gz"

if [[ -n "$BUNDLE_PATH" ]]; then
  cp "$BUNDLE_PATH" "$BUNDLE_ARCHIVE"
else
  need_cmd curl
  curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$BUNDLE_URL" -o "$BUNDLE_ARCHIVE"
fi

${renderReleaseAssetVerificationSnippet({ archiveVariable: '$BUNDLE_ARCHIVE', bundlePathVariable: '$BUNDLE_PATH', expectedArchiveName: getArchiveAssetName(config.name, 'codex', config.version, 'latest'), expectedPlatform: 'codex' })}
tar -xzf "$BUNDLE_ARCHIVE" -C "$TMP_DIR"

BUNDLE_DIR="$TMP_DIR/codex"
PLUGIN_MANIFEST="$BUNDLE_DIR/.codex-plugin/plugin.json"

if [[ ! -f "$PLUGIN_MANIFEST" ]]; then
  echo "Downloaded bundle does not contain a Codex plugin manifest." >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
${renderInstallerSavedUserConfigCaptureSnippet(config, 'codex', '$INSTALL_DIR')}
pluxx_begin_install_transaction "$BUNDLE_DIR"
${renderInstallerUserConfigSnippet(config, 'codex', '$PLUXX_TX_STAGE')}
${renderInstallerMcpPathMaterializationSnippet('codex', '$PLUXX_TX_STAGE', '$INSTALL_DIR')}
${renderInstallerRuntimeBootstrapSnippet('$PLUXX_TX_STAGE')}
CODEX_HOME_DIR="\${CODEX_HOME:-$HOME/.codex}"
CODEX_CONFIG_PATH="\${PLUXX_CODEX_CONFIG_PATH:-$CODEX_HOME_DIR/config.toml}"
pluxx_tx_backup_owned_path "$CODEX_HOME_DIR/agents/$PLUGIN_NAME"
pluxx_tx_backup_owned_path "$CODEX_HOME_DIR/pluxx/agent-installs/$PLUGIN_NAME.json"
pluxx_tx_backup_owned_path "$CODEX_HOME_DIR/plugins/cache/local-plugins/$PLUGIN_NAME"
pluxx_tx_backup_owned_path "$CODEX_CONFIG_PATH"
pluxx_tx_backup_owned_path "$MARKETPLACE_PATH"
pluxx_swap_install_transaction
${renderInstallerCodexAgentRegistrationSnippet('$INSTALL_DIR')}
${renderInstallerCodexPluginHooksSnippet('$INSTALL_DIR')}

mkdir -p "$(dirname "$MARKETPLACE_PATH")"

export MARKETPLACE_PATH
export PLUGIN_NAME
export MARKETPLACE_NAME
export MARKETPLACE_DISPLAY_NAME

node <<'NODE'
const fs = require('fs')

const filepath = process.env.MARKETPLACE_PATH
const pluginName = process.env.PLUGIN_NAME
const marketplaceName = process.env.MARKETPLACE_NAME
const displayName = process.env.MARKETPLACE_DISPLAY_NAME

let marketplace = {
  name: marketplaceName,
  interface: { displayName },
  plugins: [],
}

if (fs.existsSync(filepath)) {
  marketplace = JSON.parse(fs.readFileSync(filepath, 'utf8'))
  marketplace.name ||= marketplaceName
  marketplace.interface ||= { displayName }
  marketplace.plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : []
}

const nextPlugins = marketplace.plugins.filter((plugin) => plugin.name !== pluginName)
nextPlugins.push({
  name: pluginName,
  source: {
    source: 'local',
    path: './.codex/plugins/' + pluginName,
  },
  policy: {
    installation: 'AVAILABLE',
    authentication: 'ON_INSTALL',
  },
  category: 'Productivity',
})

fs.writeFileSync(
  filepath,
  JSON.stringify(
    {
      name: marketplace.name,
      interface: marketplace.interface,
      plugins: nextPlugins,
    },
    null,
    2,
  ) + '\\n',
)
NODE
pluxx_finalize_install_transaction

echo "Installed $PLUGIN_NAME to $INSTALL_DIR"
echo "Updated Codex marketplace catalog at $MARKETPLACE_PATH"
echo "${getPublishReloadInstruction('codex')}"
`
}

function renderInstallOpenCodeScript(config: PluginConfig): string {
  return `#!/usr/bin/env bash
set -Eeuo pipefail

REPO="\${PLUXX_PLUGIN_REPO:-REPO_PLACEHOLDER}"
PLUGIN_NAME="\${PLUXX_PLUGIN_NAME:-PLUGIN_PLACEHOLDER}"
BUNDLE_URL="\${PLUXX_OPENCODE_BUNDLE_URL:-https://github.com/\${REPO}/releases/download/vVERSION_PLACEHOLDER/OPENCODE_BUNDLE_PLACEHOLDER}"
PLUGIN_ROOT_DIR="\${PLUXX_OPENCODE_PLUGIN_ROOT_DIR:-$HOME/.config/opencode/plugins}"
INSTALL_DIR="\${PLUXX_OPENCODE_INSTALL_DIR:-$PLUGIN_ROOT_DIR/$PLUGIN_NAME}"
ENTRY_PATH="\${PLUXX_OPENCODE_ENTRY_PATH:-$PLUGIN_ROOT_DIR/$PLUGIN_NAME.ts}"
SKILLS_ROOT="\${PLUXX_OPENCODE_SKILLS_ROOT:-$HOME/.config/opencode/skills}"
BUNDLE_PATH="\${PLUXX_OPENCODE_BUNDLE_PATH:-}"
${renderInstallerTransactionHelpers('opencode')}
PLUXX_OPENCODE_COMPANION_STAGE=""
PLUXX_OPENCODE_COMPANION_JOURNAL=""

pluxx_opencode_companion_cleanup() {
  [[ -n "$PLUXX_OPENCODE_COMPANION_JOURNAL" && -f "$PLUXX_OPENCODE_COMPANION_JOURNAL" ]] || return 0
  if [[ "$PLUXX_TX_COMMITTED" == "1" ]]; then
    pluxx_finalize_opencode_companions
    return 0
  fi
  export PLUXX_OPENCODE_COMPANION_JOURNAL
  node <<'NODE'
const fs = require('fs')
const journal = JSON.parse(fs.readFileSync(process.env.PLUXX_OPENCODE_COMPANION_JOURNAL, 'utf8'))
for (const move of [...journal.moves].reverse()) {
  if (fs.existsSync(move.destination)) fs.rmSync(move.destination, { recursive: true, force: true })
  if (fs.existsSync(move.backup)) fs.renameSync(move.backup, move.destination)
}
for (const ledger of journal.ledgers) {
  if (ledger.backup && fs.existsSync(ledger.backup)) fs.copyFileSync(ledger.backup, ledger.path)
  else fs.rmSync(ledger.path, { force: true })
}
fs.rmSync(process.env.PLUXX_OPENCODE_COMPANION_JOURNAL, { force: true })
NODE
}

pluxx_commit_opencode_companions() {
  export INSTALL_DIR ENTRY_PATH SKILLS_ROOT PLUGIN_NAME PLUXX_OPENCODE_COMPANION_STAGE PLUXX_OPENCODE_COMPANION_JOURNAL
  node <<'NODE'
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const walk = (root) => {
  const entries = []
  if (!fs.existsSync(root)) return entries
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const filepath = path.join(directory, entry.name)
      const relativePath = path.relative(root, filepath).replace(/\\\\/g, '/')
      const stats = fs.lstatSync(filepath)
      if (stats.isSymbolicLink()) entries.push({ path: relativePath, kind: 'symlink', sha256: hash(fs.readlinkSync(filepath)) })
      else if (stats.isDirectory()) visit(filepath)
      else if (stats.isFile()) entries.push({ path: relativePath, kind: 'file', sha256: hash(fs.readFileSync(filepath)) })
    }
  }
  visit(root)
  return entries
}
const pluginName = process.env.PLUGIN_NAME
const installDir = path.resolve(process.env.INSTALL_DIR)
const entryPath = path.resolve(process.env.ENTRY_PATH)
const skillsRoot = path.resolve(process.env.SKILLS_ROOT)
const stageRoot = path.resolve(process.env.PLUXX_OPENCODE_COMPANION_STAGE)
const home = path.resolve(process.env.HOME)
const conventionalRoot = path.join(home, '.config', 'opencode')
const ownershipRoot = installDir === conventionalRoot || installDir.startsWith(conventionalRoot + path.sep)
  ? path.join(home, '.pluxx/install-ownership')
  : path.join(path.dirname(installDir), '.pluxx-install-ownership')
const ledgerRoot = path.join(ownershipRoot, pluginName)
const candidates = [{ surface: 'entry', source: path.join(stageRoot, 'entry.ts'), destination: entryPath, kind: 'file' }]
const stagedSkills = path.join(stageRoot, 'skills')
if (fs.existsSync(stagedSkills)) {
  for (const name of fs.readdirSync(stagedSkills).sort()) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error('Unsafe OpenCode skill name: ' + name)
    candidates.push({ surface: 'skill-' + name, source: path.join(stagedSkills, name), destination: path.join(skillsRoot, pluginName + '-' + name), kind: 'copy' })
  }
}
const previous = new Map()
if (fs.existsSync(ledgerRoot)) {
  for (const name of fs.readdirSync(ledgerRoot)) {
    if (!name.startsWith('opencode--') || !name.endsWith('.json')) continue
    const surface = name.slice('opencode--'.length, -'.json'.length)
    previous.set(surface, path.join(ledgerRoot, name))
  }
}
for (const [surface, ledgerPath] of previous) {
  if (candidates.some((candidate) => candidate.surface === surface)) continue
  const record = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  const destination = path.resolve(record.installPath || '')
  if (!surface.startsWith('skill-') || !destination.startsWith(skillsRoot + path.sep) || !path.basename(destination).startsWith(pluginName + '-')) {
    throw new Error('Invalid OpenCode companion ownership record: ' + ledgerPath)
  }
  candidates.push({ surface, destination, kind: record.kind, remove: true })
}
const entriesEqual = (expected, actual) => {
  const expectedMap = new Map(expected.map((entry) => [entry.path, entry]))
  const actualMap = new Map(actual.map((entry) => [entry.path, entry]))
  if (expectedMap.size !== actualMap.size) return false
  for (const [name, entry] of expectedMap) {
    const current = actualMap.get(name)
    if (!current || current.kind !== entry.kind || current.sha256 !== entry.sha256) return false
  }
  return true
}
const movePath = (source, destination) => {
  try {
    fs.renameSync(source, destination)
    return
  } catch (error) {
    if (!error || error.code !== 'EXDEV') throw error
  }
  const stats = fs.lstatSync(source)
  if (stats.isDirectory()) fs.cpSync(source, destination, { recursive: true, verbatimSymlinks: true })
  else fs.copyFileSync(source, destination)
  fs.rmSync(source, { recursive: true, force: true })
}
const frontmatterName = (content) => {
  const match = content.match(/^---\\n([\\s\\S]*?)\\n---\\n?/)
  if (!match) return undefined
  const nameMatch = match[1].match(/^name:\\s*(.+)$/m)
  return nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : undefined
}
const isTrustedLegacyOpenCodeCompanion = (candidate) => {
  if (candidate.remove || !fs.existsSync(candidate.destination)) return false
  if (candidate.kind === 'file') {
    if (!fs.lstatSync(candidate.destination).isFile() || fs.lstatSync(candidate.destination).isSymbolicLink()) return false
    const content = fs.readFileSync(candidate.destination, 'utf8')
    return content.includes('import * as PluginModule from "./' + pluginName + '/index.ts"')
      && content.includes('directory: join(context.directory, "' + pluginName + '")')
      && content.includes('Object.values(PluginModule).find')
  }
  if (candidate.kind === 'copy' && candidate.surface.startsWith('skill-')) {
    if (!fs.lstatSync(candidate.destination).isDirectory() || fs.lstatSync(candidate.destination).isSymbolicLink()) return false
    const skillPath = path.join(candidate.destination, 'SKILL.md')
    const candidateSkillPath = path.join(candidate.source, 'SKILL.md')
    if (!fs.existsSync(skillPath) || !fs.lstatSync(skillPath).isFile()) return false
    if (!fs.existsSync(candidateSkillPath) || !fs.lstatSync(candidateSkillPath).isFile()) return false
    const name = frontmatterName(fs.readFileSync(skillPath, 'utf8'))
    const candidateName = frontmatterName(fs.readFileSync(candidateSkillPath, 'utf8'))
    return typeof name === 'string' && name === candidateName && name.startsWith(pluginName + '/')
  }
  return false
}
for (const candidate of candidates) {
  const ledgerPath = path.join(ledgerRoot, 'opencode--' + candidate.surface + '.json')
  candidate.ledgerPath = ledgerPath
  if (!fs.existsSync(candidate.destination)) {
    if (fs.existsSync(ledgerPath)) throw new Error('Refusing to replace missing owned OpenCode companion: ' + candidate.destination)
    continue
  }
  if (!fs.existsSync(ledgerPath)) {
    if (isTrustedLegacyOpenCodeCompanion(candidate)) continue
    throw new Error('Refusing to replace unowned OpenCode companion: ' + candidate.destination)
  }
  const record = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  if (record.schema !== 'pluxx.install-ownership.v1' || record.pluginName !== pluginName || record.platform !== 'opencode' || record.surface !== candidate.surface || path.resolve(record.installPath || '') !== candidate.destination || record.kind !== candidate.kind) {
    throw new Error('Invalid OpenCode companion ownership record: ' + ledgerPath)
  }
  const unchanged = candidate.kind === 'file'
    ? fs.lstatSync(candidate.destination).isFile() && !fs.lstatSync(candidate.destination).isSymbolicLink() && hash(fs.readFileSync(candidate.destination)) === record.rootSha256
    : fs.lstatSync(candidate.destination).isDirectory() && !fs.lstatSync(candidate.destination).isSymbolicLink() && entriesEqual(record.entries || [], walk(candidate.destination))
  if (!unchanged) throw new Error('Refusing to replace modified OpenCode companion: ' + candidate.destination)
}
fs.mkdirSync(ledgerRoot, { recursive: true })
const nonce = process.pid + '-' + crypto.randomBytes(5).toString('hex')
const journal = { moves: [], ledgers: [] }
fs.writeFileSync(process.env.PLUXX_OPENCODE_COMPANION_JOURNAL, JSON.stringify(journal))
const saveJournal = () => fs.writeFileSync(process.env.PLUXX_OPENCODE_COMPANION_JOURNAL, JSON.stringify(journal))
try {
  for (const candidate of candidates) {
    fs.mkdirSync(path.dirname(candidate.destination), { recursive: true })
    const backup = path.join(path.dirname(candidate.destination), '.' + pluginName + '.pluxx-companion-backup-' + nonce + '-' + journal.moves.length)
    journal.moves.push({ destination: candidate.destination, backup })
    if (fs.existsSync(candidate.destination)) fs.renameSync(candidate.destination, backup)
    if (!candidate.remove) movePath(candidate.source, candidate.destination)
    saveJournal()
  }
  for (const candidate of candidates) {
    const ledgerBackup = fs.existsSync(candidate.ledgerPath) ? candidate.ledgerPath + '.backup-' + nonce : undefined
    if (ledgerBackup) fs.copyFileSync(candidate.ledgerPath, ledgerBackup)
    journal.ledgers.push({ path: candidate.ledgerPath, backup: ledgerBackup })
    if (candidate.remove) fs.rmSync(candidate.ledgerPath, { force: true })
    else {
      const record = {
        schema: 'pluxx.install-ownership.v1', pluginName, platform: 'opencode', surface: candidate.surface,
        installPath: candidate.destination, kind: candidate.kind,
        ...(candidate.kind === 'file' ? { rootSha256: hash(fs.readFileSync(candidate.destination)) } : { entries: walk(candidate.destination) }),
        entries: candidate.kind === 'file' ? [] : walk(candidate.destination),
      }
      const temporary = candidate.ledgerPath + '.tmp-' + nonce
      fs.writeFileSync(temporary, JSON.stringify(record, null, 2) + '\\n', { mode: 0o600 })
      fs.renameSync(temporary, candidate.ledgerPath)
    }
    saveJournal()
  }
} catch (error) {
  for (const move of [...journal.moves].reverse()) {
    if (fs.existsSync(move.destination)) fs.rmSync(move.destination, { recursive: true, force: true })
    if (fs.existsSync(move.backup)) fs.renameSync(move.backup, move.destination)
  }
  for (const ledger of journal.ledgers) {
    if (ledger.backup && fs.existsSync(ledger.backup)) fs.copyFileSync(ledger.backup, ledger.path)
    else fs.rmSync(ledger.path, { force: true })
  }
  fs.rmSync(process.env.PLUXX_OPENCODE_COMPANION_JOURNAL, { force: true })
  throw error
}
NODE
}

pluxx_finalize_opencode_companions() {
  local journal_path="$PLUXX_OPENCODE_COMPANION_JOURNAL"
  PLUXX_OPENCODE_COMPANION_JOURNAL=""
  export PLUXX_OPENCODE_FINAL_JOURNAL="$journal_path"
  node <<'NODE'
const fs = require('fs')
const journalPath = process.env.PLUXX_OPENCODE_FINAL_JOURNAL
try {
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
  for (const move of journal.moves) {
    try { fs.rmSync(move.backup, { recursive: true, force: true }) } catch {}
  }
  for (const ledger of journal.ledgers) {
    try { if (ledger.backup) fs.rmSync(ledger.backup, { force: true }) } catch {}
  }
  try { fs.rmSync(journalPath, { force: true }) } catch {}
} catch {
  // The new bundle and companions are already committed; stale backups are safer than rollback.
}
NODE
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd tar
need_cmd mktemp
need_cmd node

TMP_DIR="$(mktemp -d)"
cleanup() {
  pluxx_opencode_companion_cleanup
  pluxx_tx_cleanup
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

BUNDLE_ARCHIVE="$TMP_DIR/${config.name}-opencode.tar.gz"

if [[ -n "$BUNDLE_PATH" ]]; then
  cp "$BUNDLE_PATH" "$BUNDLE_ARCHIVE"
else
  need_cmd curl
  curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 "$BUNDLE_URL" -o "$BUNDLE_ARCHIVE"
fi

${renderReleaseAssetVerificationSnippet({ archiveVariable: '$BUNDLE_ARCHIVE', bundlePathVariable: '$BUNDLE_PATH', expectedArchiveName: getArchiveAssetName(config.name, 'opencode', config.version, 'latest'), expectedPlatform: 'opencode' })}
tar -xzf "$BUNDLE_ARCHIVE" -C "$TMP_DIR"

BUNDLE_DIR="$TMP_DIR/opencode"
PLUGIN_PACKAGE="$BUNDLE_DIR/package.json"

if [[ ! -f "$PLUGIN_PACKAGE" ]]; then
  echo "Downloaded bundle does not contain an OpenCode package.json." >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")" "$SKILLS_ROOT"
${renderInstallerSavedUserConfigCaptureSnippet(config, 'opencode', '$INSTALL_DIR')}
pluxx_begin_install_transaction "$BUNDLE_DIR"
${renderInstallerUserConfigSnippet(config, 'opencode', '$PLUXX_TX_STAGE')}
${renderInstallerMcpPathMaterializationSnippet('opencode', '$PLUXX_TX_STAGE', '$INSTALL_DIR')}
${renderInstallerRuntimeBootstrapSnippet('$PLUXX_TX_STAGE')}
PLUXX_OPENCODE_COMPANION_STAGE="$TMP_DIR/opencode-companions"
PLUXX_OPENCODE_COMPANION_JOURNAL="$TMP_DIR/opencode-companions-journal.json"
mkdir -p "$PLUXX_OPENCODE_COMPANION_STAGE/skills"
export ENTRY_PATH PLUGIN_NAME PLUXX_OPENCODE_COMPANION_STAGE

node <<'NODE'
const fs = require('fs')

const entryPath = process.env.PLUXX_OPENCODE_COMPANION_STAGE + '/entry.ts'
const pluginName = process.env.PLUGIN_NAME
const exportName = pluginName
  .split(/[^A-Za-z0-9]+/)
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join('')

const content = [
  'import type { Plugin } from "@opencode-ai/plugin"',
  'import { join } from "path"',
  '',
  'import * as PluginModule from "./' + pluginName + '/index.ts"',
  '',
  '// OpenCode auto-loads plugin files placed directly in ~/.config/opencode/plugins.',
  '// Proxy into the installed plugin bundle while preserving its expected root.',
  'const pluginFactory = Object.values(PluginModule).find((value): value is Plugin => typeof value === "function")',
  '',
  'if (!pluginFactory) {',
  '  throw new Error("OpenCode plugin bundle for ' + pluginName + ' did not export a plugin function.")',
  '}',
  '',
  'export const ' + exportName + ': Plugin = async (context) =>',
  '  pluginFactory({',
  '    ...context,',
  '    directory: join(context.directory, "' + pluginName + '"),',
  '  })',
  '',
].join('\\n')

fs.writeFileSync(entryPath, content)
NODE

if [[ -d "$PLUXX_TX_STAGE/skills" ]]; then
  for skill_dir in "$PLUXX_TX_STAGE"/skills/*; do
    [[ -d "$skill_dir" ]] || continue
    skill_name="$(basename "$skill_dir")"
    installed_skill_dir="$PLUXX_OPENCODE_COMPANION_STAGE/skills/\${skill_name}"
    cp -R "$skill_dir" "$installed_skill_dir"

    export SKILL_PATH="$installed_skill_dir/SKILL.md"
    export SKILL_NAME="$skill_name"
    export PLUGIN_NAME

    node <<'NODE'
const fs = require('fs')

const filepath = process.env.SKILL_PATH
const pluginName = process.env.PLUGIN_NAME
const fallbackName = process.env.SKILL_NAME

if (!fs.existsSync(filepath)) process.exit(0)

const content = fs.readFileSync(filepath, 'utf8')
const match = content.match(/^---\\n([\\s\\S]*?)\\n---\\n?/)
const namespacedName = pluginName + '/' + fallbackName

if (!match) {
  fs.writeFileSync(filepath, '---\\nname: ' + namespacedName + '\\n---\\n\\n' + content)
  process.exit(0)
}

const frontmatter = match[1]
const nameMatch = frontmatter.match(/^name:\\s*(.+)$/m)
const existingName = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : fallbackName
const nextName = existingName.startsWith(pluginName + '/') ? existingName : pluginName + '/' + existingName
const nextFrontmatter = nameMatch
  ? frontmatter.replace(/^name:\\s*.+$/m, 'name: ' + nextName)
  : 'name: ' + nextName + '\\n' + frontmatter

fs.writeFileSync(
  filepath,
  content.slice(0, match.index) + '---\\n' + nextFrontmatter + '\\n---\\n' + content.slice(match[0].length),
)
NODE
  done
fi
pluxx_swap_install_transaction
pluxx_commit_opencode_companions
pluxx_commit_install_transaction
PLUXX_TX_COMMITTED=1
pluxx_finalize_opencode_companions
pluxx_discard_install_transaction

echo "Installed $PLUGIN_NAME plugin code to $INSTALL_DIR"
echo "Installed OpenCode wrapper at $ENTRY_PATH"
echo "Synced namespaced skills into $SKILLS_ROOT"
echo "${getPublishReloadInstruction('opencode')}"
`
}

function replaceInstallerPlaceholders(
  script: string,
  config: PluginConfig,
  context: ReleaseArtifactContext,
): string {
  return script
    .replaceAll('REPO_PLACEHOLDER', context.repo)
    .replaceAll('PLUGIN_PLACEHOLDER', config.name)
    .replaceAll('DISPLAY_PLACEHOLDER', getDisplayName(config))
    .replaceAll('AUTHOR_PLACEHOLDER', getAuthorName(config))
    .replaceAll('HOMEPAGE_PLACEHOLDER', getHomepageUrl(config, context.repo))
    .replaceAll('DESCRIPTION_PLACEHOLDER', config.brand?.shortDescription ?? config.description)
    .replaceAll('VERSION_PLACEHOLDER', context.version)
    .replaceAll('CLAUDE_BUNDLE_PLACEHOLDER', getArchiveAssetName(config.name, 'claude-code', context.version, 'latest'))
    .replaceAll('CURSOR_BUNDLE_PLACEHOLDER', getArchiveAssetName(config.name, 'cursor', context.version, 'latest'))
    .replaceAll('CODEX_BUNDLE_PLACEHOLDER', getArchiveAssetName(config.name, 'codex', context.version, 'latest'))
    .replaceAll('OPENCODE_BUNDLE_PLACEHOLDER', getArchiveAssetName(config.name, 'opencode', context.version, 'latest'))
}

function renderInstallerScript(
  asset: PublishAssetPlan,
  config: PluginConfig,
  context: ReleaseArtifactContext,
): string {
  if (asset.name === 'install.sh') {
    return replaceInstallerPlaceholders(renderTopLevelInstallScript(context.installerTargets), config, context)
  }

  if (asset.name === 'install-all.sh') {
    return replaceInstallerPlaceholders(renderInstallAllScript(context.installerTargets), config, context)
  }

  if (asset.platform === 'claude-code') {
    return replaceInstallerPlaceholders(renderInstallClaudeCodeScript(config), config, context)
  }
  if (asset.platform === 'cursor') {
    return replaceInstallerPlaceholders(renderInstallCursorScript(config), config, context)
  }
  if (asset.platform === 'codex') {
    return replaceInstallerPlaceholders(renderInstallCodexScript(config), config, context)
  }
  if (asset.platform === 'opencode') {
    return replaceInstallerPlaceholders(renderInstallOpenCodeScript(config), config, context)
  }

  throw new Error(`No installer template for asset ${asset.name}`)
}

function writeChecksumFile(tempRoot: string, files: string[]): string {
  const checksumPath = resolve(tempRoot, 'SHA256SUMS.txt')
  const lines = files
    .map((filePath) => {
      const digest = createHash('sha256').update(readFileSync(filePath)).digest('hex')
      const name = filePath.split('/').pop()!
      return `${digest}  ${name}`
    })
    .join('\n')
  writeFileSync(checksumPath, `${lines}\n`)
  return checksumPath
}

function prepareNpmArtifact(packageDir: string, runCommand: CommandRunner): PreparedNpmArtifact {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-npm-pack-'))
  const packed = runCommand('npm', ['pack', '--json', '--pack-destination', tempRoot], { cwd: packageDir })
  if (packed.status !== 0) {
    return { tempRoot, error: packed.stderr || packed.stdout || 'npm pack failed' }
  }
  try {
    const payload = JSON.parse(packed.stdout) as Array<{ filename?: unknown; integrity?: unknown }>
    const filename = typeof payload[0]?.filename === 'string' ? payload[0].filename : undefined
    const integrity = typeof payload[0]?.integrity === 'string' ? payload[0].integrity : undefined
    if (!filename || !integrity) return { tempRoot, error: 'npm pack did not return filename and integrity.' }
    return { tempRoot, filepath: resolve(tempRoot, filename), integrity }
  } catch {
    return { tempRoot, error: 'npm pack returned unreadable JSON.' }
  }
}

function createReleaseArtifacts(
  rootDir: string,
  config: PluginConfig,
  plan: PublishPlan,
  runCommand: CommandRunner,
): { tempRoot: string; files: string[] } {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-publish-'))
  const created: string[] = []
  const githubRelease = plan.channels.githubRelease

  if (!githubRelease.repo || !githubRelease.releaseTag) {
    rmSync(tempRoot, { recursive: true, force: true })
    throw new Error('GitHub release publishing requires a resolved repository slug and release tag.')
  }

  const context: ReleaseArtifactContext = {
    repo: githubRelease.repo,
    version: plan.version,
    releaseTag: githubRelease.releaseTag,
    builtTargets: githubRelease.assets
      .filter((asset): asset is PublishAssetPlan & { platform: TargetPlatform } => asset.kind === 'archive' && asset.platform !== undefined)
      .map((asset) => asset.platform),
    installerTargets: githubRelease.assets
      .filter(
        (asset): asset is PublishAssetPlan & { platform: typeof INSTALLER_TARGETS[number] } =>
          asset.kind === 'installer'
          && asset.name !== 'install.sh'
          && asset.name !== 'install-all.sh'
          && asset.platform !== undefined
          && isInstallerTarget(asset.platform),
      )
      .map((asset) => asset.platform),
    assetBaseURL: buildAssetBaseUrl(githubRelease.repo),
  }

  try {
    for (const asset of githubRelease.assets) {
      if (asset.kind !== 'archive') continue
      const archivePath = resolve(tempRoot, asset.name)
      const result = runCommand(
        'tar',
        ['-czf', archivePath, '-C', resolve(rootDir, config.outDir), asset.platform!],
        { cwd: rootDir },
      )
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `Failed to create archive for ${asset.platform}`)
      }
      created.push(archivePath)
    }

    for (const asset of githubRelease.assets) {
      if (asset.kind !== 'installer') continue
      const installerPath = resolve(tempRoot, asset.name)
      writeFileSync(installerPath, renderInstallerScript(asset, config, context))
      chmodSync(installerPath, 0o755)
      created.push(installerPath)
    }

    const manifestAsset = githubRelease.assets.find((asset) => asset.kind === 'manifest')
    if (manifestAsset) {
      const manifestPath = resolve(tempRoot, manifestAsset.name)
      writeFileSync(manifestPath, buildReleaseManifest(config, context))
      created.push(manifestPath)
    }

    const checksumAsset = githubRelease.assets.find((asset) => asset.kind === 'checksum')
    if (checksumAsset) {
      const checksumPath = writeChecksumFile(tempRoot, created)
      if (checksumPath !== resolve(tempRoot, checksumAsset.name)) {
        throw new Error(`Checksum output path mismatch for ${checksumAsset.name}`)
      }
      created.push(checksumPath)
    }

    return { tempRoot, files: created }
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true })
    throw error
  }
}

function verifyGithubReleaseAssets(
  rootDir: string,
  releaseTag: string,
  files: string[],
  runCommand: CommandRunner,
): boolean {
  const verification = runCommand('gh', ['release', 'view', releaseTag, '--json', 'tagName,assets'], { cwd: rootDir })
  if (verification.status !== 0) return false

  try {
    const payload = JSON.parse(verification.stdout) as { tagName?: unknown; assets?: Array<{ name?: unknown }> }
    const assetNames = (payload.assets ?? []).map((asset) => asset.name)
    const expectedNames = files.map((filepath) => filepath.split('/').pop()!)
    const actualAssets = new Set(assetNames)
    if (
      payload.tagName !== releaseTag
      || assetNames.length !== files.length
      || actualAssets.size !== files.length
      || expectedNames.some((name) => !actualAssets.has(name))
    ) {
      return false
    }

    const downloadRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-release-verify-'))
    try {
      const download = runCommand(
        'gh',
        ['release', 'download', releaseTag, '--dir', downloadRoot, '--clobber'],
        { cwd: rootDir },
      )
      if (download.status !== 0) return false

      return files.every((filepath) => {
        const remotePath = resolve(downloadRoot, filepath.split('/').pop()!)
        if (!existsSync(remotePath)) return false
        const localDigest = createHash('sha256').update(readFileSync(filepath)).digest('hex')
        const remoteDigest = createHash('sha256').update(readFileSync(remotePath)).digest('hex')
        return localDigest === remoteDigest
      })
    } finally {
      rmSync(downloadRoot, { recursive: true, force: true })
    }
  } catch {
    return false
  }
}

export function formatPublishPlan(plan: PublishPlan): string[] {
  const lines: string[] = [
    `Resolved version: ${plan.version}`,
    `Resolved tag: ${plan.tag}`,
    `Channels: ${[
      plan.channels.npm.enabled ? `npm${plan.channels.npm.explicit ? ' (explicit)' : ' (auto)'}` : null,
      plan.channels.githubRelease.enabled ? `github-release${plan.channels.githubRelease.explicit ? ' (explicit)' : ' (auto)'}` : null,
    ].filter(Boolean).join(', ') || 'none'}`,
    '',
    'Checks:',
  ]

  for (const check of plan.checks) {
    lines.push(`  - ${check.name}: ${check.ok ? 'ok' : 'fail'}${check.detail ? ` — ${check.detail}` : ''}`)
  }

  lines.push('')
  if (plan.channels.npm.enabled) {
    lines.push(`npm package: ${plan.channels.npm.packageName ?? 'unknown'} (${plan.channels.npm.packageDir ?? 'missing'})`)
  }

  if (plan.channels.githubRelease.enabled) {
    lines.push(`GitHub repo: ${plan.channels.githubRelease.repo ?? 'unknown'}`)
    lines.push(`GitHub release tag: ${plan.channels.githubRelease.releaseTag}`)
    lines.push('Assets:')
    for (const asset of plan.channels.githubRelease.assets) {
      lines.push(`  - ${asset.name} <- ${asset.path}`)
    }
  }

  if (plan.dryRun) {
    lines.push('')
    lines.push('No remote changes were made.')
  }

  return lines
}

export function runPublish(config: PluginConfig, options: PublishPlanOptions = {}): PublishRunResult {
  const rootDir = options.rootDir ?? process.cwd()
  const runCommand = options.runCommand ?? runCommandDefault
  const plan = planPublish(config, options)

  const failedChecks = plan.checks.filter((check) => !check.ok)
  if (failedChecks.length > 0) {
    return {
      ...plan,
      ok: false,
    }
  }

  if (options.dryRun) {
    return {
      ...plan,
      ok: true,
    }
  }

  const execution: NonNullable<PublishRunResult['execution']> = {}
  if (plan.channels.npm.enabled) {
    const npmChannel = plan.channels.npm
    const prepared = prepareNpmArtifact(npmChannel.packageDir!, runCommand)
    try {
      const existing = prepared.error
        ? { status: 1, stdout: '', stderr: prepared.error }
        : runCommand('npm', ['view', `${npmChannel.packageName}@${plan.version}`, 'dist.integrity', '--json'], { cwd: npmChannel.packageDir })
      const remoteIntegrity = existing.status === 0 ? existing.stdout.replace(/["\s]/g, '') : ''
      const alreadyPublished = Boolean(prepared.integrity && remoteIntegrity === prepared.integrity)
      const integrityConflict = existing.status === 0 && remoteIntegrity !== '' && !alreadyPublished
      const lookupFailed = existing.status !== 0 && !isRemoteNotFound(existing, 'npm')
      const result: CommandResult = prepared.error
        ? { status: 1, stdout: '', stderr: prepared.error }
        : lookupFailed
          ? { status: existing.status, stdout: existing.stdout, stderr: `Unable to verify whether npm already has ${npmChannel.packageName}@${plan.version}: ${existing.stderr || existing.stdout}` }
        : integrityConflict
          ? { status: 1, stdout: '', stderr: `npm already has ${npmChannel.packageName}@${plan.version} with different artifact integrity.` }
          : alreadyPublished
            ? existing
            : runCommand(
              'npm',
              ['publish', prepared.filepath!, '--tag', plan.tag, '--access', 'public'],
              { cwd: npmChannel.packageDir },
            )
      const verification = result.status === 0
        ? runCommand('npm', ['view', `${npmChannel.packageName}@${plan.version}`, 'dist.integrity', '--json'], { cwd: npmChannel.packageDir })
        : undefined
      const verified = verification
        ? verification.status === 0 && verification.stdout.replace(/["\s]/g, '') === prepared.integrity
        : false
      execution.npm = {
        ok: result.status === 0 && verified,
        action: result.status === 0 ? (alreadyPublished ? 'already-published' : 'published') : 'failed',
        verified,
        detail: result.status === 0 && verified
          ? (alreadyPublished ? `npm already has byte-identical immutable version ${plan.version}; skipped publish.` : (result.stdout.trim() || 'npm publish complete'))
          : result.status === 0
            ? `npm post-publish integrity verification failed for ${npmChannel.packageName}@${plan.version}.`
            : (result.stderr || result.stdout || 'npm publish failed'),
      }
    } finally {
      rmSync(prepared.tempRoot, { recursive: true, force: true })
    }
  }

  if (plan.channels.githubRelease.enabled) {
    const releaseTag = plan.channels.githubRelease.releaseTag!
    const { tempRoot, files } = createReleaseArtifacts(rootDir, config, plan, runCommand)

    try {
      const existing = runCommand('gh', ['release', 'view', releaseTag, '--json', 'assets'], { cwd: rootDir })

      const reconciled = existing.status === 0
      let staleAssetError: CommandResult | undefined = existing.status !== 0 && !isRemoteNotFound(existing, 'github-release')
        ? { status: existing.status, stdout: existing.stdout, stderr: `Unable to inspect GitHub release ${releaseTag}: ${existing.stderr || existing.stdout}` }
        : undefined
      if (reconciled) {
        try {
          const payload = JSON.parse(existing.stdout) as { assets?: Array<{ name?: string }> }
          const expectedNames = new Set(files.map((filepath) => filepath.split('/').pop()!))
          for (const asset of payload.assets ?? []) {
            if (!asset.name || expectedNames.has(asset.name)) continue
            const deleted = runCommand('gh', ['release', 'delete-asset', releaseTag, asset.name, '--yes'], { cwd: rootDir })
            if (deleted.status !== 0) {
              staleAssetError = deleted
              break
            }
          }
        } catch {
          staleAssetError = { status: 1, stdout: '', stderr: 'Existing GitHub release asset inventory was unreadable.' }
        }
      }

      const result = staleAssetError
        ?? (reconciled
        ? runCommand('gh', ['release', 'upload', releaseTag, '--clobber', ...files], { cwd: rootDir })
        : runCommand(
          'gh',
          [
            'release',
            'create',
            releaseTag,
            ...files,
            '--title',
            `${config.name} ${plan.version}`,
            '--notes',
            `Release generated by pluxx publish for ${config.name}@${plan.version}.`,
          ],
          { cwd: rootDir },
        ))

      const verified = result.status === 0
        ? verifyGithubReleaseAssets(rootDir, releaseTag, files, runCommand)
        : false

      execution.githubRelease = {
        ok: result.status === 0 && verified,
        action: result.status === 0 ? (reconciled ? 'reconciled' : 'created') : 'failed',
        verified,
        detail: result.status === 0 && verified
          ? (result.stdout.trim() || `GitHub release ${releaseTag} ${reconciled ? 'reconciled' : 'created'}`)
          : result.status === 0
            ? `GitHub release ${releaseTag} post-publish verification is incomplete.`
          : (result.stderr || result.stdout || 'GitHub release publish failed'),
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  }

  const ok = Object.values(execution).every((channel) => channel.ok)
  return {
    ...plan,
    ok,
    execution,
  }
}
