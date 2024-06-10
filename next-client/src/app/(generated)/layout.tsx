import { Metadata } from "next";
import "./reportStyle.css";
import { nextTypography } from "@src/lib/font";
import Navbar from "@src/components/navbar/Navbar";

export const metadata: Metadata = {
  title: "Talk the City",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${nextTypography} min-w-max pt-0`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
