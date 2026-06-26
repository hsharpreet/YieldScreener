'use client'
import { useState } from 'react'

export interface ColumnDef { key: string; label: string; visible: boolean }

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'ticker', label: 'Ticker', visible: true },
  { key: 'price', label: 'Price', visible: true },
  { key: 'static_yield', label: 'Static Yield', visible: true },
  { key: 'ann_static', label: 'Ann. Static †', visible: true },
  { key: 'if_called', label: 'If-Called', visible: true },
  { key: 'ann_if_called', label: 'Ann. If-Called †', visible: true },
  { key: 'cushion', label: 'Cushion', visible: true },
  { key: 'dte', label: 'DTE', visible: true },
  { key: 'strike_expiry', label: 'Strike / Expiry', visible: true },
]

const STORAGE_KEY = 'ys_columns'

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
        className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">
        Columns &#9881;
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-10 bg-white border border-gray-200 rounded shadow-lg p-3 w-48">
          <p className="text-xs font-semibold text-gray-500 mb-2">Show / hide columns</p>
          {columns.map(col => (
            <label key={col.key} className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-gray-700">
              <input
                type="checkbox"
                checked={col.visible}
                onChange={() => toggle(col.key)}
                className="rounded" />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
