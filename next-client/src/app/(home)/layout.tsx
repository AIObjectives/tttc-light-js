import { nextTypography } from "@src/lib/font";

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
        <link rel="stylesheet" href="style.css" />
      </head>
      <body className={nextTypography}>
        <script src="index.js"></script>
        <div className="navbar">
          <a href="/">
            <h1>Talk to the City (Next)</h1>
          </a>
          <div className="nav-links">
            <a href="/examples">Examples</a>
            <a href="https://github.com/AIObjectives/tttc-light-js?tab=readme-ov-file#api-docs">
              API docs
            </a>
          </div>
        </div>

        {children}
      </body>
    </html>
  );
}
