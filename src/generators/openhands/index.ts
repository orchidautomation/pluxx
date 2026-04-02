import { ClaudeCodeGenerator } from '../claude-code'
import type { TargetPlatform } from '../../schema'

/**
 * OpenHands uses .plugin/plugin.json (Claude Code-compatible format).
 * Discovery dirs: .openhands/skills/, .claude/skills/, .agents/skills/
 * This generator reuses ClaudeCodeGenerator with a different platform name.
 */
export class OpenHandsGenerator extends ClaudeCodeGenerator {
  readonly platform: TargetPlatform = 'openhands'
}
