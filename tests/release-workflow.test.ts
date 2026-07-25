import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { parse } from 'yaml'
import { spawnSync } from 'child_process'

const ROOT = resolve(import.meta.dir, '..')
const releaseWorkflow = readFileSync(resolve(ROOT, '.github/workflows/release.yml'), 'utf-8')
const ciWorkflow = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf-8')

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
          steps: Array<{
            name?: string
            uses?: string
            run?: string
            env?: Record<string, string>
            with?: Record<string, string | number>
          }>
        }
      }
    }
    const checkout = workflow.jobs.publish.steps.find((step) => step.name === 'Check out repository')
    const version = workflow.jobs.publish.steps.find((step) => step.name === 'Resolve release version')
    const release = workflow.jobs.publish.steps.find((step) => step.name === 'Create GitHub release')

    expect(workflow.on.push.tags).toEqual(['v*'])
    expect(workflow.on.workflow_dispatch.inputs.release_tag).toEqual({
      description: 'Existing release tag to recover from the trusted main workflow',
      required: true,
      default: 'v0.1.32',
      type: 'string',
    })
    expect(checkout?.with?.['fetch-depth']).toBe(0)
    expect(checkout?.with?.ref).toBe("${{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref }}")
    expect(version?.env?.REQUESTED_RELEASE_TAG).toBe("${{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}")
    expect(version?.run).toContain('Release recovery must be dispatched from main')
    expect(version?.run).toContain('git show-ref --verify --quiet "refs/tags/${TAG_NAME}"')
    expect(version?.run).toContain('git fetch --no-tags origin main:refs/remotes/origin/main')
    expect(version?.run).toContain('git rev-parse "refs/remotes/origin/main^{commit}"')
    expect(version?.run).toContain('git merge-base --is-ancestor "${TAG_COMMIT}" "${TRUSTED_MAIN_COMMIT}"')
    expect(version?.run).not.toContain('if [[ "${GITHUB_EVENT_NAME}" == "workflow_dispatch" ]]; then')
    expect(version?.run).toContain('Checked-out commit ${HEAD_COMMIT} does not match ${TAG_NAME} commit ${TAG_COMMIT}.')
    expect(version?.run).toContain('echo "release_tag=${TAG_NAME}" >> "$GITHUB_OUTPUT"')
    expect(release?.with?.tag_name).toBe('${{ steps.version.outputs.release_tag }}')
  })

  it('rejects a normal release tag whose commit is outside trusted main history', () => {
    const workflow = parse(releaseWorkflow) as {
      jobs: { publish: { steps: Array<{ name?: string; run?: string }> } }
    }
    const versionScript = workflow.jobs.publish.steps.find((step) => step.name === 'Resolve release version')?.run
    expect(versionScript).toBeTruthy()

    const fixtureRoot = mkdtempSync(join(tmpdir(), 'pluxx-release-tag-'))
    const remote = join(fixtureRoot, 'remote.git')
    const checkout = join(fixtureRoot, 'checkout')
    const output = join(fixtureRoot, 'github-output')
    const git = (args: string[], cwd = checkout) => {
      const result = spawnSync('git', args, { cwd, encoding: 'utf-8' })
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
    const releaseCheck = workflow.jobs.publish.steps.find((step) => step.name === 'Run release checks')
    expect(releaseCheck?.env?.PLUXX_RELEASE_TAG).toBe('${{ steps.version.outputs.release_tag }}')
    expect(names.indexOf('Resolve release version')).toBeLessThan(names.indexOf('Install dependencies'))
    expect(names.indexOf('Install dependencies')).toBeLessThan(names.indexOf('Run release checks'))
    expect(names.indexOf('Pack release tarball')).toBeLessThan(names.indexOf('Verify packaged Node runtime'))
    expect(names.indexOf('Verify packaged Node runtime')).toBeLessThan(names.indexOf('Publish to npm'))
    expect(names.indexOf('Publish to npm')).toBeLessThan(names.indexOf('Verify npm publication'))
    expect(names.indexOf('Verify npm publication')).toBeLessThan(names.indexOf('Create GitHub release'))
    expect(names.indexOf('Create GitHub release')).toBeLessThan(names.indexOf('Verify GitHub release asset'))
    for (const step of workflow.jobs.publish.steps as Array<{ name?: string; run?: string }>) {
      if (!step.run) continue
      const syntax = spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf-8' })
      expect(syntax.status, `${step.name}: ${syntax.stderr}`).toBe(0)
    }
  })

  it('blocks CI when canonical proof versions or receipts are stale', () => {
    expect(ciWorkflow).toContain('name: Check proof freshness')
    expect(ciWorkflow).toContain('run: npm run proof:check')
    expect(ciWorkflow).toMatch(/uses:\s+actions\/checkout@v5\n\s+with:\n\s+fetch-depth:\s+0/)
  })
})
