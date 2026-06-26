'use client'
import { useState } from 'react'
import { ScreenerRow } from '@/lib/api'
import ScreenerRowComponent from './ScreenerRow'

type SortKey = 'ticker' | 'price' | 'static_yield' | 'ann_static' | 'if_called' | 'ann_if_called' | 'cushion' | 'dte'

interface ColDef { key: SortKey; label: string; title?: string }

const COLS: ColDef[] = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'price', label: 'Price' },
  { key: 'static_yield', label: 'Static Yield', title: 'Premium ÷ stock price — income if not called away' },
  { key: 'ann_static', label: 'Ann. Static †', title: 'Illustrative annualized static yield (naive 365/DTE)' },
  { key: 'if_called', label: 'If-Called', title: 'Return including capital gain if assigned at strike' },
  { key: 'ann_if_called', label: 'Ann. If-Called †', title: 'Illustrative annualized if-called return (naive 365/DTE)' },
  { key: 'cushion', label: 'Cushion', title: 'Downside cushion = premium ÷ price (breakeven distance)' },
  { key: 'dte', label: 'DTE' },
]

function getValue(row: ScreenerRow, key: SortKey): number {
  if (!row.best_call) return -Infinity
  const m = row.best_call.metrics
  switch (key) {
    case 'ticker': return 0
    case 'price': return row.price
    case 'static_yield': return m.static_yield
    case 'ann_static': return m.annualized_static
    case 'if_called': return m.if_called_return
    case 'ann_if_called': return m.annualized_if_called
    case 'cushion': return m.downside_cushion
    case 'dte': return row.best_call.dte
  }
}

export default function ScreenerTable({ rows }: { rows: ScreenerRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('ann_static')
  const [asc, setAsc] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'ticker') return asc ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker)
    const diff = getValue(a, sortKey) - getValue(b, sortKey)
    return asc ? diff : -diff
  })

  function handleSort(key: SortKey) {
    if (key === sortKey) setAsc(a => !a)
    else { setSortKey(key); setAsc(false) }
  }

  if (rows.length === 0) return <p className="text-gray-500 py-8 text-center">No stocks matched the current filters.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {COLS.map(col => (
              <th key={col.key}
                title={col.title}
                onClick={() => handleSort(col.key)}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer select-none hover:text-gray-900 whitespace-nowrap">
                {col.label} {sortKey === col.key ? (asc ? '↑' : '↓') : ''}
              </th>
            ))}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Strike / Expiry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(row => (
            <ScreenerRowComponent
              key={row.ticker}
              row={row}
              expanded={expanded === row.ticker}
              onToggle={() => setExpanded(expanded === row.ticker ? null : row.ticker)}
            />
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">
        † Annualized figures are illustrative. They assume identical trades repeat perfectly for a full year, which will not happen. Educational data only — not investment advice.
      </p>
    </div>
  )
}
