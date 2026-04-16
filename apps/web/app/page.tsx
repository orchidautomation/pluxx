const primaryPlatforms = [
  { index: "01", name: "Claude Code", note: "Plugin, hooks, skills, MCP — generated." },
  { index: "02", name: "Cursor", note: "Rules, hooks, plugin manifest, MCP." },
  { index: "03", name: "Codex", note: "Rich brand metadata, prompts, packaging." },
  { index: "04", name: "OpenCode", note: "Code-first plugin wrapper, no extra repo." },
] as const;

const bundleOutputs = [
  { index: "01", title: "One config", body: "Shared instructions, skills, and customization in one place." },
  { index: "02", title: "Native bundles", body: "Installable outputs for every supported host." },
  { index: "03", title: "Agent-assisted edits", body: "Coding agents refine the right parts, never the substrate." },
  { index: "04", title: "Sync, don't fork", body: "Pull MCP updates without losing your edits." },
] as const;

const workflowSteps = [
  { index: "01", command: "init", title: "Import", body: "Point at any MCP. Pluxx drafts the source project." },
  { index: "02", command: "doctor", title: "Verify", body: "Check the environment and generated structure." },
  { index: "03", command: "agent", title: "Refine", body: "Hand context to a coding agent — safely." },
  { index: "04", command: "build", title: "Ship", body: "Emit native plugin bundles. Install locally." },
  { index: "05", command: "sync", title: "Sync", body: "Pull MCP updates. Keep your human edits." },
] as const;

const heroTerminal = String.raw`$ npx @orchid-labs/pluxx init --from-mcp https://mcp.playkit.sh/mcp --yes

Introspecting MCP...
Discovered 24 tools and drafted 8 workflow skills

  pluxx.config.ts      source-of-truth plugin config
  dist/claude-code/    native Claude bundle
  dist/cursor/         native Cursor bundle
  dist/codex/          native Codex bundle
  dist/opencode/       native OpenCode wrapper

Ready.`;

const configSnippet = String.raw`import { definePlugin } from "pluxx";

export default definePlugin({
  name: "acme-plugin",
  targets: ["claude-code", "cursor", "codex", "opencode"],
  mcp: {
    acme: {
      url: "https://api.acme.com/mcp",
      auth: { type: "header", envVar: "ACME_API_KEY" },
    },
  },
});`;

const matrixRows = [
  ["Manifest", ".claude-plugin/plugin.json", ".cursor-plugin/plugin.json", ".codex-plugin/plugin.json", "package.json + wrapper"],
  ["MCP auth", "headers", "headers", "bearer_token_env_var", "env validation"],
  ["Hooks", "hooks/hooks.json", "hooks/hooks.json", ".codex/hooks.json", "JS event handlers"],
  ["Rules", "CLAUDE.md", "rules/*.mdc", "AGENTS.md", "config-driven"],
  ["Brand", "Basic", "Basic", "Rich metadata", "Minimal"],
] as const;

