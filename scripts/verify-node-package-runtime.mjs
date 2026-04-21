#!/usr/bin/env node

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function parseArgs(argv) {
  let packageFile
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--package-file') {
      packageFile = argv[index + 1]
      index += 1
    }
  }

  return {
    packageFile: packageFile ? resolve(packageFile) : undefined,
  }
}

function run(command, args, options = {}) {
  const printable = [command, ...args].map((value) => JSON.stringify(value)).join(' ')
  console.log(`$ ${printable}`)
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      ...options.env,
    },
  })

  if (result.status !== 0) {
    const stdout = result.stdout?.trim()
    const stderr = result.stderr?.trim()
    const details = [stdout, stderr].filter(Boolean).join('\n')
    throw new Error(`Command failed (${command} ${args.join(' ')}):\n${details}`)
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function createFixtureProject(rootDir) {
  mkdirSync(join(rootDir, 'skills', 'hello'), { recursive: true })
  writeFileSync(
    join(rootDir, 'pluxx.config.ts'),
    `import { definePlugin } from 'pluxx'

export default definePlugin({
  name: 'node-runtime-fixture',
  version: '0.1.0',
  description: 'Fixture config',
  author: { name: 'Test Author' },
  skills: './skills/',
  targets: ['codex'],
  outDir: './dist',
})
`,
  )
  writeFileSync(
    join(rootDir, 'skills', 'hello', 'SKILL.md'),
    `---
name: hello
description: Say hello
---

# Hello
`,
  )
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} did not include expected text: ${needle}`)
  }
}

function assertFileExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} not found at ${path}`)
  }
}

function verifyInstalledPackage(packageFile) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'pluxx-installed-package-'))
  try {
    run('npm', ['init', '-y'], { cwd: tempRoot })
    run('npm', ['install', '--no-save', packageFile], { cwd: tempRoot })

    const fixtureDir = join(tempRoot, 'fixture')
    createFixtureProject(fixtureDir)

    const installedBin = join(tempRoot, 'node_modules', '@orchid-labs', 'pluxx', 'bin', 'pluxx.js')
    const doctor = run('node', [installedBin, 'doctor', '--json'], { cwd: fixtureDir })
    const doctorReport = JSON.parse(doctor.stdout)
    if (doctorReport.ok !== true) {
      throw new Error(`installed-package doctor returned non-ok JSON: ${doctor.stdout}`)
    }

    const validate = run('node', [installedBin, 'validate'], { cwd: fixtureDir })
    assertIncludes(validate.stdout, 'Config valid: node-runtime-fixture@0.1.0', 'installed-package validate')

    const build = run('node', [installedBin, 'build', '--json'], { cwd: fixtureDir })
    const parsed = JSON.parse(build.stdout)
    if (parsed.ok !== true) {
      throw new Error(`installed-package build returned non-ok JSON: ${build.stdout}`)
    }
    assertFileExists(
      join(fixtureDir, 'dist', 'codex', '.codex-plugin', 'plugin.json'),
      'installed-package build output',
    )
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

function verifyNpmExec(packageFile) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'pluxx-npm-exec-'))
  try {
    run('npm', ['init', '-y'], { cwd: tempRoot })
    createFixtureProject(tempRoot)

    const doctor = run(
      'npm',
      ['exec', '--yes', '--package', packageFile, '--', 'pluxx', 'doctor', '--json'],
      { cwd: tempRoot },
    )
    const doctorReport = JSON.parse(doctor.stdout)
    if (doctorReport.ok !== true) {
      throw new Error(`npm exec doctor returned non-ok JSON: ${doctor.stdout}`)
    }

    const validate = run(
      'npm',
      ['exec', '--yes', '--package', packageFile, '--', 'pluxx', 'validate'],
      { cwd: tempRoot },
    )
    assertIncludes(validate.stdout, 'Config valid: node-runtime-fixture@0.1.0', 'npm exec validate')

    const build = run(
      'npm',
      ['exec', '--yes', '--package', packageFile, '--', 'pluxx', 'build', '--json'],
      { cwd: tempRoot },
    )
    const parsed = JSON.parse(build.stdout)
    if (parsed.ok !== true) {
      throw new Error(`npm exec build returned non-ok JSON: ${build.stdout}`)
    }
    assertFileExists(
      join(tempRoot, 'dist', 'codex', '.codex-plugin', 'plugin.json'),
      'npm exec build output',
    )
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

function resolvePackageFile(inputPath) {
  if (inputPath) {
    return {
      path: inputPath,
      cleanupPath: undefined,
    }
  }

  const packDir = mkdtempSync(join(tmpdir(), 'pluxx-pack-'))
  const { stdout } = run('npm', ['pack', '--silent', '--pack-destination', packDir])
  const filename = stdout.trim().split(/\r?\n/).filter(Boolean).pop()
  if (!filename) {
    throw new Error('npm pack did not produce a tarball filename')
  }
  return {
    path: resolve(packDir, filename),
    cleanupPath: packDir,
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const packageArtifact = resolvePackageFile(args.packageFile)
  console.log(`Using package tarball: ${basename(packageArtifact.path)}`)

  try {
    verifyInstalledPackage(packageArtifact.path)
    verifyNpmExec(packageArtifact.path)
    console.log('Node package runtime verification passed.')
  } finally {
    if (packageArtifact.cleanupPath && existsSync(packageArtifact.cleanupPath)) {
      rmSync(packageArtifact.cleanupPath, { recursive: true, force: true })
    }
  }
}

main()
