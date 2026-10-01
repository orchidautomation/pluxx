export function toOpenCodeExportName(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('')
}

export function buildOpenCodeEntryFile(pluginName: string): string {
  return [
    '// One discovered entry; supporting files live outside plugins/.',
    `export { default } from "../pluxx/${pluginName}/index.ts"`,
    '',
  ].join('\n')
}

export function normalizeOpenCodeEntryContent(content: string): string {
  return content.replace(/\r\n/g, '\n').trim()
}

export function isCurrentOpenCodeEntryFile(content: string, pluginName: string): boolean {
  return normalizeOpenCodeEntryContent(content) === normalizeOpenCodeEntryContent(buildOpenCodeEntryFile(pluginName))
}
