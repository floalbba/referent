import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referent",
  description: "Минимальное приложение Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen overflow-x-hidden">{children}</body>
    </html>
  );
}
