import { describe, expect, it } from 'bun:test'
import {
  classifyUpgradeInvocationSource,
  compareUpgradeVersions,
  executeUpgrade,
  planUpgrade,
  type UpgradeCommandRunner,
} from '../src/cli/upgrade'

describe('upgrade planning', () => {
  it('classifies global, npx cache, and repository invocations', () => {
    expect(classifyUpgradeInvocationSource('/usr/local/lib/node_modules/@orchid-labs/pluxx/bin/pluxx.js')).toBe('npm-global')
    expect(classifyUpgradeInvocationSource('/tmp/.npm/_npx/123/node_modules/@orchid-labs/pluxx/bin/pluxx.js')).toBe('npx-cache')
    expect(classifyUpgradeInvocationSource('/workspace/pluxx/bin/pluxx.js')).toBe('repo-source')
  })

  it('reports upgrade, current, and downgrade comparisons', () => {
    expect(compareUpgradeVersions('1.2.3', '1.3.0')).toBe('upgrade')
    expect(compareUpgradeVersions('1.2.3', '1.2.3')).toBe('current')
    expect(compareUpgradeVersions('1.2.3', '1.2.2')).toBe('downgrade')
  })

  it('resolves latest and emits a downgrade warning with rollback instructions', () => {
    const plan = planUpgrade({
      packageName: '@orchid-labs/pluxx',
      currentVersion: '1.2.3',
      requestedVersion: 'latest',
      invocationPath: '/usr/local/lib/node_modules/@orchid-labs/pluxx/bin/pluxx.js',
      runCommand: (command) => command === 'npm'
        ? { status: 0, stdout: '"1.2.2"\n', stderr: '' }
        : { status: 0, stdout: '/usr/local/bin/pluxx\n', stderr: '' },
    })

    expect(plan.resolvedVersion).toBe('1.2.2')
    expect(plan.comparison).toBe('downgrade')
    expect(plan.warning).toContain('downgrade')
    expect(plan.rollbackCommand.join(' ')).toContain('@orchid-labs/pluxx@1.2.3')
  })

  it('rejects npm aliases, paths, git URLs, and tarball URLs as versions', () => {
    for (const requestedVersion of ['npm:evil@1.0.0', 'file:/tmp/evil', 'git+https://example.com/evil.git', 'https://example.com/evil.tgz']) {
      const plan = planUpgrade({
        packageName: '@orchid-labs/pluxx',
        currentVersion: '1.2.3',
        requestedVersion,
        invocationPath: '/workspace/pluxx/bin/pluxx.js',
        runCommand: () => ({ status: 0, stdout: '/usr/local/bin/pluxx\n', stderr: '' }),
      })
      expect(plan.error).toContain('Invalid upgrade version')
    }
  })
})

describe('upgrade execution', () => {
  it('reports the active PATH binary and version after a verified upgrade', () => {
    const plan = planUpgrade({
      packageName: '@orchid-labs/pluxx',
      currentVersion: '1.2.3',
      requestedVersion: '1.3.0',
      invocationPath: '/workspace/pluxx/bin/pluxx.js',
      runCommand: (command) => command === 'which'
        ? { status: 0, stdout: '/usr/local/bin/pluxx\n', stderr: '' }
        : { status: 0, stdout: '"1.3.0"\n', stderr: '' },
    })
    const runner: UpgradeCommandRunner = (command, args) => {
      if (command === 'npm') return { status: 0, stdout: 'installed\n', stderr: '' }
      if (command === 'which') return { status: 0, stdout: '/usr/local/bin/pluxx\n', stderr: '' }
      if (command === '/usr/local/bin/pluxx' && args[0] === '--version') return { status: 0, stdout: '1.3.0\n', stderr: '' }
      return { status: 1, stdout: '', stderr: 'unexpected' }
    }

    const result = executeUpgrade(plan, runner, (filepath) => ({
      path: filepath,
      realPath: '/usr/local/lib/node_modules/@orchid-labs/pluxx/bin/pluxx.js',
      packageName: '@orchid-labs/pluxx',
      version: '1.3.0',
    }))
    expect(result.ok).toBe(true)
    expect(result.activePathAfter).toBe('/usr/local/bin/pluxx')
    expect(result.activeVersionAfter).toBe('1.3.0')
    expect(result.detail).toContain('Active PATH binary')
  })

  it('fails clearly when PATH still resolves a stale version', () => {
    const plan = planUpgrade({
      packageName: '@orchid-labs/pluxx',
      currentVersion: '1.2.3',
      requestedVersion: '1.3.0',
      invocationPath: '/workspace/pluxx/bin/pluxx.js',
      runCommand: (command) => command === 'npm'
        ? { status: 0, stdout: '"1.3.0"\n', stderr: '' }
        : { status: 0, stdout: '/usr/local/bin/pluxx\n', stderr: '' },
    })
    const result = executeUpgrade(plan, (command) => {
      if (command === 'npm') return { status: 0, stdout: '', stderr: '' }
      if (command === 'which') return { status: 0, stdout: '/usr/local/bin/pluxx\n', stderr: '' }
      return { status: 1, stdout: '', stderr: 'unexpected executable call' }
    }, (filepath) => ({
      path: filepath,
      realPath: '/usr/local/lib/node_modules/other/bin/pluxx.js',
      packageName: 'other',
      version: '1.3.0',
    }))

    expect(result.ok).toBe(false)
    expect(result.detail).toContain('could not be verified as 1.3.0')
    expect(result.detail).toContain('@orchid-labs/pluxx@1.2.3')
  })
})
