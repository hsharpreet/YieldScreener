'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth'

interface Counts { nc: number; sy: number; dc: number; ic: number }

const MOCK_ROWS = [
  { ticker: 'AAPL', price: '198.40', netCr: '$248', staticYld: '4.2%', ifCalled: '5.6%', highlight: true },
  { ticker: 'MSFT', price: '421.10', netCr: '$362', staticYld: '3.9%', ifCalled: '5.1%' },
  { ticker: 'JPM',  price: '201.75', netCr: '$198', staticYld: '4.7%', ifCalled: '6.0%', alt: true },
  { ticker: 'KO',   price: '62.30',  netCr: '$74',  staticYld: '5.3%', ifCalled: '6.8%' },
  { ticker: 'NVDA', price: '124.60', netCr: '$410', staticYld: '8.1%', ifCalled: '9.7%', alt: true },
  { ticker: 'COST', price: '880.20', netCr: '$520', staticYld: '2.9%', ifCalled: '4.3%' },
]

const TICKER_TAPE = ['AAPL 3.2%','NVDA 8.1%','MSFT 2.9%','JPM 4.7%','KO 5.3%','COST 2.9%','XOM 4.4%','PFE 6.1%','V 2.1%','AMD 7.2%','WMT 3.4%','MO 9.2%']

const FLOAT_POOL = ['AAPL','NVDA','+4.2%','MSFT','JPM','8.1%','KO','+3.6%','SPY','XOM','2.9%','$248','+4.7%','AMD','COST','5.3%','V','+2.1%','WMT','+6.8%','TLT']

const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#metrics', label: 'Metrics' },
  { href: '#pricing', label: 'Pricing' },
]

