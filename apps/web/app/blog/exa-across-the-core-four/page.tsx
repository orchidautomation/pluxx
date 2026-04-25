import type { Metadata } from "next";
import Link from "next/link";

import { featuredBlogPost } from "../posts";

export const metadata: Metadata = {
  title:
    "How we rebuilt Exa's Claude-first plugin shape across Claude Code, Cursor, Codex, and OpenCode | Pluxx",
  description:
    "A clean-room Exa example that proves one maintained Pluxx source project can ship native, Exa-backed workflows across Claude Code, Cursor, Codex, and OpenCode.",
};

const tryItCommand =
  "npx @orchid-labs/pluxx init --from-mcp https://mcp.exa.ai/mcp --yes";

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
            </div>

            <div className="blog-prose">
              <p>
                Most MCP demos stop too early. They prove a server can answer requests, but they do
                not show what it takes to turn that server into something that feels native inside
                the coding agents people actually use every day.
              </p>

              <p>That is the gap Pluxx is trying to close.</p>

              <p>
                To prove that, we built a clean-room Exa example from three inputs: Exa&apos;s
                public MCP, Exa&apos;s public docs, and the workflow shape of Exa&apos;s official
                Claude plugin.
              </p>

              <h2>What we built</h2>

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
                It also carries the pieces that usually get lost when people reduce the story to
                “skills everywhere”:
              </p>

              <ul>
                <li>specialist agents and subagents</li>
                <li>auth and setup guidance</li>
                <li>branding metadata, screenshots, and prompts</li>
                <li>a bundled Exa MCP connection rather than generic web-search fallback</li>
              </ul>

              <h2>Why Exa is the right example</h2>

              <p>
                Exa makes the point clearly because it has a strong Claude-first workflow shape. If
                Pluxx can carry that shape across the core four without flattening it into a single
                search skill, then the product promise is real.
              </p>

              <p>
                The value is not “we can connect to an MCP.” The value is “we can shape that MCP
                into the most native honest plugin experience each host can actually support.”
              </p>

              <h2>What is actually proven</h2>

              <p>The Exa example is now proven through real host workflows, not just build output:</p>

              <ul>
                {featuredBlogPost.proof.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <p>
                That means the bundled Exa MCP is not merely listed in plugin metadata. It is
                actually callable through the generated workflows.
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
                From there, Pluxx can generate the native bundles, install them locally, and prove
                the installed state with `verify-install`.
              </p>

              <h2>What this proves about Pluxx</h2>

              <p>
                Pluxx is not just a skill pack generator and not just an MCP wrapper. It is the
                layer that keeps one maintained plugin source project while compiling the best
                truthful native version of that experience for each host.
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
              <h3>Live now</h3>
              <ul className="proof-list">
                {featuredBlogPost.proof.map((item) => (
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
                  View `example/exa-plugin`
                </a>
                <a
                  href="https://github.com/orchidautomation/pluxx/blob/main/docs/exa-research-example.md"
                  rel="noreferrer"
                  target="_blank"
                >
                  Read the proof note
                </a>
                <a href="https://docs.pluxx.dev/examples/exa-research-example" rel="noreferrer" target="_blank">
                  See the docs example
                </a>
              </div>
            </div>
          </aside>
        </div>
      </article>
    </main>
  );
}
