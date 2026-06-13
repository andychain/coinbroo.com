'use client'

import { useState, useCallback } from 'react'
import { useWalletClient } from 'wagmi'
import { isNewUser, postExchange } from '@/lib/hyperliquid'
import { signApproveBuilderFee } from '@/lib/signing'

export type OnboardState = 'idle' | 'checking' | 'approving' | 'done' | 'needs_deposit' | 'error'

const STORAGE_KEY = 'ht_builder_approved'

function getApprovedList(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function useOnboarding() {
  const { data: walletClient } = useWalletClient()
  const [state, setState] = useState<OnboardState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)

  const isApproved = useCallback((address: string): boolean => {
    return getApprovedList().includes(address.toLowerCase())
  }, [])

  const markApproved = useCallback((address: string) => {
    if (typeof window === 'undefined') return
    const list = getApprovedList()
    if (!list.includes(address.toLowerCase())) {
      list.push(address.toLowerCase())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
  }, [])

  // Called when user clicks Place Order for the first time
  const ensureApproved = useCallback(async (address: string): Promise<boolean> => {
    if (!walletClient) return false
    if (isApproved(address)) return true

    setState('checking')
    setError(null)

    try {
      const newUser = await isNewUser(address)
      setIsNew(newUser)
      setState('approving')

      const { action, nonce, signature } = await signApproveBuilderFee(walletClient)
      const result = await postExchange(action, nonce, signature)

      if (result?.status === 'ok') {
        markApproved(address)
        setState('done')
        return true
      } else {
        const msg = JSON.stringify(result?.response) || 'ApproveBuilderFee failed'
        throw new Error(msg)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      const isRejected = msg.includes('rejected') || msg.includes('denied') ||
        msg.includes('cancelled') || msg.includes('cancel') || msg.includes('User rejected')
      const needsDeposit = msg.includes('Must deposit') || msg.includes('deposit before')

      if (isRejected) {
        setState('idle')
      } else if (needsDeposit) {
        setState('needs_deposit')
      } else {
        setError(msg)
        setState('error')
      }
      return false
    }
  }, [walletClient, isApproved, markApproved])

  return { state, error, isNew, isApproved, ensureApproved, reset }
}
