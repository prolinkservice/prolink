import type { Metadata } from "next";
import { LiffAutoLogin } from "@/components/LiffAutoLogin";
// 字體宣告要排在 globals 之前，確保 @font-face 先於使用它的規則
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProLink · 職人預約系統",
  description: "為各式職人打造的預約與客戶管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full antialiased">
        <LiffAutoLogin />
        {children}
      </body>
    </html>
  );
}
