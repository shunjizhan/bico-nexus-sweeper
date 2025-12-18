/**
 * Native token utilities and constants
 */
import { encodeFunctionData, parseAbi, zeroAddress, type Address, type Hex } from 'viem'

// ETH Forwarder contract - used to forward native tokens from Nexus account
// This contract has a `forward(address recipient)` function
export const ETH_FORWARDER: Address = '0x000000Afe527A978Ecb761008Af475cfF04132a1'

// Native token sentinel addresses (all map to native ETH/MATIC/etc.)
const NATIVE_TOKEN_ADDRESSES = new Set<string>([
  zeroAddress.toLowerCase(),
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000001010', // Polygon native
])

/**
 * Check if an address represents a native token
 */
export const isNativeToken = (address: string | null | undefined): boolean => {
  if (!address) return false
  return NATIVE_TOKEN_ADDRESSES.has(address.toLowerCase())
}

/**
 * ABI for ETH Forwarder contract - parsed using viem's parseAbi for correct format
 */
export const ETH_FORWARDER_ABI = parseAbi(['function forward(address recipient) external payable'])

/**
 * Encode the forward function call data
 */
export const encodeForwardCall = (recipient: Address): Hex => {
  return encodeFunctionData({
    abi: ETH_FORWARDER_ABI,
    functionName: 'forward',
    args: [recipient],
  })
}

/**
 * Get native token info for a chain
 */
export const getNativeTokenInfo = (chainId: number): { symbol: string; name: string; decimals: number } => {
  const nativeTokens: Record<number, { symbol: string; name: string }> = {
    1: { symbol: 'ETH', name: 'Ethereum' },
    10: { symbol: 'ETH', name: 'Ethereum' },
    56: { symbol: 'BNB', name: 'BNB' },
    100: { symbol: 'xDAI', name: 'xDAI' },
    137: { symbol: 'POL', name: 'POL' },
    146: { symbol: 'S', name: 'Sonic' },
    130: { symbol: 'ETH', name: 'Ethereum' },
    143: { symbol: 'MON', name: 'Monad' },
    480: { symbol: 'ETH', name: 'Ethereum' },
    999: { symbol: 'HYPE', name: 'HYPE' },
    1329: { symbol: 'SEI', name: 'Sei' },
    8453: { symbol: 'ETH', name: 'Ethereum' },
    9745: { symbol: 'PLAS', name: 'Plasma' },
    33139: { symbol: 'APE', name: 'ApeCoin' },
    42161: { symbol: 'ETH', name: 'Ethereum' },
    43114: { symbol: 'AVAX', name: 'Avalanche' },
    534352: { symbol: 'ETH', name: 'Ethereum' },
    747474: { symbol: 'ETH', name: 'Ethereum' },
  }

  const info = nativeTokens[chainId] ?? { symbol: 'ETH', name: 'Native Token' }
  return { ...info, decimals: 18 }
}
