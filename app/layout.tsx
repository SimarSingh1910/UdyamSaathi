import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/components/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "UdyamSaathi | Accel Business",
  description:
    "Find the right business bundle, complete KYC and track activation, all from your phone, in 23 Indian languages.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e40000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
