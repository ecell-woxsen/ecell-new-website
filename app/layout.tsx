import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";
import { getAssetUrl, R2_PUBLIC_BASE_URL } from "./lib/assets";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["300", "400", "500", "700"],
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-space-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://woxsen.edu.in"),
  title: "E-Cell Woxsen — Where Builders Start",
  description:
    "The Entrepreneurship Cell of Woxsen University. We build founders, not just businesses — through hands-on programs, mentorship, and a network that ships.",
  keywords: [
    "E-Cell",
    "Woxsen University",
    "Where Builders Start",
    "Entrepreneurship Cell",
    "Startups",
    "Hyderabad",
    "Innovation",
  ],
  icons: {
    // Small dedicated favicon (the old icon was the full 1.42MB logo PNG —
    // browsers downloaded the entire file just for a 28px tab icon).
    icon: "/favicon-64.png",
  },
  openGraph: {
    title: "E-Cell Woxsen — Where Builders Start",
    description:
      "The Entrepreneurship Cell of Woxsen University. We build founders, not just businesses — through hands-on programs, mentorship, and a network that ships.",
    url: "https://woxsen.edu.in/ecell",
    siteName: "E-Cell Woxsen University",
    images: [
      {
        url: getAssetUrl("/ecell-logo.png"),
        width: 800,
        height: 800,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${dmSans.variable} ${spaceMono.variable} dark antialiased`}
    >
      <body className="bg-[#040608] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 min-h-screen">
        {/* Warm the asset CDN connection + first scrollytelling frame before
            JS hydrates, so the boot corridor starts with a head start. The
            media gate avoids wasting the preload on <1024px (720p) devices. */}
        {R2_PUBLIC_BASE_URL ? (
          <link rel="preconnect" href={R2_PUBLIC_BASE_URL} crossOrigin="anonymous" />
        ) : null}
        <link
          rel="preload"
          as="image"
          href={getAssetUrl("/ecell_shots_mobile_720p/00001.webp")}
          fetchPriority="high"
          media="(max-width: 767px)"
        />
        <link
          rel="preload"
          as="image"
          href={getAssetUrl("/ecell_shots_720p/00001.webp")}
          fetchPriority="high"
          media="(min-width: 768px) and (max-width: 1023px)"
        />
        <link
          rel="preload"
          as="image"
          href={getAssetUrl("/ecell_shots/00001.webp")}
          fetchPriority="high"
          media="(min-width: 1024px)"
        />
        {children}
      </body>
    </html>
  );
}
