import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "PulsePoll",
  description: "Live polls. Every vote is a heartbeat.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="grid min-h-full justify-items-center">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