export default function HomePage() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [counts, setCounts] = useState<Counts>({ nc: 0, sy: 0, dc: 0, ic: 0 })
  const metricsRef = useRef<HTMLElement>(null)
  const countStarted = useRef(false)

  useEffect(() => {
    const close = () => setMenuOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  useEffect(() => {
    const targets: Counts = { nc: 248, sy: 4.2, dc: 7.8, ic: 5.6 }
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      if (countStarted.current) return
      const el = metricsRef.current
      if (!el) { timer = setTimeout(check, 200); return }
      if (el.getBoundingClientRect().top < window.innerHeight * 0.85) {
        countStarted.current = true
        const start = performance.now(), dur = 1500
        const tick = (now: number) => {
          const t = Math.min((now - start) / dur, 1)
          const e = 1 - Math.pow(1 - t, 3)
          setCounts({ nc: targets.nc * e, sy: targets.sy * e, dc: targets.dc * e, ic: targets.ic * e })
          if (t < 1) requestAnimationFrame(tick)
          else setCounts(targets)
        }
        requestAnimationFrame(tick)
      } else { timer = setTimeout(check, 200) }
    }
    check()
    return () => clearTimeout(timer)
  }, [])

  const plan = user?.tier === 'pro' ? 'Pro' : 'Free'
  const userInitial = user ? (user.email || '?').charAt(0).toUpperCase() : ''

  const floatItems = FLOAT_POOL.map((txt, i) => ({
    txt,
    top: `${(i * 61 + 11) % 96}%`,
    left: `${(i * 43 + 5) % 94}%`,
    size: `${13 + (i * 7) % 22}px`,
    dur: `${14 + (i * 5) % 16}s`,
    delay: `-${(i * 3) % 18}s`,
    color: txt.includes('%') || txt.includes('$') ? 'rgba(0,212,170,0.08)' : 'rgba(170,200,235,0.055)',
  }))

  // ── Shared inline style fragments ──────────────────────────────────────────
  const teal = '#00d4aa'
  const navy = '#0a1628'
  const darkCard = '#0c1c30'

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: navy, color: '#e8eef5', overflowX: 'hidden' }}>
      <style>{`
        @keyframes drift{0%{transform:translateY(14px)}50%{transform:translateY(-16px)}100%{transform:translateY(14px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}
        @keyframes glowPulse{0%,100%{opacity:.55}50%{opacity:.9}}
      `}</style>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', overflow: 'hidden', background: navy }}>
        {/* bg gradients */}
        <div style={{ position:'absolute', inset:0, zIndex:0, pointerEvents:'none',
          background:'radial-gradient(58% 50% at 18% 8%,rgba(64,86,210,.22),transparent 60%),radial-gradient(50% 50% at 88% 0%,rgba(0,212,170,.16),transparent 58%),radial-gradient(60% 60% at 70% 70%,rgba(108,74,196,.18),transparent 62%)' }} />
        <div style={{ position:'absolute', inset:0, zIndex:0, pointerEvents:'none', opacity:.5,
          background:'linear-gradient(180deg,transparent 60%,#0a1628 100%)' }} />

        {/* floating tickers */}
        <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1 }}>
          {floatItems.map((f, i) => (
            <span key={i} style={{ position:'absolute', top:f.top, left:f.left,
              fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:f.size,
              letterSpacing:'0.04em', color:f.color, whiteSpace:'nowrap',
              animation:`drift ${f.dur} ease-in-out ${f.delay} infinite` }}>{f.txt}</span>
          ))}
        </div>

        {/* NAV */}
        <nav style={{ position:'relative', zIndex:4, maxWidth:'1180px', margin:'0 auto',
          padding:'22px clamp(20px,5vw,48px)', display:'flex', alignItems:'center',
          justifyContent:'space-between', gap:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'11px' }}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'22px' }}>
              <div style={{ width:'5px', height:'11px', background:teal, borderRadius:'1.5px' }} />
              <div style={{ width:'5px', height:'18px', background:teal, borderRadius:'1.5px', opacity:.8 }} />
              <div style={{ width:'5px', height:'23px', background:teal, borderRadius:'1.5px', opacity:.6 }} />
            </div>
            <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'19px', color:'#fff', letterSpacing:'-0.02em' }}>YieldScreener</span>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'30px', fontSize:'14.5px' }}>
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} style={{ color:'#9fb2c8', textDecoration:'none', fontWeight:500 }}>{l.label}</a>
            ))}

            {!user ? (
              <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                <Link href="/login" style={{ color:'#cfdcec', fontWeight:600, fontSize:'14px', textDecoration:'none' }}>Log in</Link>
                <Link href="/signup" style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:teal, color:'#04221b', fontWeight:700, fontSize:'14px', padding:'9px 16px', borderRadius:'9px', boxShadow:'0 10px 24px -12px rgba(0,212,170,.7)', textDecoration:'none' }}>
                  Create account
                </Link>
              </div>
            ) : (
              <div style={{ position:'relative' }}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(m => !m) }}
                  style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', background:'rgba(120,160,200,.08)', border:'1px solid rgba(120,160,200,.2)', padding:'6px 12px 6px 6px', borderRadius:'100px', color:'inherit' }}>
                  <span style={{ width:'30px', height:'30px', borderRadius:'50%', background:teal, color:'#04221b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'13px' }}>{userInitial}</span>
                  <span style={{ color:'#fff', fontWeight:600, fontSize:'14px', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity:.6 }}><path d="M3 4.5L6 7.5l3-3" stroke="#cfdcec" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {menuOpen && (
                  <div onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:'52px', width:'264px', background:darkCard, border:'1px solid rgba(120,160,200,.2)', borderRadius:'14px', boxShadow:'0 24px 50px -16px rgba(0,0,0,.7)', padding:'16px', zIndex:20 }}>
                    <div style={{ fontSize:'13px', color:'#76889e' }}>Signed in as</div>
                    <div style={{ fontSize:'14px', color:'#fff', fontWeight:600, marginTop:'2px', wordBreak:'break-all' }}>{user.email}</div>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginTop:'10px', background:'rgba(0,212,170,.12)', border:'1px solid rgba(0,212,170,.35)', color:teal, fontSize:'11.5px', fontWeight:700, padding:'3px 10px', borderRadius:'100px' }}>{plan} plan</div>
                    <div style={{ height:'1px', background:'rgba(120,160,200,.14)', margin:'14px 0' }} />
                    <Link href="/screener" style={{ display:'flex', alignItems:'center', gap:'9px', background:teal, color:'#04221b', textDecoration:'none', fontWeight:700, fontSize:'14px', padding:'11px 14px', borderRadius:'10px', justifyContent:'center' }}>
                      Open Screener
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="#04221b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </Link>
                    <button onClick={logout} style={{ cursor:'pointer', textAlign:'center', marginTop:'8px', color:'#9fb2c8', fontSize:'13.5px', fontWeight:600, padding:'9px', width:'100%', background:'none', border:'none' }}>Log out</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* HERO BODY */}
        <div style={{ position:'relative', zIndex:2, maxWidth:'1180px', margin:'0 auto', padding:'clamp(40px,6vw,84px) clamp(20px,5vw,48px) clamp(72px,9vw,118px)', display:'flex', flexWrap:'wrap', gap:'clamp(40px,5vw,64px)', alignItems:'center' }}>
          {/* Left: headline */}
          <div style={{ flex:'1 1 460px', minWidth:'300px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'9px', background:'rgba(120,160,200,.08)', border:'1px solid rgba(120,160,200,.18)', padding:'7px 14px', borderRadius:'100px', fontSize:'13px', color:'#aebfd2', fontWeight:500 }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:teal, boxShadow:`0 0 10px ${teal}`, animation:'pulseDot 2.4s ease-in-out infinite' }} />
              Covered-call income screener
            </div>
            <h1 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'clamp(38px,5.6vw,66px)', lineHeight:1.04, letterSpacing:'-0.03em', color:'#fff', margin:'22px 0 0', animation:'fadeUp .7s ease both' }}>
              Monthly Income from<br />Stocks You&apos;d Hold <span style={{ color:teal }}>Anyway.</span>
            </h1>
            <p style={{ fontSize:'clamp(16px,2vw,19px)', lineHeight:1.6, color:'#9fb2c8', margin:'22px 0 0', maxWidth:'480px' }}>
              Filter for quality. Write covered calls. Pocket the premium — on a portfolio you&apos;d want to own with or without the options.
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'14px', marginTop:'34px' }}>
              <Link href="/screener" style={{ display:'inline-flex', alignItems:'center', gap:'9px', background:teal, color:'#04221b', textDecoration:'none', fontWeight:700, fontSize:'15.5px', padding:'15px 26px', borderRadius:'11px', boxShadow:'0 14px 34px -10px rgba(0,212,170,.6)' }}>
                Open Screener
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="#04221b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <a href="#how" style={{ display:'inline-flex', alignItems:'center', gap:'9px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(160,190,220,.22)', color:'#dce6f1', textDecoration:'none', fontWeight:600, fontSize:'15.5px', padding:'15px 24px', borderRadius:'11px' }}>
                See how it works
              </a>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'16px', marginTop:'26px', fontSize:'13px', color:'#76889e', flexWrap:'wrap' }}>
              <span>A research &amp; education tool</span>
              <span style={{ opacity:.4 }}>•</span>
              <span>You stay in control</span>
              <span style={{ opacity:.4 }}>•</span>
              <span>Not investment advice</span>
            </div>
          </div>

          {/* Right: mock screener preview */}
          <div style={{ flex:'1 1 470px', minWidth:'300px', position:'relative' }}>
            <div style={{ position:'absolute', inset:'-10% -4% -16% -4%', zIndex:0, background:'radial-gradient(58% 56% at 64% 26%,rgba(0,212,170,.26),transparent 70%)', filter:'blur(26px)', animation:'glowPulse 5s ease-in-out infinite' }} />
            <div style={{ position:'relative', zIndex:1, background:darkCard, border:'1px solid rgba(120,160,200,.18)', borderRadius:'16px', boxShadow:'0 36px 80px -24px rgba(0,0,0,.7)', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid rgba(120,160,200,.12)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
                  <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:teal, boxShadow:`0 0 8px ${teal}` }} />
                  <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:600, fontSize:'13.5px', color:'#cfdcec' }}>Income Screen · 30–45 DTE</span>
                </div>
                <div style={{ display:'flex', gap:'7px' }}>
                  <span style={{ fontSize:'11px', padding:'4px 9px', border:'1px solid rgba(120,160,200,.16)', borderRadius:'7px', color:'#9fb2c8' }}>IV &lt; 45</span>
                  <span style={{ fontSize:'11px', padding:'4px 9px', border:`1px solid rgba(0,212,170,.3)`, borderRadius:'7px', color:teal, background:'rgba(0,212,170,.08)' }}>Yield ↓</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1.15fr .85fr .9fr 1fr .95fr', gap:'6px', padding:'11px 18px', borderBottom:'1px solid rgba(120,160,200,.1)', fontSize:'10.5px', textTransform:'uppercase', letterSpacing:'.07em', color:'#6f8298', fontWeight:600 }}>
                <span>Symbol</span><span style={{ textAlign:'right' }}>Last</span><span style={{ textAlign:'right' }}>Net Cr</span><span style={{ textAlign:'right' }}>Static Yld</span><span style={{ textAlign:'right' }}>If-Called</span>
              </div>
              {MOCK_ROWS.map(r => (
                <div key={r.ticker} style={{ display:'grid', gridTemplateColumns:'1.15fr .85fr .9fr 1fr .95fr', gap:'6px', padding:'13px 18px', alignItems:'center', borderLeft:r.highlight ? `2px solid ${teal}` : '2px solid transparent', background:r.highlight ? 'rgba(0,212,170,.05)' : r.alt ? 'rgba(120,160,200,.03)' : undefined }}>
                  <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, color:'#fff', fontSize:'14px' }}>{r.ticker}</span>
                  <span style={{ textAlign:'right', color:'#aebfd2', fontSize:'13px' }}>{r.price}</span>
                  <span style={{ textAlign:'right', color:'#cfdcec', fontSize:'13px', fontWeight:600 }}>{r.netCr}</span>
                  <span style={{ textAlign:'right', color:teal, fontWeight:700, fontSize:'14px' }}>{r.staticYld}</span>
                  <span style={{ textAlign:'right', color:'#aebfd2', fontSize:'13px' }}>{r.ifCalled}</span>
                </div>
              ))}
              <div style={{ position:'absolute', left:0, right:0, bottom:0, height:'128px', background:`linear-gradient(to bottom,rgba(12,28,48,0) 0%,rgba(12,28,48,.85) 55%,${darkCard} 92%)`, zIndex:2, pointerEvents:'none' }} />
              <div style={{ position:'absolute', left:0, right:0, bottom:'14px', textAlign:'center', zIndex:3, fontSize:'12px', color:'#6f8298' }}>+ 142 more matches</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER TAPE ── */}
      <div style={{ background:'#060f1c', borderTop:'1px solid rgba(120,160,200,.1)', borderBottom:'1px solid rgba(120,160,200,.1)', overflow:'hidden', padding:'15px 0', position:'relative' }}>
        <div style={{ display:'flex', width:'max-content', animation:'tickerScroll 42s linear infinite' }}>
          {[0,1].map(n => (
            <div key={n} style={{ display:'flex', alignItems:'center', gap:'38px', paddingRight:'38px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:'14.5px' }}>
              {TICKER_TAPE.map((item, i) => {
                const [sym, pct] = item.split(' ')
                return (
                  <span key={i} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ color:'#cfdcec', fontWeight:700 }}>{sym} <span style={{ color:teal }}>{pct}</span></span>
                    <span style={{ color:'rgba(120,160,200,.3)' }}>|</span>
                  </span>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:'110px', background:'linear-gradient(to right,#060f1c,transparent)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'110px', background:'linear-gradient(to left,#060f1c,transparent)', pointerEvents:'none' }} />
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ background:'#ffffff', color:'#0a1628', padding:'clamp(72px,9vw,120px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', maxWidth:'620px', margin:'0 auto' }}>
            <div style={{ fontSize:'13px', fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', color:'#00b894' }}>How it works</div>
            <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'clamp(28px,4vw,44px)', letterSpacing:'-0.02em', margin:'14px 0 0', lineHeight:1.08, color:'#0a1628' }}>Three steps to a covered-call income plan</h2>
            <p style={{ fontSize:'17px', color:'#5a6b7e', lineHeight:1.6, margin:'16px 0 0' }}>No options PhD required. Screen, evaluate, and place trades on names you already trust.</p>
          </div>
          <div style={{ position:'relative', marginTop:'60px' }}>
            <div style={{ position:'absolute', top:'40px', left:'16%', right:'16%', height:'2px', background:'linear-gradient(90deg,rgba(0,184,148,.15),rgba(0,184,148,.55),rgba(0,184,148,.15))', zIndex:0 }} />
            <div style={{ position:'relative', zIndex:1, display:'flex', flexWrap:'wrap', gap:'32px', justifyContent:'center' }}>
              {[
                { n: 1, title: 'Filter for quality', desc: 'Start from a universe of liquid, fundamentally sound stocks — screen by sector, dividend, beta, and balance-sheet health.' },
                { n: 2, title: 'Rank the call options', desc: 'We score every viable strike on static yield, downside cushion, and if-called return — so the best risk/reward floats to the top.' },
                { n: 3, title: 'Pocket the premium', desc: 'Write the call, collect cash up front, and track your positions. Roll or let it get called — either way you keep the credit.' },
              ].map(step => (
                <div key={step.n} style={{ flex:'1 1 240px', minWidth:'230px', maxWidth:'320px', textAlign:'center' }}>
                  <div style={{ width:'80px', height:'80px', borderRadius:'50%', margin:'0 auto', background:'#0a1628', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'28px', color:teal, border:'3px solid #fff', boxShadow:'0 0 0 2px rgba(0,212,170,.4),0 12px 30px -10px rgba(10,22,40,.4)' }}>{step.n}</div>
                  <h3 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'20px', margin:'22px 0 0', color:'#0a1628' }}>{step.title}</h3>
                  <p style={{ fontSize:'15px', color:'#5a6b7e', lineHeight:1.6, margin:'10px 0 0' }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── METRIC CARDS ── */}
      <section id="metrics" ref={metricsRef as React.RefObject<HTMLElement>} style={{ background:'#f4f8fb', color:'#0a1628', padding:'clamp(72px,9vw,120px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth:'1140px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', maxWidth:'640px', margin:'0 auto' }}>
            <div style={{ fontSize:'13px', fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', color:'#00b894' }}>What you&apos;ll see</div>
            <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'clamp(28px,4vw,44px)', letterSpacing:'-0.02em', margin:'14px 0 0', lineHeight:1.08, color:'#0a1628' }}>Every number that decides the trade</h2>
            <p style={{ fontSize:'17px', color:'#5a6b7e', lineHeight:1.6, margin:'16px 0 0' }}>Plain-English metrics on each candidate — no Greeks decoder ring needed.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(238px,1fr))', gap:'22px', marginTop:'54px' }}>
            {[
              { icon: '$', val: `$${Math.round(counts.nc)}`, label: 'Net Credit', desc: 'Cash premium collected up front, per contract, after fees.' },
              { icon: '%', val: `${counts.sy.toFixed(1)}%`, label: 'Static Yield', desc: 'Income earned if the stock simply stays flat to expiration.' },
              { icon: '↓', val: `${counts.dc.toFixed(1)}%`, label: 'Downside Cushion', desc: 'How far the stock can fall before the trade loses money.' },
              { icon: '↗', val: `${counts.ic.toFixed(1)}%`, label: 'If-Called Return', desc: 'Total return if shares get called away at the strike price.' },
            ].map(m => (
              <div key={m.label} style={{ background:'#fff', border:'1px solid #e5edf4', borderRadius:'16px', padding:'28px 26px', boxShadow:'0 1px 2px rgba(10,22,40,.04)' }}>
                <div style={{ width:'46px', height:'46px', borderRadius:'12px', background:'rgba(0,212,170,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'22px', color:'#00b894' }}>{m.icon}</div>
                <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'42px', letterSpacing:'-0.02em', color:'#0a1628', marginTop:'22px', lineHeight:1 }}>{m.val}</div>
                <div style={{ fontWeight:700, fontSize:'15px', marginTop:'8px', color:'#0a1628' }}>{m.label}</div>
                <p style={{ fontSize:'13.5px', color:'#5a6b7e', lineHeight:1.55, margin:'7px 0 0' }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ background:'#fff', color:'#0a1628', padding:'clamp(72px,9vw,120px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth:'880px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'52px' }}>
            <div style={{ fontSize:'13px', fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', color:'#00b894' }}>Pricing</div>
            <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'clamp(28px,4vw,44px)', letterSpacing:'-0.02em', margin:'14px 0 0', lineHeight:1.08, color:'#0a1628' }}>Start free. Upgrade when it pays for itself.</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:'24px', alignItems:'stretch' }}>
            {/* Free */}
            <div style={{ background:'#fff', border:'1px solid #e2eaf2', borderRadius:'18px', padding:'34px 30px', display:'flex', flexDirection:'column' }}>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'18px', color:'#0a1628' }}>Free</div>
              <p style={{ fontSize:'14px', color:'#5a6b7e', margin:'6px 0 0' }}>For getting your first covered call on.</p>
              <div style={{ margin:'22px 0 0', display:'flex', alignItems:'flex-end', gap:'6px' }}>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'46px', letterSpacing:'-0.02em', lineHeight:1, color:'#0a1628' }}>$0</span>
                <span style={{ color:'#5a6b7e', fontSize:'15px', paddingBottom:'8px' }}>/ forever</span>
              </div>
              <Link href="/screener" style={{ margin:'24px 0 28px', display:'block', textAlign:'center', background:'#0a1628', color:'#fff', textDecoration:'none', fontWeight:600, fontSize:'15px', padding:'13px', borderRadius:'11px' }}>Open Screener</Link>
              <div style={{ display:'flex', flexDirection:'column', gap:'13px', fontSize:'14.5px', color:'#33485e' }}>
                {['Unlimited screening','End-of-day & delayed data','3 saved screens','Core income metrics'].map(f => (
                  <div key={f} style={{ display:'flex', gap:'11px', alignItems:'flex-start' }}>
                    <svg width="18" height="18" viewBox="0 0 16 16" style={{ flexShrink:0, marginTop:'1px' }}><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#00b894" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </div>
                ))}
              </div>
            </div>
            {/* Pro */}
            <div style={{ position:'relative', background:'linear-gradient(180deg,#0c1c30,#0a1628)', border:'1.5px solid #00d4aa', borderRadius:'18px', padding:'34px 30px', display:'flex', flexDirection:'column', boxShadow:'0 30px 60px -24px rgba(0,212,170,.35)' }}>
              <div style={{ position:'absolute', top:'-13px', left:'50%', transform:'translateX(-50%)', background:teal, color:'#04221b', fontWeight:700, fontSize:'12px', letterSpacing:'.03em', padding:'6px 15px', borderRadius:'100px', whiteSpace:'nowrap' }}>★ Most Popular</div>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'18px', color:'#fff' }}>Pro</div>
              <p style={{ fontSize:'14px', color:'#9fb2c8', margin:'6px 0 0' }}>Real-time data and the full toolkit.</p>
              <div style={{ margin:'22px 0 0', display:'flex', alignItems:'flex-end', gap:'6px' }}>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'46px', letterSpacing:'-0.02em', lineHeight:1, color:'#fff' }}>$29</span>
                <span style={{ color:'#9fb2c8', fontSize:'15px', paddingBottom:'8px' }}>/ month</span>
              </div>
              <div style={{ margin:'24px 0 28px', display:'flex', alignItems:'center', justifyContent:'center', gap:'9px', background:'rgba(0,212,170,.1)', border:'1px solid rgba(0,212,170,.4)', color:teal, fontWeight:700, fontSize:'15px', padding:'13px', borderRadius:'11px', cursor:'not-allowed' }}>
                <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:teal, boxShadow:`0 0 8px ${teal}`, animation:'pulseDot 2s ease-in-out infinite' }} />
                Coming Soon
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'13px', fontSize:'14.5px', color:'#cfdcec' }}>
                {['Real-time quotes & chains','Unlimited saved screens','Advanced Greeks & IV filters','Roll alerts & assignment watch','CSV & broker export'].map(f => (
                  <div key={f} style={{ display:'flex', gap:'11px', alignItems:'flex-start' }}>
                    <svg width="18" height="18" viewBox="0 0 16 16" style={{ flexShrink:0, marginTop:'1px' }}><path d="M3.5 8.5l3 3 6-7" fill="none" stroke={teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DISCLAIMER ── */}
      <div style={{ background:'#fdf3e0', borderTop:'1px solid #f0dcb4', borderBottom:'1px solid #f0dcb4', padding:'22px clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto', display:'flex', gap:'15px', alignItems:'flex-start' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:'1px' }}>
            <path d="M12 3L1.5 21h21L12 3z" stroke="#b07d18" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M12 9.5v5M12 17.5v.5" stroke="#b07d18" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize:'13px', lineHeight:1.6, color:'#7a5a18', margin:0 }}>
            <strong style={{ color:'#5e4410' }}>For educational purposes only — not investment advice.</strong> Options trading involves substantial risk and is not suitable for all investors. Writing covered calls caps upside and does not protect against losses below your cost basis. All figures shown are illustrative and not live quotes or recommendations. Past performance does not guarantee future results. Consult a licensed financial professional before trading.
          </p>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background:'#060f1c', color:'#9fb2c8', padding:'clamp(54px,7vw,80px) clamp(20px,5vw,48px) 36px' }}>
        <div style={{ maxWidth:'1140px', margin:'0 auto', display:'flex', flexWrap:'wrap', gap:'48px', justifyContent:'space-between' }}>
          <div style={{ flex:'1 1 280px', maxWidth:'340px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'11px' }}>
              <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'22px' }}>
                <div style={{ width:'5px', height:'11px', background:teal, borderRadius:'1.5px' }} />
                <div style={{ width:'5px', height:'18px', background:teal, borderRadius:'1.5px', opacity:.8 }} />
                <div style={{ width:'5px', height:'23px', background:teal, borderRadius:'1.5px', opacity:.6 }} />
              </div>
              <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'18px', color:'#fff', letterSpacing:'-0.02em' }}>YieldScreener</span>
            </div>
            <p style={{ fontSize:'14px', lineHeight:1.6, color:'#76889e', margin:'16px 0 0' }}>Income screening for self-directed investors who take their money seriously.</p>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'48px' }}>
            {[
              { heading: 'Product', links: [{ href:'#how', label:'How it works' }, { href:'#metrics', label:'Metrics' }, { href:'#pricing', label:'Pricing' }] },
              { heading: 'App', links: [{ href:'/screener', label:'Screener' }, { href:'/login', label:'Log in' }, { href:'/signup', label:'Sign up' }] },
              { heading: 'Legal', links: [{ href:'#', label:'Terms' }, { href:'#', label:'Privacy' }, { href:'#', label:'Disclosures' }] },
            ].map(col => (
              <div key={col.heading} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'13px', color:'#fff', textTransform:'uppercase', letterSpacing:'.06em' }}>{col.heading}</div>
                {col.links.map(l => (
                  <a key={l.label} href={l.href} style={{ color:'#9fb2c8', textDecoration:'none', fontSize:'14px' }}>{l.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ maxWidth:'1140px', margin:'44px auto 0', paddingTop:'24px', borderTop:'1px solid rgba(120,160,200,.12)', display:'flex', flexWrap:'wrap', gap:'12px', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'13px', color:'#5d6f85' }}>© 2026 YieldScreener. All rights reserved.</span>
          <span style={{ fontSize:'12.5px', color:'#5d6f85' }}>Not a broker-dealer. Educational information, not investment advice.</span>
        </div>
      </footer>
    </div>
  )
}
