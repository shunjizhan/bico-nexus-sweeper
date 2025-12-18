/**
 * Shared sweep utilities for building supertransaction instructions
 * Used by both auto mode (main page) and manual mode
 */
import { parseUnits, type Address } from 'viem'
import {
  runtimeERC20BalanceOf,
  type MultichainSmartAccount,
  type InstructionLike,
} from '@biconomy/abstractjs'

import { ETH_FORWARDER, encodeForwardCall, isNativeToken } from './native'

/**
 * Normalized token type for sweep operations
 * This is the common format used by both auto and manual modes
 */
export interface SweepToken {
  chainId: number
  address: Address
  isNative: boolean
  // For native tokens: amount in human-readable format (e.g., "0.001")
  // For ERC20 tokens: not used (we use runtimeERC20BalanceOf)
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
    // Convert balance (bigint wei) to human-readable string
    // We do this because buildSweepInstructions will convert back to wei
    // This ensures consistent handling between auto and manual modes
    amount: (Number(token.balance) / Math.pow(10, token.decimals)).toString(),
    decimals: token.decimals,
  }
}

/**
 * Build sweep instructions for a list of tokens
 * This is the shared logic used by both auto and manual modes
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
      // Native token - use rawCalldata type with ETH_FORWARDER
      if (!token.amount || !token.decimals) {
        console.warn('Native token missing amount or decimals, skipping')
        continue
      }

      // Convert human-readable amount to wei
      const nativeAmount = parseUnits(token.amount, token.decimals)
      if (nativeAmount <= 0n) {
        console.warn('Native token has zero balance, skipping')
        continue
      }

      const calldata = encodeForwardCall(recipient)
      const instruction = await nexusAccount.buildComposable({
        type: 'rawCalldata',
        data: {
          to: ETH_FORWARDER,
          calldata,
          chainId: token.chainId,
          value: nativeAmount,
          gasLimit: 300000n,
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
