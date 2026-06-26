'use client'
import { useAuth } from '@/components/auth'

export default function NavBar() {
  const { user, loading, logout } = useAuth()

  return (
    <nav className="border-b border-gray-200 bg-white px-4 py-2 flex items-center justify-between">
      <span className="font-semibold text-gray-800 text-sm">Yield Screener</span>
      <div className="flex items-center gap-3 text-sm">
        {loading ? null : user ? (
          <>
            <span className="text-gray-500">{user.email}</span>
            {user.tier === 'pro' && (
              <span className="text-xs font-medium bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">Pro</span>
            )}
            <button onClick={logout} className="text-gray-400 hover:text-gray-600">Sign out</button>
          </>
        ) : (
          <>
            <a href="/login" className="text-gray-600 hover:text-gray-800">Sign in</a>
            <a href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-xs font-medium transition-colors">
              Get started
            </a>
          </>
        )}
      </div>
    </nav>
  )
}
