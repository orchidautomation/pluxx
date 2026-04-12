import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { migrate } from '../src/cli/migrate'

const TEST_DIR = resolve(import.meta.dir, '.migrate-fixture')

function writeJson(path: string, data: unknown) {
  return Bun.write(path, JSON.stringify(data, null, 2) + '\n')
}

async function setupMegamindSource(platform: 'claude' | 'cursor' | 'codex' | 'opencode') {
  const sourceDir = resolve(TEST_DIR, `source-${platform}`)
  mkdirSync(sourceDir, { recursive: true })

  const manifest = {
    name: 'megamind',
    version: '1.0.3',
    description: 'Client intelligence tools powered by Megamind.',
    author: {
      name: 'The Kiln',
      url: 'https://thekiln.com',
    },
    repository: 'https://github.com/The-Kiln-Dev/projectmegamind',
    license: 'MIT',
    keywords: ['client-intelligence', 'slack'],
  }

  if (platform === 'claude') {
    mkdirSync(resolve(sourceDir, '.claude-plugin'), { recursive: true })
    await writeJson(resolve(sourceDir, '.claude-plugin/plugin.json'), manifest)
  }
  if (platform === 'cursor') {
    mkdirSync(resolve(sourceDir, '.cursor-plugin'), { recursive: true })
    await writeJson(resolve(sourceDir, '.cursor-plugin/plugin.json'), manifest)
  }
  if (platform === 'codex') {
    mkdirSync(resolve(sourceDir, '.codex-plugin'), { recursive: true })
    await writeJson(resolve(sourceDir, '.codex-plugin/plugin.json'), manifest)
  }
  if (platform === 'opencode') {
    await writeJson(resolve(sourceDir, 'package.json'), {
      ...manifest,
      type: 'module',
      dependencies: {
        '@opencode-ai/plugin': '^0.0.1',
      },
    })
  }

  await writeJson(resolve(sourceDir, '.mcp.json'), {
    mcpServers: {
      megamind: {
        url: 'https://megamind.up.railway.app/mcp',
        headers: {
          Authorization: 'Bearer ${MEGAMIND_API_KEY}',
        },
      },
    },
  })

  const hooksPath = platform === 'codex'
    ? resolve(sourceDir, '.codex/hooks.json')
    : resolve(sourceDir, 'hooks.json')

  if (platform === 'codex') {
    mkdirSync(resolve(sourceDir, '.codex'), { recursive: true })
  }

  await writeJson(hooksPath, {
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: 'command',
              command: '${PLUGIN_ROOT}/scripts/validate-env.sh',
            },
          ],
        },
      ],
    },
  })

  mkdirSync(resolve(sourceDir, 'skills/client-intel'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'skills/client-intel/SKILL.md'), '# Client Intel\n')
  mkdirSync(resolve(sourceDir, 'commands'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'commands/pulse.md'), '# pulse\n')
  mkdirSync(resolve(sourceDir, 'agents'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'agents/megamind.md'), '# agent\n')
  mkdirSync(resolve(sourceDir, 'scripts'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'scripts/validate-env.sh'), '#!/usr/bin/env bash\n')
  await Bun.write(resolve(sourceDir, 'INSTRUCTIONS.md'), 'Megamind operating instructions\n')

  return sourceDir
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('migrate', () => {
  for (const platform of ['claude', 'cursor', 'codex', 'opencode'] as const) {
    it(`migrates Megamind ${platform} example into pluxx config`, async () => {
      const sourceDir = await setupMegamindSource(platform)
      const outputDir = resolve(TEST_DIR, `out-${platform}`)
      mkdirSync(outputDir, { recursive: true })

      const previousCwd = process.cwd()
      process.chdir(outputDir)
      try {
        await migrate(sourceDir)
      } finally {
        process.chdir(previousCwd)
      }

      const configPath = resolve(outputDir, 'pluxx.config.ts')
      expect(existsSync(configPath)).toBe(true)

      const config = readFileSync(configPath, 'utf-8')
      expect(config).toContain("name: 'megamind'")
      expect(config).toContain("version: '1.0.3'")
      expect(config).toContain("envVar: 'MEGAMIND_API_KEY'")
      expect(config).toContain("targets: ['claude-code', 'cursor', 'codex', 'opencode']")

      expect(existsSync(resolve(outputDir, 'skills/client-intel/SKILL.md'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'commands/pulse.md'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'agents/megamind.md'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'scripts/validate-env.sh'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'INSTRUCTIONS.md'))).toBe(true)
    })
  }
})
