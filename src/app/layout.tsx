import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import NavBar from "@/components/NavBar";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Productivity & Bonus Tracker",
  description: "Outpatient therapy clinic productivity and arrival-rate bonus tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <SessionProvider>
          <NavBar />
          {children}
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
