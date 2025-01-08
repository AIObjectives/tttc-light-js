import { nextTypography } from "@src/lib/font";
import Navbar from "@components/navbar/Navbar";
import { Toaster } from "@src/components/elements";
import "./global.css";

export const metadata = {
  title: "Talk the City",
};

export default function RootLayout({
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
