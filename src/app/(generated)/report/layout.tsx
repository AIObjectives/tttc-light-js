import styles from "src/styles"
import {Metadata} from 'next'

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
        <style>{styles}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
