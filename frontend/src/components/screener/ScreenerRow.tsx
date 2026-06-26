'use client'
import { ScreenerRow } from '@/lib/api'
import AccordionDetail from './AccordionDetail'

function pct(n: number) { return `${(n * 100).toFixed(2)}%` }
function usd(n: number) { return `$${n.toFixed(2)}` }

interface Props { row: ScreenerRow; expanded: boolean; onToggle: () => void }

export default function ScreenerRowComponent({ row, expanded, onToggle }: Props) {
  const c = row.best_call
  const m = c?.metrics

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition-colors ${expanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
        <td className="px-4 py-3 font-semibold text-blue-700">{row.ticker}</td>
        <td className="px-4 py-3 text-gray-700">{usd(row.price)}</td>
        <td className="px-4 py-3 text-gray-700">{m ? pct(m.static_yield) : '—'}</td>
        <td className="px-4 py-3 font-medium text-green-700">{m ? pct(m.annualized_static) : '—'}</td>
        <td className="px-4 py-3 text-gray-700">{m ? pct(m.if_called_return) : '—'}</td>
        <td className="px-4 py-3 font-medium text-green-700">{m ? pct(m.annualized_if_called) : '—'}</td>
        <td className="px-4 py-3 text-gray-700">{m ? pct(m.downside_cushion) : '—'}</td>
        <td className="px-4 py-3 text-gray-700">{c ? c.dte : '—'}</td>
        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
          {c ? `$${c.strike} / ${c.expiry}` : '—'}
          {c?.earnings_within_dte && <span className="ml-1 text-amber-600" title="Earnings fall within this contract's expiration">⚠</span>}
        </td>
      </tr>
      {expanded && c && m && (
        <tr>
          <td colSpan={9} className="bg-gray-50 border-t border-gray-100 px-4 py-4">
            <AccordionDetail ticker={row.ticker} price={row.price} name={row.name} contract={c} />
          </td>
        </tr>
      )}
    </>
  )
}
