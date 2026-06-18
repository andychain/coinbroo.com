'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useAccount_HL } from '@/hooks/useAccountHL'
import { MarketList } from '@/components/trading/MarketList'
import type { UnifiedMarket } from '@/hooks/useMarkets'

function fmt(n: number, decimals = 2) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(decimals)
}

function fmtPrice(p: number) {
  if (p === 0) return '—'
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (p >= 1) return p.toFixed(4)
  return p.toFixed(6)
}

interface TopBarProps {
  market?: UnifiedMarket
  markPrice: number
  change24h: number
  markets: UnifiedMarket[]
  onSelectMarket: (coin: string) => void
}

export function TopBar({ market, markPrice, change24h, markets, onSelectMarket }: TopBarProps) {
  const { isConnected } = useAccount()
  const { accountValue, totalPnl } = useAccount_HL()
  const [marketOpen, setMarketOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  // Lock background scroll while the market selector is open (like Hyperliquid)
  useEffect(() => {
    const el = document.documentElement
    el.style.overflow = marketOpen ? 'hidden' : ''
    return () => { el.style.overflow = '' }
  }, [marketOpen])

  const isUp = change24h >= 0
  const absChg = market && market.prevDayPx > 0 ? markPrice - market.prevDayPx : 0
  const fundingPositive = (market?.funding ?? 0) >= 0
  const isPerp = market?.kind === 'perp'

  // Pair label: perps → X-USDC, spot → X/USDC
  const pairLabel = !market
    ? '—'
    : market.kind === 'spot'
      ? `${market.display}/USDC`
      : `${market.display}-USDC`

  const stats: { label: string; value: string; color: string }[] = [
    { label: '24h Change', value: `${isUp ? '+' : ''}${change24h.toFixed(2)}%`, color: isUp ? 'text-long' : 'text-short' },
    { label: 'Prev Close', value: market && market.prevDayPx > 0 ? `$${fmtPrice(market.prevDayPx)}` : '—', color: 'text-text-primary' },
    { label: '24h Volume', value: market && market.volume24h > 0 ? `$${fmt(market.volume24h)}` : '—', color: 'text-text-primary' },
  ]
  if (isPerp) {
    stats.push({ label: 'Open Interest', value: market && market.openInterest > 0 ? `$${fmt(market.openInterest * markPrice)}` : '—', color: 'text-text-primary' })
    stats.push({ label: 'Funding (1h)', value: `${fundingPositive ? '+' : ''}${((market?.funding ?? 0) * 100).toFixed(4)}%`, color: fundingPositive ? 'text-long' : 'text-short' })
  }

  return (
    <>
      <div className="h-12 hidden md:flex items-center gap-0 px-4 bg-bg-secondary border-b border-border-primary flex-shrink-0 overflow-hidden">
        {/* Market selector + price */}
        <div className="flex items-center gap-2 md:gap-3 mr-3 md:mr-5 flex-shrink-0 border-r border-border-primary pr-3 md:pr-5">
          <button
            onClick={() => setMarketOpen(o => !o)}
            className="flex items-center gap-2 hover:bg-bg-hover rounded-md px-2 py-1.5 -mx-2 transition-colors"
          >
            <span className="text-text-primary font-bold text-base">{pairLabel}</span>
            {market && market.maxLeverage > 0 && (
              <span className="text-[10px] text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded leading-none">{market.maxLeverage}x</span>
            )}
            <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${marketOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className={`font-mono text-base font-semibold ${isUp ? 'text-long' : 'text-short'}`}>
            ${fmtPrice(markPrice)}
          </span>
        </div>

        {/* Stats row — horizontally scrollable on mobile */}
        <div className="flex items-center gap-4 md:gap-6 flex-1 overflow-x-auto scrollbar-hide whitespace-nowrap">
          {stats.map(s => (
            <div key={s.label} className="flex flex-col flex-shrink-0">
              <span className="text-2xs text-text-muted leading-none mb-1.5 border-b border-dotted border-border-secondary pb-0.5 w-fit">{s.label}</span>
              <span className={`text-xs font-mono font-medium leading-none ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Account info */}
        {isConnected && accountValue > 0 && (
          <div className="hidden lg:flex items-center gap-5 ml-4 pl-5 border-l border-border-primary flex-shrink-0">
            <div className="flex flex-col">
              <span className="text-2xs text-text-muted leading-none mb-1.5">Account Equity</span>
              <span className="text-xs font-mono font-medium text-text-primary leading-none">${accountValue.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xs text-text-muted leading-none mb-1.5">Unrealized PnL</span>
              <span className={`text-xs font-mono font-medium leading-none ${totalPnl >= 0 ? 'text-long' : 'text-short'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile bar — Hyperliquid style: pair + price header with expandable stats */}
      <div className="md:hidden bg-bg-secondary border-b border-border-primary flex-shrink-0">
        <div className="flex items-center justify-between gap-2 px-3 h-14">
          {/* Pair selector */}
          <button
            onClick={() => { setStatsOpen(false); setMarketOpen(o => !o) }}
            className="flex items-center gap-2 min-w-0"
          >
            <div className="flex flex-col items-start min-w-0">
              <span className="text-lg font-bold text-text-primary leading-tight truncate">{pairLabel}</span>
              {market && market.maxLeverage > 0 && (
                <span className="text-2xs text-accent-blue font-medium leading-none">{market.maxLeverage}x</span>
              )}
            </div>
            <svg className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${marketOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Price + change + expand toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-col items-end">
              <span className={`font-mono text-lg font-semibold leading-tight ${isUp ? 'text-long' : 'text-short'}`}>{fmtPrice(markPrice)}</span>
              <span className={`font-mono text-2xs leading-none ${isUp ? 'text-long' : 'text-short'}`}>
                {absChg !== 0 ? `${isUp ? '+' : ''}${fmtPrice(Math.abs(absChg))} / ` : ''}{isUp ? '+' : ''}{change24h.toFixed(2)}%
              </span>
            </div>
            <button
              onClick={() => setStatsOpen(o => !o)}
              aria-label="Toggle market stats"
              className="flex items-center justify-center w-8 h-8 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${statsOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expandable stats grid */}
        {statsOpen && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 pb-3 pt-1 border-t border-border-primary">
            {stats.map(s => (
              <div key={s.label} className="flex flex-col gap-1">
                <span className="text-2xs text-text-muted border-b border-dotted border-border-secondary w-fit pb-0.5">{s.label}</span>
                <span className={`text-sm font-mono font-medium ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Market selector dropdown */}
      {marketOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMarketOpen(false)} />
          <div className="fixed z-50 bg-bg-secondary shadow-2xl flex flex-col overflow-hidden
            inset-x-0 top-[104px] bottom-0 border-t border-border-primary
            md:inset-x-auto md:left-4 md:top-[88px] md:bottom-auto md:w-[820px] md:max-w-[calc(100vw-2rem)] md:h-[520px] md:border md:rounded-lg">
            <MarketList
              markets={markets}
              selected={market?.coin || ''}
              onSelect={(c) => { onSelectMarket(c); setMarketOpen(false) }}
            />
          </div>
        </>
      )}
    </>
  )
}
