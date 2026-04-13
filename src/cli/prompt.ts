/**
 * Simple interactive prompt utilities using Bun's built-in readline.
 * Zero external dependencies.
 */

import * as readline from 'readline'

export class PromptCancelledError extends Error {
  constructor() {
    super('Init cancelled')
    this.name = 'PromptCancelledError'
  }
}

function ask(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    let settled = false

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      rl.removeListener('SIGINT', onCancel)
      rl.removeListener('close', onClose)
      fn()
    }

    const onCancel = () => {
      settle(() => {
        rl.close()
        reject(new PromptCancelledError())
      })
    }

    const onClose = () => {
      settle(() => {
        reject(new PromptCancelledError())
      })
    }

    rl.once('SIGINT', onCancel)
    rl.once('close', onClose)

    rl.question(question, (answer) => {
      settle(() => {
        resolve(answer)
        rl.close()
      })
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
  // Prompts are created per-question, so there is nothing to close here.
}
