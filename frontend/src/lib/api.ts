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
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  iv_rank: number | null
  score: number
  is_itm: boolean
  recommended: boolean       // overall top-ranked OTM contract
  best_for_expiry: boolean   // best OTM contract within its expiry
}

export type Strategy = 'covered_call'

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
  strategy?: Strategy
  min_dte?: number
  max_dte?: number
  // General
  min_market_cap?: number
  sectors?: string
  max_analyst_rating?: number
  // Valuation
  max_pe?: number
  max_forward_pe?: number
  max_peg?: number
  max_price_to_book?: number
  max_price_to_sales?: number
  max_ev_to_ebitda?: number
  min_dividend_yield?: number
  // Profitability
  min_gross_margin?: number
  min_operating_margin?: number
  min_net_margin?: number
  min_roe?: number
  min_roa?: number
  // Financial health
  max_debt_to_equity?: number
  min_current_ratio?: number
  // Risk / trading
  max_beta?: number
  max_short_float?: number
}

export interface ScreenResult {
  rows: ScreenerRow[]
  tier: 'free' | 'pro'
  total: number
  dataStatus: 'ready' | 'loading' | 'stale'
}

export interface UserOut {
  id: string
  email: string
  tier: 'free' | 'pro'
  created_at: string
}

export interface SavedScreener {
  id: string
  name: string
  params: ScreenParams
  created_at: string
}

const API_BASE = ''

export async function fetchScreen(params: ScreenParams = {}): Promise<ScreenResult> {
  const qs = new URLSearchParams()
  if (params.tickers) qs.set('tickers', params.tickers)
  if (params.strategy) qs.set('strategy', params.strategy)
  if (params.min_dte !== undefined) qs.set('min_dte', String(params.min_dte))
  if (params.max_dte !== undefined) qs.set('max_dte', String(params.max_dte))
  if (params.min_market_cap !== undefined) qs.set('min_market_cap', String(params.min_market_cap))
  if (params.sectors) qs.set('sectors', params.sectors)
  if (params.max_analyst_rating !== undefined) qs.set('max_analyst_rating', String(params.max_analyst_rating))
  if (params.max_pe !== undefined) qs.set('max_pe', String(params.max_pe))
  if (params.max_forward_pe !== undefined) qs.set('max_forward_pe', String(params.max_forward_pe))
  if (params.max_peg !== undefined) qs.set('max_peg', String(params.max_peg))
  if (params.max_price_to_book !== undefined) qs.set('max_price_to_book', String(params.max_price_to_book))
  if (params.max_price_to_sales !== undefined) qs.set('max_price_to_sales', String(params.max_price_to_sales))
  if (params.max_ev_to_ebitda !== undefined) qs.set('max_ev_to_ebitda', String(params.max_ev_to_ebitda))
  if (params.min_dividend_yield !== undefined) qs.set('min_dividend_yield', String(params.min_dividend_yield))
  if (params.min_gross_margin !== undefined) qs.set('min_gross_margin', String(params.min_gross_margin))
  if (params.min_operating_margin !== undefined) qs.set('min_operating_margin', String(params.min_operating_margin))
  if (params.min_net_margin !== undefined) qs.set('min_net_margin', String(params.min_net_margin))
  if (params.min_roe !== undefined) qs.set('min_roe', String(params.min_roe))
  if (params.min_roa !== undefined) qs.set('min_roa', String(params.min_roa))
  if (params.max_debt_to_equity !== undefined) qs.set('max_debt_to_equity', String(params.max_debt_to_equity))
  if (params.min_current_ratio !== undefined) qs.set('min_current_ratio', String(params.min_current_ratio))
  if (params.max_beta !== undefined) qs.set('max_beta', String(params.max_beta))
  if (params.max_short_float !== undefined) qs.set('max_short_float', String(params.max_short_float))
  const res = await fetch(`${API_BASE}/api/screen?${qs}`, { cache: 'no-store', credentials: 'include' })
  if (!res.ok) throw new Error(`Screen fetch failed: ${res.status}`)
  const rows: ScreenerRow[] = await res.json()
  return {
    rows,
    tier: (res.headers.get('X-Tier') ?? 'free') as 'free' | 'pro',
    total: parseInt(res.headers.get('X-Total') ?? String(rows.length)),
    dataStatus: (res.headers.get('X-Data-Status') ?? 'ready') as 'ready' | 'loading' | 'stale',
  }
}

export async function fetchContracts(ticker: string, minDte = 7, maxDte = 60): Promise<Contract[]> {
  const res = await fetch(`${API_BASE}/api/contracts/${ticker}?min_dte=${minDte}&max_dte=${maxDte}`, {
    cache: 'no-store',
    credentials: 'include',
  })
  if (!res.ok) return []
  return res.json()
}

export async function fetchMe(): Promise<UserOut | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function login(email: string, password: string): Promise<UserOut> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const e = await res.json()
    throw new Error((e as { detail?: string }).detail ?? 'Login failed')
  }
  return res.json()
}

export async function register(email: string, password: string): Promise<UserOut> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const e = await res.json()
    throw new Error((e as { detail?: string }).detail ?? 'Registration failed')
  }
  return res.json()
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
}

export async function fetchSavedScreeners(): Promise<SavedScreener[]> {
  const res = await fetch(`${API_BASE}/api/screeners`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export async function saveScreener(name: string, params: ScreenParams): Promise<SavedScreener> {
  const res = await fetch(`${API_BASE}/api/screeners`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, params }),
  })
  if (!res.ok) throw new Error('Failed to save screener')
  return res.json()
}

export async function deleteSavedScreener(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/screeners/${id}`, { method: 'DELETE', credentials: 'include' })
}

export async function fetchWatchlist(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/watchlist`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export async function addToWatchlist(ticker: string): Promise<void> {
  await fetch(`${API_BASE}/api/watchlist`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  })
}

export async function removeFromWatchlist(ticker: string): Promise<void> {
  await fetch(`${API_BASE}/api/watchlist/${ticker}`, { method: 'DELETE', credentials: 'include' })
}
