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
    title: "How we rebuilt Exa for the core four",
    summary:
      "A clean-room Exa example that turns one maintained source project into native, Exa-backed workflows across Claude Code, Cursor, Codex, and OpenCode.",
    deck:
      "We took Exa's public MCP and the workflow shape of Exa's Claude-first plugin, then rebuilt it as one maintained Pluxx source project with agents, commands, auth, screenshots, and native bundles for the core four.",
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
