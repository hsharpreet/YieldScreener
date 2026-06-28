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
  max_beta?: number
  min_roe?: number
  max_peg?: number
  sectors?: string
  max_analyst_rating?: number
}

export interface ScreenResult {
  rows: ScreenerRow[]
  tier: 'free' | 'pro'
  total: number
  dataStatus: 'ready' | 'loading'
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
  if (params.min_dte !== undefined) qs.set('min_dte', String(params.min_dte))
  if (params.max_dte !== undefined) qs.set('max_dte', String(params.max_dte))
  if (params.min_market_cap !== undefined) qs.set('min_market_cap', String(params.min_market_cap))
  if (params.max_pe !== undefined) qs.set('max_pe', String(params.max_pe))
  if (params.max_beta !== undefined) qs.set('max_beta', String(params.max_beta))
  if (params.min_roe !== undefined) qs.set('min_roe', String(params.min_roe))
  if (params.max_peg !== undefined) qs.set('max_peg', String(params.max_peg))
  if (params.sectors) qs.set('sectors', params.sectors)
  if (params.max_analyst_rating !== undefined) qs.set('max_analyst_rating', String(params.max_analyst_rating))
  const res = await fetch(`${API_BASE}/api/screen?${qs}`, { cache: 'no-store', credentials: 'include' })
  if (!res.ok) throw new Error(`Screen fetch failed: ${res.status}`)
  const rows: ScreenerRow[] = await res.json()
  return {
    rows,
    tier: (res.headers.get('X-Tier') ?? 'free') as 'free' | 'pro',
    total: parseInt(res.headers.get('X-Total') ?? String(rows.length)),
    dataStatus: (res.headers.get('X-Data-Status') ?? 'ready') as 'ready' | 'loading',
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
