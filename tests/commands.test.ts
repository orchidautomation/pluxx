import { afterEach, describe, expect, it } from 'bun:test'
import { getCanonicalCommandMetadata, readCanonicalCommandFiles } from '../src/commands'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const TEST_DIR = resolve(import.meta.dir, '.commands')

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('commands parser', () => {
  it('parses richer command metadata and explicit command-to-skill routing', () => {
    mkdirSync(TEST_DIR, { recursive: true })
    writeFileSync(
      resolve(TEST_DIR, 'research.md'),
      [
        '---',
        'title: Research',
        'description: Run the research wrapper',
        'when_to_use: Use when the user wants a routed investigation entrypoint.',
        'argument-hint: [company] [region]',
        'arguments: [company, region]',
        'examples:',
        '  - /research acme us',
        '  - /research acme eu',
        'skill: deep-research',
        'agent: escalation',
        'subtask: true',
        'context: fork',
        '---',
        '',
        'Use the `deep-research` skill.',
        '',
        'Arguments: $ARGUMENTS',
      ].join('\n'),
    )

    const command = readCanonicalCommandFiles(TEST_DIR)[0]
    const metadata = getCanonicalCommandMetadata(command)

    expect(metadata.title).toBe('Research')
    expect(metadata.whenToUse).toBe('Use when the user wants a routed investigation entrypoint.')
    expect(metadata.argumentHint).toBe('[company] [region]')
    expect(metadata.arguments).toEqual(['company', 'region'])
    expect(metadata.examples).toEqual(['/research acme us', '/research acme eu'])
    expect(metadata.skill).toBe('deep-research')
    expect(metadata.skills).toEqual(['deep-research'])
    expect(metadata.agent).toBe('escalation')
    expect(metadata.subtask).toBe(true)
    expect(metadata.context).toBe('fork')
  })
})
