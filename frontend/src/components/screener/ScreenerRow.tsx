'use client'
import { ScreenerRow } from '@/lib/api'
import AccordionDetail from './AccordionDetail'
import WatchlistButton from './WatchlistButton'

function pct(n: number) { return `${(n * 100).toFixed(2)}%` }
function usd(n: number) { return `$${n.toFixed(2)}` }

interface Props {
  row: ScreenerRow
  expanded: boolean
  onToggle: () => void
  inWatchlist: boolean
  onWatchlistToggle: (ticker: string, add: boolean) => void
  colSpanCount: number
  isEven?: boolean
  visibleColKeys?: Set<string>
  showStrikeExpiry?: boolean
}

export default function ScreenerRowComponent({
  row,
  expanded,
  onToggle,
  inWatchlist,
  onWatchlistToggle,
  colSpanCount,
  isEven,
  visibleColKeys,
  showStrikeExpiry,
}: Props) {
  const c = row.best_call
  const m = c?.metrics

  // Default: show all columns if no visibility info provided
  const show = (key: string) => !visibleColKeys || visibleColKeys.has(key)

  const rowBg = expanded
    ? '#1a2d4a'
    : isEven
      ? '#111c2d'
      : '#0f1929'

  const rowBorder = '1px solid #162030'

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors"
        style={{
          background: rowBg,
          borderBottom: rowBorder,
        }}
        onMouseEnter={e => {
          if (!expanded) e.currentTarget.style.background = '#1a2438'
        }}
        onMouseLeave={e => {
          if (!expanded) e.currentTarget.style.background = rowBg
        }}
      >
        {/* Symbol */}
        {show('ticker') && (
          <td className="px-3 py-2.5 font-semibold text-sm whitespace-nowrap" style={{ color: '#00d4aa' }}>
            {row.ticker}
          </td>
        )}

        {/* Name */}
        {show('name') && (
          <td className="px-3 py-2.5 text-xs max-w-[160px] truncate" style={{ color: '#6a8ab0' }} title={row.name ?? undefined}>
            {row.name || '—'}
          </td>
        )}

        {/* Price */}
        {show('price') && (
          <td className="px-3 py-2.5 text-sm tabular-nums" style={{ color: '#c8d8e8' }}>
            {usd(row.price)}
          </td>
        )}

        {/* Static Yield */}
        {show('static_yield') && (
          <td className="px-3 py-2.5 text-sm tabular-nums font-medium" style={{ color: '#00d4aa' }}>
            {m ? pct(m.static_yield) : '—'}
          </td>
        )}

        {/* Ann. Static */}
        {show('ann_static') && (
          <td className="px-3 py-2.5 text-sm tabular-nums font-semibold" style={{ color: '#00d4aa' }}>
            {m ? pct(m.annualized_static) : '—'}
          </td>
        )}

        {/* If-Called */}
        {show('if_called') && (
          <td className="px-3 py-2.5 text-sm tabular-nums" style={{ color: '#7eb8d4' }}>
            {m ? pct(m.if_called_return) : '—'}
          </td>
        )}

        {/* Ann. If-Called */}
        {show('ann_if_called') && (
          <td className="px-3 py-2.5 text-sm tabular-nums font-medium" style={{ color: '#7eb8d4' }}>
            {m ? pct(m.annualized_if_called) : '—'}
          </td>
        )}

        {/* Cushion */}
        {show('cushion') && (
          <td className="px-3 py-2.5 text-sm tabular-nums" style={{ color: '#8a9ab0' }}>
            {m ? pct(m.downside_cushion) : '—'}
          </td>
        )}

        {/* DTE */}
        {show('dte') && (
          <td className="px-3 py-2.5 text-sm tabular-nums" style={{ color: '#8a9ab0' }}>
            {c ? c.dte : '—'}
          </td>
        )}

        {/* Strike / Expiry */}
        {showStrikeExpiry && (
          <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#6a8ab0' }}>
            {c ? (
              <>
                <span className="font-medium" style={{ color: '#8a9ab0' }}>${c.strike}</span>
                <span className="mx-1" style={{ color: '#2a3a58' }}>/</span>
                {c.expiry}
                {c.earnings_within_dte && (
                  <span
                    className="ml-1.5 text-amber-400"
                    title="Earnings date falls within this contract's expiration window"
                  >
                    &#9888;
                  </span>
                )}
              </>
            ) : '—'}
          </td>
        )}

        {/* Watchlist */}
        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
          <WatchlistButton ticker={row.ticker} inWatchlist={inWatchlist} onToggle={onWatchlistToggle} />
        </td>
      </tr>

      {expanded && c && m && (
        <tr>
          <td
            colSpan={colSpanCount}
            style={{
              background: '#0d1929',
              borderBottom: '1px solid #1a2d4a',
              borderTop: '1px solid #1a2d4a',
            }}
          >
            <div className="px-6 py-5">
              <AccordionDetail ticker={row.ticker} price={row.price} name={row.name} contract={c} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
