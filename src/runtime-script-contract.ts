export const INSTALLER_OWNED_CHECK_ENV_PATH = 'scripts/check-env.sh'
export const RUNTIME_SCRIPT_ROLE_PATHS = {
  'install-validation': INSTALLER_OWNED_CHECK_ENV_PATH,
  'runtime-env': 'scripts/load-env.sh',
  'runtime-bootstrap': 'scripts/bootstrap-runtime.sh',
  'runtime-entrypoint': 'scripts/start-mcp.sh',
} as const

export type RuntimeScriptRole = keyof typeof RUNTIME_SCRIPT_ROLE_PATHS

export interface UnsafeShellEnvSourceFinding {
  line: number
  command: string
  reason: string
}

export const PORTABLE_RUNTIME_SCRIPT_ROLES = [
  RUNTIME_SCRIPT_ROLE_PATHS['runtime-env'],
  RUNTIME_SCRIPT_ROLE_PATHS['runtime-bootstrap'],
  RUNTIME_SCRIPT_ROLE_PATHS['runtime-entrypoint'],
] as const

export function getPortableRuntimeScriptRoleGuidance(): string {
  return `Use separate runtime scripts such as ${PORTABLE_RUNTIME_SCRIPT_ROLES.join(', ')} instead.`
}

export function getRuntimeScriptRoleForPath(path: string): RuntimeScriptRole | null {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '')

  for (const [role, rolePath] of Object.entries(RUNTIME_SCRIPT_ROLE_PATHS) as [RuntimeScriptRole, string][]) {
    if (normalized === rolePath) return role
  }

  return null
}

export function getRuntimeScriptPathsForRoles(roles: RuntimeScriptRole[]): string[] {
  return roles.map((role) => RUNTIME_SCRIPT_ROLE_PATHS[role])
}

export function formatRuntimeScriptRoles(roles: RuntimeScriptRole[]): string {
  return getRuntimeScriptPathsForRoles(roles).join(', ')
}

export function referencesInstallerOwnedCheckEnv(command: string): boolean {
  return command.includes('check-env.sh')
}

function stripShellComment(line: string): string {
  let quote: '"' | "'" | null = null

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const previous = line[index - 1]
    if ((char === '"' || char === "'") && previous !== '\\') {
      quote = quote === char ? null : quote || char
      continue
    }
    if (!quote && char === '#') {
      return line.slice(0, index)
    }
  }

  return line
}

function hasWorkspaceEnvFileReference(content: string): boolean {
  return /(^|[/"'\s])\.env(?:\.[A-Za-z0-9_-]+)?\b/.test(content)
}

function sourceCommandTarget(command: string): string | null {
  const match = command.trim().match(/(?:^|[;&|]\s*)(?:source|\.)\s+(.+?)(?:\s*(?:[;&|]|$))/)
  if (!match) return null
  return match[1].trim()
}

function isVariableSourceTarget(target: string): boolean {
  return /\$(?:\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)/.test(target)
}

function toLogicalShellCommands(content: string): Array<{ line: number; command: string }> {
  const commands: Array<{ line: number; command: string }> = []
  let current = ''
  let currentLine: number | null = null

  content.split(/\r?\n/).forEach((rawLine, index) => {
    let line = stripShellComment(rawLine)
    const startsContinuation = currentLine !== null
    if (currentLine === null) currentLine = index + 1

    const continues = line.endsWith('\\')
    if (continues) line = line.slice(0, -1)
    current += startsContinuation ? line : line.trimStart()

    if (continues) return

    const command = current.trim()
    if (command) commands.push({ line: currentLine, command })
    current = ''
    currentLine = null
  })

  const command = current.trim()
  if (command && currentLine !== null) commands.push({ line: currentLine, command })

  return commands
}

export function findUnsafeShellEnvSources(content: string): UnsafeShellEnvSourceFinding[] {
  const executableContent = content
    .split(/\r?\n/)
    .map(stripShellComment)
    .join('\n')
  const scriptMentionsEnvFiles = hasWorkspaceEnvFileReference(executableContent)
  const findings: UnsafeShellEnvSourceFinding[] = []

  for (const { line, command } of toLogicalShellCommands(content)) {
    const target = sourceCommandTarget(command)
    if (!target) continue

    if (hasWorkspaceEnvFileReference(target)) {
      findings.push({
        line,
        command,
        reason: 'sources a workspace .env file directly',
      })
      continue
    }

    if (scriptMentionsEnvFiles && isVariableSourceTarget(target)) {
      findings.push({
        line,
        command,
        reason: 'sources a variable in a script that enumerates workspace .env files',
      })
    }
  }

  return findings
}

export function getUnsafeShellEnvSourceMessage(path: string, finding: UnsafeShellEnvSourceFinding): string {
  return `${path} ${finding.reason} at line ${finding.line}: ${finding.command}. Runtime env scripts must parse workspace env files as dotenv text or rely on the Pluxx-generated runtime launcher; shell sourcing can execute command substitutions from user-controlled .env values.`
}

export function getInstallerOwnedCheckEnvRuntimeMessage(serverName: string): string {
  return `MCP server "${serverName}" references ${INSTALLER_OWNED_CHECK_ENV_PATH} in its runtime command or args. Pluxx install rewrites that file into a no-op after userConfig materialization, so runtime startup must not depend on it. ${getPortableRuntimeScriptRoleGuidance()}`
}

export function getInstallerOwnedCheckEnvHookMessage(eventName: string): string {
  return `Hook "${eventName}" references ${INSTALLER_OWNED_CHECK_ENV_PATH} as part of a broader runtime command. Treat that script as installer-owned and install-time only, because local installs may rewrite it into a no-op after required config is materialized.`
}

export function getConsumerEnvScriptMissingDetail(): string {
  return `This bundle does not ship a ${INSTALLER_OWNED_CHECK_ENV_PATH} file.`
}

export function getConsumerEnvScriptActiveDetail(): string {
  return `This bundle still runs ${INSTALLER_OWNED_CHECK_ENV_PATH}, which usually means required config was not materialized into the installed plugin.`
}

export function getConsumerRuntimeScriptRolesDetail(roles: RuntimeScriptRole[]): string {
  if (roles.length === 0) {
    return 'This bundle does not include any of the known portable runtime script-role files.'
  }

  return `This bundle includes the following known runtime script-role files: ${formatRuntimeScriptRoles(roles)}.`
}
