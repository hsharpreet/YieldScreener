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

// Pick strikes to show within one expiry group, nearest to ATM.
function filterGroupStrikes(forExpiry: Contract[], price: number, filter: StrikeCount): Contract[] {
  const otm = forExpiry.filter(c => c.strike >= price).sort((a, b) => a.strike - b.strike)
  const itm = forExpiry.filter(c => c.strike < price).sort((a, b) => b.strike - a.strike)

  if (filter === 'all') return [...itm.slice().reverse(), ...otm]
  if (filter === 'otm') return otm
  const half = Math.floor(filter / 2)
  return [...itm.slice(0, half).reverse(), ...otm.slice(0, filter - half)]
}

interface ExpiryGroup {
  expiry: string
  dte: number
  contracts: Contract[]        // all contracts in this expiry (unfiltered)
  best: Contract | null        // best OTM per backend ranking (null if all ITM)
}

function groupByExpiry(chain: Contract[]): ExpiryGroup[] {
  const expiries = [...new Set(chain.map(c => c.expiry))].sort()
  return expiries.map(expiry => {
    const contracts = chain.filter(c => c.expiry === expiry)
    return {
      expiry,
      dte: contracts[0].dte,
      contracts,
      best: contracts.find(c => c.best_for_expiry) ?? null,
    }
  })
}

