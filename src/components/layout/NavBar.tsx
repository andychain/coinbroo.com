'use client'

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useAccount_HL } from '@/hooks/useAccountHL'
import { TransferModal } from '@/components/ui/TransferModal'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Coinbroo'

const NAV_ITEMS = ['Trade', 'Portfolio', 'Vaults', 'Referrals', 'Leaderboard']

export function NavBar() {
  const { isConnected } = useAccount()
  const { availableBalance } = useAccount_HL()
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTab, setTransferTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="h-12 flex items-center gap-1 px-3 md:px-4 bg-bg-secondary border-b border-border-primary flex-shrink-0">
        {/* Hamburger (mobile only) */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
          className="md:hidden flex items-center justify-center w-8 h-8 -ml-1 mr-1 rounded-md text-text-secondary hover:bg-bg-hover transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 mr-3 md:mr-6 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-accent-blue flex items-center justify-center">
            <span className="text-bg-primary text-sm font-black tracking-tighter">cb</span>
          </div>
          <span className="text-text-primary font-bold text-base tracking-tight whitespace-nowrap">{APP_NAME}</span>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item, i) => (
            <button
              key={item}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                i === 0 ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Deposit / Withdraw */}
        {isConnected && (
          <div className="flex items-center gap-1.5 mr-2">
            <button
              onClick={() => { setTransferTab('deposit'); setTransferOpen(true) }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-long hover:bg-long-dim text-bg-primary transition-colors"
            >
              Deposit
            </button>
            <button
              onClick={() => { setTransferTab('withdraw'); setTransferOpen(true) }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-primary text-text-secondary hover:bg-bg-hover transition-colors"
            >
              Withdraw
            </button>
          </div>
        )}

        {/* Wallet */}
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
      </header>

      {/* Mobile nav menu */}
      {menuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <nav className="md:hidden fixed left-0 right-0 top-12 z-50 bg-bg-secondary border-b border-border-primary flex flex-col py-1 shadow-2xl">
            {NAV_ITEMS.map((item, i) => (
              <button
                key={item}
                onClick={() => setMenuOpen(false)}
                className={`px-4 py-3 text-md text-left font-medium transition-colors ${
                  i === 0 ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </>
      )}

      {transferOpen && (
        <TransferModal
          initialTab={transferTab}
          availableBalance={availableBalance}
          onClose={() => setTransferOpen(false)}
        />
      )}
    </>
  )
}
