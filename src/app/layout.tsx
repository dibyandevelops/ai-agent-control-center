import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-app",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#070a0e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://sentinelops.dev"),
  title: {
    default: "SentinelOps — Zero-Trust AI Agent Control Plane & Governance Gateway",
    template: "%s | SentinelOps",
  },
  description:
    "Enterprise control plane for autonomous AI agents. Real-time sub-20ms policy enforcement, multi-party quorum human-in-the-loop approvals, PII prevention, and tamper-evident cryptographic audit logs.",
  keywords: [
    "AI agent security",
    "agentic control plane",
    "AI governance",
    "zero-trust AI gateway",
    "AI human in the loop",
    "autonomous agent guardrails",
    "audit log chain",
    "LLM security proxy",
    "enterprise AI safety",
  ],
  authors: [{ name: "SentinelOps Engineering" }],
  creator: "SentinelOps",
  publisher: "SentinelOps Inc.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sentinelops.dev",
    siteName: "SentinelOps",
    title: "SentinelOps — Control Every AI Agent Action",
    description:
      "Enterprise control plane to discover AI agents, evaluate policy in sub-20ms before execution, route consequential actions for approval, and seal immutable audit evidence.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SentinelOps — Zero-Trust AI Agent Control Plane",
    description:
      "Enforce real-time security policies and human approval quorums before autonomous agents take consequential actions.",
    creator: "@sentinelops",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("sentinel-theme")||"dark";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=d?"dark":"light";document.documentElement.className=r;document.documentElement.setAttribute("data-theme",r);document.documentElement.style.colorScheme=r;}catch(e){}})();`,
          }}
        />
      </head>
      <body className={spaceGrotesk.variable}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
