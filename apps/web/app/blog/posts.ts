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
    title:
      "How we rebuilt Exa's Claude-first plugin shape across Claude Code, Cursor, Codex, and OpenCode",
    summary:
      "A clean-room Exa example that proves one maintained Pluxx source project can ship native, Exa-backed workflows across the core four.",
    deck:
      "We took Exa's public MCP plus the workflow shape of Exa's official Claude plugin and rebuilt it as one maintained Pluxx source project with agents, commands, auth, screenshots, and native bundles for the core four.",
    publishedAt: "April 25, 2026",
    isoDate: "2026-04-25",
    readTime: "7 min read",
    category: "Launch",
    proof: [
      "Claude Code app PASS",
      "Cursor interactive flow PASS",
      "Codex Desktop app PASS",
      "OpenCode CLI PASS",
    ],
  },
];

export const featuredBlogPost = blogPosts[0];
