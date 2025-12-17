import * as React from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'

import { SUPPORTED_DEBANK_CHAIN_IDS } from '@/lib/chains'
import { fetchPortfolio, selectEligibleTokens } from '@/lib/debank/api'
import type { Token } from '@/lib/debank/types'

import { filterByMinValue, getTokenId } from '../utils'

interface UseTokensReturn {
  tokens210: Token[]
  tokens220: Token[]
  eoaTokens: Token[]
  loadingTokens: boolean
  tokenError: string | null
  fetchTokens: () => Promise<void>
  feeTokenOptions220: Token[]
  selectedFeeTokenId220: string | null
  setSelectedFeeTokenId220: (id: string | null) => void
  selectedFeeToken220: Token | null
}

export const useTokens = (
  nexusAddress210: Address | null,
  nexusAddress220: Address | null
): UseTokensReturn => {
  const { address: walletAddress } = useAccount()

  const [tokens210, setTokens210] = React.useState<Token[]>([])
  const [tokens220, setTokens220] = React.useState<Token[]>([])
  const [eoaTokens, setEoaTokens] = React.useState<Token[]>([])
  const [loadingTokens, setLoadingTokens] = React.useState(false)
  const [tokenError, setTokenError] = React.useState<string | null>(null)

  // Selected fee token for v2.2.0 (user selects from dropdown)
  const [selectedFeeTokenId220, setSelectedFeeTokenId220] = React.useState<string | null>(null)

  // Top 10 EOA tokens by USD value (for v2.2.0 fee token selection)
  const feeTokenOptions220 = React.useMemo(() => {
    return [...eoaTokens]
      .sort((a, b) => (b.amount * b.price) - (a.amount * a.price))
      .slice(0, 10)
  }, [eoaTokens])

  // Get the selected fee token object
  const selectedFeeToken220 = React.useMemo(() => {
    if (!selectedFeeTokenId220) return feeTokenOptions220[0] ?? null
    return feeTokenOptions220.find((t) => getTokenId(t) === selectedFeeTokenId220) ?? feeTokenOptions220[0] ?? null
  }, [selectedFeeTokenId220, feeTokenOptions220])

  // Auto-select first fee token when options change
  React.useEffect(() => {
    if (feeTokenOptions220.length > 0 && !selectedFeeTokenId220) {
      setSelectedFeeTokenId220(getTokenId(feeTokenOptions220[0]))
    }
  }, [feeTokenOptions220, selectedFeeTokenId220])

  // Reset selected fee token when wallet changes
  React.useEffect(() => {
    setSelectedFeeTokenId220(null)
  }, [walletAddress])

  const fetchTokens = React.useCallback(async () => {
    if (!nexusAddress210 && !nexusAddress220) {
      setTokens210([])
      setTokens220([])
      setEoaTokens([])
      return
    }

    setLoadingTokens(true)
    setTokenError(null)

    try {
      const chainIds = [...SUPPORTED_DEBANK_CHAIN_IDS]

      // Fetch tokens from both Nexus addresses in parallel
      const [portfolio210, portfolio220, eoaPortfolio] = await Promise.all([
        nexusAddress210 ? fetchPortfolio(nexusAddress210, chainIds) : Promise.resolve({ tokens: [] as Token[], totalBalance: null }),
        nexusAddress220 ? fetchPortfolio(nexusAddress220, chainIds) : Promise.resolve({ tokens: [] as Token[], totalBalance: null }),
        walletAddress ? fetchPortfolio(walletAddress, chainIds) : Promise.resolve({ tokens: [] as Token[], totalBalance: null }),
      ])

      // Apply min value filter to Nexus tokens (only sweep tokens worth > $0.1)
      setTokens210(filterByMinValue(selectEligibleTokens(portfolio210.tokens)))
      setTokens220(filterByMinValue(selectEligibleTokens(portfolio220.tokens)))
      // EOA tokens used for trigger don't need min value filter
      setEoaTokens(selectEligibleTokens(eoaPortfolio.tokens))
    } catch (error) {
      console.error('Failed to fetch tokens:', error)
      setTokenError('Failed to fetch token balances. Please try again.')
      setTokens210([])
      setTokens220([])
      setEoaTokens([])
    } finally {
      setLoadingTokens(false)
    }
  }, [nexusAddress210, nexusAddress220, walletAddress])

  // Fetch tokens when Nexus addresses are resolved
  React.useEffect(() => {
    if (nexusAddress210 || nexusAddress220) {
      void fetchTokens()
    }
  }, [nexusAddress210, nexusAddress220, fetchTokens])

  // Clear tokens when addresses are cleared
  React.useEffect(() => {
    if (!nexusAddress210 && !nexusAddress220) {
      setTokens210([])
      setTokens220([])
      setEoaTokens([])
    }
  }, [nexusAddress210, nexusAddress220])

  return {
    tokens210,
    tokens220,
    eoaTokens,
    loadingTokens,
    tokenError,
    fetchTokens,
    feeTokenOptions220,
    selectedFeeTokenId220,
    setSelectedFeeTokenId220,
    selectedFeeToken220,
  }
}
