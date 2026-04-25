import type { Metadata } from "next";
import Link from "next/link";

import { blogPosts } from "./posts";

export const metadata: Metadata = {
  title: "Pluxx Blog | Proof, Launch Notes, and Core-Four Plugin Work",
  description:
    "Launch posts, proof notes, and public build logs from Pluxx as we turn raw MCPs into native plugins across Claude Code, Cursor, Codex, and OpenCode.",
};

export default function BlogIndexPage() {
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

      <section className="section blog-hero">
        <div className="shell blog-hero-stack">
          <div className="section-head compact">
            <span className="section-kicker">Journal</span>
            <h1 className="section-title">
              Proof in public. <em>Launch notes in the open.</em>
            </h1>
            <p className="section-body">
              This is where we document the real proof surfaces, example plugins, and release
              stories behind Pluxx.
            </p>
          </div>
        </div>
      </section>

      <section className="section section-divider">
        <div className="shell">
          <div className="blog-grid">
            {blogPosts.map((post) => (
              <article className="blog-card blog-card-featured" key={post.slug}>
                <div className="blog-card-top">
                  <span className="status-pill">{post.category}</span>
                  <div className="blog-meta">
                    <time dateTime={post.isoDate}>{post.publishedAt}</time>
                    <span>·</span>
                    <span>{post.readTime}</span>
                  </div>
                </div>
                <h2>{post.title}</h2>
                <p>{post.deck}</p>
                <ul className="proof-list">
                  {post.proof.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="blog-card-actions">
                  <Link className="button button-primary" href={`/blog/${post.slug}`}>
                    <span>Read post</span>
                    <span aria-hidden className="button-arrow">
                      →
                    </span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