export default function Home() {
  return (
    <main className="page-shell">
      <nav className="site-nav">
        <div className="shell nav-row">
          <a className="brand" href="#top">
            <span className="brand-mark" aria-hidden>◐</span>
            <span className="brand-word">pluxx</span>
          </a>
          <div className="nav-links">
            <a href="#platforms">Platforms</a>
            <a href="#problem-space">Drift</a>
            <a href="#source-project">Source</a>
            <a href="#how-it-works">Workflow</a>
            <a
              className="nav-cta"
              href="https://github.com/orchidautomation/pluxx"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <section className="hero section" id="top">
        <div className="hero-orb hero-orb-one" aria-hidden />
        <div className="shell hero-stack">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" aria-hidden />
              One MCP → every coding agent
            </span>
            <h1 className="hero-title">
              Author your plugin once.
              <br />
              Ship it <em>everywhere</em>.
            </h1>
            <p className="lede">
              Pluxx turns one MCP into native plugin bundles for Claude&nbsp;Code, Cursor, Codex,
              and OpenCode — from a single config.
            </p>

            <div className="cta-row">
              <a
                className="button button-primary"
                href="https://github.com/orchidautomation/pluxx"
                rel="noreferrer"
                target="_blank"
              >
                <span>View repository</span>
                <span aria-hidden className="button-arrow">→</span>
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
              <code>npx @orchid-labs/pluxx init</code>
            </div>
          </div>

          <div className="hero-terminal">
            <div className="terminal-card">
              <div className="terminal-bar">
                <span className="terminal-dot terminal-dot-red" />
                <span className="terminal-dot terminal-dot-yellow" />
                <span className="terminal-dot terminal-dot-green" />
                <span className="terminal-label">~/projects/acme · pluxx</span>
              </div>
              <pre className="terminal-copy">
                <code>{heroTerminal}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-divider" id="platforms">
        <div className="shell">
          <div className="section-head">
            <span className="section-kicker">Coverage</span>
            <h2 className="section-title">
              Four agents. <em>One source.</em>
            </h2>
          </div>

          <div className="platform-grid">
            {primaryPlatforms.map((platform) => (
              <article className="platform-card" key={platform.name}>
                <div className="platform-top">
                  <span className="platform-index">{platform.index}</span>
                  <span className="status-pill">Ready</span>
                </div>
                <h3>{platform.name}</h3>
                <p>{platform.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-divider" id="problem-space">
        <div className="shell">
          <div className="section-head">
            <span className="section-kicker">The drift</span>
            <h2 className="section-title">
              Same MCP. <em>Four different shapes.</em>
            </h2>
          </div>

          <div className="matrix-card">
            <div className="matrix-wrap">
              <table className="matrix-table">
                <colgroup>
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </colgroup>
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

      <section className="section section-divider" id="source-project">
        <div className="shell source-grid">
          <div className="source-col">
            <div className="section-head compact">
              <span className="section-kicker">The fix</span>
              <h2 className="section-title">
                One config. <em>Four bundles.</em>
              </h2>
            </div>

            <div className="code-card">
              <div className="code-card-head">
                <span className="code-card-file">
                  <span className="code-dot" /> pluxx.config.ts
                </span>
                <span className="code-card-badge">single source</span>
              </div>
              <pre>
                <code>{configSnippet}</code>
              </pre>
            </div>
          </div>

          <div className="bundle-grid">
            {bundleOutputs.map((bundle) => (
              <article className="bundle-card" key={bundle.title}>
                <span className="bundle-index">{bundle.index}</span>
                <h3>{bundle.title}</h3>
                <p>{bundle.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-divider" id="how-it-works">
        <div className="shell">
          <div className="section-head">
            <span className="section-kicker">Workflow</span>
            <h2 className="section-title">
              Five commands. <em>Start to ship.</em>
            </h2>
          </div>

          <ol className="workflow-grid">
            {workflowSteps.map((step) => (
              <li className="workflow-card" key={step.command}>
                <div className="workflow-top">
                  <span className="workflow-index">{step.index}</span>
                  <span className="workflow-command">pluxx {step.command}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section colophon">
        <div className="shell cta-panel">
          <div className="cta-copy">
            <h2 className="section-title">
              Bring your MCP. <em>Ship a real plugin.</em>
            </h2>
            <p className="lede">Open source. MIT-licensed. Yours to fork.</p>
          </div>

          <div className="cta-actions">
            <a
              className="button button-primary"
              href="https://github.com/orchidautomation/pluxx"
              rel="noreferrer"
              target="_blank"
            >
              <span>Star on GitHub</span>
              <span aria-hidden className="button-arrow">→</span>
            </a>
            <code className="footer-command">npx @orchid-labs/pluxx init</code>
          </div>
        </div>

        <div className="shell footer-row">
          <span>© 2026 Pluxx</span>
          <a
            href="https://github.com/orchidautomation/pluxx"
            rel="noreferrer"
            target="_blank"
          >
            github.com/orchidautomation/pluxx
          </a>
        </div>
      </section>
    </main>
  );
}
