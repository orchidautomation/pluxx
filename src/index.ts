export {
  PluginConfigSchema,
  type PluginConfig,
  type TargetPlatform,
  type UserConfigEntry,
  type PermissionRule,
  type Permissions,
} from './schema'
export { definePlugin } from './config/define'
export {
  PLATFORM_LIMITS,
  PLATFORM_LIMIT_POLICIES,
  PLATFORM_VALIDATION_RULES,
  getPlatformRules,
  type PlatformLimitKind,
  type PlatformLimitPolicy,
  type PlatformLimitPolicies,
  type PlatformLimits,
  type PlatformRules,
  type PlatformRuleSource,
} from './validation/platform-rules'
export { getPlatformCompatibilityMatrix, renderCompatibilityMatrixMarkdown, type PlatformCompatibilityRow } from './compatibility/matrix'
export {
  buildGeneratedPermissionHookScript,
  buildOpenCodePermissionMap,
  collectPermissionRules,
  parsePermissionRule,
  permissionRulesNeedToolLevelDowngrade,
  type OpenCodePermissionMap,
  type ParsedPermissionRule,
  type PermissionAction,
  type PermissionRuleKind,
} from './permissions'
export { formatPublishPlan, planPublish, runPublish, type PublishAssetPlan, type PublishCheck, type PublishPlan, type PublishPlanOptions, type PublishRunResult } from './cli/publish'
