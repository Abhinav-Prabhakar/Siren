import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SIREN — Autonomous Fire Dispatch";

const MARK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset="0.5" stop-color="#ff2e2e"/><stop offset="1" stop-color="#7e0e14"/></linearGradient></defs><polygon fill="url(#g)" points="0,0 48,0 64,16 64,64 16,64 0,48"/></svg>`,
  );

const BACKDROP =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#ffffff" stroke-opacity="0.05"/></pattern><pattern id="hz" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="8" height="24" fill="#ff2e2e" fill-opacity="0.55"/></pattern></defs><rect width="1200" height="630" fill="#060607"/><rect width="1200" height="630" fill="url(#grid)"/><rect width="1200" height="10" fill="url(#hz)"/><rect y="620" width="1200" height="10" fill="url(#hz)"/></svg>`,
  );

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          backgroundImage: `url(${BACKDROP})`,
          backgroundSize: "1200px 630px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            letterSpacing: 8,
            color: "#8b8b95",
            textTransform: "uppercase",
          }}
        >
          <span>CTRL-ROOM // LIVE</span>
          <span style={{ color: "#ff2e2e" }}>● REC</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <img src={MARK} width={168} height={168} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 148,
                fontWeight: 800,
                letterSpacing: 24,
                lineHeight: 1,
                color: "#ece9e2",
                textTransform: "uppercase",
              }}
            >
              Siren
            </span>
            <span
              style={{
                marginTop: 18,
                fontSize: 26,
                letterSpacing: 10,
                color: "#ff6a3d",
                textTransform: "uppercase",
              }}
            >
              Autonomous Fire Dispatch
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            letterSpacing: 8,
            color: "#8b8b95",
            textTransform: "uppercase",
          }}
        >
          <span>Vehicles · Crews · Equipment</span>
          <span>Dispatch by AI</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
