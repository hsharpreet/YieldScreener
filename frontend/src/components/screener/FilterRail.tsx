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

// ─── Shared helpers ───────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onClose])
}

// ─── Preset row inside dropdowns ─────────────────────────────────────────────

function PresetRow({ label, sub, selected, onClick }: {
  label: string; sub?: string; selected: boolean; onClick: () => void
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

// ─── Custom numeric editor (shown at bottom of each numeric filter dropdown) ──

function CustomNumericInput({ label, value, onChange, placeholder = 'e.g. 25' }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string
}) {
  return (
    <div className="border-t border-[#1a2438] mx-0 mt-1 px-4 py-2.5">
      <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-widest font-semibold">Custom</p>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500 shrink-0">{label}</span>
        <input
          type="number"
          value={value ?? ''}
          placeholder={placeholder}
          className="flex-1 bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
          onClick={e => e.stopPropagation()}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
        {value !== undefined && (
          <button onClick={() => onChange(undefined)} className="text-gray-500 hover:text-red-400 text-[10px]">✕</button>
        )}
      </div>
    </div>
  )
}

// ─── Filter cell (label | value, opens dropdown) ─────────────────────────────

function FilterCell({ label, displayValue, active, comingSoon = false, children }: {
  label: string; displayValue: string; active: boolean; comingSoon?: boolean; children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  return (
    <div className="relative flex items-center border-b border-[#1a2438]" ref={ref}>
      <span className="shrink-0 px-3 py-2 text-[11px] text-gray-500 w-[120px] select-none leading-tight">
        {label}
      </span>
      {comingSoon ? (
        <span className="flex-1 px-2 py-2 text-[10px] text-gray-600 italic">Coming Soon</span>
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          className={[
            'flex-1 flex items-center justify-between px-2 py-2 text-[11px] font-medium text-left transition-colors min-w-0',
            active ? 'text-[#00d4aa]' : 'text-gray-300 hover:text-white',
          ].join(' ')}
        >
          <span className="truncate">{displayValue}</span>
          <svg className="w-3 h-3 opacity-40 shrink-0 ml-1" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {open && !comingSoon && (
        <div
          className="absolute left-0 top-full z-50 rounded-lg border border-[#2a3a58] shadow-2xl overflow-hidden"
          style={{ background: '#0d1b2e', minWidth: 240 }}
          onClick={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') setOpen(false) }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-3 px-3 py-1 border-b border-[#1a2438]" style={{ background: '#070f1c' }}>
      <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-[0.12em]">{title}</span>
    </div>
  )
}

// ─── Preset definitions ───────────────────────────────────────────────────────

const DTE_PRESETS = [
  { label: 'Near-term', sub: '7–21 days', min: 7, max: 21 },
  { label: 'Standard', sub: '21–45 days', min: 21, max: 45 },
  { label: 'Extended', sub: '45–60 days', min: 45, max: 60 },
]

const MCAP_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Micro ($300M+)', value: 3e8 },
  { label: 'Small ($1B+)', value: 1e9 },
  { label: 'Mid ($5B+)', value: 5e9 },
  { label: 'Large ($20B+)', value: 20e9 },
  { label: 'Mega ($100B+)', value: 100e9 },
]

const PE_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 10', value: 10 },
  { label: 'Under 15', value: 15 },
  { label: 'Under 20', value: 20 },
  { label: 'Under 30', value: 30 },
  { label: 'Under 50', value: 50 },
]

const FORWARD_PE_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 10', value: 10 },
  { label: 'Under 15', value: 15 },
  { label: 'Under 20', value: 20 },
  { label: 'Under 30', value: 30 },
]

const PEG_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 1 (Undervalued)', value: 1 },
  { label: 'Under 1.5', value: 1.5 },
  { label: 'Under 2', value: 2 },
]

const PB_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 1', value: 1 },
  { label: 'Under 2', value: 2 },
  { label: 'Under 3', value: 3 },
  { label: 'Under 5', value: 5 },
]

const PS_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 1', value: 1 },
  { label: 'Under 2', value: 2 },
  { label: 'Under 5', value: 5 },
  { label: 'Under 10', value: 10 },
]

const EV_EBITDA_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 8', value: 8 },
  { label: 'Under 10', value: 10 },
  { label: 'Under 15', value: 15 },
  { label: 'Under 20', value: 20 },
]

