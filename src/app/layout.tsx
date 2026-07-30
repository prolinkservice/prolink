import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LiffAutoLogin } from "@/components/LiffAutoLogin";
import { THEME_COOKIE, type Theme } from "@/components/ThemeToggle";
// 字體宣告要排在 globals 之前，確保 @font-face 先於使用它的規則
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProLink · 職人預約系統",
  description: "為各式職人打造的預約與客戶管理系統",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 亮度偏好在伺服器端就寫進 html，重新整理才不會先閃一下白的
  const theme = (await cookies()).get(THEME_COOKIE)?.value
  const resolved: Theme =
    theme === 'light' || theme === 'dark' ? theme : 'auto'

  return (
    <html lang="zh-Hant" data-theme={resolved} className="h-full antialiased">
      <body className="min-h-full antialiased">
        <LiffAutoLogin />
        {children}
      </body>
    </html>
  );
}
