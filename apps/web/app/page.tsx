const primaryPlatforms = [
  {
    name: "Claude Code",
    note: "Manifest, hooks, skills, and MCP config generated as a native bundle.",
    status: "Primary",
    tone: "tone-cyan",
  },
  {
    name: "Cursor",
    note: "Rules, hooks, plugin manifest, and MCP config stay aligned with Cursor's shape.",
    status: "Primary",
    tone: "tone-mint",
  },
  {
    name: "Codex",
    note: "Rich interface metadata, screenshots, prompts, and plugin packaging from one source.",
    status: "Primary",
    tone: "tone-amber",
  },
  {
    name: "OpenCode",
    note: "Code-first plugin wrapper generation without hand-maintaining another project.",
    status: "Primary",
    tone: "tone-rose",
  },
] as const;

const betaPlatforms = [
  "GitHub Copilot",
  "OpenHands",
  "Warp",
  "Gemini CLI",
  "Roo Code",
  "Cline",
  "AMP",
] as const;

const frictionPoints = [
  {
    title: "Different manifests",
    body: "Each host wants a different manifest shape, file layout, and packaging contract.",
  },
  {
    title: "Auth drift",
    body: "The same MCP auth model becomes headers in one host and environment-mapped transport settings in another.",
  },
  {
    title: "Hooks diverge",
    body: "Event names, schema shape, and install locations all change by platform.",
  },
  {
    title: "Instructions fragment",
    body: "Rules, guides, brand metadata, and agent-facing docs split across several incompatible surfaces.",
  },
] as const;

const bundleOutputs = [
  {
    title: "Source project",
    body: "One config, shared instructions, workflow skills, and project-owned customization.",
  },
  {
    title: "Platform bundles",
    body: "Generate installable outputs for Claude Code, Cursor, Codex, OpenCode, and the beta surface.",
  },
  {
    title: "Agent refinement",
    body: "Prepare prompt packs so Codex or Claude improve the right sections without breaking the deterministic substrate.",
  },
  {
    title: "Ongoing sync",
    body: "Catch up to MCP changes later without forking your plugin logic across seven repos.",
  },
] as const;

const workflowSteps = [
  {
    command: "init",
    title: "Import the MCP",
    body: "Start from raw HTTP, SSE, or stdio. Pluxx introspects the server and drafts the first source project.",
  },
  {
    command: "doctor",
    title: "Verify the baseline",
    body: "Check the environment, build constraints, and generated structure before you refine anything.",
  },
  {
    command: "agent",
    title: "Refine safely",
    body: "Generate context and prompt packs so coding agents improve taxonomy, instructions, and product shape inside managed boundaries.",
  },
  {
    command: "build",
    title: "Ship native bundles",
    body: "Emit host-specific plugin outputs and install them locally for real validation.",
  },
  {
    command: "sync",
    title: "Stay current",
    body: "Refresh MCP-derived files later while preserving the human edits that make the plugin feel product-shaped.",
  },
] as const;

const heroTerminal = String.raw`$ bunx pluxx init --from-mcp https://mcp.playkit.sh/mcp --yes

Introspecting MCP...
Discovered 24 tools and drafted 8 workflow skills

  pluxx.config.ts      source-of-truth plugin config
  INSTRUCTIONS.md      generated instructions + custom notes
  skills/              workflow packs with concrete examples
  dist/claude-code/    native Claude bundle
  dist/cursor/         native Cursor bundle
  dist/codex/          native Codex bundle
  dist/opencode/       native OpenCode wrapper

Ready for doctor, test, and agent refinement.`;

const configSnippet = String.raw`import { definePlugin } from "pluxx";

export default definePlugin({
  name: "acme-plugin",
  description: "Official plugin for Acme's MCP",
  targets: ["claude-code", "cursor", "codex", "opencode"],
  mcp: {
    acme: {
      url: "https://api.acme.com/mcp",
      auth: {
        type: "header",
        envVar: "ACME_API_KEY",
        headerName: "X-API-Key",
        headerTemplate: "\${value}",
      },
    },
  },
});`;

const matrixRows = [
  ["Manifest", ".claude-plugin/plugin.json", ".cursor-plugin/plugin.json", ".codex-plugin/plugin.json", "package.json + wrapper"],
  ["MCP auth", "headers", "headers", "bearer_token_env_var / env_http_headers", "env validation"],
  ["Hooks", "hooks/hooks.json", "hooks/hooks.json", ".codex/hooks.json", "JS event handlers"],
  ["Rules", "CLAUDE.md", "rules/*.mdc + AGENTS.md", "AGENTS.md", "config-driven"],
  ["Brand", "Basic", "Basic", "Rich interface metadata", "Minimal"],
] as const;

