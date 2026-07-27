import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelOps — Control Every AI Agent Action",
  description:
    "One enforcement layer to discover AI agents, approve high-risk actions, and preserve audit evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
