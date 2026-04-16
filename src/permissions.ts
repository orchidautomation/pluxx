export const PERMISSION_SELECTOR_KINDS = ['Bash', 'Edit', 'Read', 'MCP', 'Skill'] as const

export type PermissionRuleKind = typeof PERMISSION_SELECTOR_KINDS[number]
export type PermissionAction = 'allow' | 'ask' | 'deny'

export interface ParsedPermissionRule {
  action: PermissionAction
  raw: string
  kind: PermissionRuleKind
  pattern: string
}

export interface OpenCodePermissionMap {
  [tool: string]: PermissionAction
}

const PERMISSION_RULE_REGEX = new RegExp(
  `^(${PERMISSION_SELECTOR_KINDS.join('|')})\\((.+)\\)$`,
)

export function parsePermissionRule(raw: string): Omit<ParsedPermissionRule, 'action'> | null {
  const trimmed = raw.trim()
  const match = trimmed.match(PERMISSION_RULE_REGEX)
  if (!match) return null

  const kind = match[1] as PermissionRuleKind
  const pattern = match[2].trim()
  if (!pattern) return null

  return {
    raw: trimmed,
    kind,
    pattern,
  }
}

export function collectPermissionRules(
  permissions: Partial<Record<PermissionAction, string[]>> | undefined,
): ParsedPermissionRule[] {
  if (!permissions) return []

  const actions: PermissionAction[] = ['allow', 'ask', 'deny']
  const rules: ParsedPermissionRule[] = []

  for (const action of actions) {
    for (const raw of permissions[action] ?? []) {
      const parsed = parsePermissionRule(raw)
      if (!parsed) continue
      rules.push({
        ...parsed,
        action,
      })
    }
  }

  return rules
}

const ACTION_PRIORITY: Record<PermissionAction, number> = {
  allow: 0,
  ask: 1,
  deny: 2,
}

function mergeAction(current: PermissionAction | undefined, next: PermissionAction): PermissionAction {
  if (!current) return next
  return ACTION_PRIORITY[next] > ACTION_PRIORITY[current] ? next : current
}

export function permissionRulesNeedToolLevelDowngrade(
  permissions: Partial<Record<PermissionAction, string[]>> | undefined,
): boolean {
  return collectPermissionRules(permissions).some((rule) => rule.pattern !== '*')
}

export function buildOpenCodePermissionMap(
  permissions: Partial<Record<PermissionAction, string[]>> | undefined,
): OpenCodePermissionMap {
  const rules = collectPermissionRules(permissions)
  const output: OpenCodePermissionMap = {}

  const toolAliases: Record<PermissionRuleKind, string[]> = {
    Bash: ['bash', 'shell'],
    Edit: ['edit', 'write'],
    Read: ['read'],
    MCP: ['mcp'],
    // OpenCode's native permission surface is tool-level and does not expose
    // a dedicated skill permission key.
    Skill: [],
  }

  for (const rule of rules) {
    for (const tool of toolAliases[rule.kind]) {
      output[tool] = mergeAction(output[tool], rule.action)
    }
  }

  return output
}

export function buildGeneratedPermissionHookScript(
  permissions: Partial<Record<PermissionAction, string[]>> | undefined,
): string | null {
  const rules = collectPermissionRules(permissions)
  if (rules.length === 0) return null

  return `#!/usr/bin/env node
const RULES = ${JSON.stringify(rules, null, 2)};
const ACTION_PRIORITY = { allow: 0, ask: 1, deny: 2 };

function wildcardToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^$(){}|[\\]\\\\]/g, "\\\\$&")
    .replace(/\\*/g, ".*");
  return new RegExp("^" + escaped + "$", "i");
}

function matchesPattern(pattern, value) {
  if (!value) return false;
  return wildcardToRegExp(pattern).test(String(value));
}

function firstValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "");
}

function parseJsonInput() {
  const chunks = [];
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => {
      const raw = chunks.join("").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on("error", reject);
  });
}

function parseMcpName(raw) {
  if (!raw) return undefined;
  if (raw.startsWith("mcp__")) {
    const match = raw.match(/^mcp__([^_]+)__(.+)$/);
    if (match) return match[1] + "." + match[2].replace(/__/g, ".");
  }
  return raw;
}

function inferCandidates(mode, event) {
  const toolName = firstValue(event.tool_name, event.toolName, event.tool, event.matcher);
  const input = event.tool_input ?? event.toolInput ?? event.input ?? {};
  const candidates = [];

  const filePath = firstValue(
    event.file_path,
    input.file_path,
    input.path,
    input.filePath,
    input.target_file,
    input.targetFile
  );
  const command = firstValue(event.command, input.command, input.cmd, input.shell_command);
  const skillName = firstValue(input.name, input.skill_name, input.skillName);
  const mcpName = parseMcpName(firstValue(event.tool_name, input.tool_name, input.name));

  if (mode === "cursor-shell") {
    if (command) candidates.push({ kind: "Bash", value: command });
    return candidates;
  }

  if (mode === "cursor-read") {
    if (filePath) candidates.push({ kind: "Read", value: filePath });
    return candidates;
  }

  if (mode === "cursor-mcp") {
    if (mcpName) candidates.push({ kind: "MCP", value: mcpName });
    return candidates;
  }

  const normalizedTool = String(toolName || "").toLowerCase();

  if (command && /(bash|shell|terminal|command)/i.test(normalizedTool)) {
    candidates.push({ kind: "Bash", value: command });
  }

  if (filePath && /(edit|write|applypatch|replace|multiedit)/i.test(normalizedTool)) {
    candidates.push({ kind: "Edit", value: filePath });
  }

  if (filePath && /(read|view|open)/i.test(normalizedTool)) {
    candidates.push({ kind: "Read", value: filePath });
  }

  if ((normalizedTool.includes("mcp") || String(toolName || "").startsWith("mcp__")) && mcpName) {
    candidates.push({ kind: "MCP", value: mcpName });
  }

  if (skillName && /skill/i.test(normalizedTool)) {
    candidates.push({ kind: "Skill", value: skillName });
  }

  return candidates;
}

function evaluate(mode, event) {
  const candidates = inferCandidates(mode, event);
  let selected;

  for (const rule of RULES) {
    for (const candidate of candidates) {
      if (candidate.kind !== rule.kind) continue;
      if (!matchesPattern(rule.pattern, candidate.value)) continue;

      if (!selected || ACTION_PRIORITY[rule.action] > ACTION_PRIORITY[selected.action]) {
        selected = { rule, action: rule.action, candidate };
      }
    }
  }

  return selected;
}

function cursorResponse(match) {
  if (!match) return {};
  return {
    permission: match.action,
    user_message: "Pluxx permissions matched " + match.rule.raw,
  };
}

function claudeResponse(match) {
  if (!match) return {};
  return {
    hookSpecificOutput: {
      permissionDecision: match.action,
      permissionDecisionReason: "Pluxx permissions matched " + match.rule.raw,
    },
  };
}

async function main() {
  const mode = process.argv[2];
  const event = await parseJsonInput();
  const match = evaluate(mode, event);
  const payload = mode === "claude-pretool" ? claudeResponse(match) : cursorResponse(match);
  process.stdout.write(JSON.stringify(payload));
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
`
}
