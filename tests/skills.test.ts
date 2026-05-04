import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { getCanonicalSkillMetadata, parseSkillMarkdown, readCanonicalSkillFiles } from '../src/skills'

const TEST_DIR = resolve(import.meta.dir, '.skills-metadata')

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

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

  it('parses richer Claude-style frontmatter into canonical skill metadata', () => {
    const parsed = parseSkillMarkdown([
      '---',
      'name: deep-research',
      'description: "Investigate a company carefully."',
      'when_to_use: "Use when the user needs sourced company research."',
      'argument-hint: "[company] [region]"',
      'arguments: [company, region]',
      'disable-model-invocation: true',
      'user-invocable: false',
      'allowed-tools: Read, MCP(exa.search)',
      'model: claude-sonnet-4',
      'effort: high',
      'context: fork',
      'agent: Explore',
      'hooks: {"sessionStart":[{"type":"command","command":"bash scripts/assist.sh"}]}',
      'paths: ["src/**","docs/**"]',
      'shell: bash',
      '---',
      '',
      '# Deep Research',
    ].join('\n'))

    expect(parsed.whenToUse).toBe('Use when the user needs sourced company research.')
    expect(parsed.argumentHint).toBe('[company] [region]')
    expect(parsed.arguments).toEqual(['company', 'region'])
    expect(parsed.disableModelInvocation).toBe(true)
    expect(parsed.userInvocable).toBe(false)
    expect(parsed.model).toBe('claude-sonnet-4')
    expect(parsed.effort).toBe('high')
    expect(parsed.context).toBe('fork')
    expect(parsed.agent).toBe('Explore')
    expect(parsed.hooks).toEqual({ sessionStart: [{ type: 'command', command: 'bash scripts/assist.sh' }] })
    expect(parsed.paths).toEqual(['src/**', 'docs/**'])
    expect(parsed.shell).toBe('bash')
  })

  it('collects related files and helper scripts into canonical skill metadata', () => {
    mkdirSync(resolve(TEST_DIR, 'deep-research/examples'), { recursive: true })
    mkdirSync(resolve(TEST_DIR, 'deep-research/scripts'), { recursive: true })
    writeFileSync(
      resolve(TEST_DIR, 'deep-research/SKILL.md'),
      [
        '---',
        'name: deep-research',
        'description: Investigate a company carefully.',
        '---',
        '',
        '# Deep Research',
      ].join('\n'),
    )
    writeFileSync(resolve(TEST_DIR, 'deep-research/reference.md'), '# Reference\n')
    writeFileSync(resolve(TEST_DIR, 'deep-research/examples/sample.md'), '# Example\n')
    writeFileSync(resolve(TEST_DIR, 'deep-research/scripts/assist.sh'), '#!/usr/bin/env bash\n')

    const skill = readCanonicalSkillFiles(TEST_DIR)[0]
    const metadata = getCanonicalSkillMetadata(skill)

    expect(metadata.title).toBe('Deep Research')
    expect(metadata.supportPaths).toEqual([
      'examples/sample.md',
      'reference.md',
      'scripts/assist.sh',
    ])
    expect(metadata.examplePaths).toEqual(['examples/sample.md'])
    expect(metadata.helperScripts).toEqual(['scripts/assist.sh'])
    expect(metadata.referencePaths).toEqual(['reference.md'])
  })
})