const DIV_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Over 1%', value: 0.01 },
  { label: 'Over 2%', value: 0.02 },
  { label: 'Over 3%', value: 0.03 },
  { label: 'Over 5%', value: 0.05 },
]

const MARGIN_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Positive', value: 0 },
  { label: 'Over 10%', value: 0.10 },
  { label: 'Over 20%', value: 0.20 },
  { label: 'Over 40%', value: 0.40 },
]

const ROE_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Over 10%', value: 0.10 },
  { label: 'Over 15%', value: 0.15 },
  { label: 'Over 20%', value: 0.20 },
  { label: 'Over 30%', value: 0.30 },
]

const ROA_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Over 5%', value: 0.05 },
  { label: 'Over 10%', value: 0.10 },
  { label: 'Over 15%', value: 0.15 },
]

const DE_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 0.5', value: 0.5 },
  { label: 'Under 1', value: 1 },
  { label: 'Under 2', value: 2 },
]

const CR_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Over 1', value: 1 },
  { label: 'Over 1.5', value: 1.5 },
  { label: 'Over 2', value: 2 },
]

const BETA_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 0.5 (Very low)', value: 0.5 },
  { label: 'Under 0.8 (Low)', value: 0.8 },
  { label: 'Under 1 (Market)', value: 1 },
  { label: 'Under 1.2 (Moderate)', value: 1.2 },
  { label: 'Under 1.5 (High)', value: 1.5 },
]

const RATING_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: '≤ 1.5 (Strong Buy)', value: 1.5 },
  { label: '≤ 2.0 (Buy)', value: 2.0 },
  { label: '≤ 2.5 (Buy/Hold)', value: 2.5 },
  { label: '≤ 3.0 (Hold)', value: 3.0 },
]

const SHORT_FLOAT_PRESETS = [
  { label: 'Any', value: undefined as number | undefined },
  { label: 'Under 5%', value: 0.05 },
  { label: 'Under 10%', value: 0.10 },
  { label: 'Under 20%', value: 0.20 },
]

