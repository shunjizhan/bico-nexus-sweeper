'use client'

import * as React from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { http, type Address, type Hex } from 'viem'
import {
  ArrowDown,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import {
  MEEVersion,
  getMEEVersion,
  toMultichainNexusAccount,
  createMeeClient,
  runtimeERC20BalanceOf,
  type InstructionLike,
} from '@biconomy/abstractjs'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatUSD } from '@/lib/utils'
import { base, getChainIdFromDebankId, getChainName, isSupportedChainId, SUPPORTED_CHAINS, SUPPORTED_DEBANK_CHAIN_IDS } from '@/lib/chains'
import { fetchPortfolio, selectEligibleTokens } from '@/lib/debank/api'
import type { Token } from '@/lib/debank/types'

type SweepState = 'idle' | 'quote' | 'awaiting-signature' | 'executing' | 'success' | 'error'
type SelectedVersion = '2.1.0' | '2.2.0'

interface SweepHistoryEntry {
  hash: string
  timestamp: number
  tokenCount: number
  version: SelectedVersion
}

const SWEEP_HISTORY_KEY = 'nexus-sweeper-history'
const MAX_HISTORY_ENTRIES = 20
const MIN_TOKEN_USD_VALUE = 0.1

const filterByMinValue = (tokens: Token[]): Token[] =>
  tokens.filter((t) => t.amount * t.price >= MIN_TOKEN_USD_VALUE)

