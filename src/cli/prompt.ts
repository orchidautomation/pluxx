/**
 * Simple interactive prompt utilities using Bun's built-in readline.
 * Zero external dependencies.
 */

import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

/**
 * Prompt for text input with an optional default value.
 */
export async function promptText(label: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : ''
  const answer = await ask(`  ${label}${suffix}: `)
  return answer.trim() || defaultValue || ''
}

/**
 * Prompt for a yes/no answer. Returns true for yes.
 */
export async function promptYesNo(label: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? '(Y/n)' : '(y/N)'
  const answer = await ask(`  ${label} ${hint}: `)
  const normalized = answer.trim().toLowerCase()
  if (normalized === '') return defaultYes
  return normalized === 'y' || normalized === 'yes'
}

/**
 * Close the readline interface. Must be called when done prompting.
 */
export function closePrompts(): void {
  rl.close()
}
