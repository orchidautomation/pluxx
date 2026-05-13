export const RECOMMENDED_CODEX_HOOKS_FEATURE_FLAG = 'hooks'
export const ALTERNATE_CODEX_HOOKS_FEATURE_FLAG = 'codex_hooks'

export interface CodexHooksFeatureState {
  recommended: boolean
  alternate: boolean
}

export function getCodexHooksFeatureState(features: Record<string, unknown> | null | undefined): CodexHooksFeatureState {
  if (!features) {
    return {
      recommended: false,
      alternate: false,
    }
  }

  return {
    recommended: features[RECOMMENDED_CODEX_HOOKS_FEATURE_FLAG] === true,
    alternate: features[ALTERNATE_CODEX_HOOKS_FEATURE_FLAG] === true,
  }
}

export function isCodexHooksFeatureEnabled(features: Record<string, unknown> | null | undefined): boolean {
  const state = getCodexHooksFeatureState(features)
  return state.recommended || state.alternate
}

export function usesAlternateCodexHooksFeatureFlagOnly(features: Record<string, unknown> | null | undefined): boolean {
  const state = getCodexHooksFeatureState(features)
  return state.alternate && !state.recommended
}
