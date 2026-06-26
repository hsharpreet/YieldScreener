'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchScreen, ScreenerRow, ScreenParams } from '@/lib/api'
import FilterRail from './FilterRail'
import ScreenerTable from './ScreenerTable'

export default function ScreenerPage() {
  const [rows, setRows] = useState<ScreenerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<ScreenParams>({ min_dte: 21, max_dte: 45, min_market_cap: 5_000_000_000, max_pe: 50 })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchScreen(params)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load screener data')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex h-full min-h-screen">
      <FilterRail params={params} onChange={setParams} onRun={load} />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Covered Call Screener</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quality stocks ranked by best available covered call yield.{' '}
            <span className="font-medium">Annualized figures are illustrative only.</span>
          </p>
        </div>
        {loading && <p className="text-gray-500 py-8 text-center">Loading…</p>}
        {error && <p className="text-red-600 py-8 text-center">{error}</p>}
        {!loading && !error && <ScreenerTable rows={rows} />}
      </main>
    </div>
  )
}
