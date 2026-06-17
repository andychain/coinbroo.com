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

  // Lock background scroll while the market selector is open (like Hyperliquid)
  useEffect(() => {
    const el = document.documentElement
    el.style.overflow = marketOpen ? 'hidden' : ''
    return () => { el.style.overflow = '' }
  }, [marketOpen])

  const isUp = change24h >= 0
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
      <div className="h-12 flex items-center gap-0 px-4 bg-bg-secondary border-b border-border-primary flex-shrink-0 overflow-hidden">
        {/* Market selector + price */}
        <div className="flex items-center gap-3 mr-5 flex-shrink-0 border-r border-border-primary pr-5">
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

        {/* Stats row */}
        <div className="flex items-center gap-6 flex-1 overflow-hidden">
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

      {/* Market selector dropdown */}
      {marketOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMarketOpen(false)} />
          <div className="fixed left-4 top-[88px] z-50 w-[820px] max-w-[calc(100vw-2rem)] h-[520px] bg-bg-secondary border border-border-primary rounded-lg shadow-2xl flex flex-col overflow-hidden">
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
