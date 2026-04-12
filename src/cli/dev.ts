import { watch, type FSWatcher } from 'fs'
import { relative, resolve } from 'path'
import { loadConfig } from '../config/load'
import { build } from '../generators'
import type { TargetPlatform } from '../schema'

/** Patterns that trigger a rebuild when changed */
const WATCH_PATTERNS = [
  /^pluxx\.config\.(ts|js|json)$/,
  /^skills\//,
  /^commands\//,
  /^agents\//,
  /^scripts\//,
  /\.md$/,
]

function shouldRebuild(relativePath: string): boolean {
  return WATCH_PATTERNS.some(pattern => pattern.test(relativePath))
}

export async function runDev(args: string[]) {
  const targetFlag = args.indexOf('--target')
  let targets: TargetPlatform[] | undefined

  if (targetFlag !== -1) {
    targets = args.slice(targetFlag + 1).filter(a => !a.startsWith('-')) as TargetPlatform[]
  }

  const rootDir = process.cwd()

  console.log('pluxx dev — watching for changes...')
  console.log('')

  // Run initial build
  await runBuild(rootDir, targets)

  // Debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pendingFile: string | null = null

  const watcher: FSWatcher = watch(rootDir, { recursive: true }, (_event, filename) => {
    if (!filename) return

    const rel = relative(rootDir, resolve(rootDir, filename))

    // Skip output directory and hidden files
    if (rel.startsWith('dist/') || rel.startsWith('.') || rel.includes('node_modules')) {
      return
    }

    if (!shouldRebuild(rel)) return

    pendingFile = rel

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      const changed = pendingFile
      pendingFile = null

      console.clear()
      console.log(`Change detected: ${changed}`)
      console.log('')

      await runBuild(rootDir, targets)
    }, 300)
  })

  // Keep process alive, clean up on exit
  process.on('SIGINT', () => {
    watcher.close()
    if (debounceTimer) clearTimeout(debounceTimer)
    console.log('\nStopped watching.')
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    watcher.close()
    if (debounceTimer) clearTimeout(debounceTimer)
    process.exit(0)
  })
}

async function runBuild(rootDir: string, targets?: TargetPlatform[]) {
  const start = performance.now()

  try {
    const config = await loadConfig(rootDir)
    const platforms = targets ?? config.targets

    console.log(`Building for: ${platforms.join(', ')}`)

    await build(config, rootDir, { targets })

    const elapsed = (performance.now() - start).toFixed(0)
    console.log(`Done in ${elapsed}ms — output in ${config.outDir}/`)
    for (const platform of platforms) {
      console.log(`  ${config.outDir}/${platform}/`)
    }
    console.log('')
    console.log('Watching for changes...')
  } catch (err) {
    const elapsed = (performance.now() - start).toFixed(0)
    console.error(`Build failed after ${elapsed}ms:`)
    console.error(err instanceof Error ? err.message : err)
    console.log('')
    console.log('Watching for changes...')
  }
}
