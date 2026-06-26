import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/auth'
import NavBar from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'Yield Screener',
  description: 'Quality-first covered call screener. Educational information, not investment advice.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white flex flex-col">
        <AuthProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
          <footer className="bg-gray-100 border-t border-gray-200 px-4 py-3 text-xs text-gray-500 text-center">
            Educational information, not investment advice. This tool is a non-tailored research screener, not a registered advisor.
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}
