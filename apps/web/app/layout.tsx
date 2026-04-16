import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pluxx.dev"),
  title: "Pluxx | One MCP In. Native Plugins Out.",
  description:
    "Pluxx turns a raw MCP into a maintainable source project that can generate native plugin bundles for Codex, Cursor, Claude Code, OpenCode, and more.",
  openGraph: {
    title: "Pluxx | One MCP In. Native Plugins Out.",
    description:
      "Import a raw MCP, refine safely with coding agents, and ship native plugin bundles everywhere without maintaining seven drifting plugin repos.",
    url: "https://pluxx.dev",
    siteName: "Pluxx",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pluxx | One MCP In. Native Plugins Out.",
    description:
      "Build AI agent plugins once. Ship native bundles everywhere from one source project.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
