import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Economics Calculator",
  description: "Calculate AI product economics: from token costs to P&L",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
