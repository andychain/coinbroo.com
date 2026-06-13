'use client'

import { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useWalletClient } from 'wagmi'
import { postExchange } from '@/lib/hyperliquid'
import { signOrder } from '@/lib/signing'
import { useAccount_HL } from '@/hooks/useAccountHL'
import { useOnboarding } from '@/hooks/useOnboarding'
import { OnboardingModal } from '@/components/ui/OnboardingModal'
import { BUILDER_FEE } from '@/lib/hyperliquid'

interface TradePanelProps {
  coin: string
  markPrice: number
  assetIndex: number
  maxLeverage: number
  onOrderPlaced?: () => void
}

type Side = 'long' | 'short'
type OrderType = 'market' | 'limit'

const HL_TAKER_FEE = 0.00035   // 0.035%
const HL_MAKER_FEE = -0.0001   // -0.010% rebate
const BUILDER_FEE_RATE = BUILDER_FEE / 100000

export function TradePanel({ coin, markPrice, assetIndex, maxLeverage, onOrderPlaced }: TradePanelProps) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { availableBalance, refresh } = useAccount_HL()
  const { state, error, isNew, isApproved, ensureApproved, reset } = useOnboarding()

  const [side, setSide] = useState<Side>('long')
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [sizeUsd, setSizeUsd] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [leverage, setLeverage] = useState(10)
  const [placing, setPlacing] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const isLong = side === 'long'

  const orderValue = useMemo(() => {
    const sz = parseFloat(sizeUsd) || 0
    return sz * leverage
  }, [sizeUsd, leverage])

  const sizeCoin = useMemo(() => {
    const usd = parseFloat(sizeUsd) || 0
    const px = orderType === 'limit' ? parseFloat(limitPrice) || markPrice : markPrice
    if (px === 0) return 0
    return (usd * leverage) / px
  }, [sizeUsd, leverage, limitPrice, markPrice, orderType])

  const liqPrice = useMemo(() => {
    if (!sizeCoin || !markPrice) return null
    const liqPct = 1 / leverage * 0.9
    return isLong ? markPrice * (1 - liqPct) : markPrice * (1 + liqPct)
  }, [sizeCoin, markPrice, leverage, isLong])

  const hlFeeUsd = useMemo(() => {
    const rate = orderType === 'market' ? HL_TAKER_FEE : HL_MAKER_FEE
    return orderValue * rate
  }, [orderValue, orderType])

  const builderFeeUsd = useMemo(() => {
    return orderValue * BUILDER_FEE_RATE
  }, [orderValue])

  async function placeOrder() {
    if (!walletClient || !isConnected || !address) return
    if (!sizeUsd || parseFloat(sizeUsd) <= 0) {
      setStatus({ type: 'error', msg: 'Enter a valid size' })
      return
    }

    // If not yet approved, run approval first
    if (!isApproved(address)) {
      const approved = await ensureApproved(address)
      if (!approved) return // approval failed or pending — modal is showing
    }

    setPlacing(true)
    setStatus(null)

    try {
      const px = orderType === 'limit' ? parseFloat(limitPrice) : undefined
      const { action, nonce, signature } = await signOrder(walletClient, {
        coin,
        isBuy: isLong,
        sz: sizeCoin,
        px,
      })

      const actionWithAsset = {
        ...action,
        orders: [(action as { orders: { a: number }[] }).orders[0]
          ? { ...(action as { orders: { a: number }[] }).orders[0], a: assetIndex }
          : { a: assetIndex }],
      }

      const result = await postExchange(actionWithAsset, nonce, signature)

      if (result?.status === 'ok') {
        setStatus({ type: 'success', msg: `${isLong ? 'Long' : 'Short'} order placed!` })
        setSizeUsd('')
        onOrderPlaced?.()
        setTimeout(refresh, 1000)
      } else {
        throw new Error(result?.response?.data?.statuses?.[0] || 'Order failed')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Order failed'
      setStatus({ type: 'error', msg })
    } finally {
      setPlacing(false)
    }
  }

  const leverageOptions = [2, 5, 10, 20, 50].filter(l => l <= maxLeverage)

  return (
    <>
      {/* Approval modal — only shows when triggered by Place Order */}
      <OnboardingModal
        state={state}
        isNew={isNew}
        error={error}
        onClose={reset}
      />

      <div className="flex flex-col h-full p-3 gap-3 overflow-y-auto">
        {/* Long / Short */}
        <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-border-primary">
          <button
            onClick={() => setSide('long')}
            className={`py-2 text-sm font-semibold transition-colors ${
              isLong ? 'bg-long text-white' : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setSide('short')}
            className={`py-2 text-sm font-semibold transition-colors ${
              !isLong ? 'bg-short text-white' : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            Short
          </button>
        </div>

        {/* Order type */}
        <div className="flex gap-1.5">
          {(['market', 'limit'] as OrderType[]).map(t => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 py-1 text-xs rounded capitalize transition-colors border ${
                orderType === t
                  ? 'border-accent-blue text-accent-blue bg-blue-950/30'
                  : 'border-border-primary text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Limit price */}
        {orderType === 'limit' && (
          <div>
            <label className="text-2xs text-text-muted block mb-1">Limit price (USD)</label>
            <input
              type="number"
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              placeholder={markPrice.toFixed(1)}
              className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-border-secondary"
            />
          </div>
        )}

        {/* Size */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-2xs text-text-muted">Size (USD)</label>
            {availableBalance > 0 && (
              <button
                onClick={() => setSizeUsd((availableBalance * 0.95).toFixed(2))}
                className="text-2xs text-accent-blue hover:text-blue-400"
              >
                Max ${availableBalance.toFixed(0)}
              </button>
            )}
          </div>
          <input
            type="number"
            value={sizeUsd}
            onChange={e => setSizeUsd(e.target.value)}
            placeholder="0.00"
            className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-border-secondary"
          />
          {sizeCoin > 0 && (
            <p className="text-2xs text-text-muted mt-1">≈ {sizeCoin.toFixed(4)} {coin}</p>
          )}
        </div>

        {/* Leverage */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-2xs text-text-muted">Leverage</label>
            <span className="text-xs font-medium text-text-primary">{leverage}x</span>
          </div>
          <div className="flex gap-1">
            {leverageOptions.map(l => (
              <button
                key={l}
                onClick={() => setLeverage(l)}
                className={`flex-1 py-1 text-xs rounded transition-colors ${
                  leverage === l
                    ? 'bg-bg-hover text-text-primary font-medium'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {l}x
              </button>
            ))}
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-bg-tertiary rounded-lg p-2.5 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Order value</span>
            <span className="text-text-primary font-mono">${orderValue.toFixed(2)}</span>
          </div>
          {liqPrice && (
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Est. liquidation</span>
              <span className="text-short font-mono">${liqPrice.toFixed(1)}</span>
            </div>
          )}
          <div className="border-t border-border-primary pt-1.5 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">
                {orderType === 'market' ? 'Taker fee (0.035%)' : 'Maker fee (-0.010%)'}
              </span>
              <span className={`font-mono ${orderType === 'limit' ? 'text-long' : 'text-text-secondary'}`}>
                {orderType === 'limit' ? '-' : ''}${Math.abs(hlFeeUsd).toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Builder fee ({(BUILDER_FEE / 1000).toFixed(3)}%)</span>
              <span className="text-text-secondary font-mono">${builderFeeUsd.toFixed(4)}</span>
            </div>
            {orderValue > 0 && (
              <div className="flex justify-between text-xs border-t border-border-primary pt-1">
                <span className="text-text-secondary font-medium">Total fee</span>
                <span className={`font-mono font-medium ${orderType === 'limit' && hlFeeUsd + builderFeeUsd < 0 ? 'text-long' : 'text-text-primary'}`}>
                  {(hlFeeUsd + builderFeeUsd) < 0 ? '-' : ''}${Math.abs(hlFeeUsd + builderFeeUsd).toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className={`text-xs px-3 py-2 rounded-lg ${
            status.type === 'success' ? 'bg-long-bg text-long' : 'bg-short-bg text-short'
          }`}>
            {status.msg}
          </div>
        )}

        {/* Submit */}
        {isConnected ? (
          <button
            onClick={placeOrder}
            disabled={placing || !sizeUsd}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isLong ? 'bg-long hover:bg-long-dim' : 'bg-short hover:bg-short-dim'
            }`}
          >
            {placing ? 'Placing...' : `${isLong ? 'Buy / Long' : 'Sell / Short'} ${coin}`}
          </button>
        ) : (
          <div className="text-center text-xs text-text-muted py-2">
            Connect wallet to trade
          </div>
        )}
      </div>
    </>
  )
}
