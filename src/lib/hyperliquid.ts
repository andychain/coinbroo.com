const HL_API = 'https://api.hyperliquid.xyz'

export const BUILDER_ADDRESS = process.env.NEXT_PUBLIC_BUILDER_ADDRESS as string
export const BUILDER_FEE = parseInt(process.env.NEXT_PUBLIC_BUILDER_FEE || '5')
export const REFERRAL_CODE = process.env.NEXT_PUBLIC_REFERRAL_CODE as string
export const HL_NETWORK = process.env.NEXT_PUBLIC_HL_NETWORK || 'mainnet'

// ─── Info (read) endpoints ───────────────────────────────────────────────────

async function info(body: object) {
  const res = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HL API error: ${res.status}`)
  return res.json()
}

export interface AssetCtx {
  funding: string
  openInterest: string
  prevDayPx: string
  dayNtlVlm: string
  markPx: string
  midPx: string
}

export async function getMeta() {
  return info({ type: 'meta' })
}

export async function getMetaAndAssetCtxs(dex?: string): Promise<[{ universe: Market[] }, AssetCtx[]]> {
  return info(dex ? { type: 'metaAndAssetCtxs', dex } : { type: 'metaAndAssetCtxs' })
}

export interface Candle {
  t: number; T: number; s: string; i: string
  o: string; c: string; h: string; l: string; v: string; n: number
}

export async function getCandleSnapshot(coin: string, interval: string, startTime: number, endTime: number): Promise<Candle[]> {
  return info({ type: 'candleSnapshot', req: { coin, interval, startTime, endTime } })
}

// ─── Spot ─────────────────────────────────────────────────────────────────────

export interface SpotToken {
  name: string
  index: number
  szDecimals: number
  fullName?: string | null
}

export interface SpotPair {
  name: string          // e.g. "PURR/USDC"
  tokens: [number, number]
  index: number
  isCanonical?: boolean
}

export interface SpotAssetCtx {
  prevDayPx: string
  dayNtlVlm: string
  markPx: string
  midPx: string
  coin: string          // e.g. "PURR/USDC" or "@107"
  circulatingSupply: string
}

export async function getSpotMetaAndAssetCtxs(): Promise<[{ tokens: SpotToken[]; universe: SpotPair[] }, SpotAssetCtx[]]> {
  return info({ type: 'spotMetaAndAssetCtxs' })
}

// ─── Builder perp dexs (HIP-3) ────────────────────────────────────────────────

export interface PerpDex {
  name: string
  fullName: string
}

export async function getPerpDexs(): Promise<(PerpDex | null)[]> {
  return info({ type: 'perpDexs' })
}

export async function getAllMids(): Promise<Record<string, string>> {
  return info({ type: 'allMids' })
}

export async function getL2Book(coin: string) {
  return info({ type: 'l2Book', coin })
}

export async function getUserState(address: string) {
  return info({ type: 'clearinghouseState', user: address })
}

export interface SpotBalance {
  coin: string
  total: string
  hold: string
}

export async function getSpotState(address: string): Promise<{ balances: SpotBalance[] }> {
  return info({ type: 'spotClearinghouseState', user: address })
}

export async function getOpenOrders(address: string) {
  return info({ type: 'openOrders', user: address })
}

export async function getUserFills(address: string) {
  return info({ type: 'userFills', user: address })
}

export async function getFundingHistory(coin: string) {
  return info({ type: 'fundingHistory', coin, startTime: Date.now() - 86400000 })
}

export async function getReferralInfo(address: string) {
  return info({ type: 'referral', user: address })
}

export async function getBaseFees(): Promise<{ taker: number; maker: number }> {
  // Use a zero address to get the base fee schedule without user-specific discounts
  const data = await info({ type: 'userFees', user: '0x0000000000000000000000000000000000000000' })
  return {
    taker: parseFloat(data?.feeSchedule?.cross ?? '0.00045'),
    maker: parseFloat(data?.feeSchedule?.add ?? '0.00015'),
  }
}

// Check if a wallet is new to Hyperliquid (never traded)
export async function isNewUser(address: string): Promise<boolean> {
  try {
    const state = await getUserState(address)
    const totalValue = parseFloat(state?.marginSummary?.accountValue || '0')
    const fills = await getUserFills(address)
    return totalValue === 0 && (!fills || fills.length === 0)
  } catch {
    return true
  }
}

// ─── Exchange (write) endpoints ──────────────────────────────────────────────

export async function postExchange(action: object, nonce: number, signature: string | { r: string; s: string; v: number }, vaultAddress?: string) {
  const body: Record<string, unknown> = { action, nonce, signature }
  if (vaultAddress) body.vaultAddress = vaultAddress
  const res = await fetch(`${HL_API}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) { const text = await res.text(); console.error("HL exchange raw error:", text); throw new Error(`HL exchange error: ${res.status} — ${text}`) }
  return res.json()
}

// ─── Market data helpers ──────────────────────────────────────────────────────

export interface Market {
  name: string
  szDecimals: number
  maxLeverage: number
}

export interface Position {
  coin: string
  szi: string        // size (negative = short)
  entryPx: string
  positionValue: string
  unrealizedPnl: string
  returnOnEquity: string
  liquidationPx: string | null
  leverage: { type: string; value: number }
}

export interface AccountState {
  marginSummary: {
    accountValue: string
    totalMarginUsed: string
    totalNtlPos: string
  }
  assetPositions: Array<{ position: Position; type: string }>
  withdrawable: string
}

export function formatPrice(price: number, decimals = 2): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (price >= 1) return price.toFixed(decimals)
  return price.toFixed(4)
}

export function formatSize(size: number): string {
  if (Math.abs(size) >= 1000) return size.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return size.toFixed(3)
}