const ALL_SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Consumer Staples', 'Energy', 'Industrials', 'Materials',
  'Real Estate', 'Utilities', 'Communication Services',
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function FilterRail({ params, onChange, onRun, watchlistMode, onWatchlistModeChange }: Props) {
  const [savedOpen, setSavedOpen] = useState(false)
  const savedRef = useRef<HTMLDivElement>(null)
  useClickOutside(savedRef, () => setSavedOpen(false))

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

  // ── Display values ────────────────────────────────────────────────────────

  const dteDisplay = (() => {
    const p = DTE_PRESETS.find(p => p.min === params.min_dte && p.max === params.max_dte)
    if (p) return p.label
    if (params.min_dte !== undefined || params.max_dte !== undefined)
      return `${params.min_dte ?? '?'}–${params.max_dte ?? '?'} days`
    return 'Any'
  })()

  const mcapDisplay = (() => {
    if (params.min_market_cap === undefined) return 'Any'
    const p = MCAP_PRESETS.find(p => p.value === params.min_market_cap)
    return p ? p.label : `$${((params.min_market_cap) / 1e9).toFixed(0)}B+`
  })()

  const sectorDisplay = selectedSectors.length === 0
    ? 'Any'
    : selectedSectors.length === 1 ? selectedSectors[0] : `${selectedSectors.length} sectors`

  const pct = (v?: number) => v !== undefined ? `${(v * 100).toFixed(0)}%` : ''

  // ── Active / reset ────────────────────────────────────────────────────────

  const activeCount = [
    params.min_dte, params.max_dte, params.min_market_cap, params.sectors,
    params.max_analyst_rating, params.max_pe, params.max_forward_pe, params.max_peg,
    params.max_price_to_book, params.max_price_to_sales, params.max_ev_to_ebitda,
    params.min_dividend_yield, params.min_gross_margin, params.min_operating_margin,
    params.min_net_margin, params.min_roe, params.min_roa, params.max_debt_to_equity,
    params.min_current_ratio, params.max_beta, params.max_short_float,
    params.tickers,
  ].filter(v => v !== undefined && v !== '').length

  function handleReset() {
    onChange({ min_dte: 21, max_dte: 45, min_market_cap: 5_000_000_000 })
  }

  function handleLoad(loaded: ScreenParams) {
    onChange(loaded); onRun(); setSavedOpen(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full" style={{ background: '#0a1628' }}>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a2438]">
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
            Filters
            {activeCount > 0 && (
              <span className="ml-1.5 text-[10px] font-medium bg-[#00d4aa]/20 text-[#00d4aa] rounded-full px-1.5 py-0.5">
                {activeCount}
              </span>
            )}
          </span>

          {/* Watchlist toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={() => onWatchlistModeChange(!watchlistMode)}
              className={`relative w-7 h-3.5 rounded-full transition-colors cursor-pointer ${watchlistMode ? 'bg-[#00d4aa]' : 'bg-[#2a3a58]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform shadow-sm ${watchlistMode ? 'translate-x-3.5' : ''}`} />
            </div>
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              Watchlist
              <span className="ml-1 text-[10px] font-medium bg-[#00d4aa]/20 text-[#00d4aa] rounded px-1">Pro</span>
            </span>
          </label>

          {/* Saved */}
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
          {activeCount > 0 && (
            <button onClick={handleReset} className="text-[11px] text-gray-500 hover:text-red-400 transition-colors px-2 py-1">
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

      {/* Filter grid — 3 columns, sectioned */}
      <div className="grid grid-cols-3 divide-x divide-[#1a2438]">

        {/* ── SECTION: Options ── */}
        <SectionHeader title="Options" />

        {/* DTE */}
        <FilterCell label="Days to Exp." displayValue={dteDisplay} active={params.min_dte !== undefined || params.max_dte !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Days to Expiration</p>
            {DTE_PRESETS.map(p => (
              <PresetRow
                key={p.label} label={p.label} sub={p.sub}
                selected={params.min_dte === p.min && params.max_dte === p.max}
                onClick={() => onChange({ ...params, min_dte: p.min, max_dte: p.max })}
              />
            ))}
          </div>
          <div className="border-t border-[#1a2438] px-4 py-2.5">
            <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-widest font-semibold">Custom Range</p>
            <div className="flex gap-2 items-center">
              <input type="number" value={params.min_dte ?? ''} placeholder="Min"
                className="w-16 bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
                onClick={e => e.stopPropagation()}
                onChange={e => onChange({ ...params, min_dte: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <span className="text-gray-600 text-xs">–</span>
              <input type="number" value={params.max_dte ?? ''} placeholder="Max"
                className="w-16 bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
                onClick={e => e.stopPropagation()}
                onChange={e => onChange({ ...params, max_dte: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
          </div>
        </FilterCell>

        {/* Beta */}
        <FilterCell label="Beta" displayValue={params.max_beta !== undefined ? `< ${params.max_beta}` : 'Any'} active={params.max_beta !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Beta (Volatility)</p>
            {BETA_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_beta === p.value}
                onClick={() => onChange({ ...params, max_beta: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< " value={params.max_beta} onChange={v => onChange({ ...params, max_beta: v })} placeholder="e.g. 1.3" />
        </FilterCell>

        {/* Analyst Rating */}
        <FilterCell label="Analyst Rating" displayValue={params.max_analyst_rating !== undefined ? `≤ ${params.max_analyst_rating}` : 'Any'} active={params.max_analyst_rating !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Rating (1=Buy · 5=Sell)</p>
            {RATING_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_analyst_rating === p.value}
                onClick={() => onChange({ ...params, max_analyst_rating: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="≤ " value={params.max_analyst_rating} onChange={v => onChange({ ...params, max_analyst_rating: v })} placeholder="e.g. 2.5" />
        </FilterCell>

        {/* ── SECTION: General ── */}
        <SectionHeader title="General" />

        {/* Sector */}
        <FilterCell label="Sector" displayValue={sectorDisplay} active={!!params.sectors}>
          <div className="py-1" style={{ minWidth: 260 }}>
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Sectors (multi-select)</p>
            {ALL_SECTORS.map(s => (
              <button key={s} onClick={e => { e.stopPropagation(); toggleSector(s) }}
                className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${selectedSectors.includes(s) ? 'text-[#00d4aa] bg-[#00d4aa]/10' : 'text-gray-300 hover:bg-[#1a2438] hover:text-white'}`}>
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${selectedSectors.includes(s) ? 'bg-[#00d4aa] border-[#00d4aa]' : 'border-[#2a3a58]'}`}>
                  {selectedSectors.includes(s) && (
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#0a1628" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {s}
              </button>
            ))}
            {selectedSectors.length > 0 && (
              <div className="border-t border-[#1a2438] mt-1 px-4 py-2">
                <button onClick={e => { e.stopPropagation(); onChange({ ...params, sectors: undefined }) }}
                  className="text-[10px] text-gray-500 hover:text-red-400 transition-colors">Clear sectors</button>
              </div>
            )}
          </div>
        </FilterCell>

        {/* Market Cap */}
        <FilterCell label="Market Cap" displayValue={mcapDisplay} active={params.min_market_cap !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Minimum Market Cap</p>
            {MCAP_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.min_market_cap === p.value}
                onClick={() => onChange({ ...params, min_market_cap: p.value })} />
            ))}
          </div>
        </FilterCell>

        {/* Custom Tickers */}
        <FilterCell
          label="Tickers"
          displayValue={watchlistMode ? 'Watchlist' : params.tickers ? params.tickers.split(',').slice(0, 2).join(', ') + (params.tickers.split(',').length > 2 ? '…' : '') : 'All'}
          active={!!(params.tickers && !watchlistMode)}
        >
          <div className="p-4" style={{ minWidth: 260 }} onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Custom Ticker List</p>
            <input type="text" placeholder="AAPL, MSFT, NVDA…"
              value={watchlistMode ? '' : (params.tickers ?? '')}
              disabled={watchlistMode}
              className="w-full bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] disabled:opacity-40"
              onChange={e => onChange({ ...params, tickers: e.target.value || undefined })} />
            <p className="text-[10px] text-gray-600 mt-1.5">Comma-separated. Overrides universe.</p>
          </div>
        </FilterCell>

        {/* ── SECTION: Valuation ── */}
        <SectionHeader title="Valuation" />

        {/* P/E */}
        <FilterCell label="P/E Ratio" displayValue={params.max_pe !== undefined ? `< ${params.max_pe}` : 'Any'} active={params.max_pe !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max P/E (Trailing)</p>
            {PE_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_pe === p.value}
                onClick={() => onChange({ ...params, max_pe: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< " value={params.max_pe} onChange={v => onChange({ ...params, max_pe: v })} placeholder="e.g. 25" />
        </FilterCell>

        {/* Forward P/E */}
        <FilterCell label="Forward P/E" displayValue={params.max_forward_pe !== undefined ? `< ${params.max_forward_pe}` : 'Any'} active={params.max_forward_pe !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Forward P/E</p>
            {FORWARD_PE_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_forward_pe === p.value}
                onClick={() => onChange({ ...params, max_forward_pe: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< " value={params.max_forward_pe} onChange={v => onChange({ ...params, max_forward_pe: v })} placeholder="e.g. 20" />
        </FilterCell>

        {/* PEG */}
        <FilterCell label="PEG Ratio" displayValue={params.max_peg !== undefined ? `< ${params.max_peg}` : 'Any'} active={params.max_peg !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max PEG Ratio</p>
            {PEG_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_peg === p.value}
                onClick={() => onChange({ ...params, max_peg: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< " value={params.max_peg} onChange={v => onChange({ ...params, max_peg: v })} placeholder="e.g. 1.5" />
        </FilterCell>

        {/* Price/Book */}
        <FilterCell label="Price / Book" displayValue={params.max_price_to_book !== undefined ? `< ${params.max_price_to_book}` : 'Any'} active={params.max_price_to_book !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Price/Book</p>
            {PB_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_price_to_book === p.value}
                onClick={() => onChange({ ...params, max_price_to_book: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< " value={params.max_price_to_book} onChange={v => onChange({ ...params, max_price_to_book: v })} placeholder="e.g. 3" />
        </FilterCell>

        {/* Price/Sales */}
        <FilterCell label="Price / Sales" displayValue={params.max_price_to_sales !== undefined ? `< ${params.max_price_to_sales}` : 'Any'} active={params.max_price_to_sales !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Price/Sales (TTM)</p>
            {PS_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_price_to_sales === p.value}
                onClick={() => onChange({ ...params, max_price_to_sales: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< " value={params.max_price_to_sales} onChange={v => onChange({ ...params, max_price_to_sales: v })} placeholder="e.g. 5" />
        </FilterCell>

        {/* EV/EBITDA */}
        <FilterCell label="EV / EBITDA" displayValue={params.max_ev_to_ebitda !== undefined ? `< ${params.max_ev_to_ebitda}` : 'Any'} active={params.max_ev_to_ebitda !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max EV/EBITDA</p>
            {EV_EBITDA_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_ev_to_ebitda === p.value}
                onClick={() => onChange({ ...params, max_ev_to_ebitda: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< " value={params.max_ev_to_ebitda} onChange={v => onChange({ ...params, max_ev_to_ebitda: v })} placeholder="e.g. 12" />
        </FilterCell>

        {/* Dividend Yield */}
        <FilterCell label="Div. Yield" displayValue={params.min_dividend_yield !== undefined ? `> ${pct(params.min_dividend_yield)}` : 'Any'} active={params.min_dividend_yield !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Min Dividend Yield</p>
            {DIV_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.min_dividend_yield === p.value}
                onClick={() => onChange({ ...params, min_dividend_yield: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="> % " value={params.min_dividend_yield !== undefined ? params.min_dividend_yield * 100 : undefined}
            onChange={v => onChange({ ...params, min_dividend_yield: v !== undefined ? v / 100 : undefined })} placeholder="e.g. 2" />
        </FilterCell>

        {/* ── SECTION: Profitability ── */}
        <SectionHeader title="Profitability" />

        {/* Gross Margin */}
        <FilterCell label="Gross Margin" displayValue={params.min_gross_margin !== undefined ? `> ${pct(params.min_gross_margin)}` : 'Any'} active={params.min_gross_margin !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Min Gross Margin</p>
            {MARGIN_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.min_gross_margin === p.value}
                onClick={() => onChange({ ...params, min_gross_margin: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="> % " value={params.min_gross_margin !== undefined ? params.min_gross_margin * 100 : undefined}
            onChange={v => onChange({ ...params, min_gross_margin: v !== undefined ? v / 100 : undefined })} placeholder="e.g. 40" />
        </FilterCell>

        {/* Operating Margin */}
        <FilterCell label="Oper. Margin" displayValue={params.min_operating_margin !== undefined ? `> ${pct(params.min_operating_margin)}` : 'Any'} active={params.min_operating_margin !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Min Operating Margin</p>
            {MARGIN_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.min_operating_margin === p.value}
                onClick={() => onChange({ ...params, min_operating_margin: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="> % " value={params.min_operating_margin !== undefined ? params.min_operating_margin * 100 : undefined}
            onChange={v => onChange({ ...params, min_operating_margin: v !== undefined ? v / 100 : undefined })} placeholder="e.g. 20" />
        </FilterCell>

        {/* Net Margin */}
        <FilterCell label="Net Margin" displayValue={params.min_net_margin !== undefined ? `> ${pct(params.min_net_margin)}` : 'Any'} active={params.min_net_margin !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Min Net Profit Margin</p>
            {MARGIN_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.min_net_margin === p.value}
                onClick={() => onChange({ ...params, min_net_margin: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="> % " value={params.min_net_margin !== undefined ? params.min_net_margin * 100 : undefined}
            onChange={v => onChange({ ...params, min_net_margin: v !== undefined ? v / 100 : undefined })} placeholder="e.g. 10" />
        </FilterCell>

        {/* ROE */}
        <FilterCell label="ROE" displayValue={params.min_roe !== undefined ? `> ${pct(params.min_roe)}` : 'Any'} active={params.min_roe !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Min Return on Equity</p>
            {ROE_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.min_roe === p.value}
                onClick={() => onChange({ ...params, min_roe: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="> % " value={params.min_roe !== undefined ? params.min_roe * 100 : undefined}
            onChange={v => onChange({ ...params, min_roe: v !== undefined ? v / 100 : undefined })} placeholder="e.g. 15" />
        </FilterCell>

        {/* ROA */}
        <FilterCell label="ROA" displayValue={params.min_roa !== undefined ? `> ${pct(params.min_roa)}` : 'Any'} active={params.min_roa !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Min Return on Assets</p>
            {ROA_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.min_roa === p.value}
                onClick={() => onChange({ ...params, min_roa: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="> % " value={params.min_roa !== undefined ? params.min_roa * 100 : undefined}
            onChange={v => onChange({ ...params, min_roa: v !== undefined ? v / 100 : undefined })} placeholder="e.g. 10" />
        </FilterCell>

        {/* EPS Growth — Coming Soon */}
        <FilterCell label="EPS Growth" displayValue="Any" active={false} comingSoon />

        {/* ── SECTION: Financial Health ── */}
        <SectionHeader title="Financial Health" />

        {/* Debt/Equity */}
        <FilterCell label="Debt / Equity" displayValue={params.max_debt_to_equity !== undefined ? `< ${params.max_debt_to_equity}` : 'Any'} active={params.max_debt_to_equity !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Debt/Equity</p>
            {DE_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_debt_to_equity === p.value}
                onClick={() => onChange({ ...params, max_debt_to_equity: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< " value={params.max_debt_to_equity} onChange={v => onChange({ ...params, max_debt_to_equity: v })} placeholder="e.g. 1.5" />
        </FilterCell>

        {/* Current Ratio */}
        <FilterCell label="Current Ratio" displayValue={params.min_current_ratio !== undefined ? `> ${params.min_current_ratio}` : 'Any'} active={params.min_current_ratio !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Min Current Ratio</p>
            {CR_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.min_current_ratio === p.value}
                onClick={() => onChange({ ...params, min_current_ratio: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="> " value={params.min_current_ratio} onChange={v => onChange({ ...params, min_current_ratio: v })} placeholder="e.g. 1.5" />
        </FilterCell>

        {/* Quick Ratio — Coming Soon */}
        <FilterCell label="Quick Ratio" displayValue="Any" active={false} comingSoon />

        {/* ── SECTION: Trading ── */}
        <SectionHeader title="Trading" />

        {/* Short Float */}
        <FilterCell label="Short Float" displayValue={params.max_short_float !== undefined ? `< ${pct(params.max_short_float)}` : 'Any'} active={params.max_short_float !== undefined}>
          <div className="py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Short Float</p>
            {SHORT_FLOAT_PRESETS.map(p => (
              <PresetRow key={p.label} label={p.label} selected={params.max_short_float === p.value}
                onClick={() => onChange({ ...params, max_short_float: p.value })} />
            ))}
          </div>
          <CustomNumericInput label="< % " value={params.max_short_float !== undefined ? params.max_short_float * 100 : undefined}
            onChange={v => onChange({ ...params, max_short_float: v !== undefined ? v / 100 : undefined })} placeholder="e.g. 10" />
        </FilterCell>

        {/* Avg Volume — Coming Soon */}
        <FilterCell label="Avg. Volume" displayValue="Any" active={false} comingSoon />

        {/* RSI — Coming Soon */}
        <FilterCell label="RSI (14)" displayValue="Any" active={false} comingSoon />

        {/* ── SECTION: Technical ── */}
        <SectionHeader title="Technical" />

        <FilterCell label="52W High/Low" displayValue="Any" active={false} comingSoon />
        <FilterCell label="SMA 50-Day" displayValue="Any" active={false} comingSoon />
        <FilterCell label="SMA 200-Day" displayValue="Any" active={false} comingSoon />

      </div>
    </div>
  )
}
