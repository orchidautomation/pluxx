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
  return /(^|[=/"'\s])\.env(?:\.[A-Za-z0-9_-]+)?\b/.test(content)
}

interface ShellToken {
  kind: 'word' | 'operator'
  value: string
}

const COMMAND_BOUNDARY_OPERATORS = new Set([';;&', '&&', '||', ';;', ';&', ';', '&', '|', '(', ')', '{', '}'])
const REDIRECTION_OPERATORS = new Set(['&>>', '<<<', '<<-', '&>', '>>', '<<', '<>', '>&', '<&', '>|', '<', '>'])
const SHELL_OPERATORS = Array.from(new Set([...COMMAND_BOUNDARY_OPERATORS, ...REDIRECTION_OPERATORS]))
  .sort((left, right) => right.length - left.length)
const CONTROL_PREFIXES = new Set(['if', 'elif', 'while', 'until', '!', 'coproc', 'then', 'do', 'else'])

function tokenizeShellCommand(command: string): ShellToken[] {
  const tokens: ShellToken[] = []
  const expansionClosers: string[] = []
  let word = ''
  let quote: '"' | "'" | '`' | null = null

  const flushWord = (): void => {
    if (!word) return
    tokens.push({ kind: 'word', value: word })
    word = ''
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]
    const next = command[index + 1]

    if (char === '\\' && quote !== "'") {
      word += char
      if (next !== undefined) {
        word += next
        index += 1
      }
      continue
    }

    if (quote) {
      word += char
      if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      word += char
      continue
    }

    if (char === '$' && next === '{') {
      word += '${'
      expansionClosers.push('}')
      index += 1
      continue
    }

    if (char === '$' && command.slice(index, index + 3) === '$((') {
      word += '$(('
      expansionClosers.push('))')
      index += 2
      continue
    }

    if (char === '$' && next === '(') {
      word += '$('
      expansionClosers.push(')')
      index += 1
      continue
    }

    const closer = expansionClosers.at(-1)
    if (closer && command.startsWith(closer, index)) {
      word += closer
      expansionClosers.pop()
      index += closer.length - 1
      continue
    }

    if (expansionClosers.length > 0) {
      word += char
      continue
    }

    if ((char === '<' || char === '>') && next === '(') {
      word += `${char}(`
      expansionClosers.push(')')
      index += 1
      continue
    }

    if (char === '(' && /^[A-Za-z_][A-Za-z0-9_]*\+?=$/.test(word)) {
      word += char
      expansionClosers.push(')')
      continue
    }

    if (/\s/.test(char)) {
      flushWord()
      continue
    }

    const operator = SHELL_OPERATORS.find(candidate => command.startsWith(candidate, index))
    if (operator) {
      flushWord()
      tokens.push({ kind: 'operator', value: operator })
      index += operator.length - 1
      continue
    }

    word += char
  }

  flushWord()
  return tokens
}

function readAnsiCQuotedSegment(word: string, start: number): { decoded: string; end: number } | null {
  if (word[start] !== '$' || word[start + 1] !== "'") return null

  let end = start + 2
  while (end < word.length && (word[end] !== "'" || word[end - 1] === '\\')) end += 1
  if (end >= word.length) return null

  const decoded = word
    .slice(start + 2, end)
    .replace(/\\u([0-9A-Fa-f]{4})|\\U([0-9A-Fa-f]{8})|\\x([0-9A-Fa-f]{1,2})|\\([0-7]{1,3})|\\([abefnrtv\\'"])/g, (_match, unicodeShort, unicodeLong, hex, octal, escaped) => {
      if (unicodeShort || unicodeLong) {
        const codePoint = Number.parseInt(unicodeShort ?? unicodeLong, 16)
        return codePoint <= 0x10FFFF ? String.fromCodePoint(codePoint) : '\uFFFD'
      }
      if (hex) return String.fromCharCode(Number.parseInt(hex, 16))
      if (octal) return String.fromCharCode(Number.parseInt(octal, 8))
      return ({
        a: '\u0007',
        b: '\b',
        e: '\u001b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
        v: '\v',
        '\\': '\\',
        "'": "'",
        '"': '"',
      } as Record<string, string>)[escaped] ?? escaped
    })

  return { decoded, end }
}

function staticShellWordValue(word: string): string | null {
  let value = ''
  let quote: '"' | "'" | null = null

  for (let index = 0; index < word.length; index += 1) {
    const char = word[index]
    if (!quote) {
      const ansiSegment = readAnsiCQuotedSegment(word, index)
      if (ansiSegment) {
        value += ansiSegment.decoded
        index = ansiSegment.end
        continue
      }
    }
    if (char === '\\' && quote !== "'") {
      const next = word[index + 1]
      if (next === undefined) return null
      value += next
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      quote = quote === char ? null : quote || char
      continue
    }
    if (!quote && (char === '$' || char === '`')) return null
    value += char
  }

  return quote ? null : value
}

function normalizeShellWordForMatching(word: string): string | null {
  let value = ''
  let quote: '"' | "'" | null = null

  for (let index = 0; index < word.length; index += 1) {
    const char = word[index]
    if (!quote) {
      const ansiSegment = readAnsiCQuotedSegment(word, index)
      if (ansiSegment) {
        value += ansiSegment.decoded
        index = ansiSegment.end
        continue
      }
    }
    if (char === '\\' && quote !== "'") {
      const next = word[index + 1]
      if (next === undefined) return null
      value += next
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      quote = quote === char ? null : quote || char
      continue
    }
    value += char
  }

  return quote ? null : value
}

function isAssignmentWord(word: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]+\])?\+?=/.test(word)
}

