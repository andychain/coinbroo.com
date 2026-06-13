'use client'

import { type OnboardState } from '@/hooks/useOnboarding'

const BUILDER_ADDRESS = process.env.NEXT_PUBLIC_BUILDER_ADDRESS
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Coinbroo'

interface OnboardingModalProps {
  state: OnboardState
  isNew: boolean
  error: string | null
  onClose: () => void
}

export function OnboardingModal({ state, isNew, error, onClose }: OnboardingModalProps) {
  // Only show during active approval flow
  if (state === 'idle' || state === 'done') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl relative">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
        >
          ✕
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center">
            <span className="text-white font-bold">H</span>
          </div>
          <span className="text-text-primary font-semibold text-lg">{APP_NAME}</span>
        </div>

        {state === 'checking' ? (
          <>
            <h2 className="text-text-primary font-semibold mb-2">Setting up your account...</h2>
            <p className="text-text-muted text-sm">Just a moment while we check your account.</p>
            <div className="mt-4 h-1 bg-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-accent-blue rounded-full animate-pulse w-1/3" />
            </div>
          </>
        ) : state === 'approving' ? (
          <>
            <h2 className="text-text-primary font-semibold mb-2">One-time approval needed</h2>
            {isNew && (
              <div className="bg-long-bg border border-long/30 rounded-lg px-3 py-2 mb-3">
                <p className="text-long text-xs font-medium">New user detected</p>
                <p className="text-long/70 text-xs mt-0.5">Referral bonus will be applied to your account.</p>
              </div>
            )}
            <p className="text-text-muted text-sm mb-4">
              Sign this one-time approval to allow {APP_NAME} to submit trades on your behalf.
              Your funds stay in your wallet — this only enables fee collection.
            </p>
            <div className="bg-bg-tertiary rounded-lg p-3 mb-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Builder address</span>
                <span className="font-mono text-text-secondary">{BUILDER_ADDRESS?.slice(0, 6)}…{BUILDER_ADDRESS?.slice(-4)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Max fee</span>
                <span className="text-text-secondary">{(parseInt(process.env.NEXT_PUBLIC_BUILDER_FEE || '3') / 1000).toFixed(3)}% per trade</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Revokable</span>
                <span className="text-long">Yes, anytime</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <div className="w-3 h-3 rounded-full border-2 border-accent-blue border-t-transparent animate-spin flex-shrink-0" />
              Waiting for wallet signature...
            </div>
          </>
        ) : state === 'needs_deposit' ? (
          <>
            <h2 className="text-text-primary font-semibold mb-2">Deposit required</h2>
            <p className="text-text-muted text-sm mb-4">
              You need to deposit USDC to Hyperliquid before trading on {APP_NAME}.
              Once deposited, come back and place your order.
            </p>
            <a
              href="https://app.hyperliquid.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium text-center hover:bg-accent-blue-dim transition-colors mb-2"
            >
              Deposit on Hyperliquid →
            </a>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              I'll do it later
            </button>
          </>
        ) : state === 'error' ? (
          <>
            <h2 className="text-text-primary font-semibold mb-2">Something went wrong</h2>
            <p className="text-short text-sm mb-4">{error}</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue-dim transition-colors mb-2"
            >
              Try again
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
