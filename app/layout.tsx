import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RIDEPLAY", template: "%s · RIDEPLAY" },
  description: "Let everyone in the car control the music, without touching the driver's phone.",
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0C0F",
};

// Applies the saved theme before first paint (dark is the default).
const themeScript = `try{var t=localStorage.getItem('rp-theme');var d=t==='light'||(t==='system'&&matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';document.documentElement.dataset.theme=d}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
