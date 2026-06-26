'use client'
import { useState } from 'react'
import { ScreenerRow } from '@/lib/api'
import ScreenerRowComponent from './ScreenerRow'
import ColumnCustomizer, { ColumnDef, loadColumns, saveColumns } from './ColumnCustomizer'

type SortKey = 'ticker' | 'price' | 'static_yield' | 'ann_static' | 'if_called' | 'ann_if_called' | 'cushion' | 'dte'

interface ColDef { key: SortKey; label: string; title?: string; colKey: string }

const ALL_COLS: ColDef[] = [
  { key: 'ticker', label: 'Ticker', colKey: 'ticker' },
  { key: 'price', label: 'Price', colKey: 'price' },
  { key: 'static_yield', label: 'Static Yield', title: 'Premium ÷ stock price — income if not called away', colKey: 'static_yield' },
  { key: 'ann_static', label: 'Ann. Static †', title: 'Illustrative annualized static yield (naive 365/DTE)', colKey: 'ann_static' },
  { key: 'if_called', label: 'If-Called', title: 'Return including capital gain if assigned at strike', colKey: 'if_called' },
  { key: 'ann_if_called', label: 'Ann. If-Called †', title: 'Illustrative annualized if-called return (naive 365/DTE)', colKey: 'ann_if_called' },
  { key: 'cushion', label: 'Cushion', title: 'Downside cushion = premium ÷ price (breakeven distance)', colKey: 'cushion' },
  { key: 'dte', label: 'DTE', colKey: 'dte' },
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

interface Props {
  rows: ScreenerRow[]
  tier: 'free' | 'pro'
  total: number
  watchlist: Set<string>
  onWatchlistToggle: (ticker: string, add: boolean) => void
}

export default function ScreenerTable({ rows, tier, total, watchlist, onWatchlistToggle }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('ann_static')
  const [asc, setAsc] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [columns, setColumns] = useState<ColumnDef[]>(loadColumns)

  const visibleColKeys = new Set(columns.filter(c => c.visible).map(c => c.key))
  const visibleCols = ALL_COLS.filter(col => visibleColKeys.has(col.colKey))
  const showStrikeExpiry = visibleColKeys.has('strike_expiry')

  // Total header columns: visible data cols + Strike/Expiry (if visible) + watchlist star
  const colSpanCount = visibleCols.length + (showStrikeExpiry ? 1 : 0) + 1

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'ticker') return asc ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker)
    const diff = getValue(a, sortKey) - getValue(b, sortKey)
    return asc ? diff : -diff
  })

  function handleSort(key: SortKey) {
    if (key === sortKey) setAsc(a => !a)
    else { setSortKey(key); setAsc(false) }
  }

  function handleColumnsChange(cols: ColumnDef[]) {
    saveColumns(cols)
    setColumns(cols)
  }

  if (rows.length === 0) return (
    <p className="text-gray-500 py-8 text-center">No stocks matched the current filters.</p>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">
          {tier === 'free' && total > rows.length
            ? `Showing ${rows.length} of ${total} results (free tier)`
            : `${rows.length} result${rows.length !== 1 ? 's' : ''}`}
        </p>
        <ColumnCustomizer columns={columns} onChange={handleColumnsChange} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {visibleCols.map(col => (
                <th
                  key={col.key}
                  title={col.title}
                  onClick={() => handleSort(col.key as SortKey)}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer select-none hover:text-gray-900 whitespace-nowrap">
                  {col.label} {sortKey === col.key ? (asc ? '↑' : '↓') : ''}
                </th>
              ))}
              {showStrikeExpiry && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Strike / Expiry
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-8">
                <span className="sr-only">Watchlist</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(row => (
              <ScreenerRowComponent
                key={row.ticker}
                row={row}
                expanded={expanded === row.ticker}
                onToggle={() => setExpanded(expanded === row.ticker ? null : row.ticker)}
                inWatchlist={watchlist.has(row.ticker)}
                onWatchlistToggle={onWatchlistToggle}
                colSpanCount={colSpanCount}
              />
            ))}
            {tier === 'free' && total > rows.length && (
              <tr>
                <td colSpan={colSpanCount} className="px-4 py-4 text-center bg-gradient-to-b from-white to-gray-50 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-2">
                    Showing {rows.length} of {total} results.
                  </p>
                  <a
                    href="/signup"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded px-4 py-2 transition-colors">
                    Upgrade to Pro — see all {total} results
                  </a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">
          &#x2020; Annualized figures are illustrative. They assume identical trades repeat perfectly for a full year, which will not happen. Educational data only — not investment advice.
        </p>
      </div>
    </div>
  )
}
