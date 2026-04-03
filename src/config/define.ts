import { type PluginConfig, PluginConfigSchema } from '../schema'

/**
 * Define a plugin configuration with full type checking and validation.
 *
 * Usage in pluxx.config.ts:
 * ```ts
 * import { definePlugin } from 'pluxx'
 *
 * export default definePlugin({
 *   name: 'my-plugin',
 *   description: 'My awesome plugin',
 *   author: { name: 'Me' },
 *   // ...
 * })
 * ```
 */
export function definePlugin(config: PluginConfig): PluginConfig {
  return PluginConfigSchema.parse(config)
}
