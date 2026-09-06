import { existsSync, realpathSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'

/** Reject mixed host roots before any test installer/native command is invoked. */
export function assertIsolatedCodexTestEnvironment(root: string, env: Record<string, string>): void {
  const canonical = (input: string): string => {
    let parent = resolve(input)
    while (!existsSync(parent) && dirname(parent) !== parent) parent = dirname(parent)
    return resolve(realpathSync(parent), relative(parent, resolve(input)))
  }
  const base = canonical(root)
  for (const key of ['HOME', 'CODEX_HOME', 'XDG_CONFIG_HOME', 'PLUXX_CODEX_CONFIG_PATH', 'PLUXX_CODEX_MARKETPLACE_PATH', 'PLUXX_CODEX_INSTALL_DIR', 'PLUXX_INSTALL_LOCK_ROOT']) {
    if (!env[key] || !canonical(env[key]).startsWith(base + sep)) throw new Error(`Codex test isolation rejected ${key}`)
  }
}
