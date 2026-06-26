'use client'
import { useState } from 'react'

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-3 text-sm text-amber-800">
      <span className="shrink-0 mt-0.5">&#9432;</span>
      <span className="flex-1">
        <strong>Educational information only — not investment advice.</strong>{' '}
        Data is delayed ~15 minutes. Annualized figures are illustrative and assume identical trades repeat perfectly, which will not happen. Past covered-call yields do not guarantee future results.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-600 hover:text-amber-800 ml-2"
        aria-label="Dismiss">
        &#x2715;
      </button>
    </div>
  )
}
