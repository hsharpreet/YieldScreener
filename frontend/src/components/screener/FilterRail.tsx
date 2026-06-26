'use client'
import { ScreenParams } from '@/lib/api'
import SavedScreeners from './SavedScreeners'

interface Props {
  params: ScreenParams
  onChange: (p: ScreenParams) => void
  onRun: () => void
  watchlistMode: boolean
  onWatchlistModeChange: (val: boolean) => void
}

export default function FilterRail({ params, onChange, onRun, watchlistMode, onWatchlistModeChange }: Props) {
  function handleLoad(loaded: ScreenParams) {
    onChange(loaded)
    onRun()
  }

  return (
    <aside className="w-56 shrink-0 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-5 overflow-y-auto">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filters</h2>

        <label className="block text-xs text-gray-600 mb-1">DTE range</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={params.min_dte ?? 21}
            min={1}
            max={params.max_dte}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            onChange={e => onChange({ ...params, min_dte: Number(e.target.value) })} />
          <span className="text-gray-400 self-center">–</span>
          <input
            type="number"
            value={params.max_dte ?? 45}
            min={params.min_dte}
            max={365}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            onChange={e => onChange({ ...params, max_dte: Number(e.target.value) })} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Max P/E</label>
        <input
          type="number"
          value={params.max_pe ?? 50}
          min={1}
          max={500}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          onChange={e => onChange({ ...params, max_pe: Number(e.target.value) })} />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Min Market Cap ($B)</label>
        <input
          type="number"
          value={((params.min_market_cap ?? 5e9) / 1e9).toFixed(0)}
          min={0}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          onChange={e => onChange({ ...params, min_market_cap: Number(e.target.value) * 1e9 })} />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Tickers (comma-sep)</label>
        <input
          type="text"
          placeholder="default universe"
          value={params.tickers ?? ''}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          onChange={e => onChange({ ...params, tickers: e.target.value || undefined })} />
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={watchlistMode}
            onChange={e => onWatchlistModeChange(e.target.checked)}
            className="rounded" />
          My Watchlist only
          <span className="text-[10px] font-medium bg-blue-100 text-blue-700 rounded px-1">Pro</span>
        </label>
      </div>

      <SavedScreeners currentParams={params} onLoad={handleLoad} />

      <button
        onClick={onRun}
        className="mt-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded px-3 py-2 transition-colors">
        Run Screen
      </button>
    </aside>
  )
}
