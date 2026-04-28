import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { loadConfig } from '../config/load'
import {
  AGENT_CONTEXT_PATH,
  planAgentPrepare,
  planAgentPrompt,
  type AgentPromptKind,
} from './agent'
import {
  MCP_SCAFFOLD_METADATA_PATH,
  type McpScaffoldMetadata,
} from './init-from-mcp'

export type EvalLevel = 'error' | 'warning' | 'info' | 'success'

export interface EvalCheck {
  level: EvalLevel
  code: string
  title: string
  detail: string
  fix: string
  path?: string
}

export interface EvalReport {
  ok: boolean
  errors: number
  warnings: number
  infos: number
  checks: EvalCheck[]
}

export interface EvalRunOptions {
  rootDir?: string
}

const AGENT_PROMPT_KINDS: AgentPromptKind[] = ['taxonomy', 'instructions', 'review']

function addCheck(checks: EvalCheck[], check: EvalCheck): void {
  checks.push(check)
}

function summarizeChecks(checks: EvalCheck[]): EvalReport {
  const errors = checks.filter((check) => check.level === 'error').length
  const warnings = checks.filter((check) => check.level === 'warning').length
  const infos = checks.filter((check) => check.level === 'info').length

  return {
    ok: errors === 0,
    errors,
    warnings,
    infos,
    checks,
  }
}

async function loadMcpScaffoldMetadata(rootDir: string): Promise<McpScaffoldMetadata | null> {
  const metadataPath = resolve(rootDir, MCP_SCAFFOLD_METADATA_PATH)
  if (!existsSync(metadataPath)) {
    return null
  }

  const parsed = JSON.parse(readFileSync(metadataPath, 'utf-8')) as McpScaffoldMetadata
  return parsed
}

function hasRelatedDiscovery(metadata: McpScaffoldMetadata): boolean {
  return metadata.skills.some((skill) =>
    (skill.resourceUris?.length ?? 0) > 0
    || (skill.resourceTemplateUris?.length ?? 0) > 0
    || (skill.promptNames?.length ?? 0) > 0,
  )
}

function collectSkillResourceLabels(skill: McpScaffoldMetadata['skills'][number], metadata: McpScaffoldMetadata): string[] {
  const resourceByUri = new Map((metadata.resources ?? []).map((resource) => [resource.uri, resource]))
  const resourceTemplateByUri = new Map((metadata.resourceTemplates ?? []).map((template) => [template.uriTemplate, template]))

  return [
    ...(skill.resourceUris ?? []).map((uri) => {
      const resource = resourceByUri.get(uri)
      return resource ? `\`${resource.name ?? resource.title ?? resource.uri}\`` : `\`${uri}\``
    }),
    ...(skill.resourceTemplateUris ?? []).map((uriTemplate) => {
      const template = resourceTemplateByUri.get(uriTemplate)
      return template ? `\`${template.name}\`` : `\`${uriTemplate}\``
    }),
  ]
}

function collectSkillPromptLabels(skill: McpScaffoldMetadata['skills'][number]): string[] {
  return (skill.promptNames ?? []).map((name) => `\`${name}\``)
}

function evaluateInstructions(rootDir: string, metadata: McpScaffoldMetadata, checks: EvalCheck[]): void {
  const relativePath = 'INSTRUCTIONS.md'
  const filePath = resolve(rootDir, relativePath)

  if (!existsSync(filePath)) {
    addCheck(checks, {
      level: 'error',
      code: 'instructions-missing',
      title: 'Instructions file missing',
      detail: 'The scaffold does not include INSTRUCTIONS.md.',
      fix: 'Regenerate the scaffold or restore INSTRUCTIONS.md before evaluating quality.',
      path: relativePath,
    })
    return
  }

  const content = readFileSync(filePath, 'utf-8')
  const missing: string[] = []

  if (!content.includes('## Workflow Guidance')) missing.push('`## Workflow Guidance`')
  if (!content.includes('## Tool Routing')) missing.push('`## Tool Routing`')
  if (((metadata.resources?.length ?? 0) > 0 || (metadata.resourceTemplates?.length ?? 0) > 0) && !content.includes('## Resource Surfaces')) {
    missing.push('`## Resource Surfaces`')
  }
  if ((metadata.prompts?.length ?? 0) > 0 && !content.includes('## Prompt Templates')) {
    missing.push('`## Prompt Templates`')
  }

  if (missing.length > 0) {
    addCheck(checks, {
      level: 'error',
      code: 'instructions-quality-contract',
      title: 'Instructions scaffold is missing required sections',
      detail: `INSTRUCTIONS.md is missing: ${missing.join(', ')}.`,
      fix: 'Regenerate the scaffold or restore the required generated sections in INSTRUCTIONS.md.',
      path: relativePath,
    })
    return
  }

  addCheck(checks, {
    level: 'success',
    code: 'instructions-quality-contract',
    title: 'Instructions scaffold includes expected discovery sections',
    detail: 'INSTRUCTIONS.md reflects the current workflow, tool, resource, and prompt-template surfaces.',
    fix: 'No action needed.',
    path: relativePath,
  })
}

