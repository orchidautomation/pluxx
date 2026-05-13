export function stripTomlComment(line: string): string {
  let inString = false
  let quote = ''
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if ((char === '"' || char === "'") && line[i - 1] !== '\\') {
      if (!inString) {
        inString = true
        quote = char
      } else if (quote === char) {
        inString = false
        quote = ''
      }
      continue
    }
    if (char === '#' && !inString) return line.slice(0, i)
  }
  return line
}

export function parseTomlValue(value: string): unknown {
  if (value.startsWith('"') && value.endsWith('"')) return unquoteTomlString(value)
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1)
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    return splitTomlList(inner).map((part) => parseTomlValue(part.trim()))
  }
  if (value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1).trim()
    const result: Record<string, unknown> = {}
    if (!inner) return result
    for (const part of splitTomlList(inner)) {
      const assignment = part.trim().match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/)
      if (!assignment) continue
      result[assignment[1]] = parseTomlValue(assignment[2].trim())
    }
    return result
  }
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

export function splitTomlList(value: string): string[] {
  const parts: string[] = []
  let current = ''
  let inString = false
  let quote = ''
  let braceDepth = 0
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if ((char === '"' || char === "'") && value[i - 1] !== '\\') {
      if (!inString) {
        inString = true
        quote = char
      } else if (quote === char) {
        inString = false
        quote = ''
      }
    }
    if (!inString && char === '{') braceDepth += 1
    if (!inString && char === '}') braceDepth -= 1
    if (!inString && braceDepth === 0 && char === ',') {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current)
  return parts
}

export function unquoteTomlString(value: string): string {
  return value
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
}
