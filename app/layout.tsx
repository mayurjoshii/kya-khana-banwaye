import type { Metadata, Viewport } from "next";
import { Baloo_2, Shrikhand } from "next/font/google";

import "./globals.css";

const shrikhand = Shrikhand({
  variable: "--font-shrikhand",
  weight: "400",
  subsets: ["latin"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "devanagari"],
});

export const metadata: Metadata = {
  title: "Cook Assistant",
  description: "Plans the cook's visit and makes a Hindi voice note for her.",
};

export const viewport: Viewport = {
  themeColor: "#fffdf8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${shrikhand.variable} ${baloo.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
