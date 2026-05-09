import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strategy Signal Board",
  description: "Cardona-inspired educational strategy analyzer powered by Yahoo Finance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