export default function AccordionDetail({ ticker, price, name, contract }: Props) {
  const [chain, setChain] = useState<Contract[]>([])
  const [chainLoading, setChainLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [strikeCount, setStrikeCount] = useState<StrikeCount>(9)
  const [openExpiries, setOpenExpiries] = useState<Set<string>>(new Set())
  const seededRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const m = contract.metrics
  const capitalRequired = price * 100

  async function refresh() {
    const data = await fetchContracts(ticker, 7, 60)
    setChain(data)
    setChainLoading(false)
    setLastUpdated(new Date())
    setSecondsAgo(0)
    // First load: auto-open the expiry holding the overall recommended contract.
    if (!seededRef.current) {
      seededRef.current = true
      const rec = data.find(c => c.recommended)
      if (rec) setOpenExpiries(new Set([rec.expiry]))
    }
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

  function toggleExpiry(expiry: string) {
    setOpenExpiries(prev => {
      const next = new Set(prev)
      if (next.has(expiry)) next.delete(expiry)
      else next.add(expiry)
      return next
    })
  }

  const groups = groupByExpiry(chain)
  const allOpen = groups.length > 0 && groups.every(g => openExpiries.has(g.expiry))

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
          Top ranked: ${contract.strike} strike &middot; expires {contract.expiry} &middot; {contract.dte} DTE &middot; premium {usd(contract.premium)}
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

      {/* Option chain, grouped by expiry */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#3a5070' }}>
            Expirations (7–60 DTE) — click a date to expand its strikes
          </p>
          <div className="flex items-center gap-3">
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
            <button
              onClick={() => setOpenExpiries(allOpen ? new Set() : new Set(groups.map(g => g.expiry)))}
              className="text-[10px] px-2 py-0.5 rounded border transition-colors"
              style={{ color: '#6a8ab0', borderColor: '#2a3a58' }}
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        </div>

        {chainLoading ? (
          <p className="text-xs" style={{ color: '#3a5070' }}>Loading chain...</p>
        ) : groups.length === 0 ? (
          <p className="text-xs" style={{ color: '#3a5070' }}>No liquid contracts found.</p>
        ) : (
          <div className="overflow-x-auto rounded" style={{ border: '1px solid #1a2d4a' }}>
            <table className="text-xs w-full" style={{ background: '#0a1628' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2d4a' }}>
                  {['Expiry / Strike', 'Net Credit', 'Premium', 'Static %', 'Ann. Static †', 'If-Called $', 'Delta', 'IV', 'Earn.'].map(h => (
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
                {groups.map(group => {
                  const isOpen = openExpiries.has(group.expiry)
                  const visible = isOpen ? filterGroupStrikes(group.contracts, price, strikeCount) : []
                  return [
                    // Expiry header row — click to expand/collapse; shows best-of-expiry summary
                    <tr
                      key={`hdr-${group.expiry}`}
                      onClick={() => toggleExpiry(group.expiry)}
                      className="cursor-pointer select-none"
                      style={{ background: isOpen ? '#0c1830' : '#07101e', borderBottom: '1px solid #1a2d4a' }}
                    >
                      <td colSpan={9} className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px]" style={{ color: '#00d4aa' }}>{isOpen ? '▾' : '▸'}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#7eb8d4' }}>
                            {group.expiry}
                          </span>
                          <span className="text-[10px]" style={{ color: '#3a5070' }}>
                            {group.dte} DTE · {group.contracts.length} strikes
                          </span>
                          {group.best ? (
                            <span className="text-[10px] tabular-nums ml-auto" style={{ color: '#00d4aa' }}>
                              ★ Best OTM: ${group.best.strike} @ {usd(group.best.premium)} → {pct(group.best.metrics.static_yield)} ({pct(group.best.metrics.annualized_static)} ann. †)
                              {group.best.recommended && (
                                <span
                                  className="ml-2 text-[9px] font-bold rounded px-1.5 py-0.5"
                                  style={{ color: '#0a1628', background: '#00d4aa' }}
                                >
                                  TOP RANKED
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[10px] ml-auto" style={{ color: '#3a5070' }}>no OTM strikes</span>
                          )}
                        </div>
                      </td>
                    </tr>,
                    // Strike rows (only when the group is expanded)
                    ...visible.map((c, i) => {
                      const isBestOfExpiry = c.best_for_expiry
                      const isTopRanked = c.recommended
                      return (
                        <tr
                          key={`${c.expiry}-${c.strike}`}
                          style={{
                            background: isBestOfExpiry ? 'rgba(0,212,170,0.14)' : i % 2 === 0 ? '#0d1929' : '#0a1628',
                            borderBottom: '1px solid #162030',
                            borderLeft: isBestOfExpiry ? '3px solid #00d4aa' : '3px solid transparent',
                            opacity: c.is_itm ? 0.55 : 1,
                          }}
                        >
                          <td className="px-3 py-1.5 tabular-nums font-medium" style={{ color: isBestOfExpiry ? '#00d4aa' : '#8a9ab0' }}>
                            {isBestOfExpiry && <span className="mr-1 text-[9px] font-bold" style={{ color: '#00d4aa' }}>★</span>}
                            {isTopRanked && (
                              <span className="mr-1 text-[8px] font-bold rounded px-1 py-0.5" style={{ color: '#0a1628', background: '#00d4aa' }}>
                                TOP
                              </span>
                            )}
                            {c.is_itm && <span className="mr-1 text-[9px] font-semibold" style={{ color: '#f59e0b' }}>ITM</span>}
                            ${c.strike}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums font-semibold" style={{ color: '#00d4aa' }}>{dollars(c.metrics.net_credit)}</td>
                          <td className="px-3 py-1.5 tabular-nums" style={{ color: '#6a8ab0' }}>{usd(c.premium)}</td>
                          <td className="px-3 py-1.5 tabular-nums" style={{ color: '#00d4aa' }}>{pct(c.metrics.static_yield)}</td>
                          <td className="px-3 py-1.5 tabular-nums font-medium" style={{ color: '#00d4aa' }}>{pct(c.metrics.annualized_static)}</td>
                          <td className="px-3 py-1.5 tabular-nums" style={{ color: '#7eb8d4' }}>{dollars(c.metrics.if_called_profit)}</td>
                          <td className="px-3 py-1.5 tabular-nums" style={{ color: '#8a9ab0' }}>
                            {c.delta !== null ? c.delta.toFixed(2) : '—'}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums" style={{ color: '#8a9ab0' }}>
                            {c.implied_volatility > 0 ? pct(c.implied_volatility) : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-center" style={{ color: '#f59e0b' }}>
                            {c.earnings_within_dte ? '⚠' : ''}
                          </td>
                        </tr>
                      )
                    }),
                  ]
                })}
              </tbody>
            </table>
            <p className="text-[11px] px-3 py-1.5" style={{ color: '#2a4060', borderTop: '1px solid #162030' }}>
              ★ Best OTM strike per expiration, ranked by ann. static yield × delta fit — same math for every user. TOP = highest-ranked across all expirations. Net Credit = premium × 100. † Ann. figures illustrative. Educational data only, 15-min delayed — not investment advice.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
