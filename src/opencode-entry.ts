export function toOpenCodeExportName(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('')
}

export function buildOpenCodeEntryFile(pluginName: string): string {
  const exportName = toOpenCodeExportName(pluginName)
  return [
    'import type { Plugin } from "@opencode-ai/plugin"',
    '',
    `import * as PluginModule from "./${pluginName}/index.ts"`,
    '',
    '// OpenCode auto-loads plugin files placed directly in ~/.config/opencode/plugins.',
    '// Proxy into the installed Pluxx bundle while preserving the host workspace context.',
    'const pluginFactory = Object.values(PluginModule).find((value): value is Plugin => typeof value === "function")',
    '',
    'if (!pluginFactory) {',
    `  throw new Error("OpenCode plugin bundle for ${pluginName} did not export a plugin function.")`,
    '}',
    '',
    `export const ${exportName}: Plugin = async (context) =>`,
    '  pluginFactory(context)',
    '',
  ].join('\n')
}

export function normalizeOpenCodeEntryContent(content: string): string {
  return content.replace(/\r\n/g, '\n').trim()
}

export function isCurrentOpenCodeEntryFile(content: string, pluginName: string): boolean {
  return normalizeOpenCodeEntryContent(content) === normalizeOpenCodeEntryContent(buildOpenCodeEntryFile(pluginName))
}
