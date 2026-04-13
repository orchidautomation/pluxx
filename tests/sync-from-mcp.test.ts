import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { introspectMcpServer } from '../src/mcp/introspect'
import { detectSkillRenames, detectToolRenames, syncFromMcp } from '../src/cli/sync-from-mcp'
import { writeMcpScaffold } from '../src/cli/init-from-mcp'

const TEST_DIR = resolve(import.meta.dir, '.sync-from-mcp')
const STATE_PATH = resolve(TEST_DIR, 'server-state.json')
const STUB_SERVER_PATH = resolve(TEST_DIR, 'stub-server.js')

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })

  writeFileSync(
    STUB_SERVER_PATH,
    `import { readFileSync } from 'fs'
import * as readline from 'readline'

const statePath = process.argv[2]
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

function readState() {
  return JSON.parse(readFileSync(statePath, 'utf-8'))
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\\n')
}

rl.on('line', (line) => {
  const message = JSON.parse(line)
  const state = readState()

  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: state.serverInfo,
        instructions: state.instructions,
      }
    })
    return
  }

  if (message.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: state.tools
      }
    })
  }
})`,
  )
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('sync-from-mcp', () => {
  it('does not treat identical descriptions as a rename without corroborating evidence', () => {
    const renames = detectToolRenames(
      [
        {
          name: 'SearchCustomers',
          description: 'Search customer records.',
        },
      ],
      [
        {
          name: 'ArchiveInvoices',
          description: 'Search customer records.',
        },
      ],
    )

    expect(renames.size).toBe(0)
  })

  it('matches skills 1:1 before transferring custom content', () => {
    const toolRenames = new Map([
      ['FindOrganizations', 'SearchOrganizations'],
      ['FindPeople', 'SearchPeople'],
    ])

    const skillRenames = detectSkillRenames(
      [
        {
          dirName: 'legacy-organizations',
          title: 'Legacy Organizations',
          toolNames: ['FindOrganizations'],
        },
        {
          dirName: 'legacy-people',
          title: 'Legacy People',
          toolNames: ['FindPeople'],
        },
      ],
      [
        {
          dirName: 'account-research',
          title: 'Account Research',
          toolNames: ['SearchOrganizations', 'SearchPeople'],
        },
      ],
      toolRenames,
    )

    expect(skillRenames.size).toBe(1)
    expect([...skillRenames.values()]).toEqual(['account-research'])
    expect([...skillRenames.keys()]).toContain('legacy-organizations')
  })

  it('updates managed MCP-derived files and preserves user-owned files', async () => {
    writeFileSync(
      STATE_PATH,
      JSON.stringify({
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.0.0',
          description: 'A fake MCP server for sync tests.',
        },
        instructions: 'Use the original fake tools carefully.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
              required: ['query'],
            },
          },
          {
            name: 'FindPeople',
            description: 'Search people.',
          },
        ],
      }, null, 2),
    )

    const source = {
      transport: 'stdio' as const,
      command: 'bun',
      args: [STUB_SERVER_PATH, STATE_PATH],
      env: {
        STUB_API_KEY: '${STUB_API_KEY}',
      },
    }

    const introspection = await introspectMcpServer(source)
    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'stub-server',
      authorName: 'Test Author',
      displayName: 'Stub Server',
      targets: ['claude-code', 'codex'],
      source,
      introspection,
      skillGrouping: 'tool',
      hookMode: 'safe',
    })

    writeFileSync(
      resolve(TEST_DIR, 'INSTRUCTIONS.md'),
      readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8').replace(
        'Add custom plugin instructions here. This section is preserved across `pluxx sync --from-mcp`.',
        'Always mention the curated onboarding checklist.',
      ),
    )
    writeFileSync(
      resolve(TEST_DIR, 'skills/find-organizations/SKILL.md'),
      readFileSync(resolve(TEST_DIR, 'skills/find-organizations/SKILL.md'), 'utf-8').replace(
        'Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.',
        'Custom note: emphasize enterprise account research.',
      ),
    )
    writeFileSync(
      resolve(TEST_DIR, 'skills/find-people/SKILL.md'),
      readFileSync(resolve(TEST_DIR, 'skills/find-people/SKILL.md'), 'utf-8').replace(
        'Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.',
        'Custom note: this legacy skill should be kept for manual follow-up.',
      ),
    )

    mkdirSync(resolve(TEST_DIR, 'skills/custom'), { recursive: true })
    writeFileSync(
      resolve(TEST_DIR, 'skills/custom/SKILL.md'),
      '---\nname: custom\ndescription: Custom user-owned skill\n---\n\nCustom content.\n',
    )

    writeFileSync(
      STATE_PATH,
      JSON.stringify({
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.1.0',
          description: 'A fake MCP server for sync tests.',
        },
        instructions: 'Use the updated fake tools carefully.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations with richer filters.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                industry: { type: 'string' },
              },
              required: ['query'],
            },
          },
          {
            name: 'SearchTechnologies',
            description: 'Search technologies.',
          },
        ],
      }, null, 2),
    )

    const result = await syncFromMcp({ rootDir: TEST_DIR })

    expect(result.addedFiles).toContain('skills/search-technologies/SKILL.md')
    expect(result.removedFiles).not.toContain('skills/find-people/SKILL.md')
    expect(result.preservedFiles).toContain('skills/find-people/SKILL.md')
    expect(result.updatedFiles).toContain('skills/find-organizations/SKILL.md')
    expect(result.updatedFiles).toContain('./INSTRUCTIONS.md')
    expect(result.updatedFiles).toContain('.pluxx/mcp.json')

    expect(existsSync(resolve(TEST_DIR, 'skills/search-technologies/SKILL.md'))).toBe(true)
    expect(existsSync(resolve(TEST_DIR, 'skills/find-people/SKILL.md'))).toBe(true)
    expect(existsSync(resolve(TEST_DIR, 'skills/custom/SKILL.md'))).toBe(true)

    const instructions = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')
    const organizationSkill = readFileSync(resolve(TEST_DIR, 'skills/find-organizations/SKILL.md'), 'utf-8')
    const preservedPeopleSkill = readFileSync(resolve(TEST_DIR, 'skills/find-people/SKILL.md'), 'utf-8')
    expect(instructions).toContain('Use the updated fake tools carefully.')
    expect(instructions).toContain('Always mention the curated onboarding checklist.')
    expect(organizationSkill).toContain('Search organizations with richer filters.')
    expect(organizationSkill).toContain('Custom note: emphasize enterprise account research.')
    expect(preservedPeopleSkill).toContain('Custom note: this legacy skill should be kept for manual follow-up.')

    const metadata = JSON.parse(readFileSync(resolve(TEST_DIR, '.pluxx/mcp.json'), 'utf-8')) as {
      skills: Array<{ dirName: string }>
    }
    expect(metadata.skills.map((skill) => skill.dirName)).toEqual([
      'find-organizations',
      'search-technologies',
    ])
  })
})
