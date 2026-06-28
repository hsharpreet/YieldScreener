'use client'
import { useState } from 'react'
import { ScreenerRow } from '@/lib/api'
import ScreenerRowComponent from './ScreenerRow'
import ColumnCustomizer, { ColumnDef, loadColumns, saveColumns } from './ColumnCustomizer'

type SortKey = 'ticker' | 'name' | 'price' | 'net_credit' | 'static_yield' | 'ann_static' | 'if_called' | 'ann_if_called' | 'cushion' | 'dte'

interface ColDef { key: SortKey; label: string; title?: string; colKey: string }

const ALL_COLS: ColDef[] = [
  { key: 'ticker', label: 'Symbol', colKey: 'ticker' },
  { key: 'name', label: 'Name', colKey: 'name' },
  { key: 'price', label: 'Price', colKey: 'price' },
  { key: 'net_credit', label: 'Net Credit ($)', title: 'Cash collected per contract = premium × 100 shares', colKey: 'net_credit' },
  { key: 'static_yield', label: 'Static Yield', title: 'Premium ÷ stock price — income if not called away', colKey: 'static_yield' },
  { key: 'ann_static', label: 'Ann. Static †', title: 'Illustrative annualized static yield (naive 365/DTE)', colKey: 'ann_static' },
  { key: 'if_called', label: 'If-Called', title: 'Return including capital gain if assigned at strike', colKey: 'if_called' },
  { key: 'ann_if_called', label: 'Ann. If-Called †', title: 'Illustrative annualized if-called return (naive 365/DTE)', colKey: 'ann_if_called' },
  { key: 'cushion', label: 'Cushion', title: 'Downside cushion = premium ÷ price (breakeven distance)', colKey: 'cushion' },
  { key: 'dte', label: 'DTE', title: 'Days to expiration of the best available contract', colKey: 'dte' },
]

function getValue(row: ScreenerRow, key: SortKey): number {
  if (!row.best_call) return -Infinity
  const m = row.best_call.metrics
  switch (key) {
    case 'ticker': return 0
    case 'name': return 0
    case 'price': return row.price
    case 'net_credit': return m.net_credit
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

// Sort caret
function SortIcon({ dir }: { dir: 'asc' | 'desc' | null }) {
  if (!dir) return <span className="ml-1 text-gray-700">&#8597;</span>
  return (
    <span className="ml-1" style={{ color: '#00d4aa' }}>
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

export default function ScreenerTable({ rows, tier, total, watchlist, onWatchlistToggle }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('ann_static')
  const [asc, setAsc] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [columns, setColumns] = useState<ColumnDef[]>(loadColumns)

  const visibleColKeys = new Set(columns.filter(c => c.visible).map(c => c.key))
  const visibleCols = ALL_COLS.filter(col => visibleColKeys.has(col.colKey))
  const showStrikeExpiry = visibleColKeys.has('strike_expiry')

  // colspan for accordion: visible data cols + strike/expiry (if shown) + watchlist col
  const colSpanCount = visibleCols.length + (showStrikeExpiry ? 1 : 0) + 1

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'ticker') return asc ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker)
    if (sortKey === 'name') return asc ? (a.name ?? '').localeCompare(b.name ?? '') : (b.name ?? '').localeCompare(a.name ?? '')
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
    <p className="py-8 text-center text-sm" style={{ color: '#4a5568' }}>No stocks matched the current filters.</p>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs" style={{ color: '#4a6080' }}>
          {tier === 'free' && total > rows.length
            ? `Showing ${rows.length} of ${total} results (free tier)`
            : `${rows.length} result${rows.length !== 1 ? 's' : ''}`}
        </p>
        <ColumnCustomizer columns={columns} onChange={handleColumnsChange} />
      </div>

      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #1a2438' }}>
        <table className="min-w-full text-sm" style={{ background: '#111c2d' }}>
          <thead style={{ background: '#0a1628', borderBottom: '1px solid #1a2438' }}>
            <tr>
              {visibleCols.map(col => (
                <th
                  key={col.key}
                  title={col.title}
                  onClick={() => handleSort(col.key as SortKey)}
                  className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap transition-colors"
                  style={{ color: sortKey === col.key ? '#00d4aa' : '#4a6080' }}
                >
                  {col.label}
                  <SortIcon dir={sortKey === col.key ? (asc ? 'asc' : 'desc') : null} />
                </th>
              ))}
              {showStrikeExpiry && (
                <th
                  className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: '#4a6080' }}
                >
                  Strike / Expiry
                </th>
              )}
              <th className="px-3 py-2.5 w-8">
                <span className="sr-only">Watchlist</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <ScreenerRowComponent
                key={row.ticker}
                row={row}
                expanded={expanded === row.ticker}
                onToggle={() => setExpanded(expanded === row.ticker ? null : row.ticker)}
                inWatchlist={watchlist.has(row.ticker)}
                onWatchlistToggle={onWatchlistToggle}
                colSpanCount={colSpanCount}
                isEven={idx % 2 === 0}
                visibleColKeys={visibleColKeys}
                showStrikeExpiry={showStrikeExpiry}
              />
            ))}
            {tier === 'free' && total > rows.length && (
              <tr>
                <td
                  colSpan={colSpanCount}
                  className="px-4 py-5 text-center"
                  style={{ background: 'linear-gradient(to bottom, #111c2d, #0a1628)', borderTop: '1px solid #1a2438' }}
                >
                  <p className="text-sm mb-3" style={{ color: '#6a8ab0' }}>
                    Showing {rows.length} of {total} results.
                  </p>
                  <a
                    href="/signup"
                    className="inline-block text-sm font-semibold rounded px-5 py-2 transition-colors"
                    style={{ background: '#00d4aa', color: '#0a1628' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#00bfa0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#00d4aa')}
                  >
                    Upgrade to Pro — see all {total} results
                  </a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p
          className="text-[11px] px-3 py-2"
          style={{ color: '#3a5070', borderTop: '1px solid #1a2438', background: '#0a1628' }}
        >
          &#x2020; Annualized figures are illustrative. They assume identical trades repeat perfectly for a full year, which will not happen. Educational data only — not investment advice.
        </p>
      </div>
    </div>
  )
}
