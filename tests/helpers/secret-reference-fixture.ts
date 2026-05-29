import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { PluginConfig, TargetPlatform } from '../../src/schema'

export const SECRET_REFERENCE_SENTINEL = 'pluxx-sentinel-secret-should-never-compile'
export const SECRET_REFERENCE_WORKSPACE_SENTINEL = 'pluxx-sentinel-workspace-should-never-compile'
export const SECRET_REFERENCE_ENV_VAR = 'PLUXX_SECRET_REFERENCE_API_KEY'
export const SECRET_REFERENCE_WORKSPACE_ENV_VAR = 'PLUXX_SECRET_REFERENCE_WORKSPACE_ID'

export function makeSecretReferenceFixtureConfig(
  targets: TargetPlatform[],
  outDir = './dist',
): PluginConfig {
  return {
    name: 'secret-reference-fixture',
    version: '1.0.0',
    description: 'Fixture for MCP auth secret-reference regression coverage.',
    author: { name: 'Test Author' },
    license: 'MIT',
    skills: './skills/',
    mcp: {
      fixture: {
        transport: 'http',
        url: 'https://metrics.example.com/mcp',
        auth: {
          type: 'header',
          envVar: SECRET_REFERENCE_ENV_VAR,
          headerName: 'X-API-Key',
          headerTemplate: '${value}',
        },
      },
    },
    platforms: {
      codex: {
        mcpServers: {
          fixture: {
            env_http_headers: {
              'X-API-Key': SECRET_REFERENCE_ENV_VAR,
              'X-Workspace': SECRET_REFERENCE_WORKSPACE_ENV_VAR,
            },
          },
        },
      },
    },
    targets,
    outDir,
  }
}

export function readTextTree(rootDir: string): Array<{ path: string; content: string }> {
  const entries: Array<{ path: string; content: string }> = []

  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
        continue
      }
      entries.push({
        path: fullPath,
        content: readFileSync(fullPath, 'utf-8'),
      })
    }
  }

  visit(rootDir)
  return entries
}
