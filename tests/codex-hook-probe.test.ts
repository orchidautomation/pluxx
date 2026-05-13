import { afterEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { runCodexHookProbeSuite, type CodexHookProbeScenario } from '../src/codex-hook-probe'

const TMP_ROOTS: string[] = []
const ORIGINAL_THREAD_ID = process.env.CODEX_THREAD_ID
const ORIGINAL_SHELL = process.env.CODEX_SHELL
const ORIGINAL_ORIGINATOR = process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
const ORIGINAL_FAKE_MODE = process.env.PLUXX_FAKE_CODEX_MODE

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
  if (ORIGINAL_THREAD_ID === undefined) {
    delete process.env.CODEX_THREAD_ID
  } else {
    process.env.CODEX_THREAD_ID = ORIGINAL_THREAD_ID
  }

  if (ORIGINAL_SHELL === undefined) {
    delete process.env.CODEX_SHELL
  } else {
    process.env.CODEX_SHELL = ORIGINAL_SHELL
  }

  if (ORIGINAL_ORIGINATOR === undefined) {
    delete process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  } else {
    process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE = ORIGINAL_ORIGINATOR
  }

  if (ORIGINAL_FAKE_MODE === undefined) {
    delete process.env.PLUXX_FAKE_CODEX_MODE
  } else {
    process.env.PLUXX_FAKE_CODEX_MODE = ORIGINAL_FAKE_MODE
  }

  while (TMP_ROOTS.length > 0) {
    rmSync(TMP_ROOTS.pop()!, { recursive: true, force: true })
  }
})

function makeAuthHome(rootDir: string): string {
  const authHome = resolve(rootDir, 'codex-home')
  mkdirSync(authHome, { recursive: true })
  writeFileSync(resolve(authHome, 'auth.json'), '{"access_token":"test"}\n')
  return authHome
}

function makeFakeCodex(rootDir: string): string {
  const binDir = resolve(rootDir, '.bin')
  mkdirSync(binDir, { recursive: true })
  const binary = resolve(binDir, 'codex')
  makeStubExecutable(binary, `#!/bin/sh
MODE="\${PLUXX_FAKE_CODEX_MODE:-last-only}"
OUT=""
ENABLE_HOOKS="no"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--enable" ] && [ "\${2:-}" = "hooks" ]; then
    ENABLE_HOOKS="yes"
  fi
  if [ "$1" = "--output-last-message" ]; then
    shift
    OUT="$1"
  fi
  shift
done
printf '{"type":"thread.started","thread_id":"test"}\\n'
printf '{"type":"turn.started"}\\n'
if [ "$MODE" = "echo-thread" ]; then
  printf 'THREAD:%s\\n' "\${CODEX_THREAD_ID:-missing}" > "$OUT"
elif [ "$MODE" = "echo-enable" ]; then
  printf 'ENABLE:%s\\n' "$ENABLE_HOOKS" > "$OUT"
elif [ -n "$OUT" ]; then
  printf 'OK\\n' > "$OUT"
fi
if [ "$MODE" = "hook-ran" ]; then
  printf 'ran\\n' > ./hook-ran.txt
fi
if [ "$MODE" = "linger" ]; then
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}\\n'
  sleep 10
else
  printf '{"type":"turn.completed"}\\n'
fi
`)
  return binary
}

const DEFAULT_SCENARIO: CodexHookProbeScenario = {
  name: 'codex-hooks-trusted',
  featureMode: 'codex_hooks',
  trustProject: true,
}

describe('codex hook probe', () => {
  it('reports headless-response-no-hook when Codex returns a final answer without a hook side effect', async () => {
    const rootDir = makeTempDir('pluxx-codex-hook-probe-')
    const authHome = makeAuthHome(rootDir)
    const codexBinary = makeFakeCodex(rootDir)

    const suite = await runCodexHookProbeSuite([DEFAULT_SCENARIO], {
      codexBinary,
      authSourceHome: authHome,
      timeoutMs: 2000,
    })

    expect(suite.results).toHaveLength(1)
    expect(suite.results[0]?.status).toBe('headless-response-no-hook')
    expect(suite.results[0]?.lastMessage).toBe('OK')
    expect(suite.results[0]?.hookRan).toBe(false)
    expect(suite.results[0]?.eventTypes).toContain('turn.completed')
  })

  it('reports hook-executed when the hook side effect is present', async () => {
    const rootDir = makeTempDir('pluxx-codex-hook-probe-hook-ran-')
    const authHome = makeAuthHome(rootDir)
    const codexBinary = makeFakeCodex(rootDir)
    process.env.PLUXX_FAKE_CODEX_MODE = 'hook-ran'

    const suite = await runCodexHookProbeSuite([DEFAULT_SCENARIO], {
      codexBinary,
      authSourceHome: authHome,
      timeoutMs: 2000,
    })

    expect(suite.results[0]?.status).toBe('hook-executed')
    expect(suite.results[0]?.hookRan).toBe(true)
    expect(suite.results[0]?.hookOutput).toBe('ran')
  })

  it('kills lingering Codex processes after the final message lands', async () => {
    const rootDir = makeTempDir('pluxx-codex-hook-probe-linger-')
    const authHome = makeAuthHome(rootDir)
    const codexBinary = makeFakeCodex(rootDir)
    process.env.PLUXX_FAKE_CODEX_MODE = 'linger'

    const suite = await runCodexHookProbeSuite([DEFAULT_SCENARIO], {
      codexBinary,
      authSourceHome: authHome,
      timeoutMs: 4000,
    })

    expect(suite.results[0]?.exitCode).toBe(0)
    expect(suite.results[0]?.killedAfterFinalMessage).toBe(true)
    expect(suite.results[0]?.timedOut).toBe(false)
  })

  it('strips thread-coupling env vars before spawning the probe Codex process', async () => {
    const rootDir = makeTempDir('pluxx-codex-hook-probe-env-')
    const authHome = makeAuthHome(rootDir)
    const codexBinary = makeFakeCodex(rootDir)
    process.env.PLUXX_FAKE_CODEX_MODE = 'echo-thread'
    process.env.CODEX_THREAD_ID = 'thread-leak'
    process.env.CODEX_SHELL = '1'
    process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE = 'Codex Desktop'

    const suite = await runCodexHookProbeSuite([DEFAULT_SCENARIO], {
      codexBinary,
      authSourceHome: authHome,
      timeoutMs: 2000,
    })

    expect(suite.results[0]?.lastMessage).toBe('THREAD:missing')
  })

  it('passes extra CLI activation args through to codex exec', async () => {
    const rootDir = makeTempDir('pluxx-codex-hook-probe-enable-')
    const authHome = makeAuthHome(rootDir)
    const codexBinary = makeFakeCodex(rootDir)
    process.env.PLUXX_FAKE_CODEX_MODE = 'echo-enable'

    const suite = await runCodexHookProbeSuite([{
      name: 'enable-hooks-trusted',
      featureMode: 'none',
      trustProject: true,
      extraCliArgs: ['--enable', 'hooks'],
    }], {
      codexBinary,
      authSourceHome: authHome,
      timeoutMs: 2000,
    })

    expect(suite.results[0]?.lastMessage).toBe('ENABLE:yes')
  })
})
