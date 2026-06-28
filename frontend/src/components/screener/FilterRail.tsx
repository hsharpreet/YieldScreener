'use client'
import { useState, useRef, useEffect } from 'react'
import { ScreenParams } from '@/lib/api'
import SavedScreeners from './SavedScreeners'

interface Props {
  params: ScreenParams
  onChange: (p: ScreenParams) => void
  onRun: () => void
  watchlistMode: boolean
  onWatchlistModeChange: (val: boolean) => void
}

// ─── Preset definitions ───────────────────────────────────────────────────────

const DTE_PRESETS = [
  { label: 'Near-term', sub: '7–21 days', min: 7, max: 21 },
  { label: 'Standard', sub: '21–45 days', min: 21, max: 45 },
  { label: 'Extended', sub: '45–60 days', min: 45, max: 60 },
]

const MCAP_PRESETS = [
  { label: 'Any', sub: '', value: undefined as number | undefined },
  { label: 'Small-cap', sub: '$1B+', value: 1e9 },
  { label: 'Mid-cap', sub: '$5B+', value: 5e9 },
  { label: 'Large-cap', sub: '$20B+', value: 20e9 },
  { label: 'Mega-cap', sub: '$100B+', value: 100e9 },
]

const PE_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: '≤ 15', value: 15 },
  { label: '≤ 25', value: 25 },
  { label: '≤ 35', value: 35 },
  { label: '≤ 50', value: 50 },
  { label: '≤ 100', value: 100 },
]

const BETA_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: '≤ 0.8 (Low)', value: 0.8 },
  { label: '≤ 1.2 (Moderate)', value: 1.2 },
  { label: '≤ 1.5 (High)', value: 1.5 },
]

const RATING_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: '≤ 1.5 (Strong Buy)', value: 1.5 },
  { label: '≤ 2.0 (Buy)', value: 2.0 },
  { label: '≤ 2.5 (Buy/Hold)', value: 2.5 },
  { label: '≤ 3.0 (Hold)', value: 3.0 },
]

const PEG_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: '≤ 1 (Undervalued)', value: 1 },
  { label: '≤ 1.5', value: 1.5 },
  { label: '≤ 2', value: 2 },
]

const ROE_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: '≥ 10%', value: 0.10 },
  { label: '≥ 15%', value: 0.15 },
  { label: '≥ 20%', value: 0.20 },
  { label: '≥ 25%', value: 0.25 },
]

const ALL_SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Consumer Staples', 'Energy', 'Industrials', 'Materials',
  'Real Estate', 'Utilities', 'Communication Services',
]

// ─── Dropdown panel (shared) ──────────────────────────────────────────────────

