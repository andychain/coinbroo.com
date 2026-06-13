'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { TopBar } from '@/components/layout/TopBar'
import { OrderBook } from '@/components/trading/OrderBook'
import { TradePanel } from '@/components/trading/TradePanel'
import { Positions } from '@/components/trading/Positions'
import { MarketList } from '@/components/trading/MarketList'
import { useHLWebSocket } from '@/hooks/useHLWebSocket'
import { getMeta, getAllMids } from '@/lib/hyperliquid'
import type { OrderBook as OBType } from '@/hooks/useHLWebSocket'

const DEFAULT_COINS = ['BTC', 'ETH', 'SOL', 'ARB', 'AVAX', 'HYPE', 'SUI', 'WIF', 'PEPE', 'DOGE']

interface MetaUniverse {
  name: string
  szDecimals: number
  maxLeverage: number
}

interface Meta {
  universe: MetaUniverse[]
}

export default function TradingPage() {
  const [selectedCoin, setSelectedCoin] = useState('BTC')
  const [meta, setMeta] = useState<Meta>({ universe: [] })
  const [mids, setMids] = useState<Record<string, number>>({})
  const [orderBook, setOrderBook] = useState<OBType | null>(null)
  const [priceHistory, setPriceHistory] = useState<Record<string, { price: number; prev: number }>>({})

  // Load meta (market info) on mount
  useEffect(() => {
    getMeta().then(m => {
      if (m?.universe) setMeta(m)
    })
    getAllMids().then(allMids => {
      const parsed: Record<string, number> = {}
      Object.entries(allMids).forEach(([k, v]) => {
        parsed[k] = parseFloat(v as string)
      })
      setMids(parsed)
    })
  }, [])

  // WebSocket for live data
  const handleOrderBook = useCallback((data: OBType) => {
    if (data.coin === selectedCoin) setOrderBook(data)
  }, [selectedCoin])

  const handleAllMids = useCallback((data: Record<string, string>) => {
    setMids(prev => {
      const next: Record<string, number> = { ...prev }
      Object.entries(data).forEach(([k, v]) => {
        const price = parseFloat(v)
        setPriceHistory(ph => ({
          ...ph,
          [k]: { price, prev: ph[k]?.price || price }
        }))
        next[k] = price
      })
      return next
    })
  }, [])

  const { connected } = useHLWebSocket({
    coins: DEFAULT_COINS,
    onOrderBook: handleOrderBook,
    onAllMids: handleAllMids,
  })

  const currentAsset = meta.universe.find(u => u.name === selectedCoin)
  const markPrice = mids[selectedCoin] || 0
  const markPrev = priceHistory[selectedCoin]?.prev || markPrice
  const priceChange = markPrev > 0 ? ((markPrice - markPrev) / markPrev) * 100 : 0

  // Build market list from mids
  const markets = DEFAULT_COINS
    .filter(c => mids[c])
    .map(c => ({
      name: c,
      price: mids[c],
      change24h: priceHistory[c]
        ? ((mids[c] - priceHistory[c].prev) / priceHistory[c].prev) * 100
        : 0,
      volume24h: 0,
      funding: 0,
    }))

  // Order book data
  const bids = orderBook?.levels?.[0] || []
  const asks = orderBook?.levels?.[1] || []
  const topBid = bids[0] ? parseFloat(bids[0].px) : markPrice * 0.9995
  const topAsk = asks[0] ? parseFloat(asks[0].px) : markPrice * 1.0005
  const spread = topAsk - topBid

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
<TopBar
        selectedMarket={selectedCoin}
        markPrice={markPrice}
        priceChange={priceChange}
      />



      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Market list - left sidebar */}
        <div className="w-44 flex-shrink-0 border-r border-border-primary hidden lg:flex flex-col">
          <div className="px-2.5 py-1.5 border-b border-border-primary">
            <span className="text-2xs text-text-muted uppercase tracking-wider">Markets</span>
          </div>
          <MarketList
            markets={markets}
            selected={selectedCoin}
            onSelect={setSelectedCoin}
          />
        </div>

        {/* Order book */}
        <div className="w-48 flex-shrink-0 border-r border-border-primary hidden md:flex flex-col">
          <div className="px-2.5 py-1.5 border-b border-border-primary">
            <span className="text-2xs text-text-muted uppercase tracking-wider">Order Book</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <OrderBook
              bids={bids}
              asks={asks}
              markPrice={markPrice}
              spread={spread}
            />
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border-primary">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-primary flex-shrink-0">
            <span className="text-2xs text-text-muted uppercase tracking-wider">{selectedCoin}-PERP</span>
            <span className="text-xs text-text-primary font-mono font-medium">
              ${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {/* TradingView widget placeholder */}
          <div className="flex-1 flex items-center justify-center bg-bg-tertiary">
            <div className="text-center">
              <p className="text-text-muted text-sm mb-2">Chart</p>
              <p className="text-text-muted text-xs">
                Embed TradingView widget here:<br />
                <code className="text-accent-blue text-2xs">new TradingView.widget(&#123; symbol: &quot;HYPERLIQUID:{selectedCoin}USDT&quot; &#125;)</code>
              </p>
            </div>
          </div>
        </div>

        {/* Trade panel */}
        <div className="w-52 flex-shrink-0 border-l border-border-primary flex flex-col">
          <div className="px-2.5 py-1.5 border-b border-border-primary flex-shrink-0">
            <span className="text-2xs text-text-muted uppercase tracking-wider">Place Order</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <TradePanel
              coin={selectedCoin}
              markPrice={markPrice}
              assetIndex={meta.universe.findIndex(u => u.name === selectedCoin)}
              maxLeverage={currentAsset?.maxLeverage || 50}
              onOrderPlaced={() => {}}
            />
          </div>
        </div>
      </div>

      {/* Positions bar */}
      <div className="h-48 border-t border-border-primary flex-shrink-0 bg-bg-secondary">
        <Positions markPrices={mids} meta={meta} />
      </div>
    </div>
  )
}
