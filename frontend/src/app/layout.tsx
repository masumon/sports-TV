import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Sports Live TV",
  description: "Premium global sports live TV streaming with real-time score overlays.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
