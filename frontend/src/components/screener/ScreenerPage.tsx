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
  const [dataStatus, setDataStatus] = useState<'ready' | 'loading'>('ready')
  const [params, setParams] = useState<ScreenParams>({ min_dte: 21, max_dte: 45 })
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const [watchlistMode, setWatchlistMode] = useState(false)

  // Refs that are always current — load() never needs to be recreated
  const paramsRef = useRef<ScreenParams>(params)
  paramsRef.current = params
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  // ── load: reads cache from backend, never blocks on Yahoo Finance ──────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null }
    try {
      const result = await fetchScreen(paramsRef.current)
      setRows(result.rows)
      setTier(result.tier)
      setTotal(result.total)
      setDataStatus(result.dataStatus)
      // Scheduler hasn't finished its first pass yet — retry in 10 s automatically.
      if (result.dataStatus === 'loading') {
        retryRef.current = setTimeout(load, 10_000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load screener data')
    } finally {
      setLoading(false)
    }
  }, []) // stable — always reads latest params via paramsRef

  // ── Run on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    load()
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [load])

  // ── Auto-run 600 ms after any filter change (debounced) ───────────────────
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(load, 600)
  }, [params, load])

  // ── Watchlist mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.tier === 'pro') {
      fetchWatchlist().then(tickers => setWatchlist(new Set(tickers)))
    }
  }, [user])

  useEffect(() => {
    if (watchlistMode && watchlist.size > 0) {
      setParams(p => ({ ...p, tickers: Array.from(watchlist).join(',') }))
    } else if (!watchlistMode) {
      setParams(p => ({ ...p, tickers: undefined }))
    }
  }, [watchlistMode, watchlist])

  function handleWatchlistToggle(ticker: string, add: boolean) {
    setWatchlist(prev => {
      const next = new Set(prev)
      if (add) next.add(ticker)
      else next.delete(ticker)
      return next
    })
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0f1724' }}>
      <DisclaimerBanner />

      {/* Page header */}
      <div className="px-6 pt-5 pb-3" style={{ background: '#0a1628', borderBottom: '1px solid #1a2438' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-white tracking-tight">Covered Call Screener</h1>
          <span className="inline-flex items-center gap-1 border border-[#2a3a58] rounded-full px-2.5 py-0.5 text-xs text-gray-400" style={{ background: '#1a2438' }}>
            USA Markets
          </span>
          {dataStatus === 'loading' && (
            <span className="text-xs" style={{ color: '#f59e0b' }}>
              ⏳ Fetching market data…
            </span>
          )}
          {dataStatus === 'ready' && !loading && (
            <span className="text-xs" style={{ color: '#2a4060' }}>
              Data refreshes every 10 min · 15-min delayed
            </span>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: '#3a5070' }}>
          Quality stocks ranked by best covered call yield.{' '}
          <span style={{ color: '#2a4060' }}>Annualized figures are illustrative only.</span>
        </p>
      </div>

      {/* Filter bar */}
      <FilterRail
        params={params}
        onChange={setParams}
        onRun={load}
        watchlistMode={watchlistMode}
        onWatchlistModeChange={setWatchlistMode}
      />

      {/* Table area */}
      <main className="flex-1 px-4 py-4 overflow-auto">
        {loading && (
          <div className="py-12 text-center">
            <div className="text-sm" style={{ color: '#6a8ab0' }}>
              {dataStatus === 'loading'
                ? 'Fetching market data for the first time — this takes ~30 s…'
                : 'Applying filters…'}
            </div>
            <div className="mt-4 space-y-2 max-w-5xl mx-auto">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="h-10 rounded animate-pulse"
                  style={{ background: '#111c2d', opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          </div>
        )}

        {!loading && dataStatus === 'loading' && rows.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-2xl mb-3">⏳</div>
            <p className="font-medium" style={{ color: '#c8d8e8' }}>Market data is loading…</p>
            <p className="text-sm mt-1" style={{ color: '#4a6080' }}>
              The background scheduler is fetching fresh data. Retrying automatically in 10 s.
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="py-12 text-center">
            <p className="font-medium" style={{ color: '#c8d8e8' }}>No stocks matched your filters.</p>
            <p className="text-sm mt-1" style={{ color: '#4a6080' }}>
              Try relaxing the criteria — wider DTE range, higher max PE, or fewer sector restrictions.
            </p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <ScreenerTable
            rows={rows}
            tier={tier}
            total={total}
            watchlist={watchlist}
            onWatchlistToggle={handleWatchlistToggle}
          />
        )}

        {!loading && !error && rows.length === 0 && dataStatus === 'ready' && (
          <div className="py-12 text-center">
            <p className="font-medium" style={{ color: '#c8d8e8' }}>No stocks matched your filters.</p>
            <p className="text-sm mt-1" style={{ color: '#4a6080' }}>
              Try relaxing the criteria — wider DTE range, higher max PE, or fewer sector restrictions.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
