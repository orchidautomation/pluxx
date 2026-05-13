import { homedir } from 'os'
import { resolve } from 'path'

const THREAD_LEAK_ENV_KEYS = [
  'CODEX_THREAD_ID',
  'CODEX_SHELL',
  'CODEX_INTERNAL_ORIGINATOR_OVERRIDE',
] as const

export function resolveCodexAuthSourceHome(authSourceHome?: string): string {
  return authSourceHome
    ? resolve(authSourceHome)
    : (process.env.CODEX_HOME
        ? resolve(process.env.CODEX_HOME)
        : resolve(homedir(), '.codex'))
}

export function buildCodexProbeEnv(codexHome: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CODEX_HOME: codexHome,
    HOME: codexHome,
  }

  for (const key of THREAD_LEAK_ENV_KEYS) {
    delete env[key]
  }

  return env
}
