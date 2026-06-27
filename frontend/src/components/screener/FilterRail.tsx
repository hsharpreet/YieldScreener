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

function SectionHeader({ label }: { label: string }) {
  return <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-2">{label}</h3>
}

function NumberField({
  label, value, placeholder, min, max, step, onChange,
}: {
  label: string
  value: number | undefined
  placeholder?: string
  min?: number
  max?: number
  step?: number
  onChange: (v: number | undefined) => void
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </div>
  )
}

export default function FilterRail({ params, onChange, onRun, watchlistMode, onWatchlistModeChange }: Props) {
  function handleLoad(loaded: ScreenParams) {
    onChange(loaded)
    onRun()
  }

  return (
    <aside className="w-60 shrink-0 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-1 overflow-y-auto">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Filters</h2>

      <SectionHeader label="Options" />

      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1">DTE range</label>
        <div className="flex gap-2">
          <input
            type="number" value={params.min_dte ?? 21} min={1} max={params.max_dte}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            onChange={e => onChange({ ...params, min_dte: Number(e.target.value) })} />
          <span className="text-gray-400 self-center">–</span>
          <input
            type="number" value={params.max_dte ?? 45} min={params.min_dte} max={365}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            onChange={e => onChange({ ...params, max_dte: Number(e.target.value) })} />
        </div>
      </div>

      <SectionHeader label="Quality" />

      <NumberField
        label="Min Market Cap ($B)"
        value={params.min_market_cap !== undefined ? params.min_market_cap / 1e9 : undefined}
        placeholder="5"
        min={0}
        onChange={v => onChange({ ...params, min_market_cap: v !== undefined ? v * 1e9 : undefined })}
      />

      <NumberField
        label="Max P/E"
        value={params.max_pe}
        placeholder="50"
        min={0}
        onChange={v => onChange({ ...params, max_pe: v })}
      />

      <NumberField
        label="Max PEG ratio"
        value={params.max_peg}
        placeholder="any"
        min={0}
        step={0.1}
        onChange={v => onChange({ ...params, max_peg: v })}
      />

      <NumberField
        label="Min ROE (e.g. 0.10 = 10%)"
        value={params.min_roe}
        placeholder="any"
        step={0.01}
        onChange={v => onChange({ ...params, min_roe: v })}
      />

      <SectionHeader label="Risk" />

      <NumberField
        label="Max Beta"
        value={params.max_beta}
        placeholder="any"
        min={0}
        step={0.1}
        onChange={v => onChange({ ...params, max_beta: v })}
      />

      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1">
          Max Analyst Rating
          <span className="text-gray-400 ml-1">(1=Strong Buy, 5=Sell)</span>
        </label>
        <input
          type="range" min={1} max={5} step={0.5}
          value={params.max_analyst_rating ?? 5}
          className="w-full"
          onChange={e => onChange({ ...params, max_analyst_rating: Number(e.target.value) })}
        />
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>Strong Buy (1)</span>
          <span className="font-medium text-gray-600">{params.max_analyst_rating ?? '—'}</span>
          <span>Sell (5)</span>
        </div>
      </div>

      <SectionHeader label="Universe" />

      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1">Sectors (comma-sep)</label>
        <input
          type="text"
          placeholder="Technology, Healthcare…"
          value={params.sectors ?? ''}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          onChange={e => onChange({ ...params, sectors: e.target.value || undefined })}
        />
      </div>

      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1">Tickers (comma-sep)</label>
        <input
          type="text"
          placeholder="default universe"
          value={params.tickers ?? ''}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          onChange={e => onChange({ ...params, tickers: e.target.value || undefined })}
        />
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={watchlistMode}
            onChange={e => onWatchlistModeChange(e.target.checked)}
            className="rounded"
          />
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
