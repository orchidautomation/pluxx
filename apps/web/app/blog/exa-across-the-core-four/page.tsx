import type { Metadata } from "next";
import Link from "next/link";

import { featuredBlogPost } from "../posts";

export const metadata: Metadata = {
  title: "How we rebuilt Exa for the core four | Pluxx",
  description:
    "A clean-room Exa example that proves one maintained Pluxx source project can ship native, Exa-backed workflows across Claude Code, Cursor, Codex, and OpenCode.",
};

const tryItCommand =
  "npx @orchid-labs/pluxx init --from-mcp https://mcp.exa.ai/mcp --yes";

const heroStats = [
  "1 maintained source project",
  "4 native destinations",
  "6 Exa research workflows",
  "1 bundled Exa MCP",
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
              <p>
                Raw MCP access is table stakes. The harder problem is turning that MCP into
                something that actually feels native inside the coding agents people use every day.
              </p>

              <div className="blog-callout">
                <span className="section-kicker">The gap</span>
                <p>
                  Most demos stop once the server responds. Pluxx is about what comes next:
                  shaping that MCP into installable, native-feeling workflows without forking the
                  project four different ways.
                </p>
              </div>

              <p>
                To prove that, we built a clean-room Exa example from three inputs: Exa&apos;s
                public MCP, Exa&apos;s public docs, and the workflow shape of Exa&apos;s official
                Claude plugin.
              </p>

              <h2>What shipped</h2>

              <p>
                The result is one maintained source project that now generates native bundles for
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
                It also keeps the pieces that usually get flattened away when the story gets reduced
                to “skills everywhere”:
              </p>

              <ul>
                <li>specialist agents and subagents</li>
                <li>auth and setup guidance</li>
                <li>branding metadata, screenshots, and prompts</li>
                <li>a bundled Exa MCP connection rather than generic web-search fallback</li>
              </ul>

              <h2>Why Exa is the right example</h2>

              <p>
                Exa makes the point clearly because it already has a strong workflow shape. If
                Pluxx can take that shape, keep the research depth, and carry it across the core
                four without collapsing it into one thin search skill, then the product promise is
                real.
              </p>

              <p>
                The value is not “we can connect to an MCP.” The value is “we can shape that MCP
                into the most native honest plugin experience each host can actually support,” while
                still keeping one maintained source project at the center.
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

              <h2>What this says about Pluxx</h2>

              <p>
                Pluxx is not a skill-pack copier and it is not an MCP wrapper service. It is the
                layer that keeps one maintained plugin source project while compiling the best
                truthful native version of that experience for each host.
              </p>

              <h2>Try it yourself</h2>

              <p>
                If you want to start from Exa&apos;s public MCP and generate your own maintained
                source project, the fastest entry path is:
              </p>

              <pre className="blog-code">
                <code>{tryItCommand}</code>
              </pre>

              <p>
                From there, Pluxx can generate the native bundles, install them locally, and verify
                the installed state instead of trusting `dist/` alone.
              </p>

              <p>
                If you want the full proof trail, start with the repo proof note and the Exa source
                project.
              </p>
            </div>
          </div>

          <aside className="blog-post-aside">
            <div className="blog-aside-card">
              <span className="section-kicker">Proof</span>
              <h3>Live across the core four</h3>
              <p className="blog-aside-copy">
                These are real workflow runs, not just generated files or static screenshots.
              </p>
              <ul className="proof-list">
                {featuredBlogPost.proof.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="blog-aside-card">
              <span className="section-kicker">Bundle</span>
              <h3>What ships in the example</h3>
              <ul className="proof-list">
                {shippedInBundle.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="blog-aside-card">
              <span className="section-kicker">Source</span>
              <h3>Explore the example</h3>
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
                <a href="https://docs.pluxx.dev/examples/exa-research-example" rel="noreferrer" target="_blank">
                  Open the docs example
                </a>
              </div>
            </div>
          </aside>
        </div>
      </article>
    </main>
  );
}
