import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://blue-reach.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Blue Reach — Campaign Dashboard for Outbound Agencies",
    template: "%s | Blue Reach",
  },
  description:
    "Stop sending spreadsheet reports. Blue Reach gives your outbound agency clients a branded, real-time portal to track campaigns, leads, and results — synced live from Instantly & Smartlead.",
  keywords: [
    "client reporting dashboard",
    "outbound agency software",
    "instantly dashboard",
    "smartlead dashboard",
    "white-label client portal",
    "agency reporting tool",
    "cold email reporting",
    "campaign analytics dashboard",
    "lead generation agency software",
    "client portal for agencies",
    "email outreach reporting",
    "agency client management",
  ],
  authors: [{ name: "Blue Reach" }],
  creator: "Blue Reach",
  publisher: "Blue Reach",
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
    url: siteUrl,
    siteName: "Blue Reach",
    title: "Blue Reach — Campaign Dashboard for Outbound Agencies",
    description:
      "Give your agency clients a branded, real-time dashboard to track campaigns, leads, and results. Synced from Instantly & Smartlead. White-label ready.",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Blue Reach — Real-time client dashboard for outbound agencies",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blue Reach — Campaign Dashboard for Outbound Agencies",
    description:
      "Give your agency clients a branded, real-time dashboard to track campaigns, leads, and results. Synced from Instantly & Smartlead.",
    images: [`${siteUrl}/og-image.png`],
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "SaaS",
};

// Runtime environment config - injected at server render time
// This makes env vars available to client-side code even when
// NEXT_PUBLIC_* vars aren't available at build time (Railway issue)
const runtimeConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Inject runtime config for client-side access */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
