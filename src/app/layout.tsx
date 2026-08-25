import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-app",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#06090e" },
  ],
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("sentinel-theme")?.value;
  const initialTheme = themeCookie === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      className={themeCookie ? initialTheme : undefined}
      data-theme={themeCookie ? initialTheme : undefined}
      style={themeCookie ? { colorScheme: initialTheme } : undefined}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `!function(){try{var d=document.documentElement,t=localStorage.getItem("sentinel-theme")||localStorage.getItem("theme");if(!t||t==="system"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}d.className=t;d.setAttribute("data-theme",t);d.style.colorScheme=t;}catch(e){}}();`,
          }}
        />
      </head>
      <body className={spaceGrotesk.variable}>
        <ThemeProvider initialTheme={themeCookie as "dark" | "light" | undefined}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
