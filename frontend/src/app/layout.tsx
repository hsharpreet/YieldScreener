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
