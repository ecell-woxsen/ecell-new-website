import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

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
    icon: "/ecell-logo.png",
  },
  openGraph: {
    title: "E-Cell Woxsen — Where Builders Start",
    description:
      "The Entrepreneurship Cell of Woxsen University. We build founders, not just businesses — through hands-on programs, mentorship, and a network that ships.",
    url: "https://woxsen.edu.in/ecell",
    siteName: "E-Cell Woxsen University",
    images: [
      {
        url: "/ecell-logo.png",
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
      className={`${bebasNeue.variable} ${dmSans.variable} ${spaceMono.variable} dark antialiased scroll-smooth`}
    >
      <body className="bg-[#040608] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
