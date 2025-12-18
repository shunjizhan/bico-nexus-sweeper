/**
 * Shared sweep utilities for building supertransaction instructions
 * Used by both auto mode (main page) and manual mode
 */
import { formatUnits, parseUnits, type Address } from 'viem'
import {
  runtimeERC20BalanceOf,
  type MultichainSmartAccount,
  type InstructionLike,
} from '@biconomy/abstractjs'

import { isNativeToken } from './native'

/**
 * Normalized token type for sweep operations
 * This is the common format used by both auto and manual modes
 */
export interface SweepToken {
  chainId: number
  address: Address
  isNative: boolean
  /** Human-readable amount (e.g., "0.1" for 0.1 ETH) - required for native tokens */
  amount?: string
  decimals?: number
}

/**
 * Convert DeBank Token to SweepToken
 */
export const fromDebankToken = (
  token: {
    chain: string
    tokenAddress?: Address | null
    isNative?: boolean
    amount: number
    decimals: number
  },
  chainId: number
): SweepToken | null => {
  if (!token.tokenAddress) return null

  const isNative = token.isNative || isNativeToken(token.tokenAddress)

  return {
    chainId,
    address: token.tokenAddress,
    isNative,
    amount: token.amount.toString(),
    decimals: token.decimals,
  }
}

/**
 * Convert manual TokenInfo to SweepToken
 */
export const fromTokenInfo = (
  token: {
    chainId: number
    address: Address
    isNative: boolean
    balance: bigint
    decimals: number
  }
): SweepToken => {
  return {
    chainId: token.chainId,
    address: token.address,
    isNative: token.isNative,
    // Use formatUnits to avoid precision loss when converting bigint to string
    amount: formatUnits(token.balance, token.decimals),
    decimals: token.decimals,
  }
}

/**
 * Build sweep instructions for a list of tokens
 * This is the shared logic used by both auto and manual modes
 *
 * For native tokens: uses fixed amount (full balance)
 * For ERC20 tokens: uses runtimeERC20BalanceOf (balance at execution time)
 *
 * Note: When only native tokens exist, callers should use EOA trigger mode
 * so that fees come from EOA wallet, allowing full native balance to be swept.
 */
export const buildSweepInstructions = async (
  nexusAccount: MultichainSmartAccount,
  recipient: Address,
  tokens: SweepToken[]
): Promise<InstructionLike[]> => {
  const instructions: InstructionLike[] = []

  for (const token of tokens) {
    const nexusAddr = nexusAccount.addressOn(token.chainId)
    if (!nexusAddr) continue

    if (token.isNative) {
      // Native token - use fixed amount
      if (!token.amount || !token.decimals) {
        console.warn('Native token missing amount or decimals, skipping')
        continue
      }

      const sweepAmount = parseUnits(token.amount, token.decimals)
      if (sweepAmount <= 0n) {
        console.warn('Native token has zero balance, skipping')
        continue
      }

      const instruction = await nexusAccount.buildComposable({
        type: 'nativeTokenTransfer',
        data: {
          to: recipient,
          value: sweepAmount,
          chainId: token.chainId,
          gasLimit: 100000n,
        },
      })
      instructions.push(instruction)
    } else {
      // ERC20 token - use transfer type with runtime balance
      const instruction = await nexusAccount.buildComposable({
        type: 'transfer',
        data: {
          chainId: token.chainId,
          tokenAddress: token.address,
          amount: runtimeERC20BalanceOf({
            targetAddress: nexusAddr,
            tokenAddress: token.address,
          }),
          recipient,
          gasLimit: 100000n,
        },
      })
      instructions.push(instruction)
    }
  }

  return instructions
}
