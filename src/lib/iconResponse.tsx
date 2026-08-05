import { ImageResponse } from "next/og";

export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: size * 0.2,
        }}
      >
        <div
          style={{
            fontSize: size * 0.55,
            display: "flex",
          }}
        >
          ☀️
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
