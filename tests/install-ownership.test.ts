import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import {
  getInstallOwnershipPath,
  hashInstallBundle,
  listInstallOwnershipDrift,
  readInstallOwnership,
  removeOwnedInstall,
  transactionalInstall,
  transactionalInstallGroup,
} from '../src/install-ownership'

const ROOT = resolve(import.meta.dir, '.install-ownership-fixture')
const HOME = resolve(ROOT, 'home')
const SOURCE = resolve(ROOT, 'source')
const INSTALL = resolve(HOME, '.cursor/plugins/local/fixture')

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  mkdirSync(SOURCE, { recursive: true })
  writeFileSync(resolve(SOURCE, 'plugin.json'), '{"version":"1.0.0"}\n')
  writeFileSync(resolve(SOURCE, 'owned.txt'), 'owned\n')
  process.env.HOME = HOME
})

afterEach(() => rmSync(ROOT, { recursive: true, force: true }))

describe('install ownership transactions', () => {
  it('records copied content and detects same-version byte drift', () => {
    transactionalInstall({
      pluginName: 'fixture',
      platform: 'cursor',
      sourcePath: SOURCE,
      installPath: INSTALL,
      kind: 'copy',
    })
    const ownership = readInstallOwnership('fixture', 'cursor', INSTALL)!
    expect(ownership.entries.length).toBe(2)
    expect(listInstallOwnershipDrift(ownership)).toEqual([])

    writeFileSync(resolve(INSTALL, 'owned.txt'), 'user edit\n')
    expect(listInstallOwnershipDrift(ownership)).toContain('owned file was modified: owned.txt')
    expect(hashInstallBundle(INSTALL)).not.toBe(hashInstallBundle(SOURCE))
  })

  it('records executable ownership and detects mode-only drift', () => {
    const executable = resolve(SOURCE, 'run-hook')
    writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    transactionalInstall({
      pluginName: 'fixture',
      platform: 'cursor',
      sourcePath: SOURCE,
      installPath: INSTALL,
      kind: 'copy',
    })

    const ownership = readInstallOwnership('fixture', 'cursor', INSTALL)!
    expect(ownership.entries.find(entry => entry.path === 'run-hook')?.executable).toBe(true)
    expect(listInstallOwnershipDrift(ownership)).toEqual([])
    const before = hashInstallBundle(INSTALL)

    chmodSync(resolve(INSTALL, 'run-hook'), 0o644)
    expect(listInstallOwnershipDrift(ownership)).toContain('owned file mode was modified: run-hook')
    expect(hashInstallBundle(INSTALL)).not.toBe(before)
    expect(removeOwnedInstall('fixture', 'cursor', INSTALL).preserved).toContain('run-hook')
  })

  it('keeps the previous working bundle when staged validation fails', () => {
    transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: SOURCE, installPath: INSTALL, kind: 'copy' })
    writeFileSync(resolve(SOURCE, 'owned.txt'), 'candidate\n')

    expect(() => transactionalInstall({
      pluginName: 'fixture',
      platform: 'cursor',
      sourcePath: SOURCE,
      installPath: INSTALL,
      kind: 'copy',
      validate: () => { throw new Error('invalid candidate') },
    })).toThrow('invalid candidate')
    expect(readFileSync(resolve(INSTALL, 'owned.txt'), 'utf-8')).toBe('owned\n')
  })

  it('restores the previous bundle when live verification fails after the swap', () => {
    transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: SOURCE, installPath: INSTALL, kind: 'copy' })
    writeFileSync(resolve(SOURCE, 'owned.txt'), 'candidate\n')
    let calls = 0
    expect(() => transactionalInstall({
      pluginName: 'fixture',
      platform: 'cursor',
      sourcePath: SOURCE,
      installPath: INSTALL,
      kind: 'copy',
      validate: () => { if (++calls === 2) throw new Error('consumer verification failed') },
    })).toThrow('consumer verification failed')
    expect(readFileSync(resolve(INSTALL, 'owned.txt'), 'utf-8')).toBe('owned\n')
  })

  it('rolls back every owned surface when a companion swap fails', () => {
    const entryPath = resolve(HOME, '.cursor/plugins/local/fixture.ts')
    transactionalInstallGroup({
      pluginName: 'fixture',
      platform: 'cursor',
      targets: [
        { sourcePath: SOURCE, installPath: INSTALL, kind: 'copy' },
        { installPath: entryPath, kind: 'file', surface: 'entry', content: 'old entry\n' },
      ],
    })
    writeFileSync(resolve(SOURCE, 'owned.txt'), 'candidate\n')
    let entryValidations = 0

    expect(() => transactionalInstallGroup({
      pluginName: 'fixture',
      platform: 'cursor',
      targets: [
        { sourcePath: SOURCE, installPath: INSTALL, kind: 'copy' },
        {
          installPath: entryPath,
          kind: 'file',
          surface: 'entry',
          content: 'new entry\n',
          validate: () => { if (++entryValidations === 2) throw new Error('companion verification failed') },
        },
      ],
    })).toThrow('companion verification failed')
    expect(readFileSync(resolve(INSTALL, 'owned.txt'), 'utf-8')).toBe('owned\n')
    expect(readFileSync(entryPath, 'utf-8')).toBe('old entry\n')
    expect(listInstallOwnershipDrift(readInstallOwnership('fixture', 'cursor', entryPath, 'entry')!)).toEqual([])
  })

  it('refuses to replace an unowned companion file', () => {
    const entryPath = resolve(HOME, '.cursor/plugins/local/fixture.ts')
    mkdirSync(resolve(entryPath, '..'), { recursive: true })
    writeFileSync(entryPath, 'private entry\n')
    expect(() => transactionalInstall({
      pluginName: 'fixture',
      platform: 'cursor',
      installPath: entryPath,
      kind: 'file',
      surface: 'entry',
      content: 'managed entry\n',
    })).toThrow('unowned install')
    expect(readFileSync(entryPath, 'utf-8')).toBe('private entry\n')
  })

  it('refuses reinstall over modified or unowned copied content', () => {
    mkdirSync(INSTALL, { recursive: true })
    writeFileSync(resolve(INSTALL, 'private.txt'), 'mine\n')
    expect(() => transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: SOURCE, installPath: INSTALL, kind: 'copy' })).toThrow('unowned install')

    rmSync(INSTALL, { recursive: true, force: true })
    transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: SOURCE, installPath: INSTALL, kind: 'copy' })
    writeFileSync(resolve(INSTALL, 'owned.txt'), 'mine\n')
    expect(() => transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: SOURCE, installPath: INSTALL, kind: 'copy' })).toThrow('modified install')
  })

  it('removes unchanged owned files while preserving modified and extra files', () => {
    transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: SOURCE, installPath: INSTALL, kind: 'copy' })
    writeFileSync(resolve(INSTALL, 'owned.txt'), 'mine\n')
    writeFileSync(resolve(INSTALL, 'extra.txt'), 'extra\n')

    const result = removeOwnedInstall('fixture', 'cursor', INSTALL)
    expect(result.removed).toContain('plugin.json')
    expect(result.preserved).toEqual(expect.arrayContaining(['owned.txt', 'extra.txt']))
    expect(existsSync(resolve(INSTALL, 'owned.txt'))).toBe(true)
    expect(existsSync(resolve(INSTALL, 'extra.txt'))).toBe(true)
    expect(existsSync(getInstallOwnershipPath('fixture', 'cursor'))).toBe(false)
  })

  it('rejects tampered ownership paths before deleting anything', () => {
    mkdirSync(resolve(INSTALL, '..'), { recursive: true })
    const sentinel = resolve(ROOT, 'sentinel.txt')
    writeFileSync(sentinel, 'keep\n')
    const ownershipPath = getInstallOwnershipPath('fixture', 'cursor')
    mkdirSync(resolve(ownershipPath, '..'), { recursive: true })
    writeFileSync(ownershipPath, JSON.stringify({
      schema: 'pluxx.install-ownership.v1',
      pluginName: 'fixture',
      platform: 'cursor',
      installPath: INSTALL,
      kind: 'copy',
      entries: [{ path: '../../../../sentinel.txt', kind: 'file', sha256: '0'.repeat(64) }],
    }))
    expect(() => removeOwnedInstall('fixture', 'cursor', INSTALL)).toThrow('invalid owned entry')
    expect(readFileSync(sentinel, 'utf-8')).toBe('keep\n')
  })
})
