import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import NavBar from "@/components/NavBar";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "IPTA Dashboard",
  description: "Integrated Pediatric Therapy Associates — productivity and bonus tracking",
  manifest: "/manifest.json",
  other: {
    "theme-color": "#2D9F93",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <SessionProvider>
          <ServiceWorkerRegistration />
          <NavBar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
