'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchScreen, fetchWatchlist, ScreenerRow, ScreenParams } from '@/lib/api'
import { useAuth } from '@/components/auth'
import FilterRail from './FilterRail'
import ScreenerTable from './ScreenerTable'
import DisclaimerBanner from './DisclaimerBanner'

export default function ScreenerPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<ScreenerRow[]>([])
  const [tier, setTier] = useState<'free' | 'pro'>('free')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<ScreenParams>({
    min_dte: 21,
    max_dte: 45,
    min_market_cap: 5_000_000_000,
    max_pe: 50,
  })
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const [watchlistMode, setWatchlistMode] = useState(false)

  // Fetch watchlist for Pro users
  useEffect(() => {
    if (user?.tier === 'pro') {
      fetchWatchlist().then(tickers => setWatchlist(new Set(tickers)))
    }
  }, [user])

  // When watchlist mode toggles, inject tickers filter
  useEffect(() => {
    if (watchlistMode && watchlist.size > 0) {
      setParams(p => ({ ...p, tickers: Array.from(watchlist).join(',') }))
    } else if (watchlistMode && watchlist.size === 0) {
      // Nothing to do — no watchlist items yet
    } else if (!watchlistMode) {
      setParams(p => ({ ...p, tickers: undefined }))
    }
  }, [watchlistMode, watchlist])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchScreen(params)
      setRows(result.rows)
      setTier(result.tier)
      setTotal(result.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load screener data')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => { load() }, [load])

  function handleWatchlistToggle(ticker: string, add: boolean) {
    setWatchlist(prev => {
      const next = new Set(prev)
      if (add) next.add(ticker)
      else next.delete(ticker)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full min-h-screen">
      <DisclaimerBanner />
      <div className="flex flex-1">
        <FilterRail
          params={params}
          onChange={setParams}
          onRun={load}
          watchlistMode={watchlistMode}
          onWatchlistModeChange={setWatchlistMode}
        />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Covered Call Screener</h1>
            <p className="text-sm text-gray-500 mt-1">
              Quality stocks ranked by best available covered call yield.{' '}
              <span className="font-medium">Annualized figures are illustrative only.</span>
            </p>
          </div>
          {loading && <p className="text-gray-500 py-8 text-center">Loading&#x2026;</p>}
          {error && <p className="text-red-600 py-8 text-center">{error}</p>}
          {!loading && !error && (
            <ScreenerTable
              rows={rows}
              tier={tier}
              total={total}
              watchlist={watchlist}
              onWatchlistToggle={handleWatchlistToggle}
            />
          )}
        </main>
      </div>
    </div>
  )
}
