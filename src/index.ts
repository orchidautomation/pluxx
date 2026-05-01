export {
  PluginConfigSchema,
  type PluginConfig,
  type RuntimeReadiness,
  type RuntimeReadinessDependency,
  type RuntimeReadinessGate,
  type RuntimeReadinessRefresh,
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
  type PluginDistributionBrandingSubprimitive,
  type PluginDistributionInstallSubprimitive,
  type PluginDistributionOutputSubprimitive,
  type PluginHooksBucket,
  type PluginInstructionsBucket,
  type PluginPermissionsBucket,
  type PluginRuntimeMcpSubprimitive,
  type PluginRuntimePayloadSubprimitive,
  type PluginRuntimeReadinessSubprimitive,
  type PluginRuntimeBucket,
  type PluginSkillsBucket,
} from './schema'
export { getPlatformCompatibilityMatrix, renderCompatibilityMatrixMarkdown, type PlatformCompatibilityRow } from './compatibility/matrix'
export {
  getEnabledRuntimeReadinessBindings,
  getRuntimeReadinessCapability,
  getRuntimeReadinessExternalConfigNote,
  getRuntimeReadinessNamedPromptTargetNote,
  type RuntimeReadinessBinding,
  type RuntimeReadinessCapability,
  type RuntimeReadinessDeliveryMode,
  type RuntimeReadinessGateKind,
  type RuntimeReadinessScopeMode,
} from './runtime-readiness-registry'
export {
  INSTALLER_OWNED_CHECK_ENV_PATH,
  PORTABLE_RUNTIME_SCRIPT_ROLES,
  getConsumerEnvScriptActiveDetail,
  getConsumerEnvScriptMissingDetail,
  getInstallerOwnedCheckEnvHookMessage,
  getInstallerOwnedCheckEnvRuntimeMessage,
  getPortableRuntimeScriptRoleGuidance,
  referencesInstallerOwnedCheckEnv,
} from './runtime-script-contract'
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
export {
  printVerifyInstallResult,
  verifyInstall,
  type VerifyInstallCheck,
  type VerifyInstallResult,
} from './cli/verify-install'
