import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://woxsen.edu.in"),
  title: "E-Cell | Woxsen University — Where Innovation Meets Initiative",
  description:
    "Official website of the Entrepreneurship Cell at Woxsen University, Hyderabad. Fostering disruptive student founders, venture creation, and grassroots innovation.",
  keywords: [
    "E-Cell",
    "Woxsen University",
    "Entrepreneurship Cell",
    "Startups",
    "Hyderabad",
    "Innovation",
    "Hult Prize",
    "Incubation",
    "Student Founders",
  ],
  authors: [{ name: "E-Cell Woxsen University" }],
  icons: {
    icon: "/ecell-logo.png",
  },
  openGraph: {
    title: "E-Cell | Woxsen University",
    description:
      "Where Innovation Meets Initiative. The student-led startup ecosystem of Woxsen University.",
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
      className={`${outfit.variable} ${plusJakarta.variable} dark antialiased scroll-smooth`}
    >
      <body className="bg-[#05070B] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden min-h-screen">
        {children}
      </body>
    </html>
  );
}