function evaluateSkills(rootDir: string, metadata: McpScaffoldMetadata, checks: EvalCheck[]): void {
  const failures: Array<{ path: string, missing: string[] }> = []

  for (const skill of metadata.skills) {
    const relativePath = `skills/${skill.dirName}/SKILL.md`
    const filePath = resolve(rootDir, relativePath)

    if (!existsSync(filePath)) {
      failures.push({ path: relativePath, missing: ['skill file'] })
      continue
    }

    const content = readFileSync(filePath, 'utf-8')
    const missing: string[] = []

    if (!content.includes('## Example Requests')) {
      missing.push('`## Example Requests`')
    }
    if (collectSkillResourceLabels(skill, metadata).length > 0 && !content.includes('## Related Resources')) {
      missing.push('`## Related Resources`')
    }
    if (collectSkillPromptLabels(skill).length > 0 && !content.includes('## Related Prompt Templates')) {
      missing.push('`## Related Prompt Templates`')
    }

    if (missing.length > 0) {
      failures.push({ path: relativePath, missing })
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      addCheck(checks, {
        level: 'error',
        code: 'skill-quality-contract',
        title: 'Skill scaffold is missing required quality sections',
        detail: `${failure.path} is missing: ${failure.missing.join(', ')}.`,
        fix: 'Regenerate the scaffold or restore the missing generated sections in this skill file.',
        path: failure.path,
      })
    }
    return
  }

  addCheck(checks, {
    level: 'success',
    code: 'skill-quality-contract',
    title: 'Skill scaffolds expose expected examples and related surfaces',
    detail: `Checked ${metadata.skills.length} generated skill file(s) for examples and related discovery sections.`,
    fix: 'No action needed.',
  })
}

function hasManagedCommands(metadata: McpScaffoldMetadata): boolean {
  return metadata.managedFiles.some((file) => file.startsWith('commands/'))
}

function evaluateCommands(rootDir: string, metadata: McpScaffoldMetadata, checks: EvalCheck[]): void {
  if (!hasManagedCommands(metadata)) {
    addCheck(checks, {
      level: 'info',
      code: 'command-quality-contract-skipped',
      title: 'No managed command files to evaluate',
      detail: 'This scaffold does not currently manage command files.',
      fix: 'No action needed unless commands should be part of this plugin surface.',
    })
    return
  }

  const failures: Array<{ path: string, missing: string[] }> = []

  for (const skill of metadata.skills) {
    const relativePath = `commands/${skill.dirName}.md`
    const filePath = resolve(rootDir, relativePath)

    if (!existsSync(filePath)) {
      failures.push({ path: relativePath, missing: ['command file'] })
      continue
    }

    const content = readFileSync(filePath, 'utf-8')
    const missing: string[] = []

    if (!content.includes('argument-hint:')) missing.push('`argument-hint` frontmatter')
    if (!content.includes('Primary tools:')) missing.push('`Primary tools:` block')
    if (collectSkillResourceLabels(skill, metadata).length > 0 && !content.includes('Related resources:')) {
      missing.push('`Related resources:` block')
    }
    if (collectSkillPromptLabels(skill).length > 0 && !content.includes('Related prompt templates:')) {
      missing.push('`Related prompt templates:` block')
    }

    if (/Use the .* workflow for this plugin\./.test(content)) {
      addCheck(checks, {
        level: 'warning',
        code: 'command-generic-entry-blurb',
        title: 'Command still uses a generic workflow blurb',
        detail: `${relativePath} still uses the old generic command template instead of product-shaped routing guidance.`,
        fix: 'Refine the command blurb or rerun agent instructions/review passes to strengthen command UX.',
        path: relativePath,
      })
    }

    if ((skill.promptNames?.length ?? 0) > 0 && content.includes('argument-hint: [request]')) {
      addCheck(checks, {
        level: 'warning',
        code: 'command-generic-prompt-arguments',
        title: 'Prompt-backed command still uses a generic argument hint',
        detail: `${relativePath} has related prompt templates but still advertises the generic \`[request]\` argument hint.`,
        fix: 'Derive argument hints from prompt-template arguments or refine the scaffold so the command exposes the intended workflow parameters.',
        path: relativePath,
      })
    }

    if (missing.length > 0) {
      failures.push({ path: relativePath, missing })
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      addCheck(checks, {
        level: 'error',
        code: 'command-quality-contract',
        title: 'Command scaffold is missing required quality sections',
        detail: `${failure.path} is missing: ${failure.missing.join(', ')}.`,
        fix: 'Regenerate the scaffold or restore the missing generated sections in this command file.',
        path: failure.path,
      })
    }
    return
  }

  addCheck(checks, {
    level: 'success',
    code: 'command-quality-contract',
    title: 'Command scaffolds expose expected routing guidance and related surfaces',
    detail: `Checked ${metadata.skills.length} generated command file(s) for argument hints, tool routing, and related discovery surfaces.`,
    fix: 'No action needed.',
  })
}

