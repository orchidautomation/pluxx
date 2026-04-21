import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const ROOT = fileURLToPath(new URL('.', import.meta.url))

function injectImportMetaDir() {
  return {
    name: 'inject-import-meta-dir',
    transform(code: string, id: string) {
      if (!id.includes('/tests/') || !code.includes('import.meta.dir')) {
        return null
      }

      return {
        code: [
          `import { dirname as __pluxxDirname } from 'node:path'`,
          `import { fileURLToPath as __pluxxFileURLToPath } from 'node:url'`,
          `if (!('dir' in import.meta)) {`,
          `  import.meta.dir = __pluxxDirname(__pluxxFileURLToPath(import.meta.url))`,
          `}`,
          code,
        ].join('\n'),
        map: null,
      }
    },
  }
}

export default defineConfig({
  plugins: [injectImportMetaDir()],
  resolve: {
    alias: {
      'bun:test': resolve(ROOT, 'tests/setup/bun-test-shim.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/helpers/**/*.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', '**/.codex/**'],
    fileParallelism: false,
    testTimeout: 30000,
    setupFiles: [resolve(ROOT, 'tests/setup/bun-global-shim.ts')],
  },
})
