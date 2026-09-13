import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDAC C-CAT · Study Dashboard",
  description:
    "8-week study plan, spaced revision queue and mock log for the CDAC C-CAT exam.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
