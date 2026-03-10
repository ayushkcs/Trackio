import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trackio - Know When Your Emails Get Opened",
  description:
    "Track email opens in real-time with a simple Chrome extension. Get instant notifications and detailed analytics for every email you send.",
  keywords: ["email tracking", "gmail", "chrome extension", "email analytics"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
          }}
        />
      </body>
    </html>
  );
}
