export interface Metrics {
  net_credit: number
  static_yield: number
  annualized_static: number
  downside_cushion: number
  breakeven: number
  if_called_profit: number
  if_called_return: number
  annualized_if_called: number
  // Strategy extras (present only for that strategy)
  collateral?: number | null          // CSP: strike × 100
  capital_required?: number | null    // PMCC: long-call debit × 100
  net_debit?: number | null           // PMCC
  assignment_safe?: boolean | null    // PMCC
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
  option_type: 'call' | 'put'
  leg?: 'long' | 'short' | null   // PMCC legs
}

export type Strategy = 'covered_call' | 'cash_secured_put' | 'pmcc'

export interface ScreenerRow {
  ticker: string
  name: string
  price: number
  market_cap: number | null
  pe_ratio: number | null
  sector: string | null
  best_call: Contract | null       // CC: call · CSP: put · PMCC: short leg
  long_call?: Contract | null      // PMCC only: long LEAPS leg
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
  // Growth / liquidity
  min_eps_growth?: number
  min_quick_ratio?: number
  min_avg_volume?: number
  // Technicals
  min_rsi?: number
  max_rsi?: number
  above_sma_50?: boolean
  above_sma_200?: boolean
  min_52w_position?: number
  max_52w_position?: number
  // Option Greeks (|delta| — same bounds for calls and puts)
  min_delta?: number
  max_delta?: number
  min_iv_rank?: number
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
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    qs.set(key, String(value))
  }
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

export async function fetchContracts(
  ticker: string,
  minDte = 7,
  maxDte = 60,
  strategy: Strategy = 'covered_call',
): Promise<Contract[]> {
  const res = await fetch(
    `${API_BASE}/api/contracts/${ticker}?min_dte=${minDte}&max_dte=${maxDte}&strategy=${strategy}`,
    { cache: 'no-store', credentials: 'include' },
  )
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