function DropdownPanel({
  open,
  onClose,
  children,
  alignRight = false,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  alignRight?: boolean
}) {
  if (!open) return null
  return (
    <div
      className={`absolute top-full mt-1 z-50 rounded-lg border border-[#2a3a58] shadow-2xl overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}
      style={{ background: '#0d1b2e', minWidth: 220 }}
    >
      {children}
    </div>
  )
}

// ─── Preset option row ────────────────────────────────────────────────────────

function PresetRow({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string
  sub?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-2 text-xs flex items-center justify-between gap-3 transition-colors',
        selected ? 'bg-[#00d4aa]/15 text-[#00d4aa]' : 'text-gray-300 hover:bg-[#1a2438] hover:text-white',
      ].join(' ')}
    >
      <span className="font-medium">{label}</span>
      {sub && <span className="text-gray-500 text-[10px] shrink-0">{sub}</span>}
      {selected && (
        <svg className="w-3 h-3 text-[#00d4aa] shrink-0" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// ─── Single filter cell (FinViz-style: label | clickable value) ───────────────

function FilterCell({
  label,
  displayValue,
  active,
  children,
}: {
  label: string
  displayValue: string
  active: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative flex items-center border-b border-[#1a2438]" ref={ref}>
      {/* Label */}
      <span className="shrink-0 px-3 py-2 text-[11px] text-gray-500 w-28 select-none">
        {label}
      </span>
      {/* Value button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          'flex-1 flex items-center justify-between px-2 py-2 text-[11px] font-medium text-left transition-colors truncate',
          active ? 'text-[#00d4aa]' : 'text-gray-300 hover:text-white',
        ].join(' ')}
      >
        <span className="truncate">{displayValue}</span>
        <svg className="w-3 h-3 opacity-50 shrink-0 ml-1" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full mt-0 z-50 rounded-lg border border-[#2a3a58] shadow-2xl overflow-hidden"
          style={{ background: '#0d1b2e', minWidth: 240 }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FilterRail({ params, onChange, onRun, watchlistMode, onWatchlistModeChange }: Props) {
  const [savedOpen, setSavedOpen] = useState(false)
  const savedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) setSavedOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Display value helpers ─────────────────────────────────────────────────

  const dteDisplay = (() => {
    const preset = DTE_PRESETS.find(p => p.min === params.min_dte && p.max === params.max_dte)
    if (preset) return preset.label
    if (params.min_dte !== undefined || params.max_dte !== undefined)
      return `${params.min_dte ?? '?'}–${params.max_dte ?? '?'} days`
    return 'Any'
  })()

  const mcapDisplay = (() => {
    if (params.min_market_cap === undefined) return 'Any'
    const preset = MCAP_PRESETS.find(p => p.value === params.min_market_cap)
    return preset ? preset.label : `$${((params.min_market_cap ?? 0) / 1e9).toFixed(0)}B+`
  })()

  const peDisplay = params.max_pe !== undefined ? `≤ ${params.max_pe}` : 'Any'

  const betaDisplay = params.max_beta !== undefined ? `≤ ${params.max_beta}` : 'Any'

  const sectorDisplay = (() => {
    if (!params.sectors) return 'Any'
    const list = params.sectors.split(',').map(s => s.trim()).filter(Boolean)
    if (list.length === 1) return list[0]
    return `${list.length} selected`
  })()

  const ratingDisplay = params.max_analyst_rating !== undefined
    ? `≤ ${params.max_analyst_rating}`
    : 'Any'

  const pegDisplay = params.max_peg !== undefined ? `≤ ${params.max_peg}` : 'Any'

  const roeDisplay = params.min_roe !== undefined
    ? `≥ ${(params.min_roe * 100).toFixed(0)}%`
    : 'Any'

  const tickerDisplay = params.tickers && !watchlistMode
    ? params.tickers.split(',').map(t => t.trim()).filter(Boolean).join(', ')
    : watchlistMode ? 'Watchlist' : 'All'

  // ── Sector helpers ────────────────────────────────────────────────────────

  const selectedSectors = params.sectors
    ? params.sectors.split(',').map(s => s.trim()).filter(Boolean)
    : []

  function toggleSector(sector: string) {
    const next = selectedSectors.includes(sector)
      ? selectedSectors.filter(s => s !== sector)
      : [...selectedSectors, sector]
    onChange({ ...params, sectors: next.length > 0 ? next.join(', ') : undefined })
  }

  // ── Any filters active? ───────────────────────────────────────────────────

  const anyActive =
    params.min_dte !== undefined || params.max_dte !== undefined ||
    params.min_market_cap !== undefined || params.max_pe !== undefined ||
    params.max_beta !== undefined || params.sectors !== undefined ||
    params.max_analyst_rating !== undefined || params.max_peg !== undefined ||
    params.min_roe !== undefined || (params.tickers !== undefined && !watchlistMode)

  function handleReset() {
    onChange({
      min_dte: 21, max_dte: 45,
      min_market_cap: 5_000_000_000,
    })
  }

  function handleLoad(loaded: ScreenParams) {
    onChange(loaded)
    onRun()
    setSavedOpen(false)
  }

  return (
    <div className="w-full" style={{ background: '#0a1628' }}>

      {/* ── Toolbar row ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a2438]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Filters</span>

          {/* Watchlist toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={() => onWatchlistModeChange(!watchlistMode)}
              className={[
                'relative w-7 h-3.5 rounded-full transition-colors cursor-pointer',
                watchlistMode ? 'bg-[#00d4aa]' : 'bg-[#2a3a58]',
              ].join(' ')}
            >
              <span className={[
                'absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform shadow-sm',
                watchlistMode ? 'translate-x-3.5' : 'translate-x-0',
              ].join(' ')} />
            </div>
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              Watchlist
              <span className="ml-1 text-[10px] font-medium bg-[#00d4aa]/20 text-[#00d4aa] rounded px-1">Pro</span>
            </span>
          </label>

          {/* Saved screeners */}
          <div className="relative" ref={savedRef}>
            <button
              onClick={() => setSavedOpen(o => !o)}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 4.5h5M3.5 6.5h5M3.5 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Saved
            </button>
            {savedOpen && (
              <div
                className="absolute left-0 top-full mt-1 z-50 rounded-lg border border-[#2a3a58] shadow-2xl p-3"
                style={{ background: '#0d1b2e', minWidth: 240 }}
                onClick={e => e.stopPropagation()}
              >
                <SavedScreeners currentParams={params} onLoad={handleLoad} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {anyActive && (
            <button
              onClick={handleReset}
              className="text-[11px] text-gray-500 hover:text-red-400 transition-colors px-2 py-1"
            >
              Reset
            </button>
          )}
          <button
            onClick={onRun}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold transition-colors"
            style={{ background: '#00d4aa', color: '#0a1628' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#00bfa0')}
            onMouseLeave={e => (e.currentTarget.style.background = '#00d4aa')}
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Run Screen
          </button>
        </div>
      </div>

      {/* ── Filter grid: 3 columns ── */}
      <div className="grid grid-cols-3 divide-x divide-[#1a2438]">

        {/* Col 1 */}
        <div className="flex flex-col">

          {/* DTE */}
          <FilterCell label="Days to Exp." displayValue={dteDisplay} active={params.min_dte !== undefined || params.max_dte !== undefined}>
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Days to Expiration</p>
              {DTE_PRESETS.map(p => (
                <PresetRow
                  key={p.label}
                  label={p.label}
                  sub={p.sub}
                  selected={params.min_dte === p.min && params.max_dte === p.max}
                  onClick={() => onChange({ ...params, min_dte: p.min, max_dte: p.max })}
                />
              ))}
              <div className="border-t border-[#1a2438] mx-3 mt-1 pt-2 pb-3">
                <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-widest font-semibold">Manual</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={params.min_dte ?? ''}
                    placeholder="Min"
                    min={1}
                    className="w-16 bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
                    onClick={e => e.stopPropagation()}
                    onChange={e => onChange({ ...params, min_dte: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                  <span className="text-gray-600 text-xs">–</span>
                  <input
                    type="number"
                    value={params.max_dte ?? ''}
                    placeholder="Max"
                    min={1}
                    className="w-16 bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
                    onClick={e => e.stopPropagation()}
                    onChange={e => onChange({ ...params, max_dte: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </FilterCell>

          {/* P/E Ratio */}
          <FilterCell label="P/E Ratio" displayValue={peDisplay} active={params.max_pe !== undefined}>
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max P/E Ratio</p>
              {PE_PRESETS.map(p => (
                <PresetRow
                  key={p.label}
                  label={p.label}
                  selected={params.max_pe === p.value}
                  onClick={() => onChange({ ...params, max_pe: p.value })}
                />
              ))}
            </div>
          </FilterCell>

          {/* PEG */}
          <FilterCell label="PEG Ratio" displayValue={pegDisplay} active={params.max_peg !== undefined}>
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max PEG Ratio</p>
              {PEG_PRESETS.map(p => (
                <PresetRow
                  key={p.label}
                  label={p.label}
                  selected={params.max_peg === p.value}
                  onClick={() => onChange({ ...params, max_peg: p.value })}
                />
              ))}
            </div>
          </FilterCell>

        </div>

        {/* Col 2 */}
        <div className="flex flex-col">

          {/* Market Cap */}
          <FilterCell label="Market Cap" displayValue={mcapDisplay} active={params.min_market_cap !== undefined}>
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Minimum Market Cap</p>
              {MCAP_PRESETS.map(p => (
                <PresetRow
                  key={p.label}
                  label={p.label}
                  sub={p.sub}
                  selected={params.min_market_cap === p.value}
                  onClick={() => onChange({ ...params, min_market_cap: p.value })}
                />
              ))}
            </div>
          </FilterCell>

          {/* Beta */}
          <FilterCell label="Beta" displayValue={betaDisplay} active={params.max_beta !== undefined}>
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Beta (Volatility)</p>
              {BETA_PRESETS.map(p => (
                <PresetRow
                  key={p.label}
                  label={p.label}
                  selected={params.max_beta === p.value}
                  onClick={() => onChange({ ...params, max_beta: p.value })}
                />
              ))}
            </div>
          </FilterCell>

          {/* Min ROE */}
          <FilterCell label="Min ROE" displayValue={roeDisplay} active={params.min_roe !== undefined}>
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Minimum Return on Equity</p>
              {ROE_PRESETS.map(p => (
                <PresetRow
                  key={p.label}
                  label={p.label}
                  selected={params.min_roe === p.value}
                  onClick={() => onChange({ ...params, min_roe: p.value })}
                />
              ))}
            </div>
          </FilterCell>

        </div>

        {/* Col 3 */}
        <div className="flex flex-col">

          {/* Sector */}
          <FilterCell label="Sector" displayValue={sectorDisplay} active={!!params.sectors}>
            <div className="py-1" style={{ minWidth: 260 }}>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Sectors (multi-select)</p>
              {ALL_SECTORS.map(sector => (
                <button
                  key={sector}
                  onClick={e => { e.stopPropagation(); toggleSector(sector) }}
                  className={[
                    'w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors',
                    selectedSectors.includes(sector) ? 'text-[#00d4aa] bg-[#00d4aa]/10' : 'text-gray-300 hover:bg-[#1a2438] hover:text-white',
                  ].join(' ')}
                >
                  <span className={[
                    'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                    selectedSectors.includes(sector) ? 'bg-[#00d4aa] border-[#00d4aa]' : 'border-[#2a3a58]',
                  ].join(' ')}>
                    {selectedSectors.includes(sector) && (
                      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#0a1628" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {sector}
                </button>
              ))}
              {selectedSectors.length > 0 && (
                <div className="border-t border-[#1a2438] mt-1 px-4 py-2">
                  <button
                    onClick={e => { e.stopPropagation(); onChange({ ...params, sectors: undefined }) }}
                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Clear sectors
                  </button>
                </div>
              )}
            </div>
          </FilterCell>

          {/* Analyst Rating */}
          <FilterCell label="Analyst Rating" displayValue={ratingDisplay} active={params.max_analyst_rating !== undefined}>
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Analyst Rating (1=Buy · 5=Sell)</p>
              {RATING_PRESETS.map(p => (
                <PresetRow
                  key={p.label}
                  label={p.label}
                  selected={params.max_analyst_rating === p.value}
                  onClick={() => onChange({ ...params, max_analyst_rating: p.value })}
                />
              ))}
            </div>
          </FilterCell>

          {/* Custom Tickers */}
          <FilterCell label="Tickers" displayValue={tickerDisplay} active={!!(params.tickers && !watchlistMode)}>
            <div className="p-4" style={{ minWidth: 260 }} onClick={e => e.stopPropagation()}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Custom Ticker List</p>
              <input
                type="text"
                placeholder="AAPL, MSFT, NVDA…"
                value={watchlistMode ? '' : (params.tickers ?? '')}
                disabled={watchlistMode}
                className="w-full bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] disabled:opacity-40 disabled:cursor-not-allowed"
                onChange={e => onChange({ ...params, tickers: e.target.value || undefined })}
              />
              <p className="text-[10px] text-gray-600 mt-1.5">Comma-separated. Overrides universe.</p>
            </div>
          </FilterCell>

        </div>
      </div>
    </div>
  )
}
