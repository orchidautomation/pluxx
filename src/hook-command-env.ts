const PLUGIN_ROOT_REFERENCE_PATTERN = /\$\{(?:PLUGIN_ROOT|PLUXX_PLUGIN_ROOT|CLAUDE_PLUGIN_ROOT|CURSOR_PLUGIN_ROOT|CODEX_PLUGIN_ROOT|OPENCODE_PLUGIN_ROOT)\}(?:[\\/][^\s"'`;$|&<>)]*)?/g

export function quotePluginRootCommandReferences(command: string): string {
  return command.replace(PLUGIN_ROOT_REFERENCE_PATTERN, (match, offset) => {
    const previous = command[offset - 1]
    if (previous === '"' || previous === "'") return match
    return `"${match}"`
  })
}

export function buildHookCommandWrapperScript(command: string, pluginRootVar: string, envFileVar?: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(pluginRootVar)) {
    throw new Error(`Invalid plugin root environment variable name: ${pluginRootVar}`)
  }

  const serializedCommand = JSON.stringify(quotePluginRootCommandReferences(command))
  const serializedPluginRootVar = JSON.stringify(pluginRootVar)
  const serializedEnvFileVar = JSON.stringify(envFileVar ?? null)

  return [
    '#!/usr/bin/env node',
    'import { appendFileSync, existsSync, readFileSync } from "node:fs"',
    'import { dirname, resolve } from "node:path"',
    'import { fileURLToPath } from "node:url"',
    'import { spawnSync } from "node:child_process"',
    '',
    'const shellSingleQuote = (input) => `\'${String(input ?? "").replace(/\'/g, `\'"\'"\'`)}\'`',
    `const PLUGIN_ROOT_VAR = ${serializedPluginRootVar}`,
    `const ENV_FILE_VAR = ${serializedEnvFileVar}`,
    `const COMMAND = ${serializedCommand}`,
    '',
    'const scriptPath = fileURLToPath(import.meta.url)',
    'const pluginRoot = resolve(process.env[PLUGIN_ROOT_VAR] || dirname(scriptPath) + "/..")',
    'process.env[PLUGIN_ROOT_VAR] = pluginRoot',
    'process.env.PLUGIN_ROOT = pluginRoot',
    'process.env.PLUXX_PLUGIN_ROOT = pluginRoot',
    '',
    'const userConfigPath = resolve(pluginRoot, ".pluxx-user.json")',
    'if (existsSync(userConfigPath)) {',
    '  const payload = JSON.parse(readFileSync(userConfigPath, "utf8"))',
    '  const env = payload && typeof payload === "object" && payload.env && typeof payload.env === "object"',
    '    ? payload.env',
    '    : {}',
    '  const envRefs = payload && typeof payload === "object" && payload.envRefs && typeof payload.envRefs === "object"',
    '    ? payload.envRefs',
    '    : {}',
    '',
    '  for (const [key, value] of Object.entries(env)) {',
    '    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue',
    '    process.env[key] = String(value)',
    '    if (ENV_FILE_VAR && process.env[ENV_FILE_VAR]) {',
    '      appendFileSync(process.env[ENV_FILE_VAR], `export ${key}=${shellSingleQuote(String(value))}\\n`)',
    '    }',
    '  }',
    '  for (const [key, envVar] of Object.entries(envRefs)) {',
    '    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue',
    '    if (typeof envVar !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(envVar)) continue',
    '    if (!(envVar in process.env)) continue',
    '    const value = String(process.env[envVar])',
    '    process.env[key] = value',
    '    if (ENV_FILE_VAR && process.env[ENV_FILE_VAR]) {',
    '      appendFileSync(process.env[ENV_FILE_VAR], `export ${key}=${shellSingleQuote(value)}\\n`)',
    '    }',
    '  }',
    '}',
    '',
    'function canRun(command) {',
    '  const result = spawnSync(command, ["--version"], { stdio: "ignore" })',
    '  return !result.error && result.status === 0',
    '}',
    '',
    'function findBash() {',
    '  const candidates = ["bash"]',
    '  if (process.platform === "win32") {',
    '    for (const value of [process.env.GIT_BASH, process.env.BASH]) {',
    '      if (value) candidates.push(value)',
    '    }',
    '    candidates.push(',
    '      "C:/Program Files/Git/bin/bash.exe",',
    '      "C:/Program Files/Git/usr/bin/bash.exe",',
    '      "C:/Program Files (x86)/Git/bin/bash.exe",',
    '      "C:/Program Files (x86)/Git/usr/bin/bash.exe",',
    '    )',
    '  }',
    '  for (const candidate of candidates) {',
    '    if (canRun(candidate)) return candidate',
    '  }',
    '  return null',
    '}',
    '',
    'const bash = findBash()',
    'if (!bash) {',
    '  console.error("[pluxx] Cannot run generated hook command because bash was not found.")',
    '  console.error("[pluxx] Install Git Bash on Windows or make bash available on PATH, then rebuild/reinstall the plugin.")',
    '  console.error("[pluxx] Hook command: " + COMMAND)',
    '  process.exit(127)',
    '}',
    '',
    'const result = spawnSync(bash, ["-lc", COMMAND], {',
    '  cwd: pluginRoot,',
    '  env: process.env,',
    '  stdio: "inherit",',
    '})',
    '',
    'if (result.error) {',
    '  console.error(`[pluxx] Failed to run generated hook command with ${bash}: ${result.error.message}`)',
    '  process.exit(1)',
    '}',
    '',
    'process.exit(result.status ?? (result.signal ? 128 : 1))',
    '',
  ].join('\n')
}
