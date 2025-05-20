import { nextTypography } from "@/lib/font";
import Navbar from "@/components/navbar/Navbar";
import { Toaster } from "@/components/elements";
import "./global.css";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Talk to the City",
  openGraph: {
    title: "Talk to the City",
    description:
      "Talk to the City helps large groups of people coordinate by understanding each other better, faster, and in more depth.",
    siteName: "Talk to the City",
    images: [
      {
        url: "/images/t3c-product-desktop-mobile.png",
        width: 1200,
        height: 630,
        alt: "Talk to the city",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk to the City",
    description:
      "Talk to the City helps large groups of people coordinate by understanding each other better, faster, and in more depth.",
    creator: "@AIObjectives",
    images: [
      new URL(
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000/images/t3c-product-desktop-mobile.png"
          : "https://www.talktothe.city/images/t3c-product-desktop-mobile.png",
      ),
    ],
  },
  metadataBase: new URL(
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://www.talktothe.city",
  ),
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://unpkg.com/papaparse@latest/papaparse.min.js"></script>
      </head>
      <body className={nextTypography}>
        <script src="index.js"></script>
        <div className="h-screen w-screen">
          <Navbar />
          {children}
        </div>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
