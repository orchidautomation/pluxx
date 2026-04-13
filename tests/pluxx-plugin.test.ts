import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const PLUGIN_ROOT = resolve(ROOT, 'plugins/pluxx')

describe('pluxx dogfood plugin', () => {
  it('ships a repo-local Codex plugin manifest and marketplace entry', () => {
    const manifestPath = resolve(PLUGIN_ROOT, '.codex-plugin/plugin.json')
    const marketplacePath = resolve(ROOT, '.agents/plugins/marketplace.json')

    expect(existsSync(manifestPath)).toBe(true)
    expect(existsSync(marketplacePath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      name: string
      skills: string
      interface: {
        displayName: string
        defaultPrompt: string[]
      }
    }
    const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf-8')) as {
      plugins: Array<{ name: string; source: { path: string } }>
    }

    expect(manifest.name).toBe('pluxx')
    expect(manifest.skills).toBe('./skills/')
    expect(manifest.interface.displayName).toBe('Pluxx')
    expect(manifest.interface.defaultPrompt.length).toBeLessThanOrEqual(3)
    expect(marketplace.plugins.some((plugin) => plugin.name === 'pluxx' && plugin.source.path === './plugins/pluxx')).toBe(true)
  })

  it('defines the expected skill pack with valid frontmatter', () => {
    const skills = [
      'pluxx-import-mcp',
      'pluxx-refine-taxonomy',
      'pluxx-rewrite-instructions',
      'pluxx-review-scaffold',
      'pluxx-sync-mcp',
    ]

    for (const skill of skills) {
      const skillPath = resolve(PLUGIN_ROOT, `skills/${skill}/SKILL.md`)
      const yamlPath = resolve(PLUGIN_ROOT, `skills/${skill}/agents/openai.yaml`)

      expect(existsSync(skillPath)).toBe(true)
      expect(existsSync(yamlPath)).toBe(true)

      const content = readFileSync(skillPath, 'utf-8')
      expect(content.startsWith('---\n')).toBe(true)
      expect(content).toContain(`name: ${skill}`)
      expect(content).toContain('description:')
    }
  })
})
