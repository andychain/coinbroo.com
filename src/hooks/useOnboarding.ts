'use client'

import { useState, useCallback } from 'react'
import { useWalletClient } from 'wagmi'
import { isNewUser, postExchange } from '@/lib/hyperliquid'
import { signApproveBuilderFee } from '@/lib/signing'

type OnboardState = 'idle' | 'checking' | 'approving' | 'done' | 'error' | 'dismissed'

const STORAGE_KEY = 'ht_builder_approved'
const DISMISSED_KEY = 'ht_onboard_dismissed'

export function useOnboarding() {
  const { data: walletClient } = useWalletClient()
  const [state, setState] = useState<OnboardState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)

  const isApproved = useCallback((address: string): boolean => {
    if (typeof window === 'undefined') return false
    try {
      const list: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      return list.includes(address.toLowerCase())
    } catch { return false }
  }, [])

  const isDismissed = useCallback((): boolean => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISSED_KEY) === 'true'
  }, [])

  const markApproved = useCallback((address: string) => {
    if (typeof window === 'undefined') return
    try {
      const list: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (!list.includes(address.toLowerCase())) {
        list.push(address.toLowerCase())
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      }
    } catch {}
  }, [])

  const dismiss = useCallback(() => {
    // User closed the modal — remember this so it doesn't re-appear on refresh
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISSED_KEY, 'true')
    }
    setState('dismissed')
  }, [])

  const retry = useCallback(() => {
    // Clear dismissed state and go back to idle so modal re-shows
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DISMISSED_KEY)
    }
    setState('idle')
    setError(null)
  }, [])

  const runOnboarding = useCallback(async (address: string) => {
    if (!walletClient) return
    if (isApproved(address)) return
    if (isDismissed()) { setState('dismissed'); return }
    if (state === 'checking' || state === 'approving') return

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
      } else {
        throw new Error(JSON.stringify(result?.response) || 'ApproveBuilderFee failed')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      const isRejected = msg.includes('rejected') || msg.includes('denied') ||
        msg.includes('cancelled') || msg.includes('cancel') || msg.includes('User rejected')
      if (isRejected) {
        setState('idle') // Go back to idle so user can connect again or dismiss
      } else {
        setError(msg)
        setState('error')
      }
    }
  }, [walletClient, isApproved, isDismissed, markApproved, state])

  return { state, error, isNew, runOnboarding, isApproved, isDismissed, dismiss, retry }
}
