import { describe, expect, it } from 'bun:test'
import { formatInstallReference, parseInstallReference } from '../src/install-reference'

describe('install references', () => {
  it('parses local source bundle references with an optional target', () => {
    const reference = parseInstallReference('local:../dist/codex#codex')

    expect(reference).toEqual({
      raw: 'local:../dist/codex#codex',
      scheme: 'local',
      locator: '../dist/codex',
      path: '../dist/codex',
      target: 'codex',
      normalized: 'local:../dist/codex#codex',
    })
    expect(formatInstallReference(reference)).toBe('local:../dist/codex#codex')
  })

  it('parses GitHub release references with version targeting', () => {
    const reference = parseInstallReference('github:orchidautomation/pluxx-example@v1.2.3#claude-code')

    expect(reference.scheme).toBe('github')
    expect(reference.locator).toBe('orchidautomation/pluxx-example')
    expect(reference.version).toBe('v1.2.3')
    expect(reference.target).toBe('claude-code')
    if (reference.scheme === 'github') {
      expect(reference.owner).toBe('orchidautomation')
      expect(reference.repo).toBe('pluxx-example')
    }
  })

  it('parses scoped npm package references without confusing scope for version', () => {
    const packageOnly = parseInstallReference('npm:@orchid-labs/pluxx-opencode#opencode')
    expect(packageOnly.scheme).toBe('npm')
    expect(packageOnly.locator).toBe('@orchid-labs/pluxx-opencode')
    expect(packageOnly.version).toBeUndefined()
    expect(packageOnly.target).toBe('opencode')

    const packageWithVersion = parseInstallReference('npm:@orchid-labs/pluxx-opencode@0.1.22#opencode')
    expect(packageWithVersion.scheme).toBe('npm')
    expect(packageWithVersion.locator).toBe('@orchid-labs/pluxx-opencode')
    expect(packageWithVersion.version).toBe('0.1.22')
  })

  it('parses reserved team-scoped references without treating them as shipped installs', () => {
    const reference = parseInstallReference('team:acme/docs-ops@stable#cursor')

    expect(reference.scheme).toBe('team')
    expect(reference.locator).toBe('acme/docs-ops')
    expect(reference.version).toBe('stable')
    expect(reference.target).toBe('cursor')
    if (reference.scheme === 'team') {
      expect(reference.team).toBe('acme')
      expect(reference.plugin).toBe('docs-ops')
    }
  })

  it('rejects unsupported schemes and malformed locators', () => {
    expect(() => parseInstallReference('registry:acme/docs-ops')).toThrow('Unsupported install reference scheme "registry"')
    expect(() => parseInstallReference('github:only-owner#codex')).toThrow('GitHub install references must look like')
    expect(() => parseInstallReference('npm:@Scope/Bad#opencode')).toThrow('npm install references must look like')
    expect(() => parseInstallReference('team:acme/docs-ops@#cursor')).toThrow('version cannot be empty')
  })

  it('rejects invalid or empty targets', () => {
    expect(() => parseInstallReference('local:./dist/codex#')).toThrow('target cannot be empty')
    expect(() => parseInstallReference('local:./dist/codex#not-a-host')).toThrow('Unknown install reference target "not-a-host"')
  })
})
