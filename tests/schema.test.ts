import { describe, expect, it } from 'bun:test'
import { HookEntrySchema, McpAuthSchema, McpServerSchema } from '../src/schema'

describe('McpServerSchema transport validation', () => {
  it('requires command and forbids url for stdio transport', () => {
    expect(
      McpServerSchema.safeParse({
        transport: 'stdio',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'stdio',
        command: 'npx',
        url: 'https://example.com/mcp',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'stdio',
        command: 'npx',
      }).success
    ).toBe(true)
  })

  it('requires url and forbids command for http/sse transport', () => {
    expect(
      McpServerSchema.safeParse({
        transport: 'http',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'http',
        url: 'https://example.com/mcp',
        command: 'npx',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'sse',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'sse',
        url: 'https://example.com/mcp',
        command: 'npx',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'http',
        url: 'https://example.com/mcp',
      }).success
    ).toBe(true)

    expect(
      McpServerSchema.safeParse({
        transport: 'sse',
        url: 'https://example.com/mcp',
      }).success
    ).toBe(true)
  })

  it('defaults missing transport to http', () => {
    const parsed = McpServerSchema.parse({
      url: 'https://example.com/mcp',
    })

    expect(parsed.transport).toBe('http')
  })
})

describe('McpAuthSchema auth validation', () => {
  it('requires envVar for bearer auth', () => {
    expect(
      McpAuthSchema.safeParse({
        type: 'bearer',
      }).success
    ).toBe(false)

    expect(
      McpAuthSchema.safeParse({
        type: 'bearer',
        envVar: 'API_KEY',
      }).success
    ).toBe(true)
  })

  it('requires envVar and headerName for header auth', () => {
    expect(
      McpAuthSchema.safeParse({
        type: 'header',
      }).success
    ).toBe(false)

    expect(
      McpAuthSchema.safeParse({
        type: 'header',
        envVar: 'API_KEY',
      }).success
    ).toBe(false)

    expect(
      McpAuthSchema.safeParse({
        type: 'header',
        envVar: 'API_KEY',
        headerName: 'X-API-Key',
      }).success
    ).toBe(true)
  })

  it('supports platform-managed auth', () => {
    expect(
      McpAuthSchema.safeParse({
        type: 'platform',
      }).success
    ).toBe(true)
  })
})

describe('HookEntrySchema hook type validation', () => {
  it('supports command hooks', () => {
    expect(
      HookEntrySchema.safeParse({
        command: 'echo hello',
      }).success
    ).toBe(true)
  })

  it('supports prompt hooks', () => {
    expect(
      HookEntrySchema.safeParse({
        type: 'prompt',
        prompt: 'Only allow safe commands',
      }).success
    ).toBe(true)
  })

  it('requires prompt for prompt hooks', () => {
    expect(
      HookEntrySchema.safeParse({
        type: 'prompt',
      }).success
    ).toBe(false)
  })
})
