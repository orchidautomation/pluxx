import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { lintProject } from '../src/cli/lint'

const tempDirs: string[] = []

function createTempProject(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-lint-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('lintProject', () => {
  it('passes for valid config and skill metadata', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/valid-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'valid-plugin',
        version: '0.1.0',
        description: 'Valid plugin config',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['claude-code', 'cursor', 'codex'],
        brand: {
          displayName: 'Valid Plugin',
          color: '#12AB34',
          defaultPrompts: ['Prompt 1', 'Prompt 2'],
        },
        mcp: {
          server: {
            url: 'https://example.com/mcp',
          },
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/valid-skill/SKILL.md'),
      [
        '---',
        'name: valid-skill',
        'description: "A valid skill description"',
        '---',
        '',
        '# Valid Skill',
      ].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.errors).toBe(0)
    expect(result.warnings).toBe(0)
  })

  it('reports cross-platform warnings and errors', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/dir-mismatch'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'Invalid metadata plugin',
        author: { name: 'Test Author' },
        skills: './skills/',
        brand: {
          displayName: 'Invalid Brand',
          color: 'blue',
          defaultPrompts: [
            'short prompt',
            'another short prompt',
            'third short prompt',
            'fourth prompt not allowed',
            'x'.repeat(140),
          ],
        },
        mcp: {
          server: {
            url: 'ftp://example.com/mcp',
          },
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/dir-mismatch/SKILL.md'),
      [
        '---',
        'name: Bad_Name',
        `description: ${'x'.repeat(290)}: detail`,
        '---',
        '',
        '# Invalid Skill',
      ].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.errors).toBeGreaterThan(0)
    expect(result.warnings).toBeGreaterThan(0)
    expect(result.issues.some(issue => issue.code === 'mcp-url-protocol')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'brand-color-hex')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'codex-default-prompts-count')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'skill-name-format')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'skill-name-dir-mismatch')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'skill-description-truncation')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'yaml-quote-special-chars')).toBe(true)
  })

  it('reports skill-description-length error when description exceeds hard max', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['codex'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      [
        '---',
        'name: my-skill',
        `description: "${'x'.repeat(1100)}"`,
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'skill-description-length' && issue.platform === 'codex')).toBe(true)
  })

  it('reports skill-description-truncation warning for display max', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['claude-code'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      [
        '---',
        'name: my-skill',
        `description: "${'x'.repeat(300)}"`,
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'skill-description-truncation' && issue.platform === 'claude-code')).toBe(true)
  })

  it('reports skill-name-dir-mismatch error for platforms requiring dir match', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/wrong-dir'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['cursor'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/wrong-dir/SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: "A valid skill"',
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'skill-name-dir-mismatch')).toBe(true)
  })

  it('does not report dir mismatch for platforms that do not require it', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/wrong-dir'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['claude-code'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/wrong-dir/SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: "A valid skill"',
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'skill-name-dir-mismatch')).toBe(false)
  })

  it('reports platform-prompt-count and platform-prompt-length for Codex limits', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['codex'],
        brand: {
          displayName: 'Test',
          defaultPrompts: [
            'x'.repeat(200),
            'short',
            'another',
            'too many',
          ],
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: "A valid skill"',
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'platform-prompt-count' && issue.platform === 'codex')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'platform-prompt-length' && issue.platform === 'codex')).toBe(true)
  })

  it('reports platform-instructions-size warning when instructions file exceeds max bytes', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['codex'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: "A valid skill"',
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    // Create an AGENTS.md that exceeds 32768 bytes
    writeFileSync(resolve(projectDir, 'AGENTS.md'), 'x'.repeat(40000))

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'platform-instructions-size' && issue.platform === 'codex')).toBe(true)
  })

  it('reports platform-rules-lines warning when rules file exceeds max lines', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['cursor'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: "A valid skill"',
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    // Create a .cursorrules file with 600 lines
    writeFileSync(resolve(projectDir, '.cursorrules'), Array(601).fill('rule line').join('\n'))

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'platform-rules-lines' && issue.platform === 'cursor')).toBe(true)
  })

  it('reports unsupported cursor hook and skill frontmatter fields', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/valid-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'valid-plugin',
        version: '0.1.0',
        description: 'Valid plugin config',
        author: { name: 'Test Author' },
        skills: './skills/',
        hooks: {
          unknownHook: [
            {
              command: 'echo test',
              matcher: 'Shell',
            },
          ],
          preToolUse: [
            {
              command: 'echo test',
              loop_limit: 3,
            },
          ],
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/valid-skill/SKILL.md'),
      [
        '---',
        'name: valid-skill',
        'description: "A valid skill description"',
        'owner: team-platform',
        '---',
        '',
        '# Valid Skill',
      ].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'cursor-hook-event-unknown')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'cursor-hook-matcher-unsupported-event')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'cursor-hook-loop-limit-unsupported-event')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'cursor-skill-frontmatter-unsupported')).toBe(true)
  })
})
