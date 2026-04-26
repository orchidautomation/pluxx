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
    title: "We rebuilt Exa's research plugin once and shipped it to four hosts",
    summary:
      "Exa maintains a Claude Code plugin and a Cursor plugin and has no presence on Codex or OpenCode. We took their public MCP, rebuilt the workflow layer in one source project, and let Pluxx compile native installs for every host.",
    deck:
      "Today Exa ships a Claude Code plugin and a Cursor plugin. Two codebases, same MCP, half the agent landscape uncovered. We rebuilt the workflow layer once and let Pluxx compile native installs for Claude Code, Cursor, Codex, and OpenCode.",
    publishedAt: "April 25, 2026",
    isoDate: "2026-04-25",
    readTime: "8 min read",
    category: "Field Note",
    proof: [
      "Claude Code app",
      "Cursor CLI",
      "Codex Desktop",
      "OpenCode CLI",
    ],
  },
];

export const featuredBlogPost = blogPosts[0];
