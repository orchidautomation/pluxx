import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { getCanonicalSkillMetadata, parseSkillMarkdown, readCanonicalSkillFiles, rewriteSkillFrontmatter } from '../src/skills'

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

  it('keeps a quoted scalar containing a comma as one allowed tool', () => {
    const parsed = parseSkillMarkdown([
      '---',
      'name: quoted-tool',
      'description: Quoted tool fixture',
      'allowed-tools: "Read, carefully"',
      '---',
      '',
      '# Quoted Tool',
    ].join('\n'))

    expect(parsed.allowedTools).toEqual(['Read, carefully'])
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

  it('parses supported YAML shapes without losing multiline or quoted-comma values', () => {
    const parsed = parseSkillMarkdown([
      '---',
      'name: yaml-skill',
      'description: |',
      '  First line.',
      '  Second line.',
      'allowed-tools: ["Read, carefully", Bash]',
      'arguments:',
      '  - target',
      '  - "region, optional"',
      'paths: ["src/**", "docs,notes/**"]',
      'hooks:',
      '  preToolUse:',
      '    - type: command',
      '      command: bash scripts/assist.sh',
      '---',
      '',
      '# YAML Skill',
    ].join('\n'))

    expect(parsed.hasValidFrontmatter).toBe(true)
    expect(parsed.description).toBe('First line.\nSecond line.\n')
    expect(parsed.allowedTools).toEqual(['Read, carefully', 'Bash'])
    expect(parsed.arguments).toEqual(['target', 'region, optional'])
    expect(parsed.paths).toEqual(['src/**', 'docs,notes/**'])
    expect(parsed.hooks).toEqual({
      preToolUse: [{ type: 'command', command: 'bash scripts/assist.sh' }],
    })
    expect(parsed.frontmatterNodes.get('description')).toMatchObject({
      key: 'description',
      kind: 'scalar',
      source: { line: 3, column: 14 },
    })
    expect(parsed.frontmatterDiagnostics).toEqual([])
  })

  it('records invalid YAML and unsupported known-field shapes explicitly', () => {
    const invalid = parseSkillMarkdown([
      '---',
      'name: invalid-yaml',
      'description: [unterminated',
      '---',
      '',
      '# Invalid',
    ].join('\n'))

    expect(invalid.hasValidFrontmatter).toBe(false)
    expect(invalid.frontmatterDiagnostics.some(diagnostic => diagnostic.code === 'skill-frontmatter-yaml')).toBe(true)

    const unsupported = parseSkillMarkdown([
      '---',
      'name: unsupported-shape',
      'description:',
      '  summary: Nested descriptions are not supported.',
      'allowed-tools:',
      '  Read: true',
      '---',
      '',
      '# Unsupported',
    ].join('\n'))

    expect(unsupported.hasValidFrontmatter).toBe(true)
    expect(unsupported.frontmatterDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'skill-frontmatter-shape', key: 'description', source: expect.objectContaining({ line: 4 }) }),
      expect.objectContaining({ code: 'skill-frontmatter-shape', key: 'allowed-tools', source: expect.objectContaining({ line: 6 }) }),
    ]))
  })

  it('does not treat an indented YAML document marker inside a block scalar as the closing fence', () => {
    const parsed = parseSkillMarkdown([
      '---',
      'name: block-marker',
      'description: |',
      '  Before',
      '  ---',
      '  After',
      '---',
      '',
      '# Block Marker',
    ].join('\n'))

    expect(parsed.hasValidFrontmatter).toBe(true)
    expect(parsed.description).toBe('Before\n---\nAfter\n')
    expect(parsed.body).toContain('# Block Marker')
  })

  it('rejects aliases and unsupported tags with diagnostics instead of throwing', () => {
    const aliased = parseSkillMarkdown([
      '---',
      'name: alias-fixture',
      'description: Alias fixture',
      'hooks: &hook-map',
      '  self: *hook-map',
      '---',
      '',
      '# Alias Fixture',
    ].join('\n'))
    expect(aliased.hasValidFrontmatter).toBe(false)
    expect(aliased.frontmatterDiagnostics.some(diagnostic => diagnostic.code === 'skill-frontmatter-yaml')).toBe(true)

    const tagged = parseSkillMarkdown([
      '---',
      'name: tag-fixture',
      'description: !!js/function x',
      '---',
      '',
      '# Tag Fixture',
    ].join('\n'))
    expect(tagged.hasValidFrontmatter).toBe(false)
    expect(tagged.frontmatterDiagnostics.some(diagnostic => diagnostic.code === 'skill-frontmatter-yaml')).toBe(true)
  })

  it('rewrites and removes only complete top-level fields', () => {
    const source = [
      '---',
      'name: original-name',
      'description: |',
      '  Keep this:',
      '  name: nested-name',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      'hooks:',
      '  preToolUse:',
      '    - name: nested-hook',
      '      type: command',
      '      command: echo test',
      '---',
      '',
      '# Original',
    ].join('\n')

    const rewritten = rewriteSkillFrontmatter(source, {
      set: { name: 'renamed', 'user-invocable': false },
      remove: ['allowed-tools'],
    })

    expect(rewritten).toContain('name: renamed')
    expect(rewritten).toContain('name: nested-name')
    expect(rewritten).toContain('name: nested-hook')
    expect(rewritten).toContain('user-invocable: false')
    expect(rewritten).not.toContain('allowed-tools:')
    expect(rewritten).not.toContain('  - Read')
    expect(parseSkillMarkdown(rewritten).hasValidFrontmatter).toBe(true)
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
