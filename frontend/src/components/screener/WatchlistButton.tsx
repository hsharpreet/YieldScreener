'use client'
import { addToWatchlist, removeFromWatchlist } from '@/lib/api'
import { useAuth } from '@/components/auth'

interface Props {
  ticker: string
  inWatchlist: boolean
  onToggle: (ticker: string, add: boolean) => void
}

export default function WatchlistButton({ ticker, inWatchlist, onToggle }: Props) {
  const { user } = useAuth()

  if (!user || user.tier !== 'pro') return (
    <span
      className="text-gray-200 cursor-not-allowed"
      title="Pro feature — upgrade to use watchlist">
      &#9733;
    </span>
  )

  async function toggle() {
    if (inWatchlist) {
      await removeFromWatchlist(ticker)
      onToggle(ticker, false)
    } else {
      await addToWatchlist(ticker)
      onToggle(ticker, true)
    }
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); void toggle() }}
      className={`text-lg leading-none ${inWatchlist ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
      title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}>
      &#9733;
    </button>
  )
}
