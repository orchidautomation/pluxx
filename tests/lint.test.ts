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

  // ── Gotcha #1: Plugin dirs nested inside .claude-plugin/ ──
  it('reports error when plugin directories are nested inside .claude-plugin/', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, '.claude-plugin/skills'), { recursive: true })
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
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'plugin-dir-nested')).toBe(true)
  })

  // ── Gotcha #2 & #3: Manifest path prefix and traversal ──
  it('reports error when config paths lack ./ prefix or contain ../', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: 'skills/',
        targets: ['claude-code'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'manifest-path-prefix')).toBe(true)
  })

  // ── Gotcha #4: Plugin name must be kebab-case ──
  it('reports error for non-kebab-case plugin name', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'My Plugin',
        version: '0.1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['claude-code'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    // The schema also rejects this at parse time, but if it got through the lint would catch it
    expect(result.errors).toBeGreaterThan(0)
  })

  // ── Gotcha #5: Validate hook event names ──
  it('warns on unknown hook event names', async () => {
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
        hooks: {
          onSave: [{ command: 'echo saved' }],
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'hook-event-unknown')).toBe(true)
  })

  // ── Gotcha #7: Agent forbidden frontmatter ──
  it('warns when agent files use forbidden frontmatter fields', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })
    mkdirSync(resolve(projectDir, 'agents'), { recursive: true })

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
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    writeFileSync(
      resolve(projectDir, 'agents/my-agent.md'),
      ['---', 'name: my-agent', 'hooks: true', 'mcpServers: server1', 'permissionMode: auto', '---', '', '# Agent'].join('\n'),
    )

    const result = await lintProject(projectDir)
    const forbiddenIssues = result.issues.filter(i => i.code === 'agent-forbidden-frontmatter')
    expect(forbiddenIssues.length).toBe(3)
  })

  // ── Gotcha #8: Agent isolation must be "worktree" ──
  it('reports error when agent isolation is not worktree', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })
    mkdirSync(resolve(projectDir, 'agents'), { recursive: true })

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
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    writeFileSync(
      resolve(projectDir, 'agents/isolated-agent.md'),
      ['---', 'name: isolated-agent', 'isolation: container', '---', '', '# Agent'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'agent-isolation-invalid')).toBe(true)
  })

  // ── Gotcha #9: Warn on absolute paths in hooks ──
  it('warns when hooks use absolute paths', async () => {
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
        hooks: {
          sessionStart: [{ command: '/usr/local/bin/my-hook' }],
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'hook-absolute-path')).toBe(true)
  })

  // ── Gotcha #11: settings.json unknown keys ──
  it('warns on unknown keys in settings.json', async () => {
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
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    writeFileSync(
      resolve(projectDir, 'settings.json'),
      JSON.stringify({ agent: {}, theme: 'dark', debug: true }),
    )

    const result = await lintProject(projectDir)
    const settingsIssues = result.issues.filter(i => i.code === 'settings-unknown-key')
    expect(settingsIssues.length).toBe(2)
  })

  // ── Gotcha #12: Version semver validation ──
  it('reports error for non-semver version', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })

    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '1.0',
        description: 'test',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['claude-code'],
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'version-semver')).toBe(true)
  })

  // ── Commands are a first-class optional surface ──
  it('does not warn when commands/ directory exists alongside skills', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })
    mkdirSync(resolve(projectDir, 'commands'), { recursive: true })

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
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'commands-legacy')).toBe(false)
  })

  it('does not warn about commands/ when Claude Code is not a target', async () => {
    const projectDir = createTempProject()
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })
    mkdirSync(resolve(projectDir, 'commands'), { recursive: true })

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
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'commands-legacy')).toBe(false)
  })

  // ── Gotcha #15 & #16: Codex agents min threads/depth ──
  it('reports error when Codex agents.max_threads or max_depth is below minimum', async () => {
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
        platforms: {
          codex: {
            agents: { max_threads: 0, max_depth: 0 },
          },
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'codex-agents-max-threads')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'codex-agents-max-depth')).toBe(true)
  })

  // ── Gotcha #18: Codex hooks are external config ──
  it('warns that Codex hooks are configured outside generated plugin bundles', async () => {
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
        hooks: {
          sessionStart: [{ command: 'echo start' }],
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'codex-hooks-external-config')).toBe(true)
  })

  it('does not warn for supported Codex canonical hook aliases', async () => {
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
        hooks: {
          sessionStart: [{ command: 'echo start' }],
          beforeSubmitPrompt: [{ command: 'echo prompt' }],
        },
        platforms: {
          codex: {
            features: { codex_hooks: true },
          },
        },
      }, null, 2),
    )

    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A skill"', '---', '', '# Skill'].join('\n'),
    )

    const result = await lintProject(projectDir)
    expect(result.issues.some(issue => issue.code === 'codex-hook-event-unsupported')).toBe(false)
  })

  it('reports unknown cursor hook, unsupported loop_limit, and unsupported skill frontmatter fields', async () => {
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
          sessionStart: [
            {
              command: 'echo test',
              matcher: 'Bash',
            },
          ],
          unknownHook: [
            {
              command: 'echo test',
            },
          ],
          preToolUse: [
            {
              command: 'echo test',
              loop_limit: 3,
            },
          ],
          stop: [
            {
              command: 'echo stop',
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
    expect(result.issues.filter(issue => issue.code === 'cursor-hook-event-unknown')).toHaveLength(1)
    expect(result.issues.some(issue => issue.code === 'cursor-hook-loop-limit-unsupported-event')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'cursor-skill-frontmatter-unsupported')).toBe(true)
  })
})
