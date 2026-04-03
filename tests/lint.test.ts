import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { lintProject } from '../src/cli/lint'

const tempDirs: string[] = []

function createTempProject(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'plugahh-lint-'))
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
      resolve(projectDir, 'plugahh.config.json'),
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
      resolve(projectDir, 'plugahh.config.json'),
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
    expect(result.issues.some(issue => issue.code === 'cursor-dir-name-match')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'claude-description-truncation')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'yaml-quote-special-chars')).toBe(true)
  })
})
