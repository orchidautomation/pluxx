import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { z } from 'zod'

export const PLUXX_COMPILER_INTENT_PATH = '.pluxx/compiler-intent.json'

export const CompilerIntentSkillPolicySchema = z.object({
  skillDir: z.string(),
  title: z.string(),
  description: z.string().optional(),
  source: z.object({
    kind: z.literal('claude-allowed-tools'),
    platform: z.literal('claude-code').default('claude-code'),
  }),
  permissions: z.object({
    allow: z.array(z.string()).optional(),
    ask: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).refine(
    (permissions) => (permissions.allow?.length ?? 0)
      + (permissions.ask?.length ?? 0)
      + (permissions.deny?.length ?? 0) > 0,
    {
      message: 'Compiler intent skill policies must declare at least one allow/ask/deny rule.',
    },
  ),
})

export const CompilerIntentSchema = z.object({
  version: z.literal(1),
  skillPolicies: z.array(CompilerIntentSkillPolicySchema).default([]),
})

export type CompilerIntentSkillPolicy = z.infer<typeof CompilerIntentSkillPolicySchema>
export type CompilerIntentFile = z.infer<typeof CompilerIntentSchema>

export function readCompilerIntent(rootDir: string): CompilerIntentFile | undefined {
  const path = resolve(rootDir, PLUXX_COMPILER_INTENT_PATH)
  if (!existsSync(path)) return undefined

  const raw = JSON.parse(readFileSync(path, 'utf-8'))
  return CompilerIntentSchema.parse(raw)
}
