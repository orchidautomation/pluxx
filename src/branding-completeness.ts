import type { PluginConfig } from './schema'

export interface BrandingCompletenessWarning {
  code: string
  platform: string
  title: string
  message: string
  fix: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasNonEmptyStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((entry) => hasNonEmptyString(entry))
}

export function getBrandingCompletenessWarnings(config: PluginConfig): BrandingCompletenessWarning[] {
  const warnings: BrandingCompletenessWarning[] = []
  const codexInterface = asRecord(config.platforms?.codex?.interface)

  if (config.targets.includes('codex')) {
    const codexHasIcon = hasNonEmptyString(config.brand?.icon)
      || hasNonEmptyString(codexInterface?.composerIcon)
      || hasNonEmptyString(codexInterface?.logo)
    const codexHasScreenshots = hasNonEmptyStringArray(config.brand?.screenshots)
      || hasNonEmptyStringArray(codexInterface?.screenshots)

    if (!codexHasIcon && !codexHasScreenshots) {
      warnings.push({
        code: 'codex-branding-metadata-missing',
        platform: 'Codex',
        title: 'Codex branding metadata is incomplete',
        message: 'Codex supports icon/logo and screenshots, but this plugin will fall back to generic iconography and ship without screenshots because `brand.icon` and `brand.screenshots` are missing.',
        fix: 'Declare `brand.icon` and `brand.screenshots` in pluxx.config.ts, or add equivalent `platforms.codex.interface` overrides if you need a host-specific exception.',
      })
    } else if (!codexHasIcon) {
      warnings.push({
        code: 'codex-branding-metadata-missing',
        platform: 'Codex',
        title: 'Codex branding metadata is incomplete',
        message: 'Codex supports composer icon/logo metadata, but this plugin will fall back to generic host visuals because `brand.icon` is missing.',
        fix: 'Declare `brand.icon` in pluxx.config.ts, or add `platforms.codex.interface.composerIcon` / `logo` if you need a host-specific exception.',
      })
    } else if (!codexHasScreenshots) {
      warnings.push({
        code: 'codex-branding-metadata-missing',
        platform: 'Codex',
        title: 'Codex branding metadata is incomplete',
        message: 'Codex supports screenshots in the plugin detail surface, but this plugin will ship without them because `brand.screenshots` is missing.',
        fix: 'Declare `brand.screenshots` in pluxx.config.ts, or add `platforms.codex.interface.screenshots` if you need a host-specific exception.',
      })
    }
  }

  if (config.targets.includes('cursor') && !hasNonEmptyString(config.brand?.icon)) {
    warnings.push({
      code: 'cursor-branding-metadata-missing',
      platform: 'Cursor',
      title: 'Cursor branding metadata is incomplete',
      message: 'Cursor supports logo metadata in the plugin manifest, but this plugin will fall back to generic host visuals because `brand.icon` is missing.',
      fix: 'Declare `brand.icon` in pluxx.config.ts so Pluxx can emit Cursor logo metadata.',
    })
  }

  return warnings
}
