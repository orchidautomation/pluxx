import type { Metadata } from "next";
import Link from "next/link";

import { featuredBlogPost } from "../posts";

export const metadata: Metadata = {
  title: "If you're at Exa, this is what Pluxx gives you | Pluxx",
  description:
    "A clean-room Exa example that proves one maintained source project can ship native, Exa-backed workflows across Claude Code, Cursor, Codex, and OpenCode.",
};

const installCommands = [
  {
    label: "Claude Code",
    command:
      "curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-claude-code.sh | bash",
  },
  {
    label: "Cursor",
    command:
      "curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-cursor.sh | bash",
  },
  {
    label: "Codex",
    command:
      "curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-codex.sh | bash",
  },
  {
    label: "OpenCode",
    command:
      "curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-opencode.sh | bash",
  },
];

const heroStats = [
  "1 source of truth",
  "4 native installs",
  "6 research workflows",
  "live in real hosts",
];

const liveProofNotes = [
  "Claude Code runs the Exa workflows in-app with the plugin-bundled MCP tools attached.",
  "Cursor picks up the same research playbooks and routes them through Exa-backed workflows instead of a generic web-search fallback.",
  "Codex Desktop can invoke the plugin directly and call Exa through the bundled plugin-scoped MCP connection.",
  "OpenCode keeps the research pack intact through its own native agent and command surfaces.",
];

const shippedInBundle = [
  "parallel research agents and subagents",
  "company, people, code, news, and source-review workflows",
  "auth wiring for EXA_API_KEY",
  "branding, prompts, and screenshots where the host supports them",
];

const exaAlreadyHas = [
  "a public MCP that already solves the data layer",
  "a strong Claude-first workflow shape with specialist research patterns",
  "real user demand in more than one agent host",
];

const pluxxAdds = [
  "one maintained source project for the workflow layer",
  "native commands, skills, subagents, and install surfaces per host",
  "shared auth, setup, and verification instead of four drifting plugin repos",
];

