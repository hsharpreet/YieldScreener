'use client'
import { useState } from 'react'

export interface ColumnDef { key: string; label: string; visible: boolean }

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'ticker', label: 'Symbol', visible: true },
  { key: 'name', label: 'Name', visible: true },
  { key: 'price', label: 'Price', visible: true },
  { key: 'net_credit', label: 'Net Credit ($)', visible: true },
  { key: 'static_yield', label: 'Static Yield', visible: true },
  { key: 'ann_static', label: 'Ann. Static †', visible: true },
  { key: 'if_called', label: 'If-Called', visible: true },
  { key: 'ann_if_called', label: 'Ann. If-Called †', visible: true },
  { key: 'cushion', label: 'Cushion', visible: true },
  { key: 'dte', label: 'DTE', visible: true },
  { key: 'delta', label: 'Delta', visible: true },
  { key: 'iv_rank', label: 'IV Rank', visible: true },
  { key: 'strike_expiry', label: 'Strike / Expiry', visible: true },
]

// v4: added delta + iv_rank columns (CC-22) — bump invalidates stale saved sets
const STORAGE_KEY = 'ys_columns_v4'

export function loadColumns(): ColumnDef[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as ColumnDef[]
  } catch { /* ignore */ }
  return DEFAULT_COLUMNS
}

export function saveColumns(cols: ColumnDef[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cols)) } catch { /* ignore */ }
}

interface Props { columns: ColumnDef[]; onChange: (cols: ColumnDef[]) => void }

export default function ColumnCustomizer({ columns, onChange }: Props) {
  const [open, setOpen] = useState(false)

  function toggle(key: string) {
    const next = columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c)
    saveColumns(next)
    onChange(next)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-medium rounded px-2.5 py-1 border transition-colors"
        style={{
          background: '#1a2438',
          borderColor: '#2a3a58',
          color: '#6a8ab0',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#00d4aa40'
          e.currentTarget.style.color = '#c8d8e8'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#2a3a58'
          e.currentTarget.style.color = '#6a8ab0'
        }}
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Columns
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 z-20 rounded-lg border shadow-2xl p-3 w-52"
          style={{ background: '#0d1b2e', borderColor: '#1a2d4a' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#3a5070' }}>
            Show / Hide Columns
          </p>
          {columns.map(col => (
            <label
              key={col.key}
              className="flex items-center gap-2 py-1 cursor-pointer text-xs transition-colors"
              style={{ color: col.visible ? '#c8d8e8' : '#4a6080' }}
            >
              <span
                className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                style={{
                  background: col.visible ? '#00d4aa' : 'transparent',
                  borderColor: col.visible ? '#00d4aa' : '#2a3a58',
                }}
                onClick={() => toggle(col.key)}
              >
                {col.visible && (
                  <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#0a1628" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span onClick={() => toggle(col.key)} className="flex-1">{col.label}</span>
            </label>
          ))}
          <button
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-center text-[11px] transition-colors py-1"
            style={{ color: '#00d4aa' }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
