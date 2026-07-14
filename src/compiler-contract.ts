import { z } from 'zod'

export const PluginNameSchema = z.string().regex(
  /^[a-z0-9-]+$/,
  'Must be lowercase with hyphens only',
)

export const HOST_MAPPED_COMPILER_BUCKETS = [
  'instructions',
  'skills',
  'commands',
  'agents',
  'hooks',
  'permissions',
  'runtime',
  'distribution',
] as const

export type HostMappedCompilerBucket = typeof HOST_MAPPED_COMPILER_BUCKETS[number]

export const PLUXX_COMPILER_BUCKETS = [
  'instructions',
  'skills',
  'commands',
  'agents',
  'orchestration',
  'hooks',
  'permissions',
  'runtime',
  'distribution',
] as const

export type PluxxCompilerBucket = typeof PLUXX_COMPILER_BUCKETS[number]
