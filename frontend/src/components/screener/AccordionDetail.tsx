'use client'
import { useState, useEffect, useRef } from 'react'
import { Contract, fetchContracts } from '@/lib/api'
import MetricCard from './MetricCard'

function pct(n: number) { return `${(n * 100).toFixed(2)}%` }
function usd(n: number) { return `$${n.toFixed(2)}` }
function netCredit(n: number) { return `$${(n).toFixed(0)}` }

const POLL_INTERVAL_MS = 30_000  // refresh every 30 s while accordion is open

interface Props { ticker: string; price: number; name: string; contract: Contract }

// Sort: OTM first (strike ≥ price), grouped by expiry ascending, then strike ascending within expiry.
// ITM contracts are appended at the end (sorted by strike desc so nearest-ATM ITM appears first).
function sortChain(contracts: Contract[], price: number, showItm: boolean): Contract[] {
  const otm = contracts
    .filter(c => c.strike >= price)
    .sort((a, b) => a.expiry.localeCompare(b.expiry) || a.strike - b.strike)
  if (!showItm) return otm
  const itm = contracts
    .filter(c => c.strike < price)
    .sort((a, b) => a.expiry.localeCompare(b.expiry) || b.strike - a.strike)
  return [...otm, ...itm]
}

export default function AccordionDetail({ ticker, price, name, contract }: Props) {
  const [chain, setChain] = useState<Contract[]>([])
  const [chainLoading, setChainLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [showItm, setShowItm] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const m = contract.metrics

  async function refresh() {
    const data = await fetchContracts(ticker, 7, 60)
    setChain(data)
    setChainLoading(false)
    setLastUpdated(new Date())
    setSecondsAgo(0)
  }

  // Initial load + poll while open
  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  // Count-up "X s ago" ticker
  useEffect(() => {
    if (!lastUpdated) return
    const t = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [lastUpdated])

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
        {lastUpdated && !chainLoading && (
          <span className="ml-auto text-[10px] tabular-nums" style={{ color: '#2a4060' }}>
            updated {secondsAgo}s ago · refreshes every 30s
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
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#3a5070' }}>
            Available contracts (7&#x2013;60 DTE) — OTM first, grouped by expiry
          </p>
          <button
            onClick={() => setShowItm(s => !s)}
            className="text-[10px] px-2 py-0.5 rounded border transition-colors"
            style={{
              color: showItm ? '#0a1628' : '#6a8ab0',
              background: showItm ? '#00d4aa' : 'transparent',
              borderColor: showItm ? '#00d4aa' : '#2a3a58',
            }}
          >
            {showItm ? 'Hide ITM' : 'Show ITM'}
          </button>
        </div>
        {chainLoading ? (
          <p className="text-xs" style={{ color: '#3a5070' }}>Loading chain...</p>
        ) : chain.length === 0 ? (
          <p className="text-xs" style={{ color: '#3a5070' }}>No liquid contracts found.</p>
        ) : (() => {
          const sorted = sortChain(chain, price, showItm)
          let lastExpiry = ''
          return (
            <div className="overflow-x-auto rounded" style={{ border: '1px solid #1a2d4a' }}>
              <table className="text-xs w-full" style={{ background: '#0a1628' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a2d4a' }}>
                    {['Expiry / DTE', 'Strike', 'Net Credit', 'Premium', 'Static %', 'Ann. Static †', 'If-Called $', 'Earn.'].map(h => (
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
                  {sorted.map((c, i) => {
                    const isBest = c.expiry === contract.expiry && c.strike === contract.strike
                    const isItm = c.strike < price
                    const showGroupHeader = c.expiry !== lastExpiry
                    if (showGroupHeader) lastExpiry = c.expiry
                    return [
                      showGroupHeader && (
                        <tr key={`hdr-${c.expiry}`} style={{ background: '#07101e', borderBottom: '1px solid #1a2d4a' }}>
                          <td colSpan={8} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#2a5070' }}>
                            {c.expiry} &mdash; {c.dte} DTE
                          </td>
                        </tr>
                      ),
                      <tr
                        key={i}
                        style={{
                          background: isBest ? 'rgba(0,212,170,0.08)' : i % 2 === 0 ? '#0d1929' : '#0a1628',
                          borderBottom: '1px solid #162030',
                          opacity: isItm ? 0.6 : 1,
                        }}
                      >
                        <td className="px-3 py-1.5 tabular-nums" style={{ color: isBest ? '#00d4aa' : '#6a8ab0' }}>
                          {isItm && <span className="mr-1 text-[9px] font-semibold" style={{ color: '#f59e0b' }}>ITM</span>}
                          {c.expiry}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums font-medium" style={{ color: isBest ? '#00d4aa' : '#8a9ab0' }}>${c.strike}</td>
                        <td className="px-3 py-1.5 tabular-nums font-semibold" style={{ color: '#00d4aa' }}>{netCredit(c.metrics.net_credit)}</td>
                        <td className="px-3 py-1.5 tabular-nums" style={{ color: '#6a8ab0' }}>{usd(c.premium)}</td>
                        <td className="px-3 py-1.5 tabular-nums" style={{ color: '#00d4aa' }}>{pct(c.metrics.static_yield)}</td>
                        <td className="px-3 py-1.5 tabular-nums font-medium" style={{ color: '#00d4aa' }}>{pct(c.metrics.annualized_static)}</td>
                        <td className="px-3 py-1.5 tabular-nums" style={{ color: '#7eb8d4' }}>{netCredit(c.metrics.if_called_profit)}</td>
                        <td className="px-3 py-1.5 text-center" style={{ color: '#f59e0b' }}>
                          {c.earnings_within_dte ? '⚠' : ''}
                        </td>
                      </tr>
                    ].filter(Boolean)
                  })}
                </tbody>
              </table>
              <p className="text-[11px] px-3 py-1.5" style={{ color: '#2a4060', borderTop: '1px solid #162030' }}>
                Net Credit = premium &times; 100 shares (cash received). If-Called $ = total profit if assigned. &#x2020; Ann. figures illustrative. Data 15-min delayed.
              </p>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
