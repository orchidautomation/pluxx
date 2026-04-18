import { ImageResponse } from "next/og";

export const alt = "Pluxx | Stop maintaining four plugin repos for one MCP.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background:
            "radial-gradient(circle at 78% 8%, rgba(157, 109, 255, 0.26), rgba(157, 109, 255, 0) 38%), #08050f",
          color: "#ece5f8",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "52px 64px 56px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 18,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#130d20",
              borderRadius: 18,
              display: "flex",
              height: 76,
              justifyContent: "center",
              position: "relative",
              width: 76,
            }}
          >
            <div
              style={{
                border: "5px solid #9d6dff",
                borderRadius: "999px",
                display: "flex",
                height: 44,
                overflow: "hidden",
                width: 44,
              }}
            >
              <div style={{ flex: 1 }} />
              <div style={{ background: "#9d6dff", flex: 1 }} />
            </div>
          </div>
          <div
            style={{
              color: "#ece5f8",
              display: "flex",
              fontFamily: "Georgia, serif",
              fontSize: 54,
              fontStyle: "italic",
              letterSpacing: -2,
            }}
          >
            pluxx
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 980 }}>
          <div
            style={{
              color: "#b4abcd",
              display: "flex",
              fontFamily: "ui-monospace, monospace",
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            One MCP. Four native plugin surfaces.
          </div>
          <div
            style={{
              color: "#ece5f8",
              display: "flex",
              flexDirection: "column",
              fontFamily: "Georgia, serif",
              fontSize: 84,
              letterSpacing: -3,
              lineHeight: 1.02,
            }}
          >
            <span>Stop maintaining four</span>
            <span>plugin repos for one MCP.</span>
          </div>
          <div
            style={{
              color: "#cfc5e1",
              display: "flex",
              flexDirection: "column",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              fontSize: 30,
              gap: 8,
              lineHeight: 1.35,
            }}
          >
            <span>
              Pluxx keeps one source project for Claude Code, Cursor, Codex, and OpenCode,
            </span>
            <span>then compiles the native bundle each host expects.</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["claude-code", "cursor", "codex", "opencode"].map((item) => (
            <div
              key={item}
              style={{
                background: "#171126",
                border: "1px solid rgba(157, 109, 255, 0.24)",
                borderRadius: 999,
                color: "#ece5f8",
                display: "flex",
                fontFamily: "ui-monospace, monospace",
                fontSize: 22,
                padding: "10px 18px",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
