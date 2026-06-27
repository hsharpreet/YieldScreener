'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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
    min_dte: 7,
    max_dte: 60,
  })
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const [watchlistMode, setWatchlistMode] = useState(false)

  // Always-current ref so load() never needs to be recreated
  const paramsRef = useRef<ScreenParams>(params)
  paramsRef.current = params

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
    } else if (!watchlistMode) {
      setParams(p => ({ ...p, tickers: undefined }))
    }
  }, [watchlistMode, watchlist])

  // load() reads from paramsRef so it never needs to be recreated
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchScreen(paramsRef.current)
      setRows(result.rows)
      setTier(result.tier)
      setTotal(result.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load screener data')
    } finally {
      setLoading(false)
    }
  }, []) // No deps — never re-creates; always uses latest ref

  // Run once on mount only
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
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900">Covered Call Screener</h1>
              <span className="inline-flex items-center gap-1 border border-gray-300 rounded-full px-2.5 py-0.5 text-xs text-gray-500 bg-gray-50">
                &#127482;&#127480; USA Markets
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Quality stocks ranked by best available covered call yield.{' '}
              <span className="font-medium">Annualized figures are illustrative only.</span>
            </p>
          </div>

          {loading && (
            <div className="py-12 text-center">
              <div className="text-gray-400 text-sm">Screening stocks across US markets&#x2026;</div>
              <div className="mt-4 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse mx-auto max-w-4xl" />
                ))}
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="py-12 text-center">
              <div className="text-gray-400 text-4xl mb-4">&#128269;</div>
              <p className="text-gray-700 font-medium">No stocks matched your filters.</p>
              <p className="text-gray-500 text-sm mt-1">Try relaxing the criteria — reduce min market cap, widen the DTE range, or remove optional filters.</p>
            </div>
          )}

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
