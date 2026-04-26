import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
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
  Bun.spawnSync(['chmod', '+x', path])
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
              'claude-code': { prompt: '/exa-research-example:deep-research topic' },
              cursor: { prompt: '/exa-deep-research topic' },
              codex: { prompt: 'Use Exa Research Example to research topic.' },
              opencode: { prompt: '/deep-research topic' },
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
})
