import { createPublicClient, http, type Address, formatUnits, type Chain } from 'viem'

import { SUPPORTED_CHAINS } from './chains'
import { getRpcUrl } from './rpc'

const ERC20_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export interface TokenInfo {
  chainId: number
  address: Address
  symbol: string
  name: string
  decimals: number
  balance: bigint
  formattedBalance: string
  isSupported: boolean
}

// Create a dynamic chain config for any chainId
const createDynamicChain = (chainId: number): Chain => ({
  id: chainId,
  name: `Chain ${chainId}`,
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [getRpcUrl(chainId)] },
  },
})

export const fetchTokenInfo = async (
  chainId: number,
  tokenAddress: Address,
  ownerAddress: Address
): Promise<TokenInfo> => {
  // Check if chain is in our supported list
  const supportedChain = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  const isSupported = !!supportedChain

  // Use supported chain config or create dynamic one
  const chain = supportedChain ?? createDynamicChain(chainId)

  // Use Alchemy RPC if available, otherwise public RPC
  const rpcUrl = getRpcUrl(chainId)

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  try {
    const [symbol, name, decimals, balance] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'name',
      }),
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [ownerAddress],
      }),
    ])

    return {
      chainId,
      address: tokenAddress,
      symbol,
      name,
      decimals,
      balance,
      formattedBalance: formatUnits(balance, decimals),
      isSupported,
    }
  } catch (error) {
    console.error('Failed to fetch token info:', error)
    throw new Error('Cannot find token. Please check chain ID and token address.')
  }
}
