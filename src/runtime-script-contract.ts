export const INSTALLER_OWNED_CHECK_ENV_PATH = 'scripts/check-env.sh'
export const RUNTIME_SCRIPT_ROLE_PATHS = {
  'install-validation': INSTALLER_OWNED_CHECK_ENV_PATH,
  'runtime-env': 'scripts/load-env.sh',
  'runtime-bootstrap': 'scripts/bootstrap-runtime.sh',
  'runtime-entrypoint': 'scripts/start-mcp.sh',
} as const

export type RuntimeScriptRole = keyof typeof RUNTIME_SCRIPT_ROLE_PATHS

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
