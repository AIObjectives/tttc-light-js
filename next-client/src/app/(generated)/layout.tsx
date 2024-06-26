import { Metadata } from "next";
import "./reportStyle.css";
import { nextTypography } from "@src/lib/font";
import Navbar from "@components/navbar/Navbar";
import { Toaster } from "@components/elements";

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
        <Toaster
          position="bottom-right"
          toastOptions={{
            unstyled: true,
            className:
              "border-none flex flex-row gap-x-2 items-center p-4 border-r-2 rounded-md shadow-lg",
            classNames: {
              toast: "bg-green-100",
              title: "text-green-500",
              icon: "text-green-500",
            },
          }}
        />
      </body>
    </html>
  );
}
