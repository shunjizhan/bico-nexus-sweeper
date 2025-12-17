import * as React from 'react'
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { http, type Address, type Hex } from 'viem'
import {
  MEEVersion,
  getMEEVersion,
  toMultichainNexusAccount,
  createMeeClient,
  runtimeERC20BalanceOf,
  type InstructionLike,
} from '@biconomy/abstractjs'

import { getChainIdFromDebankId, isSupportedChainId, SUPPORTED_CHAINS } from '@/lib/chains'
import type { Token } from '@/lib/debank/types'

import type { SelectedVersion, SweepHistoryEntry, SweepState } from '../types'
import { sleep } from '../utils'

interface UseSweepParams {
  nexusAddress210: Address | null
  nexusAddress220: Address | null
  tokens210: Token[]
  tokens220: Token[]
  selectedFeeToken220: Token | null
  onSweepSuccess: (entry: SweepHistoryEntry) => void
  onTokensRefresh: () => void
}

interface UseSweepReturn {
  sweepState210: SweepState
  sweepError210: string | null
  supertxHash210: string | null
  sweepState220: SweepState
  sweepError220: string | null
  supertxHash220: string | null
  handleSweep: (version: SelectedVersion) => Promise<void>
  isAnySweepBusy: boolean
}

export const useSweep = ({
  nexusAddress210,
  nexusAddress220,
  tokens210,
  tokens220,
  selectedFeeToken220,
  onSweepSuccess,
  onTokensRefresh,
}: UseSweepParams): UseSweepReturn => {
  const { address: walletAddress } = useAccount()
  const { data: walletClient } = useWalletClient()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  const [sweepState210, setSweepState210] = React.useState<SweepState>('idle')
  const [sweepError210, setSweepError210] = React.useState<string | null>(null)
  const [supertxHash210, setSupertxHash210] = React.useState<string | null>(null)

  const [sweepState220, setSweepState220] = React.useState<SweepState>('idle')
  const [sweepError220, setSweepError220] = React.useState<string | null>(null)
  const [supertxHash220, setSupertxHash220] = React.useState<string | null>(null)

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
        } catch {
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
        onSweepSuccess({
          hash,
          timestamp: Date.now(),
          tokenCount: tokens.length,
          version,
        })
        setTimeout(() => onTokensRefresh(), 3000)
      } else {
        throw new Error(`Transaction failed: ${receipt.transactionStatus}`)
      }
    } catch (error) {
      console.error('Sweep failed:', error)
      setSweepState('error')
      setSweepError(error instanceof Error ? error.message : 'Sweep failed. Please try again.')
    }
  }, [walletClient, nexusAddress210, nexusAddress220, walletAddress, tokens210, tokens220, selectedFeeToken220, currentChainId, switchChainAsync, onSweepSuccess, onTokensRefresh])

  // Reset sweep states when wallet disconnects or changes
  React.useEffect(() => {
    if (!walletAddress) {
      setSweepState210('idle')
      setSweepError210(null)
      setSupertxHash210(null)
      setSweepState220('idle')
      setSweepError220(null)
      setSupertxHash220(null)
    }
  }, [walletAddress])

  const isSweepBusy210 = sweepState210 === 'quote' || sweepState210 === 'awaiting-signature' || sweepState210 === 'executing'
  const isSweepBusy220 = sweepState220 === 'quote' || sweepState220 === 'awaiting-signature' || sweepState220 === 'executing'
  const isAnySweepBusy = isSweepBusy210 || isSweepBusy220

  return {
    sweepState210,
    sweepError210,
    supertxHash210,
    sweepState220,
    sweepError220,
    supertxHash220,
    handleSweep,
    isAnySweepBusy,
  }
}
