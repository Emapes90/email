import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/Toaster";

export const metadata: Metadata = {
  title: "ProMail — Professional Email Hosting",
  description:
    "Production-grade self-hosted email platform with webmail, calendar, contacts & admin panel.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
