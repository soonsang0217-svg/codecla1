import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "아침 브리핑",
    short_name: "아침 브리핑",
    description: "일정, 할 일, 주식, 뉴스, 이동 경로를 한 화면에서 확인하는 아침 브리핑",
    start_url: "/briefing",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
