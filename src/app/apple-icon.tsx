import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const MARK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset="0.5" stop-color="#ff2e2e"/><stop offset="1" stop-color="#7e0e14"/></linearGradient></defs><polygon fill="url(#g)" points="0,0 48,0 64,16 64,64 16,64 0,48"/></svg>`,
  );

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060607",
        }}
      >
        <img src={MARK} width={128} height={128} alt="" />
      </div>
    ),
    { ...size },
  );
}
