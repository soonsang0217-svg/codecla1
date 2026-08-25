import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인터뷰 기사 초안 생성기",
  description: "인터뷰 녹취록으로 기사 초안을 만드는 팀 내부 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col antialiased">
        <div className="flex-1">{children}</div>
        <footer className="py-4 text-center text-xs text-neutral-400">
          제작자: 오리너구리, &lt;대신만나드립니다 인터뷰 초안 생성기&gt;
        </footer>
      </body>
    </html>
  );
}
