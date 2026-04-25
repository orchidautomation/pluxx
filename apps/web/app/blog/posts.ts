export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  deck: string;
  publishedAt: string;
  isoDate: string;
  readTime: string;
  category: string;
  proof: string[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "exa-across-the-core-four",
    title: "How Exa can ship natively across Claude Code, Cursor, Codex, and OpenCode",
    summary:
      "A clean-room Exa example that shows how one maintained source project can ship native, Exa-backed workflows across Claude Code, Cursor, Codex, and OpenCode.",
    deck:
      "We took Exa's public MCP and the workflow shape of Exa's Claude-first plugin, then rebuilt it as one maintained source project that installs natively across the major coding agents without forking the workflow layer four different ways.",
    publishedAt: "April 25, 2026",
    isoDate: "2026-04-25",
    readTime: "7 min read",
    category: "Launch",
    proof: [
      "Claude Code",
      "Cursor",
      "Codex Desktop",
      "OpenCode",
    ],
  },
];

export const featuredBlogPost = blogPosts[0];
