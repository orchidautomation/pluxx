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
  CORE_FOUR_PRIMITIVE_CAPABILITIES,
  PLATFORM_LIMITS,
  PLATFORM_LIMIT_POLICIES,
  PLATFORM_VALIDATION_RULES,
  getCoreFourPrimitiveCapabilities,
  getPlatformRules,
  type CoreFourPlatform,
  type CoreFourPrimitiveCapabilities,
  type PlatformPrimitiveCapability,
  type PlatformLimitKind,
  type PlatformLimitPolicy,
  type PlatformLimitPolicies,
  type PlatformLimits,
  type PrimitiveTranslationMode,
  type PlatformRules,
  type PlatformRuleSource,
} from './validation/platform-rules'
export {
  PLUXX_COMPILER_BUCKETS,
  getConfiguredCompilerBuckets,
  getPluginCompilerBuckets,
  type Hooks,
  type PluxxCompilerBucket,
  type PluginCompilerBuckets,
  type PluginCommandsBucket,
  type PluginAgentsBucket,
  type PluginDistributionBucket,
  type PluginHooksBucket,
  type PluginInstructionsBucket,
  type PluginPermissionsBucket,
  type PluginRuntimeBucket,
  type PluginSkillsBucket,
} from './schema'
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
export {
  PLUXX_COMPILER_INTENT_PATH,
  readCompilerIntent,
  type CompilerIntentFile,
  type CompilerIntentSkillPolicy,
} from './compiler-intent'
export { formatPublishPlan, planPublish, runPublish, type PublishAssetPlan, type PublishCheck, type PublishPlan, type PublishPlanOptions, type PublishRunResult } from './cli/publish'
