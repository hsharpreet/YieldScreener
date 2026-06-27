'use client'
import { useState } from 'react'

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div
      className="px-4 py-2 flex items-start gap-3 text-xs"
      style={{
        background: 'rgba(245,158,11,0.08)',
        borderBottom: '1px solid rgba(245,158,11,0.2)',
        color: '#d4a843',
      }}
    >
      <span className="shrink-0 mt-0.5 text-amber-400">&#9432;</span>
      <span className="flex-1">
        <strong style={{ color: '#f0b844' }}>Educational information only — not investment advice.</strong>{' '}
        Data is delayed ~15 minutes. Annualized figures are illustrative and assume identical trades repeat perfectly, which will not happen. Past covered-call yields do not guarantee future results.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 ml-2 transition-colors"
        style={{ color: '#8a7030' }}
        aria-label="Dismiss"
        onMouseEnter={e => (e.currentTarget.style.color = '#f0b844')}
        onMouseLeave={e => (e.currentTarget.style.color = '#8a7030')}
      >
        &#x2715;
      </button>
    </div>
  )
}
