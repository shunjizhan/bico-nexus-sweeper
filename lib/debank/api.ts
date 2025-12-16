import { zeroAddress, type Address } from 'viem'

import { DEBANK_API_BASE, DEBANK_HEADERS } from './constants'
import type { Chain, CompletePortfolio, PortfolioSummary, Token, TotalBalance } from './types'
import { getChainIdFromDebankId, isSupportedChainId } from '@/lib/chains'

const extractAddressFromValue = (value: string | null | undefined): Address | null => {
  if (!value) return null

  const trimmed = value.trim()
  if (trimmed.startsWith('0x') && trimmed.length === 42) {
    return trimmed.toLowerCase() as Address
  }

  const segments = trimmed.split(/[:_]/)
  for (const segment of segments) {
    const normalized = segment.trim()
    if (normalized.startsWith('0x') && normalized.length === 42) {
      return normalized.toLowerCase() as Address
    }
  }

  return null
}

const resolveTokenAddress = (token: Token): Address | null => {
  const directMatch = extractAddressFromValue(token.id)
  if (directMatch) return directMatch

  // Native token
  if (token.id === token.chain) {
    return zeroAddress
  }

  return null
}

export async function fetchPortfolio(address: Address, chainIds?: string[]): Promise<CompletePortfolio> {
  const chainParam = chainIds && chainIds.length > 0 ? `&chain_ids=${chainIds.join(',')}` : ''

  const [totalBalance, tokens] = await Promise.all([
    fetch(`${DEBANK_API_BASE}/user/total_balance?id=${address}`, { headers: DEBANK_HEADERS })
      .then((res) => res.json() as Promise<TotalBalance>),
    fetch(`${DEBANK_API_BASE}/user/all_token_list?id=${address}&is_all=true${chainParam}`, { headers: DEBANK_HEADERS })
      .then((res) => res.json() as Promise<Token[]>),
  ])

  const tokensWithAddress = tokens.map((token) => ({
    ...token,
    tokenAddress: resolveTokenAddress(token),
  }))

  return {
    totalBalance,
    tokens: tokensWithAddress,
  }
}

export function calculatePortfolioSummary(portfolio: CompletePortfolio): PortfolioSummary {
  const tokenValue = portfolio.tokens.reduce((sum, token) => sum + token.amount * token.price, 0)

  return {
    totalValue: portfolio.totalBalance?.total_usd_value ?? 0,
    tokenValue,
    tokenCount: portfolio.tokens.length,
  }
}

export function selectEligibleTokens(tokens: Token[]): Token[] {
  if (!tokens?.length) return []

  return [...tokens]
    .filter((token) => {
      if (!token.is_verified || !token.is_wallet) return false

      const chainId = getChainIdFromDebankId(token.chain)
      if (!isSupportedChainId(chainId)) return false

      if (!token.tokenAddress) return false
      if (token.amount <= 0) return false

      return true
    })
    .sort((a, b) => b.amount * b.price - a.amount * a.price)
}
