import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { applyFileMutations, publishStagedDirectory } from '../src/fs-transaction'

let rootDir = ''

beforeEach(() => {
  rootDir = mkdtempSync(resolve(tmpdir(), 'pluxx-fs-transaction-'))
})

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true })
})

describe('filesystem transactions', () => {
  it('rolls back every file when an injected apply failure occurs', () => {
    writeFileSync(resolve(rootDir, 'existing.txt'), 'before\n')

    expect(() => applyFileMutations(rootDir, [
      { path: 'existing.txt', action: 'update', content: 'after\n' },
      { path: 'created.txt', action: 'create', content: 'created\n' },
    ], {
      injectFailure(phase, detail) {
        if (phase === 'entry-applied' && detail === 'created.txt') {
          throw new Error('injected failure')
        }
      },
    })).toThrow('Original files were restored')

    expect(readFileSync(resolve(rootDir, 'existing.txt'), 'utf-8')).toBe('before\n')
    expect(existsSync(resolve(rootDir, 'created.txt'))).toBe(false)
    expect(existsSync(resolve(rootDir, '.pluxx/transactions'))).toBe(false)
  })

  it('cleans the journal when failure is injected before the first file mutation', () => {
    writeFileSync(resolve(rootDir, 'existing.txt'), 'before\n')
    expect(() => applyFileMutations(rootDir, [
      { path: 'existing.txt', action: 'update', content: 'after\n' },
    ], {
      injectFailure(phase) {
        if (phase === 'journaled') throw new Error('injected pre-apply failure')
      },
    })).toThrow('Original files were restored')
    expect(readFileSync(resolve(rootDir, 'existing.txt'), 'utf-8')).toBe('before\n')
    expect(existsSync(resolve(rootDir, '.pluxx/transactions'))).toBe(false)
  })

  it('restores mode bits and removes staged residue when an update fails', () => {
    const target = resolve(rootDir, 'script.sh')
    writeFileSync(target, '#!/bin/sh\nexit 0\n')
    chmodSync(target, 0o755)

    expect(() => applyFileMutations(rootDir, [
      { path: 'script.sh', action: 'update', content: '#!/bin/sh\nexit 1\n', mode: 0o644 },
    ], {
      injectFailure(phase) {
        if (phase === 'staged') throw new Error('injected staged failure')
      },
    })).toThrow('Original files were restored')

    expect(readFileSync(target, 'utf-8')).toBe('#!/bin/sh\nexit 0\n')
    expect(statSync(target).mode & 0o777).toBe(0o755)
    expect(readdirSync(rootDir).filter((entry) => entry.includes('.pluxx-'))).toEqual([])
  })

  it('rejects symbolic-link destinations before writing a journal', () => {
    const target = resolve(rootDir, 'target.txt')
    const link = resolve(rootDir, 'link.txt')
    writeFileSync(target, 'before\n')
    symlinkSync(target, link)

    expect(() => applyFileMutations(rootDir, [
      { path: 'link.txt', action: 'update', content: 'after\n' },
    ])).toThrow('does not support symbolic-link paths')

    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readFileSync(target, 'utf-8')).toBe('before\n')
    expect(existsSync(resolve(rootDir, '.pluxx/transactions'))).toBe(false)
  })

  it('rejects a symlinked parent without writing outside the project root', () => {
    const outside = mkdtempSync(resolve(tmpdir(), 'pluxx-fs-outside-'))
    symlinkSync(outside, resolve(rootDir, 'redirect'))
    try {
      expect(() => applyFileMutations(rootDir, [
        { path: 'redirect/created.txt', action: 'create', content: 'unsafe\n' },
      ])).toThrow('does not support symbolic-link paths')
      expect(existsSync(resolve(outside, 'created.txt'))).toBe(false)
      expect(existsSync(resolve(rootDir, '.pluxx/transactions'))).toBe(false)
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('refuses to mutate over an unfinished file transaction', () => {
    const target = resolve(rootDir, 'existing.txt')
    const journalDir = resolve(rootDir, '.pluxx/transactions/unfinished')
    writeFileSync(target, 'before\n')
    mkdirSync(journalDir, { recursive: true })
    writeFileSync(resolve(journalDir, 'journal.json'), '{"state":"applying"}\n')

    expect(() => applyFileMutations(rootDir, [
      { path: 'existing.txt', action: 'update', content: 'after\n' },
    ])).toThrow('Unfinished Pluxx mutation found')
    expect(readFileSync(target, 'utf-8')).toBe('before\n')
  })

  it('rejects stale create plans before writing a journal', () => {
    writeFileSync(resolve(rootDir, 'existing.txt'), 'before\n')
    expect(() => applyFileMutations(rootDir, [
      { path: 'existing.txt', action: 'create', content: 'after\n' },
    ])).toThrow('Create mutation destination already exists')
    expect(readFileSync(resolve(rootDir, 'existing.txt'), 'utf-8')).toBe('before\n')
    expect(existsSync(resolve(rootDir, '.pluxx/transactions'))).toBe(false)
  })

  it('rejects absolute manifest paths before writing a journal', () => {
    const target = resolve(rootDir, 'existing.txt')
    writeFileSync(target, 'before\n')
    expect(() => applyFileMutations(rootDir, [
      { path: target, action: 'update', content: 'after\n' },
    ])).toThrow('must be relative to the project root')
    expect(readFileSync(target, 'utf-8')).toBe('before\n')
    expect(existsSync(resolve(rootDir, '.pluxx/transactions'))).toBe(false)
  })

  it('publishes a staged directory and removes transaction residue', () => {
    const destination = resolve(rootDir, 'dist')
    const staged = resolve(rootDir, '.dist-stage')
    mkdirSync(destination)
    mkdirSync(staged)
    writeFileSync(resolve(destination, 'old.txt'), 'old\n')
    writeFileSync(resolve(staged, 'new.txt'), 'new\n')

    publishStagedDirectory(destination, staged)

    expect(existsSync(resolve(destination, 'old.txt'))).toBe(false)
    expect(readFileSync(resolve(destination, 'new.txt'), 'utf-8')).toBe('new\n')
    expect(readdirSync(rootDir).filter((entry) => entry.includes('pluxx-transaction'))).toEqual([])
  })

  it('restores the original directory when publication fails after backup', () => {
    const destination = resolve(rootDir, 'dist')
    const staged = resolve(rootDir, '.dist-stage')
    mkdirSync(destination)
    mkdirSync(staged)
    writeFileSync(resolve(destination, 'old.txt'), 'old\n')
    writeFileSync(resolve(staged, 'new.txt'), 'new\n')

    expect(() => publishStagedDirectory(destination, staged, {
      injectFailure(phase) {
        if (phase === 'backup-created') throw new Error('injected failure')
      },
    })).toThrow('Original directory was restored')

    expect(readFileSync(resolve(destination, 'old.txt'), 'utf-8')).toBe('old\n')
    expect(existsSync(resolve(destination, 'new.txt'))).toBe(false)
  })

  it('rejects staging on a different parent before mutation', () => {
    const otherRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-fs-other-'))
    mkdirSync(resolve(otherRoot, 'stage'))
    try {
      expect(() => publishStagedDirectory(resolve(rootDir, 'dist'), resolve(otherRoot, 'stage')))
        .toThrow('avoid cross-device publication')
      expect(existsSync(resolve(rootDir, 'dist'))).toBe(false)
    } finally {
      rmSync(otherRoot, { recursive: true, force: true })
    }
  })

  it('refuses to publish over an unfinished directory transaction', () => {
    const destination = resolve(rootDir, 'dist')
    const staged = resolve(rootDir, '.dist-stage')
    mkdirSync(destination)
    mkdirSync(staged)
    writeFileSync(resolve(destination, 'old.txt'), 'old\n')
    writeFileSync(resolve(staged, 'new.txt'), 'new\n')
    writeFileSync(resolve(rootDir, '.dist.pluxx-transaction-unfinished.json'), '{"state":"publishing"}\n')

    expect(() => publishStagedDirectory(destination, staged)).toThrow('Unfinished Pluxx directory publication found')
    expect(readFileSync(resolve(destination, 'old.txt'), 'utf-8')).toBe('old\n')
    expect(readFileSync(resolve(staged, 'new.txt'), 'utf-8')).toBe('new\n')
  })
})