export default function ExaBlogPostPage() {
  return (
    <main className="page-shell">
      <nav className="site-nav">
        <div className="shell nav-row">
          <Link className="brand" href="/">
            <span aria-hidden className="brand-mark">
              ◐
            </span>
            <span className="brand-word">pluxx</span>
          </Link>
          <div className="nav-links">
            <Link href="/">Home</Link>
            <Link href="/blog">Blog</Link>
            <a href="https://docs.pluxx.dev" rel="noreferrer" target="_blank">
              Docs
            </a>
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

      <article className="section blog-post-shell">
        <div className="shell blog-post-grid">
          <div className="blog-post-main">
            <div className="blog-post-head">
              <span className="section-kicker">{featuredBlogPost.category}</span>
              <h1 className="section-title">{featuredBlogPost.title}</h1>
              <p className="section-body">{featuredBlogPost.deck}</p>
              <div className="blog-meta">
                <time dateTime={featuredBlogPost.isoDate}>{featuredBlogPost.publishedAt}</time>
                <span>·</span>
                <span>{featuredBlogPost.readTime}</span>
              </div>
              <div className="blog-proof-strip">
                {heroStats.map((item) => (
                  <span className="blog-proof-pill" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="blog-prose">
              <div className="blog-callout">
                <span className="section-kicker">If you are at Exa</span>
                <p>
                  You already have the hard parts: a public MCP and a strong Claude-first research
                  workflow. Pluxx is the layer that turns those into one maintained source project
                  that can ship native plugin installs for Claude Code, Cursor, Codex, and
                  OpenCode.
                </p>
              </div>

              <div className="blog-answer-grid">
                <div className="blog-answer-card">
                  <span className="section-kicker">Exa already has</span>
                  <ul className="proof-list">
                    {exaAlreadyHas.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="blog-answer-card">
                  <span className="section-kicker">Pluxx adds</span>
                  <ul className="proof-list">
                    {pluxxAdds.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="blog-support-grid">
                <div className="blog-support-card">
                  <span className="section-kicker">Install</span>
                  <h3>Try it in your host</h3>
                  <p>
                    Build the Exa example from source and install the native bundle into the host
                    your team already uses.
                  </p>
                  <div className="blog-link-list">
                    {installCommands.map((item) => (
                      <a
                        href={`https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-${item.label
                          .toLowerCase()
                          .replace(/\s+/g, "-")}.sh`}
                        key={item.label}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {item.label} installer
                      </a>
                    ))}
                  </div>
                </div>

                <div className="blog-support-card">
                  <span className="section-kicker">Proof</span>
                  <h3>Live in real hosts</h3>
                  <p>These are real workflow runs, not static screenshots or generated files.</p>
                  <ul className="proof-list">
                    {featuredBlogPost.proof.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="blog-support-card">
                  <span className="section-kicker">Bundle</span>
                  <h3>What ships in the example</h3>
                  <ul className="proof-list">
                    {shippedInBundle.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="blog-support-card">
                  <span className="section-kicker">Source</span>
                  <h3>Inspect the source of truth</h3>
                  <div className="blog-link-list">
                    <a
                      href="https://github.com/orchidautomation/pluxx/tree/main/example/exa-plugin"
                      rel="noreferrer"
                      target="_blank"
                    >
                      Browse the source project
                    </a>
                    <a
                      href="https://github.com/orchidautomation/pluxx/blob/main/docs/exa-research-example.md"
                      rel="noreferrer"
                      target="_blank"
                    >
                      Read the repo proof note
                    </a>
                    <a
                      href="https://docs.pluxx.dev/examples/exa-research-example"
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open the docs example
                    </a>
                  </div>
                </div>
              </div>

              <p>
                If you only expose the MCP, every host still needs someone to shape the user
                experience around it. Commands, subagents, setup guidance, install packaging, and
                host-specific behavior do not maintain themselves.
              </p>

              <p>
                To show what that looks like in practice, we built a clean-room Exa example from
                three inputs: Exa&apos;s public MCP, Exa&apos;s public docs, and the workflow shape
                of Exa&apos;s official Claude plugin.
              </p>

              <h2>What we built from Exa</h2>

              <p>
                The result is one maintained source project that generates native bundles for
                Claude Code, Cursor, Codex, and OpenCode from the same source tree.
              </p>

              <ul>
                <li>Deep research</li>
                <li>Company research</li>
                <li>People research</li>
                <li>Code research</li>
                <li>Source review</li>
                <li>News briefs</li>
              </ul>

              <p>
                It also keeps the pieces that usually get flattened away when the story gets
                reduced to a thin “here are the tools” surface:
              </p>

              <ul>
                <li>specialist agents and subagents</li>
                <li>auth and setup guidance</li>
                <li>branding metadata, screenshots, and prompts</li>
                <li>a bundled Exa MCP connection rather than generic web-search fallback</li>
              </ul>

              <h2>Why this matters for Exa</h2>

              <p>
                Exa already has a workflow that people want. The distribution problem is everything
                around it. If the same operator-grade research experience can reach Claude Code,
                Cursor, Codex, and OpenCode without becoming four separate plugin products, the
                maintenance story gets materially better.
              </p>

              <p>
                The value is not “we can connect to Exa.” The value is “we can keep one workflow
                layer, then compile the most native honest version of that experience for each
                host.”
              </p>

              <h2>What “live” means here</h2>

              <p>
                The Exa example is not just a build artifact. It has now been exercised through
                real host workflows:
              </p>

              <ul>
                {featuredBlogPost.proof.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <p>
                That matters because it means the bundled Exa MCP is not merely listed in plugin
                metadata. It is actually callable through the generated workflows.
              </p>

              <ul>
                {liveProofNotes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <h2>How much was automatic</h2>

              <p>
                A raw `init --from-mcp` or `autopilot` run already gets to a credible Exa-shaped
                starting point. `migrate` from a strong Claude-first plugin would likely get even
                closer.
              </p>

              <p>
                What still took explicit shaping in this final example was the workflow taxonomy,
                the specialist-agent graph, the orchestrator prompts, and the public install and
                proof surfaces. That is the next product leverage for Pluxx: make the first pass
                recover more of that structure automatically.
              </p>

              <h2>What this says about Pluxx</h2>

              <p>
                Pluxx is not just a skill-pack copier and it is not a generic MCP wrapper. It is
                the layer that keeps one maintained plugin source project while compiling the best
                truthful native version of that experience for each host.
              </p>

              <h2>Install it</h2>

              <p>
                These installers build the public Exa example from source and install the native
                bundle directly into the host you already use:
              </p>

              {installCommands.map((item) => (
                <div key={item.label}>
                  <p>
                    <strong>{item.label}</strong>
                  </p>
                  <pre className="blog-code">
                    <code>{item.command}</code>
                  </pre>
                </div>
              ))}

              <p>
                If you want higher Exa limits, set `EXA_API_KEY` in your shell before you run the
                installer.
              </p>

              <p>
                If you want the full proof trail, start with the repo proof note and the Exa source
                project.
              </p>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