export default function Home() {
  return (
    <main className="page-shell">
      <nav className="site-nav">
        <div className="shell nav-row">
          <a className="brand" href="#top">
            pluxx
          </a>
          <div className="nav-links">
            <a href="#platforms">Platforms</a>
            <a href="#how-it-works">How it works</a>
            <a href="#source-project">Source project</a>
            <a href="https://github.com/orchidautomation/pluxx" rel="noreferrer" target="_blank">
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <section className="hero section" id="top">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="shell hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">MCP-native plugin authoring for coding agents</span>
            <h1 className="hero-title">Build AI agent plugins once. Ship them everywhere.</h1>
            <p className="lede">
              One config generates native plugin packages for Claude Code, Cursor, Codex, OpenCode, and
              the beta surface beyond that. Stop maintaining several drifting copies of the same plugin.
            </p>
            <p className="sublede">
              Import the raw MCP, verify the deterministic scaffold, then let Codex or Claude refine the
              product shape without breaking the structure underneath it.
            </p>
            <div className="cta-row">
              <a
                className="button button-primary"
                href="https://github.com/orchidautomation/pluxx"
                rel="noreferrer"
                target="_blank"
              >
                View repository
              </a>
              <a
                className="button button-secondary"
                href="https://github.com/orchidautomation/pluxx/blob/main/docs/practical-handbook.md"
                rel="noreferrer"
                target="_blank"
              >
                Read handbook
              </a>
            </div>
            <div className="command-chip">
              <span className="command-label">Quick start</span>
              <code>bunx pluxx init --from-mcp https://example.com/mcp</code>
            </div>
            <div className="hero-stats">
              <div className="stat-card">
                <strong>4</strong>
                <span>primary platforms</span>
              </div>
              <div className="stat-card">
                <strong>7</strong>
                <span>beta targets already generated</span>
              </div>
              <div className="stat-card">
                <strong>1</strong>
                <span>source project to maintain</span>
              </div>
            </div>
          </div>

          <div className="hero-panel">
            <div className="terminal-card">
              <div className="terminal-bar">
                <span className="terminal-dot terminal-dot-red" />
                <span className="terminal-dot terminal-dot-yellow" />
                <span className="terminal-dot terminal-dot-green" />
                <span className="terminal-label">pluxx</span>
              </div>
              <pre className="terminal-copy">
                <code>{heroTerminal}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="platforms">
        <div className="shell">
          <div className="section-head">
            <span className="section-kicker">Coverage</span>
            <h2 className="section-title">Primary support for the surfaces that matter right now.</h2>
            <p className="section-body">
              The core-four path is the prime-time surface today. The beta surface is already generated
              from the same source project so you can expand when the validation bar catches up.
            </p>
          </div>

          <div className="platform-grid">
            {primaryPlatforms.map((platform) => (
              <article className={`platform-card ${platform.tone}`} key={platform.name}>
                <div className="platform-top">
                  <h3>{platform.name}</h3>
                  <span className="status-pill">{platform.status}</span>
                </div>
                <p>{platform.note}</p>
              </article>
            ))}
          </div>

          <div className="beta-strip">
            <span className="beta-label">Beta targets</span>
            <div className="beta-list">
              {betaPlatforms.map((platform) => (
                <span className="beta-pill" key={platform}>
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="problem-space">
        <div className="shell problem-layout">
          <div>
            <div className="section-head compact">
              <span className="section-kicker">The problem</span>
              <h2 className="section-title">Your MCP may already be useful. Packaging it everywhere is the drag.</h2>
              <p className="section-body">
                Each coding agent has its own plugin contract, auth translation, hook model, rules
                surface, and brand metadata. Without a source-of-truth layer, one useful MCP turns into
                several plugin repos that drift apart as soon as you start shipping.
              </p>
            </div>

            <div className="problem-grid">
              {frictionPoints.map((point) => (
                <article className="problem-card" key={point.title}>
                  <h3>{point.title}</h3>
                  <p>{point.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="matrix-card">
            <div className="matrix-head">
              <span className="section-kicker">What actually changes</span>
              <h3>Cross-host differences do not stay cosmetic.</h3>
            </div>
            <div className="matrix-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Surface</th>
                    <th>Claude Code</th>
                    <th>Cursor</th>
                    <th>Codex</th>
                    <th>OpenCode</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                      <td>{row[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="source-project">
        <div className="shell source-grid">
          <div>
            <div className="section-head compact">
              <span className="section-kicker">The answer</span>
              <h2 className="section-title">Keep one source project. Generate the native outputs.</h2>
              <p className="section-body">
                Pluxx models the common authoring primitives once, then emits the exact shapes each host
                expects. The generated source remains editable, testable, and safe to refine over time.
              </p>
            </div>

            <div className="code-card">
              <div className="code-card-head">
                <span>pluxx.config.ts</span>
                <span className="code-card-badge">single source of truth</span>
              </div>
              <pre>
                <code>{configSnippet}</code>
              </pre>
            </div>
          </div>

          <div className="bundle-grid">
            {bundleOutputs.map((bundle) => (
              <article className="bundle-card" key={bundle.title}>
                <h3>{bundle.title}</h3>
                <p>{bundle.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="shell">
          <div className="section-head">
            <span className="section-kicker">Workflow</span>
            <h2 className="section-title">Deterministic first. Semantic refinement second.</h2>
            <p className="section-body">
              Pluxx is not trying to be its own orchestration runtime. It owns the scaffold, validation,
              build, install, and sync path, then hands the right context to the coding agent when real
              judgment is useful.
            </p>
          </div>

          <div className="workflow-grid">
            {workflowSteps.map((step) => (
              <article className="workflow-card" key={step.command}>
                <span className="workflow-command">{step.command}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell cta-panel">
          <div>
            <span className="section-kicker">Open source core</span>
            <h2 className="section-title">Bring your MCP in. Keep the workflow sharp.</h2>
            <p className="section-body">
              The CLI stays open source and Bun-first. The current repo already contains the docs and
              product material; this app gives Pluxx a real marketing shell without replacing that content
              system yet.
            </p>
          </div>

          <div className="cta-actions">
            <a
              className="button button-primary"
              href="https://github.com/orchidautomation/pluxx"
              rel="noreferrer"
              target="_blank"
            >
              Star on GitHub
            </a>
            <a
              className="button button-secondary"
              href="https://github.com/orchidautomation/pluxx/blob/main/README.md"
              rel="noreferrer"
              target="_blank"
            >
              Browse docs source
            </a>
            <code className="footer-command">bunx pluxx init --from-mcp https://example.com/mcp</code>
          </div>
        </div>
      </section>
    </main>
  );
}
