export { PluginConfigSchema, type Permissions, type PluginConfig, type TargetPlatform, type UserConfigEntry } from './schema'
export { definePlugin } from './config/define'
export { PLATFORM_LIMITS, PLATFORM_VALIDATION_RULES, getPlatformRules, type PlatformLimits, type PlatformRules, type PlatformRuleSource } from './validation/platform-rules'
export { getPlatformCompatibilityMatrix, renderCompatibilityMatrixMarkdown, type PlatformCompatibilityRow } from './compatibility/matrix'
