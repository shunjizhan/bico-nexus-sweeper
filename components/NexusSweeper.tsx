'use client'

import * as React from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWalletClient } from 'wagmi'
import { http, parseUnits, zeroAddress, zeroHash, type Address } from 'viem'
import {
  ArrowDown,
  Check,
  Copy,
  ExternalLink,
  HandCoins,
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
import { cn, formatAddress, formatUSD } from '@/lib/utils'
import { base, getChainIdFromDebankId, getChainName, isSupportedChainId, SUPPORTED_CHAINS, SUPPORTED_DEBANK_CHAIN_IDS } from '@/lib/chains'
import { fetchPortfolio, selectEligibleTokens } from '@/lib/debank/api'
import type { Token } from '@/lib/debank/types'

type SweepState = 'idle' | 'quote' | 'awaiting-signature' | 'executing' | 'success' | 'error'

const SWEEP_STATUS_MESSAGES: Record<SweepState, string | null> = {
  idle: null,
  quote: 'Building sweep transaction...',
  'awaiting-signature': 'Please sign the transaction in your wallet.',
  executing: 'Executing sweep...',
  success: null,
  error: null,
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

export const NexusSweeper: React.FC = () => {
  const { isConnected, address: walletAddress } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [nexusAddress, setNexusAddress] = React.useState<Address | null>(null)
  const [resolvingAccount, setResolvingAccount] = React.useState(false)
  const [accountError, setAccountError] = React.useState<string | null>(null)

  const [tokens, setTokens] = React.useState<Token[]>([])
  const [loadingTokens, setLoadingTokens] = React.useState(false)
  const [tokenError, setTokenError] = React.useState<string | null>(null)

  const [sweepState, setSweepState] = React.useState<SweepState>('idle')
  const [sweepError, setSweepError] = React.useState<string | null>(null)
  const [supertxHash, setSupertxHash] = React.useState<string | null>(null)

  // Resolve Nexus account
  const resolveNexusAccount = React.useCallback(async () => {
    if (!walletClient) {
      setNexusAddress(null)
      return
    }

    setResolvingAccount(true)
    setAccountError(null)

    try {
      const account = await toMultichainNexusAccount({
        chainConfigurations: [
          {
            chain: base,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
        signer: walletClient,
      })

      setNexusAddress(account.addressOn(base.id) as Address)
    } catch (error) {
      console.error('Failed to resolve Nexus account:', error)
      setNexusAddress(null)
      setAccountError('Failed to resolve Nexus account. Please try again.')
    } finally {
      setResolvingAccount(false)
    }
  }, [walletClient])

  // Fetch tokens from DeBank
  const fetchTokens = React.useCallback(async () => {
    if (!nexusAddress) {
      setTokens([])
      return
    }

    setLoadingTokens(true)
    setTokenError(null)

    try {
      const portfolio = await fetchPortfolio(nexusAddress, [...SUPPORTED_DEBANK_CHAIN_IDS])
      const eligible = selectEligibleTokens(portfolio.tokens)
      setTokens(eligible)
    } catch (error) {
      console.error('Failed to fetch tokens:', error)
      setTokenError('Failed to fetch token balances. Please try again.')
      setTokens([])
    } finally {
      setLoadingTokens(false)
    }
  }, [nexusAddress])

  // Resolve account when wallet connects
  React.useEffect(() => {
    if (isConnected && walletClient) {
      void resolveNexusAccount()
    } else {
      setNexusAddress(null)
      setTokens([])
    }
  }, [isConnected, walletClient, resolveNexusAccount])

  // Fetch tokens when Nexus address is resolved
  React.useEffect(() => {
    if (nexusAddress) {
      void fetchTokens()
    }
  }, [nexusAddress, fetchTokens])

  // Sweep all tokens
  const handleSweep = React.useCallback(async () => {
    if (!walletClient || !nexusAddress || !walletAddress || tokens.length === 0) {
      return
    }

    setSweepState('quote')
    setSweepError(null)
    setSupertxHash(null)

    try {
      // Get unique chain IDs from tokens
      const uniqueChainIds = [...new Set(tokens.map((t) => getChainIdFromDebankId(t.chain)).filter(isSupportedChainId))]

      // Build chain configurations
      const chainConfigurations = uniqueChainIds.map((chainId) => {
        const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)!
        return {
          chain,
          transport: http(),
          version: getMEEVersion(MEEVersion.V2_1_0),
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

        // Use native transfer for native tokens
        if (tokenAddress === zeroAddress) {
          const instruction = await nexusAccount.buildComposable({
            type: 'nativeTokenTransfer',
            data: {
              chainId,
              to: walletAddress,
              value: runtimeERC20BalanceOf({
                targetAddress: nexusAddr,
                tokenAddress: zeroAddress,
              }),
              gasLimit: 50000n,
            },
          })
          instructions.push(instruction)
        } else {
          // ERC20 transfer
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
      }

      if (instructions.length === 0) {
        throw new Error('No tokens to sweep')
      }

      setSweepState('awaiting-signature')

      // Get quote - use first non-native token as fee token
      const feeToken = tokens.find((t) => t.tokenAddress && t.tokenAddress !== zeroAddress) ?? tokens[0]
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

      setSweepState('executing')

      // Execute sweep
      const { hash } = await meeClient.executeQuote({ quote })
      setSupertxHash(hash)

      // Wait for confirmation
      await sleep(5000)
      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })

      if (receipt.transactionStatus === 'MINED_SUCCESS') {
        setSweepState('success')
        // Refresh tokens after successful sweep
        setTimeout(() => void fetchTokens(), 3000)
      } else {
        throw new Error(`Transaction failed: ${receipt.transactionStatus}`)
      }
    } catch (error) {
      console.error('Sweep failed:', error)
      setSweepState('error')
      setSweepError(error instanceof Error ? error.message : 'Sweep failed. Please try again.')
    }
  }, [walletClient, nexusAddress, walletAddress, tokens, fetchTokens])

  const totalValue = React.useMemo(
    () => tokens.reduce((sum, t) => sum + t.amount * t.price, 0),
    [tokens]
  )

  const isSweepBusy = sweepState === 'quote' || sweepState === 'awaiting-signature' || sweepState === 'executing'
  const meeScanUrl = supertxHash ? `https://meescan.biconomy.io/details/${supertxHash}` : null

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
            <ConnectButton />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header with wallet info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nexus Sweeper</h1>
          <p className="text-slate-500 text-sm mt-1">Sweep tokens from your Nexus account</p>
        </div>
        <ConnectButton />
      </div>

      {/* Nexus Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Nexus Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Smart Account Address
              </span>
              {resolvingAccount ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving...
                </div>
              ) : accountError ? (
                <span className="text-sm text-rose-600">{accountError}</span>
              ) : (
                <span className="font-mono text-sm font-medium text-slate-700">
                  {nexusAddress ?? '—'}
                </span>
              )}
            </div>
            <SmartAccountCopyButton address={nexusAddress} />
          </div>
        </CardContent>
      </Card>

      {/* Token Balances */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Available Tokens</CardTitle>
            {tokens.length > 0 && (
              <p className="text-slate-500 text-sm mt-1">
                Total: {formatUSD(totalValue)}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchTokens()}
            disabled={loadingTokens || !nexusAddress}
          >
            <RefreshCw className={cn('h-4 w-4', loadingTokens && 'animate-spin')} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loadingTokens ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading token balances...
            </div>
          ) : tokenError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {tokenError}
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No tokens found in your Nexus account.</p>
            </div>
          ) : (
            <TokenGrid tokens={tokens} />
          )}
        </CardContent>
      </Card>

      {/* Sweep Action */}
      {tokens.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Status Messages */}
            {SWEEP_STATUS_MESSAGES[sweepState] && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {SWEEP_STATUS_MESSAGES[sweepState]}
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

            {/* Sweep Button */}
            <Button
              className="w-full h-12 text-base font-bold tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl shadow-lg shadow-emerald-500/20"
              disabled={isSweepBusy || tokens.length === 0}
              onClick={() => void handleSweep()}
            >
              {isSweepBusy ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {sweepState === 'quote' ? 'Building...' : sweepState === 'awaiting-signature' ? 'Sign in wallet...' : 'Executing...'}
                </>
              ) : (
                <>
                  <ArrowDown className="mr-2 h-5 w-5" />
                  Sweep {tokens.length} token{tokens.length !== 1 ? 's' : ''} to wallet
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
