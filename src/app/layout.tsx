import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Landscaping CMS",
  description: "Landscaping content management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
