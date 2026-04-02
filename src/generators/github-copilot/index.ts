import { ClaudeCodeGenerator } from '../claude-code'
import type { TargetPlatform } from '../../schema'

/**
 * GitHub Copilot CLI uses the same plugin manifest format as Claude Code.
 * Discovery dirs: .github/skills/, .claude/skills/, .agents/skills/
 * This generator reuses ClaudeCodeGenerator with a different platform name.
 */
export class GitHubCopilotGenerator extends ClaudeCodeGenerator {
  readonly platform: TargetPlatform = 'github-copilot'
}
