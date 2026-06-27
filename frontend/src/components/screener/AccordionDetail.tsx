'use client'
import { useState, useEffect } from 'react'
import { Contract, fetchContracts } from '@/lib/api'
import MetricCard from './MetricCard'

function pct(n: number) { return `${(n * 100).toFixed(2)}%` }
function usd(n: number) { return `$${n.toFixed(2)}` }

interface Props { ticker: string; price: number; name: string; contract: Contract }

export default function AccordionDetail({ ticker, price, name, contract }: Props) {
  const [chain, setChain] = useState<Contract[]>([])
  const [chainLoading, setChainLoading] = useState(true)
  const m = contract.metrics

  useEffect(() => {
    fetchContracts(ticker, 7, 60).then(data => { setChain(data); setChainLoading(false) })
  }, [ticker])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-white">{ticker}</span>
        {name && <span className="text-sm" style={{ color: '#6a8ab0' }}>{name}</span>}
        <span className="text-sm" style={{ color: '#3a5070' }}>&#xB7; {usd(price)}</span>
        {contract.earnings_within_dte && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium rounded px-2 py-0.5"
            style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            &#9888; Earnings before {contract.expiry}
          </span>
        )}
      </div>

      {/* Contract summary */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#3a5070' }}>
          Best call: ${contract.strike} strike &middot; expires {contract.expiry} &middot; {contract.dte} DTE &middot; premium {usd(contract.premium)}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Net Credit"
            value={usd(m.net_credit)}
            sub="per 100 shares"
            tooltip="Premium x 100 shares — cash received upfront when you sell the call."
          />
          <MetricCard
            label="Breakeven"
            value={usd(m.breakeven)}
            sub={`cushion ${pct(m.downside_cushion)}`}
            tooltip="Stock price at which you break even = current price minus premium."
          />
          <MetricCard
            label="If Flat (not called)"
            value={pct(m.static_yield)}
            sub={`${pct(m.annualized_static)} ann. (illus.)`}
            highlight
            tooltip="Return if the option expires worthless and you keep the shares. = premium / price."
          />
          <MetricCard
            label="If Called (assigned)"
            value={pct(m.if_called_return)}
            sub={`${pct(m.annualized_if_called)} ann. (illus.)`}
            highlight
            tooltip="Return if assigned at the strike price. Includes both premium and any capital gain or loss."
          />
        </div>
      </div>

      {/* Option chain mini-table */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#3a5070' }}>
          Available contracts (7&#x2013;60 DTE)
        </p>
        {chainLoading ? (
          <p className="text-xs" style={{ color: '#3a5070' }}>Loading chain...</p>
        ) : chain.length === 0 ? (
          <p className="text-xs" style={{ color: '#3a5070' }}>No liquid contracts found.</p>
        ) : (
          <div className="overflow-x-auto rounded" style={{ border: '1px solid #1a2d4a' }}>
            <table className="text-xs w-full" style={{ background: '#0a1628' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2d4a' }}>
                  {['Expiry', 'DTE', 'Strike', 'Premium', 'Static %', 'Ann. Static †', 'Earn.'].map(h => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 font-semibold uppercase tracking-widest text-[10px] whitespace-nowrap"
                      style={{ color: '#3a5070' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chain.slice(0, 15).map((c, i) => {
                  const isBest = c.expiry === contract.expiry && c.strike === contract.strike
                  return (
                    <tr
                      key={i}
                      style={{
                        background: isBest ? 'rgba(0,212,170,0.08)' : i % 2 === 0 ? '#0d1929' : '#0a1628',
                        borderBottom: '1px solid #162030',
                      }}
                    >
                      <td className="px-3 py-1.5" style={{ color: isBest ? '#00d4aa' : '#8a9ab0' }}>{c.expiry}</td>
                      <td className="px-3 py-1.5 tabular-nums" style={{ color: '#6a8ab0' }}>{c.dte}</td>
                      <td className="px-3 py-1.5 tabular-nums font-medium" style={{ color: '#8a9ab0' }}>${c.strike}</td>
                      <td className="px-3 py-1.5 tabular-nums" style={{ color: '#8a9ab0' }}>{usd(c.premium)}</td>
                      <td className="px-3 py-1.5 tabular-nums" style={{ color: '#00d4aa' }}>{pct(c.metrics.static_yield)}</td>
                      <td className="px-3 py-1.5 tabular-nums font-medium" style={{ color: '#00d4aa' }}>{pct(c.metrics.annualized_static)}</td>
                      <td className="px-3 py-1.5 text-center" style={{ color: '#f59e0b' }}>
                        {c.earnings_within_dte ? '⚠' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[11px] px-3 py-1.5" style={{ color: '#2a4060', borderTop: '1px solid #162030' }}>
              &#x2020; Illustrative. Assumes perfect repetition for 365 days.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
