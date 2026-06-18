'use client'

import { useEffect, useState } from 'react'
import type { UnifiedMarket, MarketCategory } from '@/hooks/useMarkets'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { TokenLogo } from '@/components/ui/TokenLogo'

interface MarketListProps {
  markets: UnifiedMarket[]
  selected: string
  onSelect: (coin: string) => void
}

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (p >= 1) return p.toFixed(3)
  return p.toFixed(5)
}

function fmtUsd(n: number) {
  if (n <= 0) return '—'
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtVol(n: number) {
  return '$' + Math.max(0, n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// Compact USD (e.g. $227M, $27.4M, $8.70M) — used on mobile where space is tight
function fmtCompactUsd(n: number) {
  if (n <= 0) return '—'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e8) return '$' + (n / 1e6).toFixed(0) + 'M'
  if (n >= 1e7) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

const TAB_ORDER: (MarketCategory | 'All')[] = ['All', 'Perps', 'Spot']

type SortKey = 'symbol' | 'price' | 'change' | 'funding' | 'volume' | 'oi'
type SortDir = 'asc' | 'desc'

// Remember the user's last filter choice (category + Strict/All) across opens
// and reloads, like Hyperliquid.
const PREFS_KEY = 'cb:marketSelectorPrefs'
function loadPrefs(): { category: MarketCategory | 'All'; strict: boolean } {
  const fallback = { category: 'All' as const, strict: true }
  if (typeof window === 'undefined') return fallback
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return {
      category: TAB_ORDER.includes(p.category) ? p.category : 'All',
      strict: typeof p.strict === 'boolean' ? p.strict : true,
    }
  } catch {
    return fallback
  }
}

export function MarketList({ markets, selected, onSelect }: MarketListProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MarketCategory | 'All'>(() => loadPrefs().category)
  const [strict, setStrict] = useState(() => loadPrefs().strict)
  const [sortKey, setSortKey] = useState<SortKey>('volume')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const isMobile = useMediaQuery('(max-width: 767px)')

  // Persist filter choice whenever it changes
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ category, strict })) } catch { /* ignore */ }
  }, [category, strict])

  const spotView = category === 'Spot'

  const available = TAB_ORDER.filter(t => t === 'All' || markets.some(m => m.category === t))

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' ? 'asc' : 'desc')
    }
  }

  function sortVal(m: UnifiedMarket, key: SortKey): number | string {
    switch (key) {
      case 'symbol': return m.display.toLowerCase()
      case 'price': return m.price
      case 'change': return m.change24h
      case 'funding': return m.funding
      case 'volume': return m.volume24h
      case 'oi': return spotView ? (m.marketCap || 0) : m.openInterest * m.price
    }
  }

  let list = markets.filter(m => {
    const matchesCat = category === 'All' || m.category === category
    const q = search.toLowerCase()
    const matchesSearch = m.display.toLowerCase().includes(q) || m.coin.toLowerCase().includes(q)
    // Strict shows only verified markets (perps, HL-canonical, or Coinbroo-approved)
    const matchesStrict = !strict || m.verified
    return matchesCat && matchesSearch && matchesStrict
  })
  list = list.slice().sort((a, b) => {
    const va = sortVal(a, sortKey)
    const vb = sortVal(b, sortKey)
    let cmp: number
    if (typeof va === 'string' && typeof vb === 'string') cmp = va.localeCompare(vb)
    else cmp = (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const pairSuffix = (m: UnifiedMarket) => (m.kind === 'spot' ? '/USDC' : '-USDC')

  const gridCols = isMobile
    ? 'grid-cols-[1.5fr_1fr_1.1fr]'
    : spotView
      ? 'grid-cols-[1.6fr_1fr_1.3fr_1.1fr_1.3fr]'
      : 'grid-cols-[1.6fr_1fr_1.3fr_0.9fr_1.1fr_1.1fr]'

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'desc' ? '▾' : '▴') : '')

  function SortHeader({ label, k, align = 'right' }: { label: string; k: SortKey; align?: 'left' | 'right' }) {
    const active = sortKey === k
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-0.5 text-2xs hover:text-text-secondary transition-colors ${
          align === 'right' ? 'justify-end' : 'justify-start'
        } ${active ? 'text-text-primary' : 'text-text-muted'}`}
      >
        <span>{label}</span>
        <span className="w-2 text-accent-blue">{arrow(k)}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search + Strict/All */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-primary flex-shrink-0">
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search markets..."
            className="w-full bg-bg-tertiary border border-border-primary rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-secondary"
          />
        </div>
        {/* Strict / All toggle */}
        <div className="flex items-center bg-bg-tertiary rounded-lg p-0.5 flex-shrink-0">
          {(['Strict', 'All'] as const).map(opt => {
            const isStrict = opt === 'Strict'
            const active = strict === isStrict
            return (
              <button
                key={opt}
                onClick={() => setStrict(isStrict)}
                className={`w-16 py-1.5 text-xs font-semibold rounded-md text-center transition-colors ${
                  active
                    ? isStrict
                      ? 'bg-accent-blue text-bg-primary'
                      : 'bg-short text-white'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border-primary flex-shrink-0 overflow-x-auto">
        {available.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1 text-xs rounded-md font-medium whitespace-nowrap transition-colors ${
              category === c ? 'text-accent-blue border-b-2 border-accent-blue rounded-none' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table header (sortable) */}
      <div className={`grid ${gridCols} px-3 py-1.5 border-b border-border-primary flex-shrink-0`}>
        {isMobile ? (
          <>
            <SortHeader label="Symbol" k="symbol" align="left" />
            <SortHeader label="Volume" k="volume" />
            <SortHeader label="Last / 24h" k="price" />
          </>
        ) : (
          <>
            <SortHeader label="Symbol" k="symbol" align="left" />
            <SortHeader label="Last Price" k="price" />
            <SortHeader label="24h Change" k="change" />
            {!spotView && <SortHeader label="8h Funding" k="funding" />}
            <SortHeader label="Volume" k="volume" />
            <SortHeader label={spotView ? 'Market Cap' : 'Open Interest'} k="oi" />
          </>
        )}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-text-muted">No markets</div>
        ) : (
          list.map(m => {
            const isUp = m.change24h >= 0
            const isSelected = m.coin === selected
            const absChg = m.prevDayPx > 0 ? m.price - m.prevDayPx : 0
            return (
              <button
                key={m.coin}
                onClick={() => onSelect(m.coin)}
                className={`w-full grid ${gridCols} items-center px-3 py-2.5 border-b border-border-primary/40 transition-colors hover:bg-bg-hover text-left ${
                  isSelected ? 'bg-bg-hover' : ''
                }`}
              >
                {isMobile ? (
                  <>
                    {/* Logo + symbol + badges, stacked */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TokenLogo symbol={m.display} size={28} />
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-md font-medium text-text-primary truncate">{m.display}{pairSuffix(m)}</span>
                        <div className="flex items-center gap-1">
                          {m.maxLeverage > 0 && (
                            <span className="text-[9px] text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded leading-none">{m.maxLeverage}x</span>
                          )}
                          {m.kind === 'spot' && (
                            <span className="text-[9px] text-accent-blue bg-bg-tertiary px-1 py-0.5 rounded leading-none">SPOT</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Volume (compact) */}
                    <span className="text-sm font-mono text-text-secondary text-right tabular-nums">{fmtCompactUsd(m.volume24h)}</span>
                    {/* Last price + 24h change, stacked */}
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-sm font-mono text-text-primary tabular-nums">{fmtPrice(m.price)}</span>
                      <span className={`text-xs font-mono tabular-nums ${isUp ? 'text-long' : 'text-short'}`}>
                        {isUp ? '+' : ''}{m.change24h.toFixed(2)}%
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Symbol */}
                    <div className="flex items-center gap-2 min-w-0">
                      <TokenLogo symbol={m.display} size={20} />
                      <span className="text-sm font-medium text-text-primary truncate">{m.display}{pairSuffix(m)}</span>
                      {m.maxLeverage > 0 && (
                        <span className="text-[9px] text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded leading-none flex-shrink-0">{m.maxLeverage}x</span>
                      )}
                      {m.kind === 'spot' && (
                        <span className="text-[9px] text-accent-blue bg-bg-tertiary px-1 py-0.5 rounded leading-none flex-shrink-0">SPOT</span>
                      )}
                    </div>
                    {/* Last price */}
                    <span className="text-sm font-mono text-text-primary text-right tabular-nums">{fmtPrice(m.price)}</span>
                    {/* 24h change */}
                    <span className={`text-xs font-mono text-right tabular-nums ${isUp ? 'text-long' : 'text-short'}`}>
                      {absChg !== 0 ? `${isUp ? '+' : ''}${fmtPrice(Math.abs(absChg))} / ` : ''}{isUp ? '+' : ''}{m.change24h.toFixed(2)}%
                    </span>
                    {/* Funding — perps view only */}
                    {!spotView && (
                      <span className="text-xs font-mono text-text-secondary text-right tabular-nums">
                        {m.kind === 'perp' ? `${(m.funding * 100).toFixed(4)}%` : '—'}
                      </span>
                    )}
                    {/* Volume */}
                    <span className="text-xs font-mono text-text-secondary text-right tabular-nums">{fmtVol(m.volume24h)}</span>
                    {/* Market Cap (spot) or Open Interest (perps) */}
                    <span className="text-xs font-mono text-text-secondary text-right tabular-nums">
                      {spotView
                        ? (m.marketCap ? fmtUsd(m.marketCap) : '—')
                        : (m.kind === 'perp' ? fmtUsd(m.openInterest * m.price) : '—')}
                    </span>
                  </>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
