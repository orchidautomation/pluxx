import { describe, expect, it } from 'bun:test'
import { parseSkillMarkdown } from '../src/skills'

describe('skills parser', () => {
  it('parses scalar frontmatter, allowed-tools, and first heading from skill markdown', () => {
    const parsed = parseSkillMarkdown([
      '---',
      'name: deep-review',
      'description: "Review risky changes carefully."',
      'allowed-tools: Read, Bash(git status *)',
      '---',
      '',
      '# Deep Review',
      '',
      'Use this skill for risky change review.',
    ].join('\n'))

    expect(parsed.hasValidFrontmatter).toBe(true)
    expect(parsed.name).toBe('deep-review')
    expect(parsed.description).toBe('Review risky changes carefully.')
    expect(parsed.allowedTools).toEqual(['Read', 'Bash(git status *)'])
    expect(parsed.firstHeading).toBe('Deep Review')
  })

  it('parses multiline allowed-tools lists when present', () => {
    const parsed = parseSkillMarkdown([
      '---',
      'name: gated-publish',
      'description: Gated publish flow',
      'allowed-tools:',
      '  - Read',
      '  - MCP(github.merge_pull_request)',
      '---',
      '',
      '# Gated Publish',
    ].join('\n'))

    expect(parsed.allowedTools).toEqual(['Read', 'MCP(github.merge_pull_request)'])
  })
})
