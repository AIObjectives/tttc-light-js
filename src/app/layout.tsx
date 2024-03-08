import type {Metadata} from 'next'

export const metadata:Metadata = {
    title: 'Talk the City',
}

export default function RootLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    
    return (
<html lang="en">
  <head>
    {/* <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" /> */}
    <script src="https://unpkg.com/papaparse@latest/papaparse.min.js"></script>
    {/* <title>Talk the City</title> */}
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <script src="index.js"></script>
    <div className="navbar">
      <a href="/"><h1>Talk to the City (Next)</h1></a>
      <div className="nav-links">
        <a href="/examples.html">Examples</a>
        <a
          href="https://github.com/AIObjectives/tttc-light-js?tab=readme-ov-file#api-docs"
          >API docs</a
        >
      </div>
    </div>

    {children}
  </body>

  {/* <script>
    loadAllFields();
    updateDataField();
  </script> */}
</html>

    )
  }