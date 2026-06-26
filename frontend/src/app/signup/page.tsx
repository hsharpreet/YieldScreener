'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { register } from '@/lib/api'
import { useAuth } from '@/components/auth'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { refresh } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await register(email, password)
      await refresh()
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <p className="text-xs text-gray-500 border-t border-gray-100 pt-3 mt-3">
            By creating an account you acknowledge this tool provides educational financial data, not personalized investment advice.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded px-4 py-2 text-sm transition-colors disabled:opacity-60">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-center text-xs text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:underline">Sign in</a>
          </p>
        </form>
        <p className="text-center text-xs text-gray-400 mt-4">
          Educational information only — not investment advice.
        </p>
      </div>
    </div>
  )
}
