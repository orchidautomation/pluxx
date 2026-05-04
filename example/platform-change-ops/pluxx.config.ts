import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'platform-change-ops',
  version: '0.1.0',
  description: 'Policy-aware platform change operations pack for incident triage, release gating, rollout comms, and rollback workflows.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/pluxx',
  license: 'MIT',
  keywords: [
    'enterprise',
    'platform',
    'change-management',
    'incident-response',
    'release-ops',
    'claude-code',
    'cursor',
    'codex',
    'opencode',
    'pluxx',
  ],

  brand: {
    displayName: 'Platform Change Ops',
    shortDescription: 'One maintained control-plane workflow pack for change review, release gating, rollout comms, and rollback.',
    longDescription: 'Use Platform Change Ops to intake change requests, inspect blast radius, research external vendor impact, review policy and risk, gate release or docs publishes, announce rollouts, and prepare rollbacks from one maintained Pluxx source project that ships native bundles to Claude Code, Cursor, Codex, and OpenCode.',
    category: 'Productivity',
    color: '#0F4C5C',
    icon: './assets/icon/platform-change-ops-icon.svg',
    screenshots: [
      './assets/screenshots/change-intake-workflow.svg',
      './assets/screenshots/risk-review-workflow.svg',
      './assets/screenshots/rollback-workflow.svg',
    ],
    defaultPrompts: [
      'Use Platform Change Ops to intake this change request, inspect the blast radius, and tell me whether it is ready for rollout.',
      'Use Platform Change Ops to review the current release risk, attach the missing evidence, and draft the stakeholder update.',
      'Use Platform Change Ops to prepare the rollback plan for this release and list the exact approvals still missing.',
    ],
    websiteURL: 'https://pluxx.dev',
    privacyPolicyURL: 'https://docs.pluxx.dev/reference/privacy-policy',
    termsOfServiceURL: 'https://docs.pluxx.dev/reference/terms-of-service',
  },

  userConfig: [
    {
      key: 'github-token',
      title: 'GitHub Token',
      description: 'GitHub credential for release PR inspection, merge metadata, and rollback links.',
      type: 'secret',
      required: false,
      envVar: 'GITHUB_TOKEN',
    },
    {
      key: 'linear-api-key',
      title: 'Linear API Key',
      description: 'Linear credential for change requests, incident tickets, and approval tracking.',
      type: 'secret',
      required: false,
      envVar: 'LINEAR_API_KEY',
    },
    {
      key: 'slack-bot-token',
      title: 'Slack Bot Token',
      description: 'Slack token for rollout and incident stakeholder updates.',
      type: 'secret',
      required: false,
      envVar: 'SLACK_BOT_TOKEN',
    },
    {
      key: 'datadog-api-key',
      title: 'Datadog API Key',
      description: 'Datadog API key for service health, logs, and deployment impact checks.',
      type: 'secret',
      required: false,
      envVar: 'DATADOG_API_KEY',
    },
    {
      key: 'pagerduty-token',
      title: 'PagerDuty Token',
      description: 'PagerDuty token for active incident context and escalation metadata.',
      type: 'secret',
      required: false,
      envVar: 'PAGERDUTY_TOKEN',
    },
    {
      key: 'runbooks-oauth-token',
      title: 'Runbooks OAuth Token',
      description: 'Optional runbooks access token for private control-plane authoring and postmortem pages.',
      type: 'secret',
      required: false,
      envVar: 'RUNBOOKS_OAUTH_TOKEN',
    },
    {
      key: 'default-environment',
      title: 'Default Environment',
      description: 'Default environment to scope risk checks, rollout summaries, and rollback plans.',
      type: 'string',
      required: true,
      envVar: 'CHANGEOPS_ENVIRONMENT',
      defaultValue: 'production',
    },
    {
      key: 'approval-mode',
      title: 'Approval Mode',
      description: 'How aggressively the plugin should block risky write actions before explicit human approval.',
      type: 'string',
      required: true,
      envVar: 'CHANGEOPS_APPROVAL_MODE',
      defaultValue: 'strict',
    },
    {
      key: 'stakeholder-channel',
      title: 'Stakeholder Channel',
      description: 'Default Slack or Teams channel for rollout and incident updates.',
      type: 'string',
      required: false,
      envVar: 'CHANGEOPS_STAKEHOLDER_CHANNEL',
      defaultValue: '#release-ops',
    },
  ],

  permissions: {
    allow: [
      'Read(*)',
      'MCP(github.list_pull_requests)',
      'MCP(github.get_pull_request)',
      'MCP(linear.list_issues)',
      'MCP(datadog.query_metrics)',
      'MCP(datadog.search_logs)',
      'MCP(pagerduty.list_incidents)',
      'MCP(runbooks.search_pages)',
      'MCP(changeops-local.readiness_status)',
      'Skill(verify-installed-state)',
    ],
    ask: [
      'Edit(*)',
      'Bash(*)',
      'MCP(github.merge_pull_request)',
      'MCP(linear.update_issue)',
      'MCP(slack.post_message)',
      'MCP(changeops-local.open_change_window)',
      'MCP(changeops-local.record_audit_event)',
    ],
    deny: [
      'Edit(.env)',
      'Bash(rm *)',
      'Bash(kubectl delete *)',
      'Skill(rollback-change)',
    ],
  },

  skills: './skills/',
  commands: './commands/',
  agents: './agents/',
  instructions: './INSTRUCTIONS.md',
  scripts: './scripts/',
  assets: './assets/',
  passthrough: ['./passthrough/'],

  mcp: {
    github: {
      transport: 'http',
      url: 'https://api.githubcopilot.com/mcp/',
      auth: {
        type: 'header',
        envVar: 'GITHUB_TOKEN',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
    linear: {
      transport: 'http',
      url: 'https://mcp.linear.app/mcp',
      auth: {
        type: 'header',
        envVar: 'LINEAR_API_KEY',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
    slack: {
      transport: 'http',
      url: 'https://slack.com/api/mcp',
      auth: {
        type: 'header',
        envVar: 'SLACK_BOT_TOKEN',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
    datadog: {
      transport: 'http',
      url: 'https://api.datadoghq.com/api/mcp',
      auth: {
        type: 'header',
        envVar: 'DATADOG_API_KEY',
        headerName: 'DD-API-KEY',
        headerTemplate: '${value}',
      },
    },
    pagerduty: {
      transport: 'http',
      url: 'https://api.pagerduty.com/mcp',
      auth: {
        type: 'header',
        envVar: 'PAGERDUTY_TOKEN',
        headerName: 'Authorization',
        headerTemplate: 'Token token=${value}',
      },
    },
    runbooks: {
      transport: 'http',
      url: 'https://runbooks.example.com/api/mcp',
      auth: {
        type: 'platform',
        mode: 'oauth',
      },
    },
    'changeops-local': {
      transport: 'stdio',
      command: 'bash',
      args: ['./scripts/start-mcp.sh'],
      env: {
        CHANGEOPS_ENVIRONMENT: '${CHANGEOPS_ENVIRONMENT}',
        CHANGEOPS_APPROVAL_MODE: '${CHANGEOPS_APPROVAL_MODE}',
      },
    },
  },

  readiness: {
    dependencies: [
      {
        id: 'policy-cache',
        path: './passthrough/runtime/state/policy-sync.json',
        statusField: 'status',
        readyValues: ['ready'],
        pendingValues: ['syncing'],
        failedValues: ['failed'],
        refresh: {
          command: 'node "${PLUGIN_ROOT}/scripts/risk-score.mjs" sync-policy',
        },
        description: 'Local policy bundle and approval rules must be synced before mutation-aware workflows run.',
      },
      {
        id: 'service-health',
        path: './passthrough/runtime/state/service-health.json',
        statusField: 'status',
        readyValues: ['ready'],
        pendingValues: ['refreshing'],
        failedValues: ['failed'],
        refresh: {
          command: 'node "${PLUGIN_ROOT}/scripts/risk-score.mjs" refresh-health',
        },
        description: 'Current rollout health snapshot should exist before risk review and publish/rollback decisions.',
      },
    ],
    gates: [
      {
        dependency: 'policy-cache',
        applyTo: ['skills', 'commands'],
        skills: ['review-risk-and-policy', 'publish-docs-or-release', 'rollback-change'],
        commands: ['review-risk-and-policy', 'publish-docs-or-release', 'rollback-change'],
        timeoutMs: 3000,
        pollMs: 250,
        onTimeout: 'fail',
        message: 'Policy cache must be fresh before mutation-aware change work.',
      },
      {
        dependency: 'service-health',
        applyTo: ['mcp-tools', 'skills'],
        tools: ['datadog.query_metrics', 'pagerduty.list_incidents'],
        skills: ['inspect-change-surface', 'review-risk-and-policy'],
        timeoutMs: 3000,
        pollMs: 250,
        onTimeout: 'warn',
        message: 'Refresh service-health context before impact analysis or release gating.',
      },
    ],
  },

  hooks: {
    sessionStart: [
      {
        command: 'bash "${PLUGIN_ROOT}/scripts/check-env.sh"',
      },
      {
        command: 'bash "${PLUGIN_ROOT}/scripts/bootstrap-runtime.sh"',
      },
    ],
    preToolUse: [
      {
        command: 'node "${PLUGIN_ROOT}/scripts/record-audit-event.mjs" preflight',
        matcher: 'mcp__github__merge_pull_request',
        failClosed: true,
      },
      {
        command: 'node "${PLUGIN_ROOT}/scripts/record-audit-event.mjs" preflight',
        matcher: 'mcp__slack__post_message',
      },
      {
        command: 'bash "${PLUGIN_ROOT}/scripts/assert-change-window.sh"',
        matcher: 'mcp__changeops-local__open_change_window',
        failClosed: true,
      },
    ],
    postToolUse: [
      {
        command: 'node "${PLUGIN_ROOT}/scripts/record-audit-event.mjs" capture',
        matcher: 'mcp__github__merge_pull_request',
      },
      {
        command: 'node "${PLUGIN_ROOT}/scripts/record-audit-event.mjs" capture',
        matcher: 'mcp__linear__update_issue',
      },
    ],
    beforeSubmitPrompt: [
      {
        type: 'prompt',
        prompt: 'Classify the request as investigate, plan, execute, or communicate. If the user is asking to execute risky change work without evidence, convert the next step into a safer plan and say which missing approvals or context blocks execution.',
        model: 'gpt-5',
      },
    ],
    stop: [
      {
        command: 'node "${PLUGIN_ROOT}/scripts/record-audit-event.mjs" summarize',
        loop_limit: 3,
      },
    ],
  },

  platforms: {
    codex: {
      interface: {
        capabilities: ['Interactive', 'Read', 'Write'],
      },
    },
    cursor: {
      rules: [{
        description: 'Platform change-ops mutation discipline',
        alwaysApply: true,
        globs: ['**/*'],
        content: 'Investigate first, plan second, execute last. Require explicit approval context before risky write actions.',
      }],
    },
  },

  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
  outDir: './dist',
})
