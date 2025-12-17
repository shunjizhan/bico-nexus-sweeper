/**
 * RPC URL configuration for supported chains
 * Uses Alchemy RPCs with fallback to public RPCs
 */

// Alchemy RPC base URLs (without API key)
const ALCHEMY_RPC_BASE_URLS: Record<number, string> = {
  // Mainnets
  1: 'https://eth-mainnet.g.alchemy.com/v2',
  8453: 'https://base-mainnet.g.alchemy.com/v2',
  137: 'https://polygon-mainnet.g.alchemy.com/v2',
  42161: 'https://arb-mainnet.g.alchemy.com/v2',
  10: 'https://opt-mainnet.g.alchemy.com/v2',
  56: 'https://bnb-mainnet.g.alchemy.com/v2',
  146: 'https://sonic-mainnet.g.alchemy.com/v2',
  534352: 'https://scroll-mainnet.g.alchemy.com/v2',
  100: 'https://gnosis-mainnet.g.alchemy.com/v2',
  43114: 'https://avax-mainnet.g.alchemy.com/v2',
  33139: 'https://apechain-mainnet.g.alchemy.com/v2',
  480: 'https://worldchain-mainnet.g.alchemy.com/v2',
  130: 'https://unichain-mainnet.g.alchemy.com/v2',
  1329: 'https://sei-mainnet.g.alchemy.com/v2',
  999: 'https://hyperliquid-mainnet.g.alchemy.com/v2',
  9745: 'https://plasma-mainnet.g.alchemy.com/v2',
}

// Public RPC fallbacks
const PUBLIC_RPC_URLS: Record<number, string> = {
  1: 'https://ethereum.publicnode.com',
  8453: 'https://developer-access-mainnet.base.org',
  137: 'https://polygon-public.nodies.app',
  42161: 'https://arbitrum.meowrpc.com',
  10: 'https://optimism.publicnode.com',
  56: 'https://bsc.meowrpc.com',
  146: 'https://rpc.soniclabs.com',
  534352: 'https://rpc.scroll.io',
  100: 'https://gnosis-rpc.publicnode.com',
  43114: 'https://avalanche-c-chain-rpc.publicnode.com',
  33139: 'https://apechain.drpc.org',
  480: 'https://worldchain.drpc.org',
  130: 'https://0xrpc.io/uni',
  1329: 'https://sei.drpc.org',
  999: 'https://rpc.hypurrscan.io',
  9745: 'https://rpc.plasma.to',
}

// Special RPCs (non-Alchemy)
const MONAD_RPC_URL = 'https://rpc-mainnet.monadinfra.com/rpc/mmuQFfKlylzj8puKP5UiSa8K3RLhKzhe'
const KATANA_RPC_URL = 'https://rpc-katana.t.conduit.xyz'

// Chain IDs with special handling
const MONAD_CHAIN_ID = 143
const KATANA_CHAIN_ID = 747474

/**
 * Get the RPC URL for a chain
 * Uses Alchemy if API key is available, falls back to public RPCs
 */
export const getRpcUrl = (chainId: number): string => {
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

  // Monad uses its own RPC
  if (chainId === MONAD_CHAIN_ID) {
    return MONAD_RPC_URL
  }

  // Katana uses Conduit RPC
  if (chainId === KATANA_CHAIN_ID) {
    return KATANA_RPC_URL
  }

  // Try Alchemy RPC if API key is available
  if (alchemyApiKey) {
    const alchemyBaseUrl = ALCHEMY_RPC_BASE_URLS[chainId]
    if (alchemyBaseUrl) {
      return `${alchemyBaseUrl}/${alchemyApiKey}`
    }
  }

  // Fall back to public RPC
  const publicRpcUrl = PUBLIC_RPC_URLS[chainId]
  if (publicRpcUrl) {
    return publicRpcUrl
  }

  // Last resort: generic Ankr endpoint
  return `https://rpc.ankr.com/${chainId}`
}

/**
 * Check if Alchemy API key is configured
 */
export const hasAlchemyApiKey = (): boolean => {
  return !!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
}

/**
 * Check if a chain has Alchemy support
 */
export const hasAlchemySupport = (chainId: number): boolean => {
  return chainId in ALCHEMY_RPC_BASE_URLS
}
