'use client'
import { useAuth } from '@/components/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

export default function AccountPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Account</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-1">Email</div>
          <div className="text-gray-900">{user.email}</div>
        </div>
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-1">Subscription</div>
          <div className="flex items-center gap-2">
            <span className={user.tier === 'pro' ? 'font-semibold text-blue-700' : 'text-gray-700'}>
              {user.tier === 'pro' ? 'Pro' : 'Free'}
            </span>
            {user.tier === 'free' && (
              <span className="text-xs text-gray-400">(upgrade coming soon)</span>
            )}
          </div>
        </div>
        {user.tier === 'free' && (
          <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm text-blue-800">
            Pro gives you the full screener (all results), advanced quality filters, watchlist, and saved presets. Subscriptions launching soon.
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <Link href="/screener" className="text-sm text-blue-600 hover:underline">Back to Screener</Link>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
      </div>
    </div>
  )
}
