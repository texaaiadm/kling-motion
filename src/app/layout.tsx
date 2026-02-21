import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Kling Motion Control — AI Motion Transfer",
  description: "Transfer motion from reference videos to character images using Kling 2.6 Motion Control AI. Preserve character appearance while applying realistic motion.",
  keywords: "Kling Motion Control, AI motion transfer, video effects, character animation, Freepik API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable}`}>
        {children}
      </body>
    </html>
  );
}
