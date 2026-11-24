import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

export const metadata: Metadata = {
  title: { default: "CampusShare", template: "%s | CampusShare" },
  description: "Good food. Less waste. A better planet. Connecting surplus food, local farmers, and communities.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CampusShare", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFC629",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-cream font-sans text-brand-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
