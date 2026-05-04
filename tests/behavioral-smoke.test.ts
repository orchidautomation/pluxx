import { afterEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import type { PluginConfig } from '../src/schema'
import { runBehavioralSuite } from '../src/cli/behavioral'

const TMP_ROOTS: string[] = []
const ORIGINAL_PATH = process.env.PATH ?? ''
const ORIGINAL_CURSOR_API_KEY = process.env.CURSOR_API_KEY

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  TMP_ROOTS.push(dir)
  return dir
}

function makeStubExecutable(path: string, body: string): void {
  writeFileSync(path, body)
  chmodSync(path, 0o755)
}

afterEach(() => {
  process.env.PATH = ORIGINAL_PATH
  if (ORIGINAL_CURSOR_API_KEY === undefined) {
    delete process.env.CURSOR_API_KEY
  } else {
    process.env.CURSOR_API_KEY = ORIGINAL_CURSOR_API_KEY
  }

  while (TMP_ROOTS.length > 0) {
    rmSync(TMP_ROOTS.pop()!, { recursive: true, force: true })
  }
})

describe('behavioral smoke suite', () => {
  it('runs platform-specific headless prompts and returns response previews', async () => {
    const rootDir = makeTempDir('pluxx-behavioral-')
    const binDir = resolve(rootDir, '.bin')
    mkdirSync(binDir, { recursive: true })
    mkdirSync(resolve(rootDir, '.pluxx'), { recursive: true })

    writeFileSync(
      resolve(rootDir, '.pluxx/behavioral-smoke.json'),
      JSON.stringify({
        cases: [
          {
            name: 'deep-research',
            targets: {
              'claude-code': {
                prompt: '/exa-research-example:deep-research topic',
                commandId: 'deep-research',
                require: ['response ok'],
              },
              cursor: {
                prompt: '/exa-deep-research topic',
                commandId: 'deep-research',
                require: ['response ok'],
              },
              codex: {
                prompt: 'Use Exa Research Example command `deep-research` to research topic.',
                commandId: 'deep-research',
                require: ['response ok'],
              },
              opencode: {
                prompt: '/deep-research topic',
                commandId: 'deep-research',
                require: ['response ok'],
              },
            },
          },
        ],
      }, null, 2),
    )

    makeStubExecutable(
      resolve(binDir, 'claude'),
      '#!/bin/sh\nprintf "claude response ok\\n"\n',
    )
    makeStubExecutable(
      resolve(binDir, 'agent'),
      '#!/bin/sh\nif [ "$1" = "status" ]; then exit 0; fi\nprintf "cursor response ok\\n"\n',
    )
    makeStubExecutable(
      resolve(binDir, 'opencode'),
      '#!/bin/sh\nprintf "opencode response ok\\n"\n',
    )
    makeStubExecutable(
      resolve(binDir, 'codex'),
      '#!/bin/sh\nOUT=\"\"\nwhile [ $# -gt 0 ]; do\n  if [ \"$1\" = \"--output-last-message\" ]; then\n    shift\n    OUT=\"$1\"\n  fi\n  shift\ndone\nif [ -n \"$OUT\" ]; then\n  printf \"codex response ok\\n\" > \"$OUT\"\nfi\nprintf \"codex stdout\\n\"\n',
    )

    process.env.PATH = `${binDir}:${ORIGINAL_PATH}`
    process.env.CURSOR_API_KEY = 'cursor-test-key'

    const config = { name: 'exa-research-example' } as PluginConfig
    const result = await runBehavioralSuite(rootDir, config, ['claude-code', 'cursor', 'codex', 'opencode'])

    expect(result.ok).toBe(true)
    expect(result.source).toBe('.pluxx/behavioral-smoke.json')
    expect(result.checks).toHaveLength(4)
    expect(result.checks.every((check) => check.ok)).toBe(true)
    expect(result.checks.map((check) => check.platform).sort()).toEqual(['claude-code', 'codex', 'cursor', 'opencode'])
    expect(result.checks.every((check) => check.commandId === 'deep-research')).toBe(true)
  })

  it('fails when a forbidden fallback string appears in the response', async () => {
    const rootDir = makeTempDir('pluxx-behavioral-fail-')
    const binDir = resolve(rootDir, '.bin')
    mkdirSync(binDir, { recursive: true })
    mkdirSync(resolve(rootDir, '.pluxx'), { recursive: true })

    writeFileSync(
      resolve(rootDir, '.pluxx/behavioral-smoke.json'),
      JSON.stringify({
        cases: [
          {
            name: 'claude-deep-research',
            targets: {
              'claude-code': {
                prompt: '/exa-research-example:deep-research topic',
                forbid: ['context too long', 'skill bailed'],
              },
            },
          },
        ],
      }, null, 2),
    )

    makeStubExecutable(
      resolve(binDir, 'claude'),
      '#!/bin/sh\nprintf "The skill bailed (context too long).\\n"\n',
    )

    process.env.PATH = `${binDir}:${ORIGINAL_PATH}`

    const config = { name: 'exa-research-example' } as PluginConfig
    const result = await runBehavioralSuite(rootDir, config, ['claude-code'])

    expect(result.ok).toBe(false)
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0]?.ok).toBe(false)
    expect(result.checks[0]?.failures.some((failure) => failure.includes('matched forbidden text'))).toBe(true)
  })

  it('supports expected failure exits and extra runner args for installed-proof denial cases', async () => {
    const rootDir = makeTempDir('pluxx-behavioral-expected-failure-')
    const binDir = resolve(rootDir, '.bin')
    mkdirSync(binDir, { recursive: true })
    mkdirSync(resolve(rootDir, '.pluxx'), { recursive: true })

    writeFileSync(
      resolve(rootDir, '.pluxx/behavioral-smoke.json'),
      JSON.stringify({
        cases: [
          {
            name: 'permission-denied',
            targets: {
              codex: {
                prompt: 'Use the plugin to attempt a blocked action.',
                expectFailure: true,
                expectedExitCodes: [2],
                runnerArgs: ['--model', 'gpt-5.5'],
                require: ['blocked by policy'],
              },
            },
          },
        ],
      }, null, 2),
    )

    makeStubExecutable(
      resolve(binDir, 'codex'),
      '#!/bin/sh\nOUT=\"\"\nARGS=\"$*\"\nwhile [ $# -gt 0 ]; do\n  if [ \"$1\" = \"--output-last-message\" ]; then\n    shift\n    OUT=\"$1\"\n  fi\n  shift\ndone\nif [ -n \"$OUT\" ]; then\n  printf \"blocked by policy\\n\" > \"$OUT\"\nfi\nprintf \"%s\\n\" \"$ARGS\" > /dev/null\nexit 2\n',
    )

    process.env.PATH = `${binDir}:${ORIGINAL_PATH}`

    const config = { name: 'permission-proof-example' } as PluginConfig
    const result = await runBehavioralSuite(rootDir, config, ['codex'])

    expect(result.ok).toBe(true)
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0]?.ok).toBe(true)
    expect(result.checks[0]?.expectedExitCodes).toEqual([2])
    expect(result.checks[0]?.command).toContain('--model')
  })

  it('rejects command proof cases that do not reference the command explicitly or lack required markers', async () => {
    const rootDir = makeTempDir('pluxx-behavioral-invalid-command-proof-')
    const binDir = resolve(rootDir, '.bin')
    mkdirSync(binDir, { recursive: true })
    mkdirSync(resolve(rootDir, '.pluxx'), { recursive: true })

    writeFileSync(
      resolve(rootDir, '.pluxx/behavioral-smoke.json'),
      JSON.stringify({
        cases: [
          {
            name: 'missing-command-proof',
            targets: {
              codex: {
                prompt: 'Use the plugin to review this change.',
                commandId: 'review-risk-and-policy',
              },
            },
          },
        ],
      }, null, 2),
    )

    makeStubExecutable(
      resolve(binDir, 'codex'),
      '#!/bin/sh\nprintf "this should never run\\n"\n',
    )

    process.env.PATH = `${binDir}:${ORIGINAL_PATH}`

    const config = { name: 'platform-change-ops' } as PluginConfig
    await expect(runBehavioralSuite(rootDir, config, ['codex'])).rejects.toThrow(
      'declares commandId "review-risk-and-policy" but the prompt does not reference that command explicitly.',
    )
  })
})
