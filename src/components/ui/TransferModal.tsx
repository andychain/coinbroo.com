'use client'

import { useState } from 'react'
import { useAccount, useWalletClient, useReadContract } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { parseUnits, formatUnits, encodeFunctionData } from 'viem'
import { postExchange } from '@/lib/hyperliquid'
import { signWithdraw } from '@/lib/signing'

// Hyperliquid bridge on Arbitrum
const HL_BRIDGE = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7' as const
const USDC_ARBITRUM = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const

const ERC20_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

const BRIDGE_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'usd', type: 'uint64' }], outputs: [] },
] as const

type Tab = 'deposit' | 'withdraw'

interface TransferModalProps {
  availableBalance: number
  initialTab?: Tab
  onClose: () => void
}

export function TransferModal({ availableBalance, initialTab = 'deposit', onClose }: TransferModalProps) {
  const { address, chain } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [tab, setTab] = useState<Tab>(initialTab)
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading'; msg: string } | null>(null)

  const onArbitrum = chain?.id === arbitrum.id
  const amountNum = parseFloat(amount) || 0

  // Read USDC balance on Arbitrum
  const { data: usdcBalance } = useReadContract({
    address: USDC_ARBITRUM,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && onArbitrum },
  })

  const usdcBalanceNum = usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)) : 0

  async function handleDeposit() {
    if (!address || !amountNum || !walletClient) return
    try {
      if (!onArbitrum) {
        setStatus({ type: 'loading', msg: 'Switching to Arbitrum...' })
        await walletClient.switchChain({ id: arbitrum.id })
      }

      const usdAmount = parseUnits(amount, 6)

      setStatus({ type: 'loading', msg: 'Approving USDC...' })
      await walletClient.sendTransaction({
        to: USDC_ARBITRUM,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [HL_BRIDGE, usdAmount] }),
        chain: arbitrum,
      })

      setStatus({ type: 'loading', msg: 'Depositing...' })
      await walletClient.sendTransaction({
        to: HL_BRIDGE,
        data: encodeFunctionData({ abi: BRIDGE_ABI, functionName: 'deposit', args: [BigInt(Math.floor(amountNum * 1e6))] }),
        chain: arbitrum,
      })

      setStatus({ type: 'success', msg: `Deposited $${amount} USDC. It may take ~1 min to appear.` })
      setAmount('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Deposit failed'
      const isRejected = msg.includes('rejected') || msg.includes('denied') || msg.includes('cancel')
      if (!isRejected) setStatus({ type: 'error', msg })
      else setStatus(null)
    }
  }

  async function handleWithdraw() {
    if (!walletClient || !address || !amountNum) return
    setStatus({ type: 'loading', msg: 'Sign the withdrawal...' })
    try {
      const { action, nonce, signature } = await signWithdraw(walletClient, amount, address)
      const result = await postExchange(action, nonce, signature)
      if (result?.status === 'ok') {
        setStatus({ type: 'success', msg: `Withdrew $${amount} USDC to your wallet.` })
        setAmount('')
      } else {
        throw new Error(result?.response?.data?.statuses?.[0] || 'Withdraw failed')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Withdraw failed'
      const isRejected = msg.includes('rejected') || msg.includes('denied') || msg.includes('cancel')
      if (!isRejected) setStatus({ type: 'error', msg })
      else setStatus(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-primary rounded-xl w-80 p-4 shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary font-semibold text-sm">Transfer</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-border-primary mb-4">
          {(['deposit', 'withdraw'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setAmount(''); setStatus(null) }}
              className={`py-2 text-sm font-semibold capitalize transition-colors ${
                tab === t ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="text-xs text-text-muted mb-3">
          {tab === 'deposit' ? (
            <span>
              Deposit USDC from Arbitrum to your Hyperliquid account.{' '}
              {usdcBalanceNum > 0 && <span className="text-text-secondary">Wallet: ${usdcBalanceNum.toFixed(2)} USDC</span>}
            </span>
          ) : (
            <span>
              Withdraw USDC to your wallet on Arbitrum.{' '}
              <span className="text-text-secondary">Available: ${availableBalance.toFixed(2)}</span>
            </span>
          )}
        </div>

        {/* Amount */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <label className="text-2xs text-text-muted">Amount (USDC)</label>
            <button
              onClick={() => setAmount(
                tab === 'deposit'
                  ? usdcBalanceNum.toFixed(2)
                  : availableBalance.toFixed(2)
              )}
              className="text-2xs text-accent-blue hover:text-blue-400"
            >
              Max
            </button>
          </div>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-border-secondary"
          />
        </div>

        {/* Status */}
        {status && (
          <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${
            status.type === 'success' ? 'bg-long-bg text-long' :
            status.type === 'error' ? 'bg-short-bg text-short' :
            'bg-bg-tertiary text-text-muted'
          }`}>
            {status.msg}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={tab === 'deposit' ? handleDeposit : handleWithdraw}
          disabled={!amountNum || status?.type === 'loading'}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-accent-blue hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status?.type === 'loading' ? status.msg :
            tab === 'deposit'
              ? (!onArbitrum ? 'Switch to Arbitrum & Deposit' : `Deposit $${amountNum > 0 ? amountNum.toFixed(2) : '0.00'}`)
              : `Withdraw $${amountNum > 0 ? amountNum.toFixed(2) : '0.00'}`
          }
        </button>

      </div>
    </div>
  )
}
