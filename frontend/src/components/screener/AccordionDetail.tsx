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
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-800">{ticker}</span>
        <span className="text-gray-500 text-sm">{name}</span>
        <span className="text-gray-400 text-sm">· current price {usd(price)}</span>
        {contract.earnings_within_dte && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
            &#9888; Earnings before {contract.expiry}
          </span>
        )}
      </div>

      {/* Scenario comparison */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Best call: ${contract.strike} strike · expires {contract.expiry} · {contract.dte} DTE · premium {usd(contract.premium)}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Net Credit"
            value={usd(m.net_credit)}
            sub="per 100 shares"
            tooltip="Premium × 100 shares — cash received upfront when you sell the call."
          />
          <MetricCard
            label="Breakeven"
            value={usd(m.breakeven)}
            sub={`cushion ${pct(m.downside_cushion)}`}
            tooltip="Stock price at which you break even = current price − premium."
          />
          <MetricCard
            label="If Flat (not called)"
            value={pct(m.static_yield)}
            sub={`${pct(m.annualized_static)} ann. (illus.)`}
            highlight
            tooltip="Return if the option expires worthless and you keep the shares. = premium ÷ price."
          />
          <MetricCard
            label="If Called (assigned)"
            value={pct(m.if_called_return)}
            sub={`${pct(m.annualized_if_called)} ann. (illus.)`}
            highlight
            tooltip="Return if assigned at the strike price. Includes both premium and any capital gain/loss."
          />
        </div>
      </div>

      {/* Option chain mini-table */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Available contracts (7–60 DTE)</p>
        {chainLoading ? (
          <p className="text-xs text-gray-400">Loading chain&#x2026;</p>
        ) : chain.length === 0 ? (
          <p className="text-xs text-gray-400">No liquid contracts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="text-left pb-1 pr-3">Expiry</th>
                  <th className="text-left pb-1 pr-3">DTE</th>
                  <th className="text-left pb-1 pr-3">Strike</th>
                  <th className="text-left pb-1 pr-3">Premium</th>
                  <th className="text-left pb-1 pr-3">Static%</th>
                  <th className="text-left pb-1 pr-3">Ann.Static&#x2020;</th>
                  <th className="text-left pb-1">Earn.&#9888;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {chain.slice(0, 15).map((c, i) => (
                  <tr key={i} className={c.expiry === contract.expiry && c.strike === contract.strike ? 'bg-blue-50 font-medium' : ''}>
                    <td className="py-1 pr-3">{c.expiry}</td>
                    <td className="py-1 pr-3">{c.dte}</td>
                    <td className="py-1 pr-3">${c.strike}</td>
                    <td className="py-1 pr-3">{usd(c.premium)}</td>
                    <td className="py-1 pr-3">{pct(c.metrics.static_yield)}</td>
                    <td className="py-1 pr-3">{pct(c.metrics.annualized_static)}</td>
                    <td className="py-1">{c.earnings_within_dte ? '⚠' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-1">&#x2020; Illustrative. Assumes perfect repetition for 365 days.</p>
          </div>
        )}
      </div>
    </div>
  )
}
