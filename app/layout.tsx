import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Horizon',
  description: 'Personal project dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}
