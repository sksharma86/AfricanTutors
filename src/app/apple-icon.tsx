import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — simplified house mark, not the wordmark. */
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
          background: "#0c0c0b",
        }}
      >
        <div
          style={{
            width: 118,
            height: 108,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "59px solid transparent",
              borderRight: "59px solid transparent",
              borderBottom: "42px solid #f7f7f5",
            }}
          />
          <div
            style={{
              width: 108,
              height: 66,
              borderLeft: "8px solid #f7f7f5",
              borderRight: "8px solid #f7f7f5",
              borderBottom: "8px solid #f7f7f5",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 8,
            }}
          >
            <div style={{ width: 14, height: 14, background: "#c98816", borderRadius: 14 }} />
            <div
              style={{
                marginTop: 16,
                width: 52,
                height: 6,
                background: "#f7f7f5",
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
