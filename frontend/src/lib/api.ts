export interface Metrics {
  net_credit: number
  static_yield: number
  annualized_static: number
  downside_cushion: number
  breakeven: number
  if_called_profit: number
  if_called_return: number
  annualized_if_called: number
}

export interface Contract {
  strike: number
  expiry: string
  dte: number
  premium: number
  bid: number
  ask: number
  volume: number
  open_interest: number
  implied_volatility: number
  earnings_within_dte: boolean
  metrics: Metrics
}

export interface ScreenerRow {
  ticker: string
  name: string
  price: number
  market_cap: number | null
  pe_ratio: number | null
  sector: string | null
  best_call: Contract | null
}

export interface ScreenParams {
  tickers?: string
  min_dte?: number
  max_dte?: number
  min_market_cap?: number
  max_pe?: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function fetchScreen(params: ScreenParams = {}): Promise<ScreenerRow[]> {
  const qs = new URLSearchParams()
  if (params.tickers) qs.set('tickers', params.tickers)
  if (params.min_dte !== undefined) qs.set('min_dte', String(params.min_dte))
  if (params.max_dte !== undefined) qs.set('max_dte', String(params.max_dte))
  if (params.min_market_cap !== undefined) qs.set('min_market_cap', String(params.min_market_cap))
  if (params.max_pe !== undefined) qs.set('max_pe', String(params.max_pe))
  const res = await fetch(`${API_BASE}/api/screen?${qs}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Screen fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchContracts(ticker: string, minDte = 7, maxDte = 60): Promise<Contract[]> {
  const res = await fetch(`${API_BASE}/api/contracts/${ticker}?min_dte=${minDte}&max_dte=${maxDte}`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}
