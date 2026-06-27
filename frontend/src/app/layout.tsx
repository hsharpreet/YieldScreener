import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/auth'
import ConditionalNavBar from '@/components/ConditionalNavBar'
import ConditionalFooter from '@/components/ConditionalFooter'

export const metadata: Metadata = {
  title: 'YieldScreener — Covered-Call Income Screener',
  description: 'Quality-first covered call screener. Screen fundamentally strong stocks, rank the best covered call, collect monthly income. Educational information, not investment advice.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <ConditionalNavBar />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </AuthProvider>
      </body>
    </html>
  )
}
