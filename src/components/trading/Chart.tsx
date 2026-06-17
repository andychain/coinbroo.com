'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts'
import { getCandleSnapshot } from '@/lib/hyperliquid'

const WS_URL = 'wss://api.hyperliquid.xyz/ws'
const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
type Interval = typeof INTERVALS[number]

const LONG = '#1fb98a'
const SHORT = '#ed7088'

const INTERVAL_MS: Record<Interval, number> = {
  '1m': 60e3, '5m': 300e3, '15m': 900e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3,
}

interface ChartProps {
  coin: string   // HL coin id (e.g. "BTC", "@107", "PURR/USDC")
  label: string  // display label (e.g. "BTC-USDC")
}

export function Chart({ coin, label }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const [interval, setInterval] = useState<Interval>('15m')

  // Create the chart once
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#7d8a8c', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { borderColor: '#1f2628' },
      timeScale: { borderColor: '#1f2628', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      autoSize: true,
    })

    const candle = chart.addCandlestickSeries({
      upColor: LONG, downColor: SHORT, borderVisible: false, wickUpColor: LONG, wickDownColor: SHORT,
    })
    const vol = chart.addHistogramSeries({
      priceFormat: { type: 'volume' }, priceScaleId: '',
    })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chartRef.current = chart
    candleRef.current = candle
    volRef.current = vol

    return () => { chart.remove(); chartRef.current = null }
  }, [])

  // Load history + live updates whenever coin/interval changes
  useEffect(() => {
    if (!candleRef.current || !volRef.current) return
    let cancelled = false

    const end = Date.now()
    const start = end - INTERVAL_MS[interval] * 300

    getCandleSnapshot(coin, interval, start, end).then(candles => {
      if (cancelled || !candleRef.current || !volRef.current) return
      candleRef.current.setData(candles.map(c => ({
        time: (c.t / 1000) as UTCTimestamp,
        open: +c.o, high: +c.h, low: +c.l, close: +c.c,
      })))
      volRef.current.setData(candles.map(c => ({
        time: (c.t / 1000) as UTCTimestamp,
        value: +c.v,
        color: +c.c >= +c.o ? 'rgba(31,185,138,0.4)' : 'rgba(237,112,136,0.4)',
      })))
      chartRef.current?.timeScale().fitContent()
    }).catch(() => {})

    // Live candle updates
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'candle', coin, interval } }))
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.channel !== 'candle' || !msg.data) return
        const c = msg.data
        const t = (c.t / 1000) as UTCTimestamp
        candleRef.current?.update({ time: t, open: +c.o, high: +c.h, low: +c.l, close: +c.c })
        volRef.current?.update({ time: t, value: +c.v, color: +c.c >= +c.o ? 'rgba(31,185,138,0.4)' : 'rgba(237,112,136,0.4)' })
      } catch { /* ignore */ }
    }

    return () => { cancelled = true; ws.close() }
  }, [coin, interval])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 h-9 border-b border-border-primary flex-shrink-0">
        <span className="text-sm font-semibold text-text-primary mr-3">{label}</span>
        <span className="text-2xs text-text-muted mr-2">Hyperliquid</span>
        <div className="flex items-center gap-0.5 ml-auto">
          {INTERVALS.map(iv => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`px-2 py-1 text-2xs font-medium rounded transition-colors ${
                interval === iv ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}
