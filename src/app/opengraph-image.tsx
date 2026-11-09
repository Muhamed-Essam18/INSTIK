import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { tagline } from "@/lib/site";

export const alt = `Instik: ${tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand colours from docs/design-tokens.json (the image renderer cannot read the Tailwind theme).
const ink = "#1b2340";
const cream = "#fff4e6";
const coral = "#ff6a4d";
const sun = "#ffc83d";
const teal = "#19a38f";

export default async function Image() {
  const nunito = await readFile(join(process.cwd(), "src/assets/fonts/Nunito-ExtraBold.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: cream,
          color: ink,
          padding: 80,
          fontFamily: "Nunito",
        }}
      >
        <div style={{ fontSize: 96, display: "flex" }}>instik</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ fontSize: 84, lineHeight: 1.05, display: "flex", maxWidth: 900 }}>{tagline}</div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: 120, height: 20, borderRadius: 10, background: coral, display: "flex" }} />
            <div style={{ width: 120, height: 20, borderRadius: 10, background: sun, display: "flex" }} />
            <div style={{ width: 120, height: 20, borderRadius: 10, background: teal, display: "flex" }} />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Nunito", data: nunito, style: "normal", weight: 800 }] },
  );
}
