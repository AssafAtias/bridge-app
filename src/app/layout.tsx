import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata: Metadata = {
  title: "Bridge — Multiplayer Card Game",
  description: "Play real-time multiplayer Bridge online",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
