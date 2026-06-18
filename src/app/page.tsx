'use client'

import { useState, useCallback, useMemo } from 'react'
import { NavBar } from '@/components/layout/NavBar'
import { TopBar } from '@/components/layout/TopBar'
import { Footer } from '@/components/layout/Footer'
import { Chart } from '@/components/trading/Chart'
import { OrderBook } from '@/components/trading/OrderBook'
import { TradePanel } from '@/components/trading/TradePanel'
import { Positions } from '@/components/trading/Positions'
import { useHLWebSocket } from '@/hooks/useHLWebSocket'
import { useAutoDisconnect } from '@/hooks/useAutoDisconnect'
import { useMarkets } from '@/hooks/useMarkets'
import { useBaseFees } from '@/hooks/useBaseFees'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { OrderBook as OBType, Trade } from '@/hooks/useHLWebSocket'

export default function TradingPage() {
  const [selectedCoin, setSelectedCoin] = useState('BTC')
  const [mids, setMids] = useState<Record<string, number>>({})
  const [orderBooks, setOrderBooks] = useState<Record<string, OBType>>({})
  const [trades, setTrades] = useState<Record<string, Trade[]>>({})
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [mobileTab, setMobileTab] = useState<'trade' | 'book'>('trade')
  useAutoDisconnect()

  const markets = useMarkets()
  const baseFees = useBaseFees()

  const marketByCoin = useMemo(() => {
    const m: Record<string, (typeof markets)[number]> = {}
    markets.forEach(mk => { m[mk.coin] = mk })
    return m
  }, [markets])

  // Coin → core-perp asset index (for closing positions)
  const assetIndexMap = useMemo(() => {
    const m: Record<string, number> = {}
    markets.forEach(mk => { if (mk.kind === 'perp') m[mk.coin] = mk.assetIndex })
    return m
  }, [markets])

  const handleOrderBook = useCallback((data: OBType) => {
    setOrderBooks(prev => ({ ...prev, [data.coin]: data }))
  }, [])

  const handleTrade = useCallback((data: Trade[]) => {
    if (!data.length) return
    const coin = data[0].coin
    setTrades(prev => {
      const existing = prev[coin] || []
      return { ...prev, [coin]: [...data.slice().reverse(), ...existing].slice(0, 40) }
    })
  }, [])

  const handleAllMids = useCallback((data: Record<string, string>) => {
    setMids(prev => {
      const next = { ...prev }
      Object.entries(data).forEach(([k, v]) => { next[k] = parseFloat(v) })
      return next
    })
  }, [])

  useHLWebSocket({ activeCoin: selectedCoin, onOrderBook: handleOrderBook, onTrade: handleTrade, onAllMids: handleAllMids })

  const market = marketByCoin[selectedCoin]
  const currentOB = orderBooks[selectedCoin]
  const bids = currentOB?.levels?.[0] || []
  const asks = currentOB?.levels?.[1] || []
  const topBid = bids[0] ? parseFloat(bids[0].px) : 0
  const topAsk = asks[0] ? parseFloat(asks[0].px) : 0
  const bookMid = topBid && topAsk ? (topBid + topAsk) / 2 : 0

  // Live price: perps via allMids WS; spot/dex via order-book mid, fallback to polled price
  const markPrice = market?.kind === 'perp'
    ? (mids[selectedCoin] || market?.price || 0)
    : (bookMid || market?.price || 0)

  const change24h = market && market.prevDayPx > 0 ? ((markPrice - market.prevDayPx) / market.prevDayPx) * 100 : (market?.change24h || 0)
  const spread = topAsk && topBid ? topAsk - topBid : 0
  const pairLabel = market ? (market.kind === 'spot' ? `${market.display}/USDC` : `${market.display}-USDC`) : selectedCoin

  // Shared panels — rendered into either the desktop columns or the mobile stack
  const chartEl = <Chart key={selectedCoin} coin={selectedCoin} label={pairLabel} />
  const orderBookEl = (
    <OrderBook
      coin={market?.display || selectedCoin}
      bids={bids}
      asks={asks}
      markPrice={markPrice}
      spread={spread}
      trades={trades[selectedCoin] || []}
      szDecimals={market?.szDecimals ?? 2}
    />
  )
  const tradePanelEl = (
    <TradePanel
      coin={market?.display || selectedCoin}
      markPrice={markPrice}
      assetIndex={market?.assetIndex ?? -1}
      maxLeverage={market?.maxLeverage || 50}
      baseTakerFee={baseFees.taker}
      baseMakerFee={baseFees.maker}
      isSpot={market?.kind === 'spot'}
      szDecimals={market?.szDecimals ?? 4}
      baseToken={market?.baseToken}
      onOrderPlaced={() => {}}
    />
  )

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary">
      <NavBar />
      <TopBar
        market={market}
        markPrice={markPrice}
        change24h={change24h}
        markets={markets}
        onSelectMarket={setSelectedCoin}
      />

      {isMobile ? (
        /* Mobile: chart on top, then a Trade / Order Book tab switch */
        <div className="flex flex-col">
          <div className="h-[58vh] min-h-[340px] flex flex-col border-b border-border-primary">
            {chartEl}
          </div>

          <div className="flex border-b border-border-primary bg-bg-secondary flex-shrink-0">
            {([['trade', 'Trade'], ['book', 'Order Book']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMobileTab(key)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  mobileTab === key
                    ? 'text-text-primary border-b-2 border-accent-blue -mb-px'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mobileTab === 'trade' ? (
            <div className="flex flex-col">{tradePanelEl}</div>
          ) : (
            <div className="h-[480px] flex flex-col">{orderBookEl}</div>
          )}
        </div>
      ) : (
        /* Desktop: trading row fills the first viewport; scroll down for positions/balances */
        <div className="flex h-[calc(100vh-6rem)] overflow-hidden flex-shrink-0">
          {/* Chart — native Hyperliquid candles (perps + spot) */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {chartEl}
          </div>

          {/* Order book */}
          <div className="w-52 flex-shrink-0 border-l border-border-primary flex flex-col">
            {orderBookEl}
          </div>

          {/* Trade panel */}
          <div className="w-60 flex-shrink-0 border-l border-border-primary flex flex-col min-h-0">
            {tradePanelEl}
          </div>
        </div>
      )}

      {/* Positions / balances — revealed by scrolling down */}
      <div className="border-t border-border-primary bg-bg-secondary">
        <Positions markPrices={mids} assetIndexMap={assetIndexMap} />
      </div>

      <Footer />
    </div>
  )
}
