'use client'
import { useState, useEffect, useRef } from 'react'
import { Contract, fetchContracts } from '@/lib/api'
import MetricCard from './MetricCard'

function pct(n: number) { return `${(n * 100).toFixed(2)}%` }
function usd(n: number) { return `$${n.toFixed(2)}` }
function dollars(n: number) { return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

const POLL_INTERVAL_MS = 30_000

type StrikeCount = 'otm' | 9 | 13 | 17 | 'all'
const STRIKE_OPTIONS: StrikeCount[] = ['otm', 9, 13, 17, 'all']
function strikeLabel(s: StrikeCount) {
  if (s === 'otm') return 'OTM'
  if (s === 'all') return 'All'
  return String(s)
}

interface Props { ticker: string; price: number; name: string; contract: Contract }

// Pick up to `count` strikes nearest to ATM per expiry (both ITM and OTM).
function filterStrikes(contracts: Contract[], price: number, filter: StrikeCount): Contract[] {
  const expiries = [...new Set(contracts.map(c => c.expiry))].sort()
  const result: Contract[] = []

  for (const exp of expiries) {
    const forExpiry = contracts.filter(c => c.expiry === exp)
    const otm = forExpiry.filter(c => c.strike >= price).sort((a, b) => a.strike - b.strike)
    const itm = forExpiry.filter(c => c.strike < price).sort((a, b) => b.strike - a.strike)

    if (filter === 'all') {
      result.push(...itm.slice().reverse(), ...otm)
      continue
    }
    if (filter === 'otm') {
      result.push(...otm)
      continue
    }
    const half = Math.floor(filter / 2)
    // nearest ITM (reversed to ascending) then nearest OTM
    result.push(...itm.slice(0, half).reverse(), ...otm.slice(0, filter - half))
  }

  return result
}

export default function AccordionDetail({ ticker, price, name, contract }: Props) {
  const [chain, setChain] = useState<Contract[]>([])
  const [chainLoading, setChainLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [strikeCount, setStrikeCount] = useState<StrikeCount>(9)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const m = contract.metrics
  const capitalRequired = price * 100

  async function refresh() {
    const data = await fetchContracts(ticker, 7, 60)
    setChain(data)
    setChainLoading(false)
    setLastUpdated(new Date())
    setSecondsAgo(0)
  }

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [ticker]) // eslint-disable-line react-hooks/exhaustive-deps

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
          Recommended: ${contract.strike} strike &middot; expires {contract.expiry} &middot; {contract.dte} DTE &middot; premium {usd(contract.premium)}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Capital Required"
            value={dollars(capitalRequired)}
            sub={`${usd(price)} × 100 shares`}
            tooltip="Cash needed to own 100 shares to write this covered call."
          />
          <MetricCard
            label="Net Credit"
            value={dollars(m.net_credit)}
            sub={`${usd(contract.premium)} × 100 shares`}
            tooltip="Premium × 100 shares — cash received upfront when you sell the call."
          />
          <MetricCard
            label="Breakeven"
            value={usd(m.breakeven)}
            sub={`${usd(price)} − ${usd(contract.premium)} · cushion ${pct(m.downside_cushion)}`}
            tooltip="Stock price at which you break even = current price minus premium."
          />
          <MetricCard
            label="If Flat (not called)"
            value={pct(m.static_yield)}
            sub={`${pct(m.annualized_static)} ann. (illus.) · ${usd(contract.premium)} ÷ ${usd(price)}`}
            highlight
            tooltip="Return if the option expires worthless and you keep shares. = premium ÷ price."
          />
          <MetricCard
            label="If Called (assigned)"
            value={pct(m.if_called_return)}
            sub={`${pct(m.annualized_if_called)} ann. (illus.) · ${dollars(m.if_called_profit)} total`}
            highlight
            tooltip="Return if assigned at the strike. Includes premium + any capital gain or loss."
          />
        </div>
      </div>

      {/* Option chain mini-table */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#3a5070' }}>
            Available contracts (7–60 DTE)
          </p>
          {/* Strike count selector */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider mr-1" style={{ color: '#3a5070' }}>Strikes:</span>
            {STRIKE_OPTIONS.map(opt => (
              <button
                key={String(opt)}
                onClick={() => setStrikeCount(opt)}
                className="text-[10px] px-2 py-0.5 rounded border transition-colors"
                style={{
                  color: strikeCount === opt ? '#0a1628' : '#6a8ab0',
                  background: strikeCount === opt ? '#00d4aa' : 'transparent',
                  borderColor: strikeCount === opt ? '#00d4aa' : '#2a3a58',
                }}
              >
                {strikeLabel(opt)}
              </button>
            ))}
          </div>
        </div>

        {chainLoading ? (
          <p className="text-xs" style={{ color: '#3a5070' }}>Loading chain...</p>
        ) : chain.length === 0 ? (
          <p className="text-xs" style={{ color: '#3a5070' }}>No liquid contracts found.</p>
        ) : (() => {
          const filtered = filterStrikes(chain, price, strikeCount)
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
                  {filtered.map((c, i) => {
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
                        key={`${c.expiry}-${c.strike}`}
                        style={{
                          background: isBest ? 'rgba(0,212,170,0.14)' : i % 2 === 0 ? '#0d1929' : '#0a1628',
                          borderBottom: '1px solid #162030',
                          borderLeft: isBest ? '3px solid #00d4aa' : '3px solid transparent',
                          opacity: isItm && !isBest ? 0.6 : 1,
                        }}
                      >
                        <td className="px-3 py-1.5 tabular-nums" style={{ color: isBest ? '#00d4aa' : '#6a8ab0' }}>
                          {isItm && <span className="mr-1 text-[9px] font-semibold" style={{ color: '#f59e0b' }}>ITM</span>}
                          {isBest && <span className="mr-1 text-[9px] font-bold" style={{ color: '#00d4aa' }}>★</span>}
                          {c.expiry}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums font-medium" style={{ color: isBest ? '#00d4aa' : '#8a9ab0' }}>${c.strike}</td>
                        <td className="px-3 py-1.5 tabular-nums font-semibold" style={{ color: '#00d4aa' }}>{dollars(c.metrics.net_credit)}</td>
                        <td className="px-3 py-1.5 tabular-nums" style={{ color: '#6a8ab0' }}>{usd(c.premium)}</td>
                        <td className="px-3 py-1.5 tabular-nums" style={{ color: '#00d4aa' }}>{pct(c.metrics.static_yield)}</td>
                        <td className="px-3 py-1.5 tabular-nums font-medium" style={{ color: '#00d4aa' }}>{pct(c.metrics.annualized_static)}</td>
                        <td className="px-3 py-1.5 tabular-nums" style={{ color: '#7eb8d4' }}>{dollars(c.metrics.if_called_profit)}</td>
                        <td className="px-3 py-1.5 text-center" style={{ color: '#f59e0b' }}>
                          {c.earnings_within_dte ? '⚠' : ''}
                        </td>
                      </tr>
                    ].filter(Boolean)
                  })}
                </tbody>
              </table>
              <p className="text-[11px] px-3 py-1.5" style={{ color: '#2a4060', borderTop: '1px solid #162030' }}>
                ★ Recommended (highest yield × delta fit). Net Credit = premium × 100. If-Called $ = total profit if assigned. † Ann. figures illustrative. Data 15-min delayed.
              </p>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
