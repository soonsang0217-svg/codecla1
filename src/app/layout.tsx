import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인터뷰 기사 초안 생성기",
  description: "인터뷰 녹취록으로 기사 초안을 만드는 팀 내부 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
