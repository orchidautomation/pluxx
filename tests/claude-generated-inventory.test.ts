import { afterEach, describe, expect, it, vi } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { renderClaudeInventoryScript, selectClaudePlugin, verifyClaudePlugin } from '../src/claude-plugin-inventory'
const roots: string[] = []
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pluxx-native-parity-')); roots.push(root)
  const config = join(root, 'config'), bin = join(root, 'bin'), cache = join(config, 'plugins/cache/release/probe/1.0.0')
  mkdirSync(join(cache, '.claude-plugin'), { recursive: true }); mkdirSync(bin)
  const manifest = join(cache, '.claude-plugin/plugin.json')
  writeFileSync(manifest, JSON.stringify({ name: 'probe', version: '1.0.0' }))
  const inventory = join(root, 'inventory.json'), script = join(root, 'native.cjs'), native = join(bin, 'claude')
  writeFileSync(script, renderClaudeInventoryScript())
  writeFileSync(native, `#!${process.execPath}\nprocess.stdout.write(require('fs').readFileSync(process.env.FIXTURE_INVENTORY, 'utf8'))\n`); chmodSync(native, 0o755)
  const sentinel = join(root, 'unrelated-plugin'); writeFileSync(sentinel, 'preserve this plugin')
  const row = { id: 'probe@release', version: '1.0.0', scope: 'user', enabled: true, installPath: cache }
  return { row, root, config, run(value: unknown) {
    writeFileSync(inventory, JSON.stringify(value))
    const protectedPaths = [manifest, inventory, sentinel]
    const before = protectedPaths.map(p => readFileSync(p, 'utf8'))
    const result = spawnSync(process.execPath, [script, 'postflight', 'probe', 'release', '1.0.0'], { cwd: root, encoding: 'utf8', env: { HOME: root, CLAUDE_CONFIG_DIR: config, PATH: bin, FIXTURE_INVENTORY: inventory, TMPDIR: root } })
    expect(protectedPaths.map(p => readFileSync(p, 'utf8'))).toEqual(before)
    return { status: result.status, result: JSON.parse(result.stdout) }
  } }
}
describe('standalone Claude inventory parity', () => {
  it('rejects sibling directories with cache-like names in both readers', () => {
    const f = fixture()
    vi.stubEnv('HOME', f.root)
    vi.stubEnv('CLAUDE_CONFIG_DIR', f.config)
    const names = process.platform === 'win32' ? ['cache-foreign'] : ['cache-foreign', 'cache\\foreign']
    for (const name of names) {
      const outside = join(f.config, 'plugins', name)
      mkdirSync(join(outside, '.claude-plugin'), { recursive: true })
      const manifest = join(outside, '.claude-plugin/plugin.json')
      const content = JSON.stringify({ name: 'probe', version: '1.0.0' })
      writeFileSync(manifest, content)
      const inventory = [{ ...f.row, installPath: outside }]
      const local = verifyClaudePlugin({ name: 'probe', selector: 'probe@release', version: '1.0.0' }, { runCommand: () => ({ status: 0, stdout: JSON.stringify(inventory) }) })
      expect(local.code).toBe('claude-plugin-inventory-unavailable')
      const generated = f.run(inventory)
      expect(generated.status).toBe(1)
      expect(generated.result.code).toBe(local.code)
      expect(readFileSync(manifest, 'utf8')).toBe(content)
    }
  })
  it('uses the same source classifier and preserves pre-existing files', () => {
    const f = fixture()
    const inventories = [[f.row], [{ ...f.row, id: 'probe@foreign' }], [{ ...f.row, version: '2.0.0' }], [{ ...f.row, enabled: false }], [], [{}]]
    for (const inventory of inventories) {
      const expected = selectClaudePlugin(inventory, { name: 'probe', selector: 'probe@release', scope: 'user', version: '1.0.0' })
      const generated = f.run(inventory)
      expect(generated.status).toBe(expected.ok ? 0 : 1)
      expect(generated.result).toEqual(expected)
    }
  })
})