function evaluateAgentContext(contextContent: string, metadata: McpScaffoldMetadata, checks: EvalCheck[]): void {
  const missing: string[] = []

  if (((metadata.resources?.length ?? 0) > 0 || (metadata.resourceTemplates?.length ?? 0) > 0 || (metadata.prompts?.length ?? 0) > 0) && !contextContent.includes('## MCP Discovery Surfaces')) {
    missing.push('`## MCP Discovery Surfaces`')
  }

  for (const skill of metadata.skills) {
    const skillHeader = `### \`${skill.dirName}\``
    if (!contextContent.includes(skillHeader)) {
      missing.push(skillHeader)
      continue
    }

    const resourceLabels = collectSkillResourceLabels(skill, metadata)
    if (resourceLabels.length > 0) {
      const expectedLine = `- Related resources: ${resourceLabels.join(', ')}`
      if (!contextContent.includes(expectedLine)) {
        missing.push(expectedLine)
      }
    }

    const promptLabels = collectSkillPromptLabels(skill)
    if (promptLabels.length > 0) {
      const expectedLine = `- Related prompt templates: ${promptLabels.join(', ')}`
      if (!contextContent.includes(expectedLine)) {
        missing.push(expectedLine)
      }
    }
  }

  if (missing.length > 0) {
    addCheck(checks, {
      level: 'error',
      code: 'agent-context-discovery-contract',
      title: 'Agent context is missing expected discovery evidence',
      detail: `The planned agent context is missing: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', ...' : ''}.`,
      fix: 'Regenerate the agent pack and ensure the context includes per-skill resource and prompt-template associations.',
      path: AGENT_CONTEXT_PATH,
    })
    return
  }

  addCheck(checks, {
    level: 'success',
    code: 'agent-context-discovery-contract',
    title: 'Agent context exposes top-level and per-skill discovery evidence',
    detail: 'The planned agent context includes discovery surfaces and per-skill related resource/prompt-template associations.',
    fix: 'No action needed.',
    path: AGENT_CONTEXT_PATH,
  })
}

