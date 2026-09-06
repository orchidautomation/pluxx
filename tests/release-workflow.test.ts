import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { parse } from 'yaml'
import { spawnSync } from 'child_process'

const ROOT = resolve(import.meta.dir, '..')
const packageVersion = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')).version as string
const expectedReleaseTag = `v${packageVersion}`
const releaseWorkflow = readFileSync(resolve(ROOT, '.github/workflows/release.yml'), 'utf-8')
const ciWorkflow = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf-8')
const recoveryProofScript = readFileSync(resolve(ROOT, 'scripts/release-recovery-proof.mjs'), 'utf-8')

function executableAuthorityScript(
  script: string,
  expectedTag: string,
  expectedTagCommit: string,
  workflowCommit: string,
): string {
  return script
    .replaceAll('${{ steps.version.outputs.release_tag }}', expectedTag)
    .replaceAll('${{ steps.version.outputs.tag_commit }}', expectedTagCommit)
    .replaceAll('${GITHUB_' + 'SHA}', workflowCommit)
}

describe('release workflow', () => {
  it('supports a controlled full-history recovery dispatch for an existing release tag', () => {
    const workflow = parse(releaseWorkflow) as {
      on: {
        push: { tags: string[] }
        workflow_dispatch: {
          inputs: { release_tag: { required: boolean; default: string; type: string } }
        }
      }
      jobs: {
        publish: {
          'timeout-minutes': number
          defaults: { run: { 'working-directory': string } }
          steps: Array<{
            name?: string
            uses?: string
            run?: string
            if?: string
            env?: Record<string, string>
            with?: Record<string, string | number>
          }>
        }
      }
    }
    const checkout = workflow.jobs.publish.steps.find((step) => step.name === 'Check out immutable release tree')
    const trustedMain = workflow.jobs.publish.steps.find((step) => step.name === 'Check out trusted recovery code')
    const version = workflow.jobs.publish.steps.find((step) => step.name === 'Resolve release version')
    const release = workflow.jobs.publish.steps.find((step) => step.name === 'Create GitHub release')
    const recoveryRelease = workflow.jobs.publish.steps.find((step) => step.name === 'Create GitHub recovery release')

    expect(workflow.on.push.tags).toEqual(['v*'])
    expect(workflow.on.workflow_dispatch.inputs.release_tag).toEqual({
      description: 'Existing release tag to recover from the trusted main workflow',
      required: true,
      default: expectedReleaseTag,
      type: 'string',
    })
    expect(workflow.jobs.publish.defaults.run['working-directory']).toBe('release')
    expect(workflow.jobs.publish['timeout-minutes']).toBe(30)
    expect(checkout?.with?.['fetch-depth']).toBe(0)
    expect(checkout?.with?.ref).toBe("${{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref }}")
    expect(checkout?.with?.path).toBe('release')
    expect(trustedMain?.if).toBe("github.event_name == 'workflow_dispatch'")
    expect(trustedMain?.with?.['fetch-depth']).toBe(1)
    expect(trustedMain?.with?.ref).toBe('${{ github.sha }}')
    expect(trustedMain?.with?.path).toBe('trusted-main')
    expect(version?.env?.REQUESTED_RELEASE_TAG).toBe("${{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}")
    expect(version?.run).toContain('Release recovery must be dispatched from main')
    expect(version?.run).toContain('git show-ref --verify --quiet "refs/tags/${TAG_NAME}"')
    expect(version?.run).toContain('git fetch --no-tags origin main:refs/remotes/origin/main')
    expect(version?.run).toContain('git rev-parse "refs/remotes/origin/main^{commit}"')
    expect(version?.run).toContain('git merge-base --is-ancestor "${TAG_COMMIT}" "${TRUSTED_MAIN_COMMIT}"')
    expect(version?.run).toContain('Recovery commit ${GITHUB_SHA} does not match current trusted main ${TRUSTED_MAIN_COMMIT}.')
    expect(version?.run).toContain('git -C ../trusted-main rev-parse HEAD')
    expect(version?.run?.indexOf('git merge-base --is-ancestor "${TAG_COMMIT}" "${TRUSTED_MAIN_COMMIT}"'))
      .toBeLessThan(version?.run?.indexOf('if [[ "${GITHUB_EVENT_NAME}" == "workflow_dispatch" ]]; then') ?? -1)
    expect(version?.run).toContain('Checked-out commit ${HEAD_COMMIT} does not match ${TAG_NAME} commit ${TAG_COMMIT}.')
    expect(version?.run).toContain('echo "release_tag=${TAG_NAME}" >> "$GITHUB_OUTPUT"')
    expect(version?.run).toContain('echo "tag_commit=${TAG_COMMIT}" >> "$GITHUB_OUTPUT"')
    expect(release?.with?.tag_name).toBe('${{ steps.version.outputs.release_tag }}')
    expect(recoveryRelease?.with?.tag_name).toBe('${{ steps.version.outputs.release_tag }}')
  })

  it('rejects a normal release tag whose commit is outside trusted main history', () => {
    const workflow = parse(releaseWorkflow) as {
      jobs: { publish: { steps: Array<{ name?: string; run?: string }> } }
    }
    const versionScript = workflow.jobs.publish.steps.find((step) => step.name === 'Resolve release version')?.run
    expect(versionScript).toBeTruthy()

    const fixtureRoot = mkdtempSync(join(tmpdir(), 'pluxx-release-tag-'))
    const remote = join(fixtureRoot, 'remote.git')
    const checkout = join(fixtureRoot, 'release')
    const output = join(fixtureRoot, 'github-output')
    const git = (args: string[], cwd = checkout) => {
      const result = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL' })
      expect(result.status, result.stderr).toBe(0)
      return result.stdout.trim()
    }

    try {
      git(['init', '--bare', remote], fixtureRoot)
      git(['init', checkout], fixtureRoot)
      git(['config', 'user.email', 'release-test@example.com'])
      git(['config', 'user.name', 'Release Test'])
      writeFileSync(join(checkout, 'package.json'), '{"version":"0.1.37"}\n')
      git(['add', 'package.json'])
      git(['commit', '-m', 'main release version'])
      git(['branch', '-M', 'main'])
      git(['remote', 'add', 'origin', remote])
      git(['push', '-u', 'origin', 'main'])

      git(['switch', '-c', 'side-release'])
      writeFileSync(join(checkout, 'side-only.txt'), 'not reviewed on main\n')
      git(['add', 'side-only.txt'])
      git(['commit', '-m', 'side release'])
      git(['tag', 'v0.1.37'])
      const tagCommit = git(['rev-parse', 'HEAD'])

      const result = spawnSync('bash', ['-c', versionScript!], {
        cwd: checkout,
        encoding: 'utf-8',
        timeout: 15_000,
        killSignal: 'SIGKILL',
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: 'push',
          GITHUB_REF: 'refs/tags/v0.1.37',
          GITHUB_SHA: tagCommit,
          GITHUB_OUTPUT: output,
          REQUESTED_RELEASE_TAG: 'v0.1.37',
        },
      })

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Release tag v0.1.37 is not contained in trusted main commit')
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })

  it('rejects a recovery dispatch whose workflow commit is no longer current main', () => {
    const workflow = parse(releaseWorkflow) as {
      jobs: { publish: { steps: Array<{ name?: string; run?: string }> } }
    }
    const versionScript = workflow.jobs.publish.steps.find((step) => step.name === 'Resolve release version')?.run
    const authorityScripts = [
      'Revalidate recovery authority before npm publish',
      'Revalidate recovery authority before GitHub release',
      'Revalidate recovery authority after GitHub release',
    ].map((name) => workflow.jobs.publish.steps.find((step) => step.name === name)?.run)
    expect(versionScript).toBeTruthy()
    expect(authorityScripts.every(Boolean)).toBe(true)

    const fixtureRoot = mkdtempSync(join(tmpdir(), 'pluxx-release-recovery-main-'))
    const remote = join(fixtureRoot, 'remote.git')
    const release = join(fixtureRoot, 'release')
    const trustedMain = join(fixtureRoot, 'trusted-main')
    const output = join(fixtureRoot, 'github-output')
    const git = (args: string[], cwd = release) => {
      const result = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL' })
      expect(result.status, result.stderr).toBe(0)
      return result.stdout.trim()
    }

    try {
      git(['init', '--bare', remote], fixtureRoot)
      git(['init', release], fixtureRoot)
      git(['config', 'user.email', 'release-test@example.com'])
      git(['config', 'user.name', 'Release Test'])
      writeFileSync(join(release, 'package.json'), '{"version":"0.1.37"}\n')
      git(['add', 'package.json'])
      git(['commit', '-m', 'tagged release'])
      git(['branch', '-M', 'main'])
      git(['tag', 'v0.1.37'])
      const staleWorkflowCommit = git(['rev-parse', 'HEAD'])
      git(['remote', 'add', 'origin', remote])
      git(['push', '-u', 'origin', 'main', '--tags'])

      writeFileSync(join(release, 'recovery-workflow.txt'), 'reviewed recovery workflow\n')
      git(['add', 'recovery-workflow.txt'])
      git(['commit', '-m', 'add recovery workflow'])
      git(['push', 'origin', 'main'])
      const currentMain = git(['rev-parse', 'HEAD'])
      expect(currentMain).not.toBe(staleWorkflowCommit)

      git(['clone', remote, trustedMain], fixtureRoot)
      git(['checkout', '--detach', staleWorkflowCommit], trustedMain)
      git(['checkout', '--detach', 'v0.1.37'])

      const result = spawnSync('bash', ['-c', versionScript!], {
        cwd: release,
        encoding: 'utf-8',
        timeout: 15_000,
        killSignal: 'SIGKILL',
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          GITHUB_REF: 'refs/heads/main',
          GITHUB_SHA: staleWorkflowCommit,
          GITHUB_OUTPUT: output,
          REQUESTED_RELEASE_TAG: 'v0.1.37',
        },
      })

      expect(result.status).toBe(1)
      expect(result.stderr).toContain(
        `Recovery commit ${staleWorkflowCommit} does not match current trusted main ${currentMain}.`,
      )

      for (const gateScript of authorityScripts) {
        const unchanged = spawnSync(
          'bash',
          ['-c', executableAuthorityScript(gateScript!, 'v0.1.37', staleWorkflowCommit, currentMain)],
          { cwd: release, encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL' },
        )
        expect(unchanged.status, unchanged.stderr).toBe(0)
      }

      writeFileSync(join(release, 'side-tag.txt'), 'tag outside main\n')
      git(['add', 'side-tag.txt'])
      git(['commit', '-m', 'side tag'])
      const sideTagCommit = git(['rev-parse', 'HEAD'])
      git(['tag', '--force', 'v0.1.37', sideTagCommit])
      git(['push', '--force', 'origin', 'refs/tags/v0.1.37'])
      for (const gateScript of authorityScripts) {
        const outsideMain = spawnSync(
          'bash',
          ['-c', executableAuthorityScript(gateScript!, 'v0.1.37', sideTagCommit, currentMain)],
          { cwd: release, encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL' },
        )
        expect(outsideMain.status).toBe(1)
      }

      git(['tag', '--force', 'v0.1.37', currentMain])
      git(['push', '--force', 'origin', 'refs/tags/v0.1.37'])
      for (const authorityScript of authorityScripts) {
        const movedTag = spawnSync(
          'bash',
          ['-c', executableAuthorityScript(authorityScript!, 'v0.1.37', staleWorkflowCommit, currentMain)],
          { cwd: release, encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL' },
        )
        expect(movedTag.status).toBe(1)
      }

      git(['tag', '--force', 'v0.1.37', staleWorkflowCommit])
      git(['push', '--force', 'origin', 'refs/tags/v0.1.37'])
      git(['checkout', 'main'])
      writeFileSync(join(release, 'main-advanced.txt'), 'main advanced after gate\n')
      git(['add', 'main-advanced.txt'])
      git(['commit', '-m', 'advance main after gate'])
      git(['push', 'origin', 'main'])
      for (const authorityScript of authorityScripts) {
        const advancedMain = spawnSync(
          'bash',
          ['-c', executableAuthorityScript(authorityScript!, 'v0.1.37', staleWorkflowCommit, currentMain)],
          { cwd: release, encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL' },
        )
        expect(advancedMain.status).toBe(1)
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  }, 15_000)

  it('keeps immutable-tag recovery fail-closed through proof and artifact identity', () => {
    const workflow = parse(releaseWorkflow) as {
      jobs: {
        publish: {
          steps: Array<{
            name?: string
            if?: string
            run?: string
            env?: Record<string, string>
          }>
        }
      }
    }
    const steps = workflow.jobs.publish.steps
    const names = steps.map((step) => step.name)
    const standard = steps.find((step) => step.name === 'Run standard release checks')
    const prepare = steps.find((step) => step.name === 'Prepare immutable-tag recovery proof')
    const verify = steps.find((step) => step.name === 'Verify immutable-tag recovery proof')
    const pack = steps.find((step) => step.name === 'Pack release tarball')
    const npmAuthority = steps.find((step) => step.name === 'Revalidate recovery authority before npm publish')
    const published = steps.find((step) => step.name === 'Verify npm publication')
    const githubAuthority = steps.find((step) => step.name === 'Revalidate recovery authority before GitHub release')
    const postReleaseAuthority = steps.find((step) => step.name === 'Revalidate recovery authority after GitHub release')
    const releaseAsset = steps.find((step) => step.name === 'Verify GitHub release asset')

    expect(standard?.if).toBe("github.event_name != 'workflow_dispatch'")
    expect(standard?.run).toContain('npm run release:check')
    expect(prepare?.run).toContain('../trusted-main/scripts/release-recovery-proof.mjs prepare')
    expect(prepare?.run).toContain('git -C ../trusted-main status --porcelain --untracked-files=no')
    for (const command of [
      'npm run build',
      'npm run typecheck',
      'npm test',
      'node scripts/run-npm-pack.mjs --dry-run',
      'npm pack --pack-destination "${CANDIDATE_DIR}"',
      'node scripts/verify-node-package-runtime.mjs --package-file "${CANDIDATE_PATH}"',
    ]) {
      expect(recoveryProofScript).toContain(command)
    }
    expect(recoveryProofScript).toContain('runPreProofValidations(args)')
    expect(recoveryProofScript).toContain('Recovery does not support current receipt')
    expect(prepare?.run).not.toContain('npm pack --pack-destination')
    expect(prepare?.run?.indexOf('release-recovery-proof.mjs prepare'))
      .toBeLessThan(prepare?.run?.indexOf('CANDIDATE_INTEGRITY=') ?? -1)
    expect(verify?.run).toContain('../trusted-main/scripts/release-recovery-proof.mjs finalize')
    expect(verify?.run).not.toContain('npm run proof:check')
    expect(pack?.run).toContain('../trusted-main/scripts/release-recovery-proof.mjs verify')
    expect(pack?.run).toContain('candidate_integrity')
    expect(pack?.run).toContain('candidate_sha256')
    expect(releaseAsset?.run).toContain('../trusted-main/scripts/release-recovery-proof.mjs verify')
    expect(published?.run).toContain('EXPECTED_INTEGRITY="${{ steps.pack.outputs.package_integrity }}"')
    for (const authority of [npmAuthority, githubAuthority, postReleaseAuthority]) {
      expect(authority?.if).toBe("github.event_name == 'workflow_dispatch'")
      expect(authority?.run).toContain('"main:refs/remotes/origin/main"')
      expect(authority?.run).toContain('"refs/tags/${TAG_NAME}:refs/release-validation/${TAG_NAME}"')
      expect(authority?.run).toContain('test "${CURRENT_MAIN}" = "${GITHUB_SHA}"')
      expect(authority?.run).toContain('test "${CURRENT_TAG}" = "${{ steps.version.outputs.tag_commit }}"')
    }

    expect(names.indexOf('Resolve release version')).toBeLessThan(names.indexOf('Install dependencies'))
    expect(names.indexOf('Install dependencies')).toBeLessThan(names.indexOf('Prepare immutable-tag recovery proof'))
    expect(names.indexOf('Prepare immutable-tag recovery proof')).toBeLessThan(names.indexOf('Verify immutable-tag recovery proof'))
    expect(names.indexOf('Verify immutable-tag recovery proof')).toBeLessThan(names.indexOf('Pack release tarball'))
    expect(names.indexOf('Pack release tarball')).toBeLessThan(names.indexOf('Revalidate recovery authority before npm publish'))
    expect(names.indexOf('Revalidate recovery authority before npm publish')).toBeLessThan(names.indexOf('Publish to npm'))
    expect(names.indexOf('Stage recovery receipt asset')).toBeLessThan(names.indexOf('Revalidate recovery authority before GitHub release'))
    expect(names.indexOf('Revalidate recovery authority before GitHub release')).toBeLessThan(names.indexOf('Create GitHub recovery release'))
    expect(names.indexOf('Create GitHub recovery release')).toBeLessThan(names.indexOf('Verify GitHub release asset'))
    expect(names.indexOf('Verify GitHub release asset')).toBeLessThan(names.indexOf('Revalidate recovery authority after GitHub release'))
    expect(names.at(-1)).toBe('Revalidate recovery authority after GitHub release')
  })

  it('uses GitHub Actions runtime versions that avoid the Node 20 deprecation path', () => {
    expect(releaseWorkflow).toMatch(/uses:\s+actions\/checkout@v5/)
    expect(releaseWorkflow).toMatch(/uses:\s+actions\/setup-node@v5/)
    expect(releaseWorkflow).toMatch(/node-version:\s+24/)
    expect(releaseWorkflow).toMatch(/uses:\s+softprops\/action-gh-release@v3/)
    expect(releaseWorkflow).not.toMatch(/uses:\s+softprops\/action-gh-release@v2/)
    expect(releaseWorkflow).toContain('Verify npm publication')
    expect(releaseWorkflow).toContain('already exists with matching integrity; skipping immutable npm publish')
    expect(releaseWorkflow).toContain('npm view "@orchid-labs/pluxx@${EXPECTED_VERSION}" version')
    expect(releaseWorkflow).toContain('npm publish "./${{ steps.pack.outputs.package_file }}"')
    expect(releaseWorkflow).toContain('dist.integrity')
    expect(releaseWorkflow).toContain('overwrite_files: true')
    expect(releaseWorkflow).toContain('Verify GitHub release asset')
    expect(releaseWorkflow).toContain('gh release view "$TAG" --json tagName,assets')
    expect(releaseWorkflow).toContain('gh release download "$TAG" --pattern "$PACKAGE_FILE" --dir "$DOWNLOAD_DIR"')
    expect(releaseWorkflow).toContain('EXPECTED_INTEGRITY="${{ steps.pack.outputs.package_integrity }}"')
    expect(releaseWorkflow).toContain('openssl dgst -sha512 -binary "$DOWNLOAD_DIR/$PACKAGE_FILE"')
    expect(releaseWorkflow).toContain('test "$RELEASE_INTEGRITY" = "$EXPECTED_INTEGRITY"')
    expect(releaseWorkflow).not.toContain('2>/dev/null || true')
    expect(releaseWorkflow).toContain("grep -Eiq 'E404|404 Not Found|is not in this registry'")
  })

  it('runs the release integrity gates in production order', () => {
    const workflow = parse(releaseWorkflow) as {
      jobs: { publish: { steps: Array<{ name?: string; run?: string; env?: Record<string, string> }> } }
    }
    const names = workflow.jobs.publish.steps.map((step) => step.name)
    const releaseCheck = workflow.jobs.publish.steps.find((step) => step.name === 'Run standard release checks')
    expect(releaseCheck?.env?.PLUXX_RELEASE_TAG).toBe('${{ steps.version.outputs.release_tag }}')
    expect(names.indexOf('Resolve release version')).toBeLessThan(names.indexOf('Install dependencies'))
    expect(names.indexOf('Install dependencies')).toBeLessThan(names.indexOf('Run standard release checks'))
    expect(names.indexOf('Pack release tarball')).toBeLessThan(names.indexOf('Verify packaged Node runtime'))
    expect(names.indexOf('Verify packaged Node runtime')).toBeLessThan(names.indexOf('Publish to npm'))
    expect(names.indexOf('Publish to npm')).toBeLessThan(names.indexOf('Verify npm publication'))
    expect(names.indexOf('Verify npm publication')).toBeLessThan(names.indexOf('Create GitHub release'))
    expect(names.indexOf('Create GitHub release')).toBeLessThan(names.indexOf('Verify GitHub release asset'))
    for (const step of workflow.jobs.publish.steps as Array<{ name?: string; run?: string }>) {
      if (!step.run) continue
      const syntax = spawnSync('bash', ['-n'], {
        input: step.run,
        encoding: 'utf-8',
        timeout: 15_000,
        killSignal: 'SIGKILL',
      })
      expect(syntax.status, `${step.name}: ${syntax.stderr}`).toBe(0)
    }
  })

  it('blocks CI when canonical proof versions or receipts are stale', () => {
    expect(ciWorkflow).toContain('name: Check proof freshness')
    expect(ciWorkflow).toContain('run: npm run proof:check')
    expect(ciWorkflow).toMatch(/uses:\s+actions\/checkout@v5\n\s+with:\n\s+fetch-depth:\s+0/)
  })
})
