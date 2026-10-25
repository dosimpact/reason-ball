import { ThemePicker } from "@/features/theme/ui/theme-picker";
import type { Metadata } from "next";
import "@/app/globals.css";
export const metadata: Metadata = {
  title: "오롯 — 둘의 시작을 위한 웨딩 아틀라스",
  description:
    "참가격 웨딩홀과 결혼준비대행 공시를 한곳에서. 지도에서 찾고, 같은 조건으로 비교하고, 우리다운 결혼을 준비하세요.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('orot:theme');if(['taupe','pearl','rosewood','mocha','midnight'].includes(t))document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
        {children}
        <ThemePicker />
      </body>
    </html>
  );
}