function evaluatePromptContent(
  kind: AgentPromptKind,
  content: string,
  metadata: McpScaffoldMetadata,
  checks: EvalCheck[],
): void {
  const needsPerSkillAssociationLanguage = hasRelatedDiscovery(metadata)
  const requiredPhrases: string[] = []

  if (kind === 'taxonomy') {
    requiredPhrases.push(
      'Infer the MCP\'s real product surfaces and workflows from tools, resources, resource templates, and prompt templates.',
      'Reject stale scaffold assumptions',
      'avoid weak command UX',
    )
    if (needsPerSkillAssociationLanguage) {
      requiredPhrases.push(
        'Use per-skill related resources and prompt templates as strong evidence for workflow shape',
        'per-skill resource and prompt-template associations remain coherent with the chosen taxonomy',
      )
    }
  } else if (kind === 'instructions') {
    requiredPhrases.push(
      'routing guidance, not a raw documentation dump.',
      'copy-paste runnable',
    )
    if (needsPerSkillAssociationLanguage) {
      requiredPhrases.push('workflow already has related resources or prompt templates in the context')
    }
  } else {
    requiredPhrases.push(
      'weak command UX',
      'stale scaffold assumptions',
      'Separate scaffold quality findings from runtime-correctness findings.',
    )
    if (needsPerSkillAssociationLanguage) {
      requiredPhrases.push('incoherent per-skill resource/prompt associations')
    }
  }

  const missing = requiredPhrases.filter((phrase) => !content.includes(phrase))
  const promptPath = `.pluxx/agent/${kind}-prompt.md`

  if (missing.length > 0) {
    addCheck(checks, {
      level: 'error',
      code: `${kind}-prompt-contract`,
      title: `${kind[0].toUpperCase()}${kind.slice(1)} prompt is missing required quality language`,
      detail: `${promptPath} is missing: ${missing.map((phrase) => `“${phrase}”`).join(', ')}.`,
      fix: `Regenerate the ${kind} prompt pack or update the prompt builder so these quality constraints remain explicit.`,
      path: promptPath,
    })
    return
  }

  addCheck(checks, {
    level: 'success',
    code: `${kind}-prompt-contract`,
    title: `${kind[0].toUpperCase()}${kind.slice(1)} prompt keeps the expected quality contract`,
    detail: `${promptPath} includes the current discovery and quality language needed for scaffold regression checks.`,
    fix: 'No action needed.',
    path: promptPath,
  })
}

export async function runEvalSuite(options: EvalRunOptions = {}): Promise<EvalReport> {
  const rootDir = options.rootDir ?? process.cwd()
  const checks: EvalCheck[] = []

  try {
    await loadConfig(rootDir)
    const metadata = await loadMcpScaffoldMetadata(rootDir)

    if (!metadata) {
      addCheck(checks, {
        level: 'info',
        code: 'eval-skipped-no-mcp-metadata',
        title: 'No MCP scaffold metadata present',
        detail: `${MCP_SCAFFOLD_METADATA_PATH} is not present, so scaffold/prompt quality evals were skipped.`,
        fix: 'Run this command inside an MCP-derived Pluxx project if you want scaffold and prompt-pack evals.',
        path: MCP_SCAFFOLD_METADATA_PATH,
      })
      return summarizeChecks(checks)
    }

    const preparePlan = await planAgentPrepare(rootDir)
    const contextContent = preparePlan.files.find((file) => file.relativePath === AGENT_CONTEXT_PATH)?.content ?? ''
    const promptPlans = await Promise.all(
      AGENT_PROMPT_KINDS.map((kind) => planAgentPrompt(rootDir, kind, { allowMissingContext: true })),
    )
    const promptContents = new Map<AgentPromptKind, string>(
      promptPlans.map((plan) => [plan.kind, plan.files[0]?.content ?? '']),
    )

    const isMigratedBaseline = metadata.tools.length === 0

    if (isMigratedBaseline) {
      addCheck(checks, {
        level: 'info',
        code: 'eval-generated-scaffold-skipped',
        title: 'Generated scaffold evals skipped for migrated baseline',
        detail: 'This project has scaffold metadata but no MCP tool inventory, so file-level generated-section evals were skipped.',
        fix: 'No action needed unless you want to rebuild the project around a fresh MCP-derived scaffold.',
      })
    } else {
      evaluateInstructions(rootDir, metadata, checks)
      evaluateSkills(rootDir, metadata, checks)
      evaluateCommands(rootDir, metadata, checks)
    }

    evaluateAgentContext(contextContent, metadata, checks)

    for (const kind of AGENT_PROMPT_KINDS) {
      evaluatePromptContent(kind, promptContents.get(kind) ?? '', metadata, checks)
    }

    return summarizeChecks(checks)
  } catch (error) {
    addCheck(checks, {
      level: 'error',
      code: 'eval-runtime-failure',
      title: 'Eval run failed',
      detail: error instanceof Error ? error.message : String(error),
      fix: 'Resolve the underlying project/config error, then rerun `pluxx eval`.',
    })
    return summarizeChecks(checks)
  }
}

export function printEvalReport(report: EvalReport): void {
  for (const check of report.checks) {
    const prefix = check.level.toUpperCase().padEnd(7, ' ')
    const pathLabel = check.path ? ` [${check.path}]` : ''
    console.log(`${prefix} ${check.code}${pathLabel} ${check.title}`)
    console.log(`         ${check.detail}`)
    console.log(`         Fix: ${check.fix}`)
  }

  console.log('')
  console.log(`Eval summary: ${report.errors} error(s), ${report.warnings} warning(s), ${report.infos} info message(s)`)
}