const loadSweepHistory = (): SweepHistoryEntry[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SWEEP_HISTORY_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as SweepHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveSweepHistory = (history: SweepHistoryEntry[]): void => {
  if (typeof window === 'undefined') return
  try {
    const trimmed = history.slice(0, MAX_HISTORY_ENTRIES)
    localStorage.setItem(SWEEP_HISTORY_KEY, JSON.stringify(trimmed))
  } catch {
    // Ignore storage errors
  }
}

const addToSweepHistory = (entry: SweepHistoryEntry): SweepHistoryEntry[] => {
  const current = loadSweepHistory()
  if (current.some((e) => e.hash === entry.hash)) return current
  const updated = [entry, ...current].slice(0, MAX_HISTORY_ENTRIES)
  saveSweepHistory(updated)
  return updated
}

const formatSupertxHash = (hash: string): string => {
  if (!hash || hash.length <= 12) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const TokenGrid: React.FC<{ tokens: Token[] }> = ({ tokens }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {tokens.map((token) => {
      const tokenSymbol = token.display_symbol ?? token.symbol ?? token.name
      const usdValue = formatUSD(token.amount * token.price)
      const initial = tokenSymbol?.charAt(0) ?? 'T'
      const tokenLogo = token.logo_url && token.logo_url.length > 0 ? token.logo_url : null
      const chainName = getChainName(getChainIdFromDebankId(token.chain) ?? 0)

      return (
        <div
          key={`${token.chain}-${token.id}`}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm transition-colors hover:bg-slate-50"
        >
          <div className="relative h-10 w-10 shrink-0">
            {tokenLogo ? (
              <img
                src={tokenLogo}
                alt={`${tokenSymbol} logo`}
                className="h-10 w-10 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
                {initial}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{tokenSymbol}</p>
            <p className="text-xs text-slate-500">{chainName}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-900">{usdValue}</p>
            <p className="text-xs text-slate-500">{token.amount.toFixed(4)}</p>
          </div>
        </div>
      )
    })}
  </div>
)

const SmartAccountCopyButton = ({ address }: { address: Address | null }) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      disabled={!address}
      className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-all"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

interface SweepSectionProps {
  version: SelectedVersion
  tokens: Token[]
  canSweep: boolean
  feeTokenOptions?: Token[]
  selectedFeeTokenId?: string | null
  onFeeTokenChange?: (tokenId: string) => void
  loading: boolean
  error: string | null
  sweepState: SweepState
  sweepError: string | null
  supertxHash: string | null
  onRefresh: () => void
  onSweep: () => void
  disabled: boolean
}

const getTokenId = (token: Token): string => `${token.chain}-${token.id}`

interface FeeTokenSelectorProps {
  tokens: Token[]
  selectedTokenId: string | null | undefined
  onSelect: (tokenId: string) => void
  disabled?: boolean
}

const FeeTokenSelector: React.FC<FeeTokenSelectorProps> = ({
  tokens,
  selectedTokenId,
  onSelect,
  disabled,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selectedToken = React.useMemo(() => {
    if (!selectedTokenId) return tokens[0] ?? null
    return tokens.find((t) => getTokenId(t) === selectedTokenId) ?? tokens[0] ?? null
  }, [selectedTokenId, tokens])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!selectedToken) return null

  const renderTokenIcon = (token: Token) => {
    const tokenSymbol = token.display_symbol ?? token.symbol ?? token.name
    const initial = tokenSymbol?.charAt(0) ?? 'T'
    const tokenLogo = token.logo_url && token.logo_url.length > 0 ? token.logo_url : null

    return tokenLogo ? (
      <img
        src={tokenLogo}
        alt={`${tokenSymbol} logo`}
        className="h-6 w-6 rounded-full border border-slate-200 object-cover"
      />
    ) : (
      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
        {initial}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-slate-500 mb-1.5">Fee Token (from your wallet)</label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-slate-300 hover:bg-slate-50'
        )}
      >
        <div className="flex items-center gap-2.5">
          {renderTokenIcon(selectedToken)}
          <div>
            <span className="font-medium text-slate-900">
              {selectedToken.display_symbol ?? selectedToken.symbol}
            </span>
            <span className="ml-1.5 text-xs text-slate-500">
              {getChainName(getChainIdFromDebankId(selectedToken.chain) ?? 0)}
            </span>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {tokens.map((token) => {
            const tokenId = getTokenId(token)
            const isSelected = tokenId === (selectedTokenId ?? getTokenId(tokens[0]))
            return (
              <button
                key={tokenId}
                type="button"
                onClick={() => {
                  onSelect(tokenId)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                )}
              >
                {renderTokenIcon(token)}
                <div>
                  <span className="font-medium text-slate-900">
                    {token.display_symbol ?? token.symbol}
                  </span>
                  <span className="ml-1.5 text-xs text-slate-500">
                    {getChainName(getChainIdFromDebankId(token.chain) ?? 0)}
                  </span>
                </div>
                {isSelected && <Check className="ml-auto h-4 w-4 text-emerald-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const SweepSection: React.FC<SweepSectionProps> = ({
  version,
  tokens,
  canSweep,
  feeTokenOptions,
  selectedFeeTokenId,
  onFeeTokenChange,
  loading,
  error,
  sweepState,
  sweepError,
  supertxHash,
  onRefresh,
  onSweep,
  disabled,
}) => {
  const isV2 = version === '2.2.0'
  const totalValue = tokens.reduce((sum, t) => sum + t.amount * t.price, 0)
  const isSweepBusy = sweepState === 'quote' || sweepState === 'awaiting-signature' || sweepState === 'executing'
  const meeScanUrl = supertxHash ? `https://meescan.biconomy.io/details/${supertxHash}` : null

  const statusMessage = {
    idle: null,
    quote: 'Building sweep transaction...',
    'awaiting-signature': 'Please sign the transaction in your wallet.',
    executing: 'Executing sweep...',
    success: null,
    error: null,
  }[sweepState]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Available Tokens</CardTitle>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              isV2 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
            )}>
              v{version}
            </span>
          </div>
          {tokens.length > 0 && (
            <p className="text-slate-500 text-sm mt-1">
              Total: {formatUSD(totalValue)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading || disabled}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading token balances...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No tokens found in your Nexus account.</p>
          </div>
        ) : (
          <>
            <TokenGrid tokens={tokens} />

            {/* Status Messages */}
            {statusMessage && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {statusMessage}
              </div>
            )}

            {/* Supertransaction Hash */}
            {supertxHash && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Supertransaction</span>
                  <span
                    className={cn(
                      'font-semibold',
                      sweepState === 'success' ? 'text-emerald-600' : sweepState === 'error' ? 'text-rose-600' : 'text-slate-600'
                    )}
                  >
                    {sweepState === 'success' ? 'Success' : sweepState === 'error' ? 'Failed' : 'Pending'}
                  </span>
                </div>
                {meeScanUrl && (
                  <a
                    className="mt-1 inline-flex items-center gap-1 font-mono text-sm font-medium text-slate-700 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
                    href={meeScanUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {formatSupertxHash(supertxHash)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* Error Message */}
            {sweepError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {sweepError}
              </div>
            )}

            {/* Fee Token Selector for v2.2.0 */}
            {isV2 && feeTokenOptions && feeTokenOptions.length > 0 && onFeeTokenChange && (
              <FeeTokenSelector
                tokens={feeTokenOptions}
                selectedTokenId={selectedFeeTokenId}
                onSelect={onFeeTokenChange}
                disabled={isSweepBusy || disabled}
              />
            )}

            {/* Sweep Button */}
            <Button
              className={cn(
                'w-full h-12 text-base font-bold tracking-wide text-white transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl shadow-lg',
                isV2
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20'
              )}
              disabled={isSweepBusy || !canSweep || disabled}
              onClick={onSweep}
            >
              {isSweepBusy ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {sweepState === 'quote' ? 'Building...' : sweepState === 'awaiting-signature' ? 'Sign in wallet...' : 'Executing...'}
                </>
              ) : (
                <>
                  <ArrowDown className="mr-2 h-5 w-5" />
                  Sweep {tokens.length} token{tokens.length !== 1 ? 's' : ''} (v{version})
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export const NexusSweeper: React.FC = () => {
  const { isConnected, address: walletAddress } = useAccount()
  const { data: walletClient } = useWalletClient()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  const [nexusAddress210, setNexusAddress210] = React.useState<Address | null>(null)
  const [nexusAddress220, setNexusAddress220] = React.useState<Address | null>(null)
  const [resolvingAccount, setResolvingAccount] = React.useState(false)
  const [accountError, setAccountError] = React.useState<string | null>(null)

  // Separate token lists for each version
  const [tokens210, setTokens210] = React.useState<Token[]>([])
  const [tokens220, setTokens220] = React.useState<Token[]>([])
  const [eoaTokens, setEoaTokens] = React.useState<Token[]>([])
  const [loadingTokens, setLoadingTokens] = React.useState(false)
  const [tokenError, setTokenError] = React.useState<string | null>(null)

  // Separate sweep states for each version
  const [sweepState210, setSweepState210] = React.useState<SweepState>('idle')
  const [sweepError210, setSweepError210] = React.useState<string | null>(null)
  const [supertxHash210, setSupertxHash210] = React.useState<string | null>(null)

  const [sweepState220, setSweepState220] = React.useState<SweepState>('idle')
  const [sweepError220, setSweepError220] = React.useState<string | null>(null)
  const [supertxHash220, setSupertxHash220] = React.useState<string | null>(null)

  const [sweepHistory, setSweepHistory] = React.useState<SweepHistoryEntry[]>([])

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

  // Load sweep history on mount
  React.useEffect(() => {
    setSweepHistory(loadSweepHistory())
  }, [])

  // Resolve Nexus accounts for both versions
  const resolveNexusAccount = React.useCallback(async () => {
    if (!walletClient) {
      setNexusAddress210(null)
      setNexusAddress220(null)
      return
    }

    setResolvingAccount(true)
    setAccountError(null)

    try {
      // Resolve v2.1.0 address
      const account210 = await toMultichainNexusAccount({
        chainConfigurations: [
          {
            chain: base,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
        signer: walletClient,
      })
      setNexusAddress210(account210.addressOn(base.id) as Address)

      // Resolve v2.2.0 address
      const account220 = await toMultichainNexusAccount({
        chainConfigurations: [
          {
            chain: base,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_2_0),
          },
        ],
        signer: walletClient,
      })
      setNexusAddress220(account220.addressOn(base.id) as Address)
    } catch (error) {
      console.error('Failed to resolve Nexus account:', error)
      setNexusAddress210(null)
      setNexusAddress220(null)
      setAccountError('Failed to resolve Nexus account. Please try again.')
    } finally {
      setResolvingAccount(false)
    }
  }, [walletClient])

  // Fetch tokens from DeBank for both Nexus addresses
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

  // Resolve account when wallet connects
  React.useEffect(() => {
    if (isConnected && walletClient) {
      void resolveNexusAccount()
    } else {
      setNexusAddress210(null)
      setNexusAddress220(null)
      setTokens210([])
      setTokens220([])
      setEoaTokens([])
    }
  }, [isConnected, walletClient, resolveNexusAccount])

  // Fetch tokens when Nexus addresses are resolved
  React.useEffect(() => {
    if (nexusAddress210 || nexusAddress220) {
      void fetchTokens()
    }
  }, [nexusAddress210, nexusAddress220, fetchTokens])

  // Generic sweep handler
  const handleSweep = React.useCallback(async (version: SelectedVersion) => {
    const isV2 = version === '2.2.0'
    const nexusAddress = isV2 ? nexusAddress220 : nexusAddress210
    const tokens = isV2 ? tokens220 : tokens210

    if (!walletClient || !nexusAddress || !walletAddress || tokens.length === 0) {
      return
    }

    const setSweepState = isV2 ? setSweepState220 : setSweepState210
    const setSweepError = isV2 ? setSweepError220 : setSweepError210
    const setSupertxHash = isV2 ? setSupertxHash220 : setSupertxHash210

    // For v2.2.0, check if fee token is selected and switch chain if needed
    if (isV2) {
      if (!selectedFeeToken220) {
        setSweepError('Please select a fee token from your wallet.')
        return
      }
      const feeTokenChainId = getChainIdFromDebankId(selectedFeeToken220.chain)
      if (!feeTokenChainId) {
        setSweepError('Invalid fee token chain.')
        return
      }
      // Switch chain if not on the fee token's chain
      if (currentChainId !== feeTokenChainId) {
        try {
          await switchChainAsync({ chainId: feeTokenChainId })
          // After switching, user needs to click sweep again
          return
        } catch (err) {
          setSweepError('Failed to switch network. Please try again.')
          return
        }
      }
    }

    setSweepState('quote')
    setSweepError(null)
    setSupertxHash(null)

    try {
      const meeVersion = isV2 ? MEEVersion.V2_2_0 : MEEVersion.V2_1_0

      // Get unique chain IDs from tokens
      const uniqueChainIds = [...new Set(tokens.map((t) => getChainIdFromDebankId(t.chain)).filter(isSupportedChainId))]

      // Build chain configurations
      const chainConfigurations = uniqueChainIds.map((chainId) => {
        const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)!
        return {
          chain,
          transport: http(),
          version: getMEEVersion(meeVersion),
          versionCheck: false,
        }
      })

      // Create multichain Nexus account
      const nexusAccount = await toMultichainNexusAccount({
        signer: walletClient,
        chainConfigurations,
      })

      // Create MEE client
      const meeClient = await createMeeClient({
        account: nexusAccount,
      })

      // Build sweep instructions
      const instructions: InstructionLike[] = []

      for (const token of tokens) {
        const chainId = getChainIdFromDebankId(token.chain)
        if (!isSupportedChainId(chainId)) continue

        const tokenAddress = token.tokenAddress
        if (!tokenAddress) continue

        const nexusAddr = nexusAccount.addressOn(chainId)
        if (!nexusAddr) continue

        const instruction = await nexusAccount.buildComposable({
          type: 'transfer',
          data: {
            chainId,
            tokenAddress,
            amount: runtimeERC20BalanceOf({
              targetAddress: nexusAddr,
              tokenAddress,
            }),
            recipient: walletAddress,
            gasLimit: 100000n,
          },
        })
        instructions.push(instruction)
      }

      if (instructions.length === 0) {
        throw new Error('No tokens to sweep')
      }

      let hash: Hex

      if (isV2 && selectedFeeToken220) {
        // v2.2.0: Use getOnChainQuote with selected fee token as both trigger and fee token
        const feeTokenChainId = getChainIdFromDebankId(selectedFeeToken220.chain)

        if (!feeTokenChainId || !selectedFeeToken220.tokenAddress) {
          throw new Error('No valid fee token found')
        }

        const onChainQuote = await meeClient.getOnChainQuote({
          instructions,
          feeToken: {
            address: selectedFeeToken220.tokenAddress,
            chainId: feeTokenChainId,
          },
          trigger: {
            chainId: feeTokenChainId,
            tokenAddress: selectedFeeToken220.tokenAddress,
            amount: 1n,
          },
        })

        // Sign on-chain quote (user signs here)
        setSweepState('awaiting-signature')
        const signedQuote = await meeClient.signOnChainQuote({ fusionQuote: onChainQuote })

        // Execute signed quote
        setSweepState('executing')
        const result = await meeClient.executeSignedQuote({ signedQuote })
        hash = result.hash
      } else {
        // v2.1.0: Use regular getQuote + executeQuote (Smart Account mode)
        // Use highest USD value Nexus token as fee token
        const feeToken = tokens[0]
        const feeChainId = getChainIdFromDebankId(feeToken.chain)

        if (!feeChainId || !feeToken.tokenAddress) {
          throw new Error('No valid fee token found')
        }

        const quote = await meeClient.getQuote({
          instructions,
          feeToken: {
            address: feeToken.tokenAddress,
            chainId: feeChainId,
          },
        })

        // executeQuote handles signing and execution internally
        setSweepState('awaiting-signature')
        const result = await meeClient.executeQuote({ quote })
        setSweepState('executing')
        hash = result.hash
      }

      setSupertxHash(hash)

      await sleep(5000)
      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })

      if (receipt.transactionStatus === 'MINED_SUCCESS') {
        setSweepState('success')
        const newHistory = addToSweepHistory({
          hash,
          timestamp: Date.now(),
          tokenCount: tokens.length,
          version,
        })
        setSweepHistory(newHistory)
        setTimeout(() => void fetchTokens(), 3000)
      } else {
        throw new Error(`Transaction failed: ${receipt.transactionStatus}`)
      }
    } catch (error) {
      console.error('Sweep failed:', error)
      setSweepState('error')
      setSweepError(error instanceof Error ? error.message : 'Sweep failed. Please try again.')
    }
  }, [walletClient, nexusAddress210, nexusAddress220, walletAddress, tokens210, tokens220, selectedFeeToken220, currentChainId, switchChainAsync, fetchTokens])

  const isSweepBusy210 = sweepState210 === 'quote' || sweepState210 === 'awaiting-signature' || sweepState210 === 'executing'
  const isSweepBusy220 = sweepState220 === 'quote' || sweepState220 === 'awaiting-signature' || sweepState220 === 'executing'
  const isAnySweepBusy = isSweepBusy210 || isSweepBusy220

  // Not connected state
  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Wallet className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-lg normal-case">Connect Your Wallet</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-slate-500">
            Connect your wallet to view and sweep tokens from your Nexus account.
          </p>
          <div className="flex justify-center">
            <ConnectButton chainStatus="none" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nexus Sweeper</h1>
          <p className="text-slate-500 text-sm mt-1">Sweep tokens from your Nexus account</p>
        </div>
        <ConnectButton chainStatus="none" />
      </div>

      {/* Nexus Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Nexus Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* v2.1.0 Address */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Smart Account Address
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  v2.1.0
                </span>
              </div>
              {resolvingAccount ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving...
                </div>
              ) : accountError ? (
                <span className="text-sm text-rose-600">{accountError}</span>
              ) : (
                <span className="font-mono text-sm font-medium text-slate-700">
                  {nexusAddress210 ?? '—'}
                </span>
              )}
            </div>
            <SmartAccountCopyButton address={nexusAddress210} />
          </div>

          {/* v2.2.0 Address */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Smart Account Address
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  v2.2.0
                </span>
              </div>
              {resolvingAccount ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving...
                </div>
              ) : accountError ? (
                <span className="text-sm text-rose-600">{accountError}</span>
              ) : (
                <span className="font-mono text-sm font-medium text-slate-700">
                  {nexusAddress220 ?? '—'}
                </span>
              )}
            </div>
            <SmartAccountCopyButton address={nexusAddress220} />
          </div>
        </CardContent>
      </Card>

      {/* v2.1.0 Section */}
      <SweepSection
        version="2.1.0"
        tokens={tokens210}
        canSweep={tokens210.length > 0}
        loading={loadingTokens}
        error={tokenError}
        sweepState={sweepState210}
        sweepError={sweepError210}
        supertxHash={supertxHash210}
        onRefresh={fetchTokens}
        onSweep={() => void handleSweep('2.1.0')}
        disabled={!nexusAddress210 || isAnySweepBusy}
      />

      {/* v2.2.0 Section */}
      <SweepSection
        version="2.2.0"
        tokens={tokens220}
        canSweep={tokens220.length > 0 && feeTokenOptions220.length > 0}
        feeTokenOptions={feeTokenOptions220}
        selectedFeeTokenId={selectedFeeTokenId220}
        onFeeTokenChange={setSelectedFeeTokenId220}
        loading={loadingTokens}
        error={tokenError}
        sweepState={sweepState220}
        sweepError={sweepError220}
        supertxHash={supertxHash220}
        onRefresh={fetchTokens}
        onSweep={() => void handleSweep('2.2.0')}
        disabled={!nexusAddress220 || isAnySweepBusy}
      />

      {/* Sweep History */}
      {sweepHistory.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <History className="h-5 w-5 text-slate-400" />
            <CardTitle>Sweep History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sweepHistory.map((entry) => {
                const isLatest210 = entry.hash === supertxHash210
                const isLatest220 = entry.hash === supertxHash220
                const isLatest = isLatest210 || isLatest220
                const latestSweepState = isLatest210 ? sweepState210 : isLatest220 ? sweepState220 : 'idle'
                const date = new Date(entry.timestamp)
                const formattedDate = date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                const formattedTime = date.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <div
                    key={entry.hash}
                    className={cn(
                      'rounded-xl border px-4 py-3 transition-colors',
                      isLatest && latestSweepState === 'success'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <a
                          className="inline-flex items-center gap-1 font-mono text-sm font-medium text-slate-700 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
                          href={`https://meescan.biconomy.io/details/${entry.hash}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {formatSupertxHash(entry.hash)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          entry.version === '2.2.0' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        )}>
                          v{entry.version ?? '2.1.0'}
                        </span>
                        {isLatest && latestSweepState === 'success' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <Check className="h-3 w-3" />
                            Success
                          </span>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{formattedDate}</p>
                        <p>{formattedTime}</p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.tokenCount} token{entry.tokenCount !== 1 ? 's' : ''} swept
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
