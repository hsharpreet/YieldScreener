'use client'
import { usePathname } from 'next/navigation'

export default function ConditionalFooter() {
  const pathname = usePathname()
  if (pathname === '/') return null
  return (
    <footer className="bg-gray-100 border-t border-gray-200 px-4 py-3 text-xs text-gray-500 text-center">
      Educational information, not investment advice. This tool is a non-tailored research screener, not a registered advisor.
    </footer>
  )
}
