import { nextTypography } from "@/lib/font";
import Navbar from "@/components/navbar/Navbar";
import { Toaster } from "@/components/elements";
import "./global.css";
import { getAuthenticatedAppForUser } from "@/lib/firebase/serverApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Talk to the City",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = await getAuthenticatedAppForUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://unpkg.com/papaparse@latest/papaparse.min.js"></script>
      </head>
      <body className={nextTypography}>
        <script src="index.js"></script>
        <div className="h-screen w-screen">
          <Navbar currentUser={currentUser} />
          {children}
        </div>
        <Toaster
          position="bottom-right"
          // toastOptions={{
          //   className: "border-none p-4 flex",
          //   classNames: {
          //     toast: "bg-accent",
          //     title: "text-accent-foreground",
          //     icon: "text-accent-foreground",
          //   },
          // }}
        />
      </body>
    </html>
  );
}
