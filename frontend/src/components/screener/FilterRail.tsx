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

// ─── Dropdown wrapper ────────────────────────────────────────────────────────

interface DropdownProps {
  label: string
  active?: boolean
  children: React.ReactNode
}

function FilterDropdown({ label, active, children }: DropdownProps) {
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap',
          active
            ? 'bg-[#00d4aa]/20 border-[#00d4aa]/60 text-[#00d4aa]'
            : 'bg-[#1a2438] border-[#2a3a58] text-gray-300 hover:border-[#00d4aa]/40 hover:text-white',
        ].join(' ')}
      >
        {label}
        <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-lg border border-[#2a3a58] shadow-2xl overflow-hidden"
          style={{ background: '#0d1b2e', minWidth: 220 }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Preset option row inside a dropdown ─────────────────────────────────────

interface PresetOptionProps {
  label: string
  sub?: string
  selected: boolean
  onClick: () => void
}

function PresetOption({ label, sub, selected, onClick }: PresetOptionProps) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className={[
        'w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between gap-3',
        selected
          ? 'bg-[#00d4aa]/15 text-[#00d4aa]'
          : 'text-gray-300 hover:bg-[#1a2438] hover:text-white',
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

// ─── Active filter chip ───────────────────────────────────────────────────────

interface ChipProps {
  label: string
  onRemove: () => void
}

function ActiveChip({ label, onRemove }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-1 bg-[#00d4aa]/15 border border-[#00d4aa]/40 text-[#00d4aa] rounded px-2 py-0.5 text-xs font-medium">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-white transition-colors leading-none"
        aria-label={`Remove ${label} filter`}
      >
        &#x2715;
      </button>
    </span>
  )
}

// ─── DTE preset definitions ───────────────────────────────────────────────────

const DTE_PRESETS = [
  { label: 'Near-term', sub: '7–21 days', min: 7, max: 21 },
  { label: 'Standard', sub: '21–45 days', min: 21, max: 45 },
  { label: 'Extended', sub: '45–60 days', min: 45, max: 60 },
]

// ─── MarketCap preset definitions ────────────────────────────────────────────

const MCAP_PRESETS = [
  { label: 'Small-cap', sub: '$1B+', value: 1e9 },
  { label: 'Mid-cap', sub: '$5B+', value: 5e9 },
  { label: 'Large-cap', sub: '$20B+', value: 20e9 },
  { label: 'Mega-cap', sub: '$100B+', value: 100e9 },
]

// ─── P/E preset definitions ───────────────────────────────────────────────────

const PE_PRESETS = [
  { label: 'Any', sub: '', value: undefined as number | undefined },
  { label: 'Very Low', sub: '≤ 5', value: 5 },
  { label: 'Low', sub: '≤ 15', value: 15 },
  { label: 'Moderate', sub: '≤ 25', value: 25 },
  { label: 'High', sub: '≤ 35', value: 35 },
  { label: 'Very High', sub: '≤ 50', value: 50 },
]

// ─── Beta preset definitions ──────────────────────────────────────────────────

const BETA_PRESETS = [
  { label: 'Any', sub: '', value: undefined as number | undefined },
  { label: 'Low risk', sub: '≤ 0.8', value: 0.8 },
  { label: 'Moderate', sub: '≤ 1.2', value: 1.2 },
  { label: 'High', sub: '≤ 1.5', value: 1.5 },
]

// ─── Sector list ──────────────────────────────────────────────────────────────

const ALL_SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Industrials',
  'Materials',
  'Real Estate',
  'Utilities',
  'Communication Services',
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function FilterRail({ params, onChange, onRun, watchlistMode, onWatchlistModeChange }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) setSavedOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Derive display labels ────────────────────────────────────────────────

  function dteLabelFor(minDte: number | undefined, maxDte: number | undefined): string | null {
    if (minDte === undefined && maxDte === undefined) return null
    const preset = DTE_PRESETS.find(p => p.min === minDte && p.max === maxDte)
    if (preset) return `DTE: ${preset.label}`
    return `DTE: ${minDte ?? '?'}–${maxDte ?? '?'}`
  }

  function mcapLabelFor(minMcap: number | undefined): string | null {
    if (minMcap === undefined) return null
    const preset = MCAP_PRESETS.find(p => p.value === minMcap)
    if (preset) return `Mkt Cap: ${preset.label}`
    return `Mkt Cap: $${(minMcap / 1e9).toFixed(0)}B+`
  }

  function peLabelFor(maxPe: number | undefined): string | null {
    if (maxPe === undefined) return null
    return `P/E ≤ ${maxPe}`
  }

  function betaLabelFor(maxBeta: number | undefined): string | null {
    if (maxBeta === undefined) return null
    return `Beta ≤ ${maxBeta}`
  }

  function sectorLabelFor(sectors: string | undefined): string | null {
    if (!sectors) return null
    const list = sectors.split(',').map(s => s.trim()).filter(Boolean)
    if (list.length === 0) return null
    if (list.length === 1) return `Sector: ${list[0]}`
    return `Sectors: ${list.length}`
  }

  // ── Active chips ──────────────────────────────────────────────────────────

  const activeChips: { label: string; onRemove: () => void }[] = []

  const dteChip = dteLabelFor(params.min_dte, params.max_dte)
  if (dteChip) activeChips.push({ label: dteChip, onRemove: () => onChange({ ...params, min_dte: undefined, max_dte: undefined }) })

  const mcapChip = mcapLabelFor(params.min_market_cap)
  if (mcapChip) activeChips.push({ label: mcapChip, onRemove: () => onChange({ ...params, min_market_cap: undefined }) })

  const peChip = peLabelFor(params.max_pe)
  if (peChip) activeChips.push({ label: peChip, onRemove: () => onChange({ ...params, max_pe: undefined }) })

  const betaChip = betaLabelFor(params.max_beta)
  if (betaChip) activeChips.push({ label: betaChip, onRemove: () => onChange({ ...params, max_beta: undefined }) })

  const sectorChip = sectorLabelFor(params.sectors)
  if (sectorChip) activeChips.push({ label: sectorChip, onRemove: () => onChange({ ...params, sectors: undefined }) })

  if (params.max_peg !== undefined) activeChips.push({ label: `PEG ≤ ${params.max_peg}`, onRemove: () => onChange({ ...params, max_peg: undefined }) })
  if (params.min_roe !== undefined) activeChips.push({ label: `ROE ≥ ${(params.min_roe * 100).toFixed(0)}%`, onRemove: () => onChange({ ...params, min_roe: undefined }) })
  if (params.max_analyst_rating !== undefined) activeChips.push({ label: `Rating ≤ ${params.max_analyst_rating}`, onRemove: () => onChange({ ...params, max_analyst_rating: undefined }) })
  if (params.tickers && !watchlistMode) activeChips.push({ label: `Tickers: custom`, onRemove: () => onChange({ ...params, tickers: undefined }) })

  // ── Sector toggle helper ──────────────────────────────────────────────────

  function toggleSector(sector: string) {
    const current = params.sectors ? params.sectors.split(',').map(s => s.trim()).filter(Boolean) : []
    const next = current.includes(sector)
      ? current.filter(s => s !== sector)
      : [...current, sector]
    onChange({ ...params, sectors: next.length > 0 ? next.join(', ') : undefined })
  }

  const selectedSectors = params.sectors ? params.sectors.split(',').map(s => s.trim()).filter(Boolean) : []

  function handleLoad(loaded: ScreenParams) {
    onChange(loaded)
    onRun()
  }

  // ── DTE manual inputs state ───────────────────────────────────────────────

  const dtePresetActive = DTE_PRESETS.some(p => p.min === params.min_dte && p.max === params.max_dte)

  return (
    <div className="w-full" style={{ background: '#0f1724' }}>
      {/* Filter bar */}
      <div
        className="border-b border-[#1a2438] px-4 py-3"
        style={{ background: '#0a1628' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* DTE dropdown */}
          <FilterDropdown
            label={dteLabelFor(params.min_dte, params.max_dte) ?? 'DTE'}
            active={params.min_dte !== undefined || params.max_dte !== undefined}
          >
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Days to Expiration</p>
              {DTE_PRESETS.map(p => (
                <PresetOption
                  key={p.label}
                  label={p.label}
                  sub={p.sub}
                  selected={params.min_dte === p.min && params.max_dte === p.max}
                  onClick={() => onChange({ ...params, min_dte: p.min, max_dte: p.max })}
                />
              ))}
              <div className="border-t border-[#1a2438] mt-1 pt-2 px-4 pb-3">
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
          </FilterDropdown>

          {/* Market Cap dropdown */}
          <FilterDropdown
            label={mcapLabelFor(params.min_market_cap) ?? 'Mkt Cap'}
            active={params.min_market_cap !== undefined}
          >
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Minimum Market Cap</p>
              <PresetOption
                label="Any"
                sub=""
                selected={params.min_market_cap === undefined}
                onClick={() => onChange({ ...params, min_market_cap: undefined })}
              />
              {MCAP_PRESETS.map(p => (
                <PresetOption
                  key={p.label}
                  label={p.label}
                  sub={p.sub}
                  selected={params.min_market_cap === p.value}
                  onClick={() => onChange({ ...params, min_market_cap: p.value })}
                />
              ))}
            </div>
          </FilterDropdown>

          {/* P/E dropdown */}
          <FilterDropdown
            label={peLabelFor(params.max_pe) ?? 'P/E Ratio'}
            active={params.max_pe !== undefined}
          >
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max P/E Ratio</p>
              {PE_PRESETS.map(p => (
                <PresetOption
                  key={p.label}
                  label={p.label}
                  sub={p.sub}
                  selected={params.max_pe === p.value}
                  onClick={() => onChange({ ...params, max_pe: p.value })}
                />
              ))}
            </div>
          </FilterDropdown>

          {/* Beta dropdown */}
          <FilterDropdown
            label={betaLabelFor(params.max_beta) ?? 'Beta'}
            active={params.max_beta !== undefined}
          >
            <div className="py-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Max Beta (Volatility)</p>
              {BETA_PRESETS.map(p => (
                <PresetOption
                  key={p.label}
                  label={p.label}
                  sub={p.sub}
                  selected={params.max_beta === p.value}
                  onClick={() => onChange({ ...params, max_beta: p.value })}
                />
              ))}
            </div>
          </FilterDropdown>

          {/* Sector dropdown */}
          <FilterDropdown
            label={sectorLabelFor(params.sectors) ?? 'Sector'}
            active={!!params.sectors}
          >
            <div className="py-1" style={{ minWidth: 240 }}>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Sectors (multi-select)</p>
              {ALL_SECTORS.map(sector => (
                <button
                  key={sector}
                  onClick={e => { e.stopPropagation(); toggleSector(sector) }}
                  className={[
                    'w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors',
                    selectedSectors.includes(sector)
                      ? 'text-[#00d4aa] bg-[#00d4aa]/10'
                      : 'text-gray-300 hover:bg-[#1a2438] hover:text-white',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                      selectedSectors.includes(sector)
                        ? 'bg-[#00d4aa] border-[#00d4aa]'
                        : 'border-[#2a3a58]',
                    ].join(' ')}
                  >
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
          </FilterDropdown>

          {/* More Filters dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(o => !o)}
              className={[
                'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap',
                (params.max_peg !== undefined || params.min_roe !== undefined || params.max_analyst_rating !== undefined || (params.tickers && !watchlistMode))
                  ? 'bg-[#00d4aa]/20 border-[#00d4aa]/60 text-[#00d4aa]'
                  : 'bg-[#1a2438] border-[#2a3a58] text-gray-300 hover:border-[#00d4aa]/40 hover:text-white',
              ].join(' ')}
            >
              More Filters
              <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {moreOpen && (
              <div
                className="absolute left-0 top-full mt-1 z-50 rounded-lg border border-[#2a3a58] shadow-2xl p-4 space-y-3"
                style={{ background: '#0d1b2e', minWidth: 280 }}
              >
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Advanced Filters</p>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max PEG Ratio</label>
                  <input
                    type="number"
                    value={params.max_peg ?? ''}
                    placeholder="Any"
                    min={0}
                    step={0.1}
                    className="w-full bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
                    onClick={e => e.stopPropagation()}
                    onChange={e => onChange({ ...params, max_peg: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min ROE %</label>
                  <input
                    type="number"
                    value={params.min_roe !== undefined ? (params.min_roe * 100).toFixed(0) : ''}
                    placeholder="Any (e.g. 10 = 10%)"
                    min={0}
                    step={1}
                    className="w-full bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
                    onClick={e => e.stopPropagation()}
                    onChange={e => onChange({ ...params, min_roe: e.target.value === '' ? undefined : Number(e.target.value) / 100 })}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Max Analyst Rating
                    <span className="text-gray-600 ml-1">(1=Strong Buy · 5=Sell)</span>
                  </label>
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.5}
                      value={params.max_analyst_rating ?? 5}
                      className="w-full accent-[#00d4aa]"
                      onClick={e => e.stopPropagation()}
                      onChange={e => onChange({ ...params, max_analyst_rating: Number(e.target.value) })}
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>Strong Buy</span>
                      <span className="text-[#00d4aa] font-medium">{params.max_analyst_rating ?? '—'}</span>
                      <span>Sell</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Custom Tickers</label>
                  <input
                    type="text"
                    placeholder="AAPL, MSFT, NVDA…"
                    value={watchlistMode ? '' : (params.tickers ?? '')}
                    disabled={watchlistMode}
                    className="w-full bg-[#1a2438] border border-[#2a3a58] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={e => e.stopPropagation()}
                    onChange={e => onChange({ ...params, tickers: e.target.value || undefined })}
                  />
                </div>

                <button
                  onClick={e => { e.stopPropagation(); setMoreOpen(false) }}
                  className="w-full text-center text-xs text-[#00d4aa] hover:text-white py-1 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Saved Screeners dropdown */}
          <div className="relative" ref={savedRef}>
            <button
              onClick={() => setSavedOpen(o => !o)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border border-[#2a3a58] bg-[#1a2438] text-gray-300 hover:border-[#00d4aa]/40 hover:text-white transition-colors whitespace-nowrap"
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
                <SavedScreeners currentParams={params} onLoad={p => { handleLoad(p); setSavedOpen(false) }} />
              </div>
            )}
          </div>

          {/* Watchlist toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer ml-1">
            <div
              onClick={() => onWatchlistModeChange(!watchlistMode)}
              className={[
                'relative w-8 h-4 rounded-full transition-colors cursor-pointer',
                watchlistMode ? 'bg-[#00d4aa]' : 'bg-[#2a3a58]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm',
                  watchlistMode ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')}
              />
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              Watchlist
              <span className="ml-1 text-[10px] font-medium bg-[#00d4aa]/20 text-[#00d4aa] rounded px-1">Pro</span>
            </span>
          </label>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Reset */}
          {activeChips.length > 0 && (
            <button
              onClick={() => onChange({ min_dte: undefined, max_dte: undefined })}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1.5 whitespace-nowrap"
            >
              Reset
            </button>
          )}

          {/* Run Screen */}
          <button
            onClick={onRun}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap"
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

        {/* Active chips row */}
        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold shrink-0">Active:</span>
            {activeChips.map(chip => (
              <ActiveChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
