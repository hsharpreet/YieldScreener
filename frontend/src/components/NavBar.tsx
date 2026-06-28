'use client'
import Link from 'next/link'
import { useAuth } from '@/components/auth'

export default function NavBar() {
  const { user, loading, logout } = useAuth()

  return (
    <nav className="border-b border-[#1a2438] px-4 py-2 flex items-center justify-between" style={{ background: '#0a1628' }}>
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold text-white text-sm hover:text-[#00d4aa] transition-colors">
          YieldScreener
        </Link>
        <div className="hidden sm:flex items-center gap-5 text-sm text-gray-400">
          <Link href="/screener" className="hover:text-white transition-colors">
            Screener
          </Link>
          <Link href="/#pricing" className="hover:text-white transition-colors">
            Pricing
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {loading ? null : user ? (
          <>
            <span className="hidden sm:inline text-gray-500 text-xs">{user.email}</span>
            {user.tier === 'pro' && (
              <span className="text-xs font-medium bg-[#00d4aa]/20 text-[#00d4aa] rounded px-1.5 py-0.5">Pro</span>
            )}
            <Link href="/account" className="text-gray-400 hover:text-white text-xs transition-colors">
              Account
            </Link>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded px-3 py-1.5 text-xs font-medium transition-colors text-[#0a1628]"
              style={{ background: '#00d4aa' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#00bfa0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#00d4aa')}
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
