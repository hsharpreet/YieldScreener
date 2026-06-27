import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-[#0f172a] text-white px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block text-xs font-medium bg-blue-900 text-blue-300 rounded-full px-3 py-1 mb-6 tracking-wide uppercase">
            USA Markets · 15-min delayed · Educational use only
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            Premium Income from<br />Quality Stocks
          </h1>
          <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
            Find a stock you&apos;d hold forever. Write a covered call. Collect the premium. Repeat.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/screener"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-sm">
              Open Screener
            </Link>
            <a
              href="#how-it-works"
              className="border border-slate-500 hover:border-slate-300 text-slate-300 hover:text-white font-semibold px-8 py-3 rounded-lg transition-colors text-sm">
              Learn how it works
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">How it works</h2>
          <p className="text-gray-500 text-center mb-12 text-sm">
            Three steps. One disciplined strategy. Repeated monthly.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="border border-gray-100 rounded-xl p-6 bg-gray-50">
              <div className="text-3xl mb-4">&#128269;</div>
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Step 1</div>
              <h3 className="font-semibold text-gray-900 mb-2">Filter for Quality</h3>
              <p className="text-sm text-gray-600">
                Screen for strong fundamentals — market cap, P/E, ROE, beta, analyst rating. Only stocks you&apos;d be comfortable owning long-term survive.
              </p>
            </div>
            <div className="border border-gray-100 rounded-xl p-6 bg-gray-50">
              <div className="text-3xl mb-4">&#128200;</div>
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Step 2</div>
              <h3 className="font-semibold text-gray-900 mb-2">Find the Best Call</h3>
              <p className="text-sm text-gray-600">
                We rank the best covered call for each surviving stock — filtered for liquidity, ranked by yield, and flagged if earnings fall within the DTE window.
              </p>
            </div>
            <div className="border border-gray-100 rounded-xl p-6 bg-gray-50">
              <div className="text-3xl mb-4">&#128176;</div>
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Step 3</div>
              <h3 className="font-semibold text-gray-900 mb-2">Collect Premium</h3>
              <p className="text-sm text-gray-600">
                If assigned: you keep the premium plus any capital gain to the strike. If not assigned: keep the shares, keep the premium, write again next month.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key metrics */}
      <section className="bg-slate-50 border-t border-gray-100 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">What you see in the screener</h2>
          <p className="text-gray-500 text-center mb-12 text-sm">
            Every metric is calculated per-contract so you can compare apple-to-apple across tickers.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
              <div className="text-2xl shrink-0">&#36;</div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">Net Credit</div>
                <p className="text-sm text-gray-600">
                  The dollar premium you collect upfront per 100-share contract (premium &times; 100). This is yours to keep regardless of outcome.
                </p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
              <div className="text-2xl shrink-0">&#128308;</div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">Static Yield %</div>
                <p className="text-sm text-gray-600">
                  Return if the stock stays flat and the call expires worthless (premium &#247; price). The floor scenario — no capital gain, just premium income.
                </p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
              <div className="text-2xl shrink-0">&#128737;</div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">Downside Cushion %</div>
                <p className="text-sm text-gray-600">
                  How far the stock can fall before you lose money (equals Static Yield %). The premium reduces your effective cost basis — it is not full downside protection.
                </p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
              <div className="text-2xl shrink-0">&#127775;</div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">If-Called Return %</div>
                <p className="text-sm text-gray-600">
                  Return if shares are called away at the strike — premium plus any gain from price to strike. The best-case scenario when the stock runs past your strike.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">Simple pricing</h2>
          <p className="text-gray-500 text-center mb-12 text-sm">
            Start free. Upgrade when you want the full universe.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Free */}
            <div className="border border-gray-200 rounded-xl p-8">
              <div className="text-xl font-bold text-gray-900 mb-1">Free</div>
              <div className="text-3xl font-bold text-gray-900 mb-6">$0</div>
              <ul className="text-sm text-gray-600 space-y-2 mb-8">
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Top 5 results per screen</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Core options filters (DTE, delta)</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>All covered call metrics</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Earnings-within-DTE flags</li>
                <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">&#10007;</span><span className="text-gray-400">Full screener (unlimited results)</span></li>
                <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">&#10007;</span><span className="text-gray-400">Advanced quality filters</span></li>
                <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">&#10007;</span><span className="text-gray-400">Watchlist + saved presets</span></li>
              </ul>
              <Link
                href="/screener"
                className="block text-center w-full border border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm">
                Open Screener
              </Link>
            </div>
            {/* Pro */}
            <div className="border-2 border-blue-600 rounded-xl p-8 relative">
              <div className="absolute -top-3 left-6 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most popular
              </div>
              <div className="text-xl font-bold text-gray-900 mb-1">Pro</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">$29<span className="text-lg font-normal text-gray-500">/mo</span></div>
              <div className="text-xs text-gray-400 mb-6">Cancel anytime</div>
              <ul className="text-sm text-gray-600 space-y-2 mb-8">
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Everything in Free</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Full screener — all results</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Advanced quality filters (ROE, PEG, beta)</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Sector, analyst rating filters</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Watchlist (screen only your stocks)</li>
                <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span>Saved presets</li>
              </ul>
              <button
                disabled
                className="block w-full bg-blue-100 text-blue-400 font-semibold px-4 py-2.5 rounded-lg text-sm cursor-not-allowed">
                Coming soon
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="bg-amber-50 border-t border-amber-200 px-6 py-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-amber-700 font-semibold mb-2 text-sm">Educational information only — not investment advice</div>
          <p className="text-xs text-amber-700 leading-relaxed">
            Results are from a 15-minute delayed US equity screener. This tool does not constitute a registered investment advisor and is not registered as such in any jurisdiction. Covered call strategies involve real risk — you can lose money if the stock falls more than the premium received. Annualized figures are illustrative only and assume identical trades repeat perfectly, which will not happen. Past covered-call yields do not guarantee future results. For entertainment and educational use only.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f172a] text-slate-400 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>&copy; 2026 Yield Screener &middot; USA Markets Only</div>
          <div className="flex gap-4">
            <a href="mailto:support@yieldscreener.com" className="hover:text-white transition-colors">Contact</a>
            <Link href="/screener" className="hover:text-white transition-colors">Screener</Link>
          </div>
          <div className="text-slate-500">Educational use only &mdash; not investment advice</div>
        </div>
      </footer>
    </div>
  )
}
