import { Metadata } from "next";
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
      <body className={`${nextTypography} pt-0 px-0`}>
        <Navbar />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "border-none p-4 flex",
            classNames: {
              toast: "bg-accent",
              title: "text-accent-foreground",
              icon: "text-accent-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
