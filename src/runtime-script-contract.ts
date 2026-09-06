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

function hasNormalizedWorkspaceEnvFileReference(content: string): boolean {
  return hasWorkspaceEnvFileReference(content.replace(/\(/g, ' '))
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

    if (char === '{' && !word) {
      const namedFileDescriptor = command.slice(index).match(/^\{[A-Za-z_][A-Za-z0-9_]*\}(?=[<>])/)
      if (namedFileDescriptor) {
        word = namedFileDescriptor[0]
        index += namedFileDescriptor[0].length - 1
        continue
      }
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

function isFileDescriptorWord(word: string): boolean {
  return /^\d+$|^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(word)
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
      && isFileDescriptorWord(tokens[index].value)
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

function commandWordIndexAt(tokens: ShellToken[], start: number): number | null {
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
      let commandIntrospection = false
      while (index < tokens.length) {
        const afterRedirections = skipShellRedirections(tokens, index)
        if (afterRedirections !== index) {
          index = afterRedirections
          continue
        }
        if (tokens[index]?.kind !== 'word') break
        const option = staticShellWordValue(tokens[index].value)
        if (option === '--') {
          index += 1
          break
        }
        if (!option?.startsWith('-') || option === '-') break
        if (value === 'command' && /[vV]/.test(option.slice(1))) commandIntrospection = true
        index += 1
      }
      if (commandIntrospection) return null
      continue
    }
    if (isAssignmentWord(token.value)) {
      index += 1
      continue
    }
    return index
  }

  return null
}

function sourceTargetAt(tokens: ShellToken[], start: number): string | null {
  const commandIndex = commandWordIndexAt(tokens, start)
  if (commandIndex === null) return null

  const value = staticShellWordValue(tokens[commandIndex].value)
  if (value !== 'source' && value !== '.') return null

  let targetIndex = skipShellRedirections(tokens, commandIndex + 1)
  if (tokens[targetIndex]?.kind === 'word' && staticShellWordValue(tokens[targetIndex].value) === '--') {
    targetIndex = skipShellRedirections(tokens, targetIndex + 1)
  }
  return tokens[targetIndex]?.kind === 'word' ? tokens[targetIndex].value : null
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

const SHELL_EVALUATOR_COMMANDS = new Set(['bash', 'dash', 'ksh', 'sh', 'zsh'])

function commandStarts(tokens: ShellToken[]): number[] {
  const starts = new Set([0])
  tokens.forEach((token, index) => {
    if (token.kind === 'operator' && COMMAND_BOUNDARY_OPERATORS.has(token.value)) starts.add(index + 1)
  })
  return Array.from(starts)
}

function evaluatorShellArgumentValue(token: ShellToken | undefined): string | null {
  if (token?.kind !== 'word') return null

  let value = ''
  let quote: '"' | "'" | null = null

  for (let index = 0; index < token.value.length; index += 1) {
    const char = token.value[index]
    if (!quote) {
      const ansiSegment = readAnsiCQuotedSegment(token.value, index)
      if (ansiSegment) {
        value += ansiSegment.decoded
        index = ansiSegment.end
        continue
      }
    }

    if (quote === "'") {
      if (char === "'") quote = null
      else value += char
      continue
    }

    if (quote === '"') {
      if (char === '"') {
        quote = null
        continue
      }
      if (char === '\\') {
        const next = token.value[index + 1]
        if (next === undefined) return null
        if ('$`"\\\n'.includes(next)) {
          value += next
          index += 1
        } else {
          value += char
        }
        continue
      }
      value += char
      continue
    }

    if (char === '\\') {
      const next = token.value[index + 1]
      if (next === undefined) return null
      value += next
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    value += char
  }

  return quote ? null : value
}

function evaluatorCommandIndexAt(tokens: ShellToken[], start: number): number | null {
  let index = commandWordIndexAt(tokens, start)

  while (index !== null) {
    if (index >= tokens.length) return null
    const commandValue = staticShellWordValue(tokens[index].value)
    const commandName = commandValue?.split('/').at(-1)
    if (commandName !== 'env' && commandName !== 'exec') return index

    index += 1
    while (index < tokens.length) {
      const afterRedirections = skipShellRedirections(tokens, index)
      if (afterRedirections !== index) {
        index = afterRedirections
        continue
      }
      if (tokens[index]?.kind !== 'word') return null

      const word = staticShellWordValue(tokens[index].value)
      if (word === '--') {
        index += 1
        break
      }
      if (commandName === 'env' && isAssignmentWord(tokens[index].value)) {
        index += 1
        continue
      }
      if (!word?.startsWith('-') || word === '-') break

      index += 1
      if (
        (commandName === 'env' && ['-u', '--unset', '-C', '--chdir', '-a', '--argv0'].includes(word))
        || (commandName === 'exec' && word === '-a')
      ) {
        const operandIndex = skipShellRedirections(tokens, index)
        if (tokens[operandIndex]?.kind !== 'word') return null
        index = operandIndex + 1
      }
    }
  }

  return null
}

function commandAfterExecWrappersAt(tokens: ShellToken[], start: number): number | null {
  let index = commandWordIndexAt(tokens, start)

  while (index !== null && staticShellWordValue(tokens[index].value)?.split('/').at(-1) === 'exec') {
    index += 1
    while (index < tokens.length) {
      const afterRedirections = skipShellRedirections(tokens, index)
      if (afterRedirections !== index) {
        index = afterRedirections
        continue
      }
      if (tokens[index]?.kind !== 'word') return null

      const option = staticShellWordValue(tokens[index].value)
      if (option === '--') {
        index += 1
        break
      }
      if (!option?.startsWith('-') || option === '-') break

      index += 1
      if (option === '-a') {
        const operandIndex = skipShellRedirections(tokens, index)
        if (tokens[operandIndex]?.kind !== 'word') return null
        index = operandIndex + 1
      }
    }
    if (index >= tokens.length) return null
  }

  return index
}

function envSplitStringShellPayload(splitString: string, remainingArguments: string[]): string | null {
  const words = splitString
    .replace(/\\/g, '')
    .replace(/["']/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  let index = 0
  while (words[index]?.split('/').at(-1) === 'exec') {
    index += 1
    while (words[index]?.startsWith('-')) {
      const option = words[index]
      index += option === '-a' ? 2 : 1
    }
  }

  const shellName = words[index]?.split('/').at(-1)
  if (!shellName || !SHELL_EVALUATOR_COMMANDS.has(shellName)) return null

  index += 1
  let noExec = false
  while (index < words.length) {
    const option = words[index]
    if (!option.startsWith('-') && !option.startsWith('+')) return null
    if (option === '--') return null

    index += 1
    if (['-O', '+O', '-o', '+o', '--rcfile', '--init-file'].includes(option)) {
      index += 1
      continue
    }
    if (option.startsWith('--')) {
      if (option === '--noexec' || option === '--dump-strings' || option === '--dump-po-strings') noExec = true
      continue
    }

    const flags = option.slice(1)
    if (flags.includes('n')) noExec = option.startsWith('-')
    if (flags.includes('D') && option.startsWith('-')) noExec = true
    if (!flags.includes('c')) continue
    if (noExec) return null

    const inlinePayload = words.slice(index)
    return [...inlinePayload, ...remainingArguments].join(' ') || null
  }

  return null
}

function envSplitStringSpanAt(tokens: ShellToken[], start: number): string | null {
  const commandIndex = commandAfterExecWrappersAt(tokens, start)
  if (commandIndex === null) return null

  const commandValue = staticShellWordValue(tokens[commandIndex].value)
  if (commandValue?.split('/').at(-1) !== 'env') return null

  let index = commandIndex + 1
  let splitString: string | null = null
  while (index < tokens.length) {
    const afterRedirections = skipShellRedirections(tokens, index)
    if (afterRedirections !== index) {
      index = afterRedirections
      continue
    }
    if (tokens[index]?.kind !== 'word') return null

    const option = evaluatorShellArgumentValue(tokens[index])
    if (option === '-S' || option === '--split-string') {
      const operandIndex = skipShellRedirections(tokens, index + 1)
      splitString = evaluatorShellArgumentValue(tokens[operandIndex])
      index = operandIndex + 1
      break
    }
    if (option?.startsWith('-S') && option.length > 2) {
      splitString = option.slice(2)
      index += 1
      break
    }
    if (option?.startsWith('--split-string=')) {
      splitString = option.slice('--split-string='.length)
      index += 1
      break
    }
    if (option === '--' || !option?.startsWith('-') || option === '-') return null

    index += 1
    if (['-u', '--unset', '-C', '--chdir', '-a', '--argv0'].includes(option)) {
      const operandIndex = skipShellRedirections(tokens, index)
      if (tokens[operandIndex]?.kind !== 'word') return null
      index = operandIndex + 1
    }
  }
  if (!splitString) return null

  const remainingArguments: string[] = []
  while (index < tokens.length) {
    const afterRedirections = skipShellRedirections(tokens, index)
    if (afterRedirections !== index) {
      index = afterRedirections
      continue
    }
    if (tokens[index]?.kind !== 'word') break
    const argument = evaluatorShellArgumentValue(tokens[index])
    if (argument === null) return null
    remainingArguments.push(argument)
    index += 1
  }

  return envSplitStringShellPayload(splitString, remainingArguments)
}

function evaluatorShellSpans(command: string): string[] {
  const tokens = tokenizeShellCommand(command)
  const spans: string[] = []

  for (const start of commandStarts(tokens)) {
    const envSplitStringSpan = envSplitStringSpanAt(tokens, start)
    if (envSplitStringSpan !== null) spans.push(envSplitStringSpan)

    const commandIndex = evaluatorCommandIndexAt(tokens, start)
    if (commandIndex === null) continue

    const commandValue = staticShellWordValue(tokens[commandIndex].value)
    if (commandValue === 'eval') {
      const argumentsToEvaluate: string[] = []
      let index = commandIndex + 1
      while (index < tokens.length) {
        const afterRedirections = skipShellRedirections(tokens, index)
        if (afterRedirections !== index) {
          index = afterRedirections
          continue
        }
        if (tokens[index]?.kind !== 'word') break
        const argument = evaluatorShellArgumentValue(tokens[index])
        if (argument === null) break
        if (!(argumentsToEvaluate.length === 0 && argument === '--')) argumentsToEvaluate.push(argument)
        index += 1
      }
      if (argumentsToEvaluate.length > 0) spans.push(argumentsToEvaluate.join(' '))
      continue
    }

    const shellName = commandValue?.split('/').at(-1)
    if (!shellName || !SHELL_EVALUATOR_COMMANDS.has(shellName)) continue

    let index = commandIndex + 1
    let noExec = false
    while (index < tokens.length) {
      const afterRedirections = skipShellRedirections(tokens, index)
      if (afterRedirections !== index) {
        index = afterRedirections
        continue
      }

      const option = tokens[index]?.kind === 'word' ? staticShellWordValue(tokens[index].value) : null
      if (!option || option === '--' || (!option.startsWith('-') && !option.startsWith('+'))) break

      index += 1
      if (option.startsWith('--')) {
        if (option === '--noexec' || option === '--dump-strings' || option === '--dump-po-strings') noExec = true
        if ((option === '--rcfile' || option === '--init-file') && !option.includes('=')) {
          const operandIndex = skipShellRedirections(tokens, index)
          if (tokens[operandIndex]?.kind !== 'word') break
          index = operandIndex + 1
        }
        continue
      }

      if (
        option === '-O'
        || option === '+O'
        || option === '-o'
        || option === '+o'
        || option === '--rcfile'
        || option === '--init-file'
      ) {
        const operandIndex = skipShellRedirections(tokens, index)
        if (tokens[operandIndex]?.kind !== 'word') break
        index = operandIndex + 1
        continue
      }
      const optionFlags = option.slice(1)
      if (optionFlags.includes('n')) noExec = option.startsWith('-')
      if (optionFlags.includes('D') && option.startsWith('-')) noExec = true
      if (!optionFlags.includes('c')) continue

      const payloadIndex = skipShellRedirections(tokens, index)
      const payload = evaluatorShellArgumentValue(tokens[payloadIndex])
      if (!noExec && payload !== null) spans.push(payload)
      break
    }
  }

  return spans
}

function sourceCommandTargets(command: string): string[] {
  const targets: string[] = []
  const pendingCommands = [command]
  const scannedCommands = new Set<string>()

  while (pendingCommands.length > 0) {
    const current = pendingCommands.pop()
    if (current === undefined) break
    if (scannedCommands.has(current)) continue
    scannedCommands.add(current)

    const tokens = tokenizeShellCommand(current)

    targets.push(...commandStarts(tokens)
      .map(start => sourceTargetAt(tokens, start))
      .filter((target): target is string => target !== null))
    pendingCommands.push(...executableShellSpans(current), ...evaluatorShellSpans(current))
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
  const logicalCommands = toLogicalShellCommands(content)
  const scriptMentionsEnvFiles = logicalCommands.some(({ command }) => (
    hasWorkspaceEnvFileReference(command)
    || tokenizeShellCommand(command).some((token) => {
      if (token.kind !== 'word') return false
      const normalized = normalizeShellWordForMatching(token.value)
      return normalized !== null && hasNormalizedWorkspaceEnvFileReference(normalized)
    })
  ))
  const findings: UnsafeShellEnvSourceFinding[] = []

  for (const { line, command } of logicalCommands) {
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
