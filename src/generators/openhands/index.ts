import { ClaudeCodeGenerator } from '../claude-code'
import type { TargetPlatform } from '../../schema'

/**
 * OpenHands uses .plugin/plugin.json (Claude Code-compatible format).
 * Discovery dirs: .openhands/skills/, .claude/skills/, .agents/skills/
 */
export class OpenHandsGenerator extends ClaudeCodeGenerator {
  readonly platform: TargetPlatform = 'openhands'

  protected get manifestPath(): string { return '.plugin/plugin.json' }
  protected get instructionsFile(): string { return 'AGENTS.md' }
  protected get pluginRootVar(): string { return 'PLUGIN_ROOT' }
}
