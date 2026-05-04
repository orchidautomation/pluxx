import type { RuntimeReadinessPlan } from './readiness'

export type RuntimeReadinessPlatform = 'claude-code' | 'cursor' | 'codex' | 'opencode'

export type RuntimeReadinessDeliveryMode = 'bundled-hooks' | 'generated-guidance' | 'runtime-callbacks'
export type RuntimeReadinessScopeMode = 'native' | 'best-effort'
export type RuntimeReadinessGateKind = 'session-start' | 'mcp-gate' | 'prompt-gate'

export interface RuntimeReadinessBinding {
  gate: RuntimeReadinessGateKind
  event: string
  command: string
  matcher?: string
}

export interface RuntimeReadinessCapability {
  platform: RuntimeReadinessPlatform
  delivery: RuntimeReadinessDeliveryMode
  bundleEnforced: boolean
  namedPromptTargetScope: RuntimeReadinessScopeMode
  scriptPath: string | null
  companionArtifacts: string[]
  bindings: RuntimeReadinessBinding[]
  notes?: string
}

export function getEnabledRuntimeReadinessBindings(
  capability: RuntimeReadinessCapability,
  plan: RuntimeReadinessPlan,
): RuntimeReadinessBinding[] {
  return capability.bindings.filter((binding) => {
    switch (binding.gate) {
      case 'session-start':
        return plan.needsSessionStart
      case 'mcp-gate':
        return plan.needsMcpGate
      case 'prompt-gate':
        return plan.needsPromptGate
    }
  })
}

const NAMED_PROMPT_TARGET_NOTE = 'Named `skills` / `commands` readiness targets currently translate through prompt-entry gating with best-effort matching because the core four do not share one exact per-skill or per-command runtime interception surface.'
const CODEX_EXTERNAL_NOTE = 'Codex readiness now bundles translated hooks in the plugin, but Pluxx still emits `.codex/readiness.generated.json` and `.codex/hooks.generated.json` companion guidance because some Codex runtimes still gate hook activation behind `codex_hooks`.'

export function getRuntimeReadinessNamedPromptTargetNote(): string {
  return NAMED_PROMPT_TARGET_NOTE
}

export function getRuntimeReadinessExternalConfigNote(): string {
  return CODEX_EXTERNAL_NOTE
}

export function getRuntimeReadinessCapability(
  platform: RuntimeReadinessPlatform,
  pluginRootVar = 'PLUGIN_ROOT',
): RuntimeReadinessCapability {
  switch (platform) {
    case 'claude-code':
      return {
        platform,
        delivery: 'bundled-hooks',
        bundleEnforced: true,
        namedPromptTargetScope: 'best-effort',
        scriptPath: 'hooks/pluxx-readiness.mjs',
        companionArtifacts: [],
        bindings: [
          {
            gate: 'session-start',
            event: 'SessionStart',
            command: `node \${${pluginRootVar}}/hooks/pluxx-readiness.mjs session-start`,
          },
          {
            gate: 'mcp-gate',
            event: 'PreToolUse',
            matcher: 'MCP',
            command: `node \${${pluginRootVar}}/hooks/pluxx-readiness.mjs mcp-gate`,
          },
          {
            gate: 'prompt-gate',
            event: 'UserPromptSubmit',
            command: `node \${${pluginRootVar}}/hooks/pluxx-readiness.mjs prompt-gate`,
          },
        ],
      }
    case 'cursor':
      return {
        platform,
        delivery: 'bundled-hooks',
        bundleEnforced: true,
        namedPromptTargetScope: 'best-effort',
        scriptPath: 'hooks/pluxx-readiness.mjs',
        companionArtifacts: [],
        bindings: [
          {
            gate: 'session-start',
            event: 'sessionStart',
            command: 'node ./hooks/pluxx-readiness.mjs session-start',
          },
          {
            gate: 'mcp-gate',
            event: 'beforeMCPExecution',
            command: 'node ./hooks/pluxx-readiness.mjs mcp-gate',
          },
          {
            gate: 'prompt-gate',
            event: 'beforeSubmitPrompt',
            command: 'node ./hooks/pluxx-readiness.mjs prompt-gate',
          },
        ],
      }
    case 'codex':
      return {
        platform,
        delivery: 'generated-guidance',
        bundleEnforced: false,
        namedPromptTargetScope: 'best-effort',
        scriptPath: '.codex/pluxx-readiness.mjs',
        companionArtifacts: ['.codex/readiness.generated.json', 'hooks/hooks.json', '.codex/hooks.generated.json'],
        bindings: [
          {
            gate: 'session-start',
            event: 'SessionStart',
            command: 'node ./.codex/pluxx-readiness.mjs session-start',
          },
          {
            gate: 'mcp-gate',
            event: 'PreToolUse',
            matcher: 'MCP',
            command: 'node ./.codex/pluxx-readiness.mjs mcp-gate',
          },
          {
            gate: 'prompt-gate',
            event: 'UserPromptSubmit',
            command: 'node ./.codex/pluxx-readiness.mjs prompt-gate',
          },
        ],
        notes: CODEX_EXTERNAL_NOTE,
      }
    case 'opencode':
      return {
        platform,
        delivery: 'runtime-callbacks',
        bundleEnforced: true,
        namedPromptTargetScope: 'best-effort',
        scriptPath: 'runtime/pluxx-readiness.mjs',
        companionArtifacts: [],
        bindings: [
          {
            gate: 'session-start',
            event: 'session.created',
            command: 'node ./runtime/pluxx-readiness.mjs session-start',
          },
          {
            gate: 'mcp-gate',
            event: 'tool.execute.before',
            command: 'node ./runtime/pluxx-readiness.mjs mcp-gate',
          },
          {
            gate: 'prompt-gate',
            event: 'chat.message',
            command: 'node ./runtime/pluxx-readiness.mjs prompt-gate',
          },
        ],
      }
  }
}
