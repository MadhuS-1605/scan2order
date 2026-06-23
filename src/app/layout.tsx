import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/sw-register";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Scan to Order — QR ordering for restaurants, cafés & hotels",
    template: "%s · Scan to Order",
  },
  description:
    "QR ordering for restaurants, cafés, bars & hotels — guests scan, browse your menu, order and pay from their table. No app to install.",
  applicationName: "Scan to Order",
  keywords: [
    "QR ordering",
    "restaurant ordering app",
    "scan to order",
    "contactless dining",
    "café QR menu",
    "hotel in-room dining",
    "digital menu",
    "table ordering",
  ],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scan to Order",
  },
  formatDetection: { telephone: false },
  // Rich link previews when an owner shares the site (WhatsApp, social, search).
  // The OG/Twitter image is provided by app/opengraph-image.tsx automatically.
  openGraph: {
    type: "website",
    siteName: "Scan to Order",
    title: "Scan to Order — QR ordering for restaurants, cafés & hotels",
    description:
      "Guests scan, browse your menu, order and pay from their table. Live kitchen tickets, one consolidated bill, GST invoices — no app to install.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scan to Order — QR ordering for restaurants, cafés & hotels",
    description:
      "QR ordering for restaurants, cafés, bars & hotels. Scan, order, pay — no app to install.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c25e3b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${dmSans.variable}`}
    >
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
