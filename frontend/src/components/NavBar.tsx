'use client'
import Link from 'next/link'
import { useAuth } from '@/components/auth'

export default function NavBar() {
  const { user, loading, logout } = useAuth()

  return (
    <nav className="border-b border-gray-200 bg-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold text-gray-900 text-sm hover:text-blue-700 transition-colors">
          YieldScreener
        </Link>
        <div className="hidden sm:flex items-center gap-5 text-sm text-gray-600">
          <Link href="/screener" className="hover:text-gray-900 transition-colors">
            Screener
          </Link>
          <Link href="/#pricing" className="hover:text-gray-900 transition-colors">
            Pricing
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {loading ? null : user ? (
          <>
            <span className="hidden sm:inline text-gray-500 text-xs">{user.email}</span>
            {user.tier === 'pro' && (
              <span className="text-xs font-medium bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">Pro</span>
            )}
            <Link href="/account" className="text-gray-600 hover:text-gray-900 text-xs transition-colors">
              Account
            </Link>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-gray-600 text-xs transition-colors">
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-xs font-medium transition-colors">
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