function skipShellRedirections(tokens: ShellToken[], start: number): number {
  let index = start

  while (index < tokens.length) {
    if (tokens[index].kind === 'operator' && REDIRECTION_OPERATORS.has(tokens[index].value)) {
      index += 2
      continue
    }
    if (
      tokens[index].kind === 'word'
      && /^\d+$/.test(tokens[index].value)
      && tokens[index + 1]?.kind === 'operator'
      && REDIRECTION_OPERATORS.has(tokens[index + 1].value)
    ) {
      index += 3
      continue
    }
    break
  }

  return index
}

function sourceTargetAt(tokens: ShellToken[], start: number): string | null {
  let index = start

  while (index < tokens.length) {
    const afterRedirections = skipShellRedirections(tokens, index)
    if (afterRedirections !== index) {
      index = afterRedirections
      continue
    }

    const token = tokens[index]
    if (token.kind !== 'word') return null

    const value = staticShellWordValue(token.value)
    if (value && CONTROL_PREFIXES.has(value)) {
      index += 1
      continue
    }
    if (value === 'time') {
      index += 1
      while (tokens[index]?.kind === 'word' && tokens[index].value.startsWith('-')) index += 1
      continue
    }
    if (value === 'command' || value === 'builtin') {
      index += 1
      while (tokens[index]?.kind === 'word' && tokens[index].value.startsWith('-')) index += 1
      continue
    }
    if (isAssignmentWord(token.value)) {
      index += 1
      continue
    }
    if (value !== 'source' && value !== '.') return null

    index = skipShellRedirections(tokens, index + 1)
    if (tokens[index]?.kind === 'word' && staticShellWordValue(tokens[index].value) === '--') {
      index = skipShellRedirections(tokens, index + 1)
    }
    return tokens[index]?.kind === 'word' ? tokens[index].value : null
  }

  return null
}

function executableShellSpans(command: string): string[] {
  const spans: string[] = []
  let quote: '"' | "'" | null = null

  const findClosingBacktick = (start: number): number => {
    for (let index = start; index < command.length; index += 1) {
      if (command[index] === '\\') {
        index += 1
        continue
      }
      if (command[index] === '`') return index
    }
    return -1
  }

  const findClosingParen = (start: number): number => {
    let depth = 1
    let innerQuote: '"' | "'" | '`' | null = null

    for (let index = start; index < command.length; index += 1) {
      const char = command[index]
      if (char === '\\' && innerQuote !== "'") {
        index += 1
        continue
      }
      if (innerQuote) {
        if (char === innerQuote) innerQuote = null
        continue
      }
      if (char === '"' || char === "'" || char === '`') {
        innerQuote = char
        continue
      }
      if (char === '(') depth += 1
      if (char === ')') {
        depth -= 1
        if (depth === 0) return index
      }
    }

    return -1
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]
    const next = command[index + 1]
    if (char === '\\' && quote !== "'") {
      index += 1
      continue
    }
    if (quote === "'") {
      if (char === "'") quote = null
      continue
    }
    if (char === "'") {
      quote = "'"
      continue
    }
    if (char === '"') {
      quote = quote === '"' ? null : '"'
      continue
    }
    if (char === '`') {
      const end = findClosingBacktick(index + 1)
      if (end === -1) continue
      spans.push(command.slice(index + 1, end))
      index = end
      continue
    }
    if (
      (char === '$' && next === '(' && command[index + 2] !== '(')
      || ((char === '<' || char === '>') && next === '(')
    ) {
      const contentStart = index + 2
      const end = findClosingParen(contentStart)
      if (end === -1) continue
      spans.push(command.slice(contentStart, end))
      index = end
    }
  }

  return spans
}

function sourceCommandTargets(command: string): string[] {
  const targets: string[] = []
  const pendingCommands = [command]

  while (pendingCommands.length > 0) {
    const current = pendingCommands.pop()
    if (current === undefined) break

    const tokens = tokenizeShellCommand(current)
    const starts = new Set([0])
    tokens.forEach((token, index) => {
      if (token.kind === 'operator' && COMMAND_BOUNDARY_OPERATORS.has(token.value)) starts.add(index + 1)
    })

    targets.push(...Array.from(starts)
      .map(start => sourceTargetAt(tokens, start))
      .filter((target): target is string => target !== null))
    pendingCommands.push(...executableShellSpans(current))
  }

  return targets
}

function isVariableSourceTarget(target: string): boolean {
  return /\$(?:\{[A-Za-z_][A-Za-z0-9_]*[^}]*\}|[A-Za-z_][A-Za-z0-9_]*)/.test(target)
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
    for (const target of sourceCommandTargets(command)) {
      const normalizedTarget = normalizeShellWordForMatching(target)
      if (hasWorkspaceEnvFileReference(target) || (normalizedTarget !== null && hasWorkspaceEnvFileReference(normalizedTarget))) {
        findings.push({
          line,
          command,
          reason: 'sources a workspace .env file directly',
        })
        continue
      }

      if (
        scriptMentionsEnvFiles
        && (isVariableSourceTarget(target) || (normalizedTarget !== null && isVariableSourceTarget(normalizedTarget)))
      ) {
        findings.push({
          line,
          command,
          reason: 'sources a variable in a script that enumerates workspace .env files',
        })
      }
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
