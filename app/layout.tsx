import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Global Alignment Index — v0.1',
  description: 'Factual, opinion‑free signals of global alignment vs capability',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </body>
    </html>
  )
}
