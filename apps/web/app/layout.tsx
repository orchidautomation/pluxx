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
  title: "Pluxx | One Source Project. Four Native Plugins.",
  description:
    "Maintain one plugin source project and ship native plugins to Claude Code, Cursor, Codex, and OpenCode instead of four separate plugin repos.",
  openGraph: {
    title: "Pluxx | One Source Project. Four Native Plugins.",
    description:
      "Maintain one plugin source project and ship native plugins to Claude Code, Cursor, Codex, and OpenCode instead of four separate plugin repos.",
    url: "https://pluxx.dev",
    siteName: "Pluxx",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pluxx | One Source Project. Four Native Plugins.",
    description:
      "Maintain one plugin source. Ship native plugins to Claude Code, Cursor, Codex, and OpenCode.",
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
