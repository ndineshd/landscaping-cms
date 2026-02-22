import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Landscaping CMS",
  description: "Landscaping content management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const languageFromHeader = headers().get("x-site-lang");
  const htmlLanguage = (languageFromHeader || "en").trim().toLowerCase() || "en";

  return (
    <html lang={htmlLanguage}>
      <body>{children}</body>
    </html>
  );
}
