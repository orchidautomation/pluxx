import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";

import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pluxx.dev"),
  title: "Pluxx | Turn a Raw MCP Into a Native Plugin.",
  description:
    "Turn a raw MCP into a workflow-driven plugin for Claude Code, Cursor, Codex, and OpenCode. Use autopilot when you want the one-shot path.",
  openGraph: {
    title: "Pluxx | Turn a Raw MCP Into a Native Plugin.",
    description:
      "Turn a raw MCP into a workflow-driven plugin for Claude Code, Cursor, Codex, and OpenCode. Use autopilot when you want the one-shot path.",
    url: "https://pluxx.dev",
    siteName: "Pluxx",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pluxx | Turn a Raw MCP Into a Native Plugin.",
    description:
      "Turn a raw MCP into a workflow-driven plugin across the core four.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
