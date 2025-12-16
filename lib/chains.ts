import { zeroAddress, type Chain } from 'viem'
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  bsc,
  avalanche,
  scroll,
  gnosis,
  sonic,
  apeChain,
  sei,
  worldchain,
  unichain,
  plasma,
  monad,
  hyperEvm,
  katana,
} from 'viem/chains'

type ChainId = number

interface SupportedChainDefinition {
  chain: Chain
  debankId: string
  debankAliases: readonly string[]
}

// All chains supported by MEE
//
// DeBank Support Status (as of Dec 2025):
// ✓ WITH DeBank support (tokens auto-detect):
//   - Ethereum, Base, Polygon, Arbitrum, OP Mainnet, BNB Smart Chain,
//     Sonic, Scroll, Gnosis, Avalanche
//
// ✗ WITHOUT DeBank support (tokens won't auto-detect):
//   - Ape Chain, Sei, World Chain, Unichain, Plasma, Monad, HyperEVM, Katana
//   - These newer chains are not yet indexed by DeBank
//
// Reference: https://docs.cloud.debank.com/en/readme/api-pro-reference/chain
const SUPPORTED_CHAIN_DEFINITIONS: readonly SupportedChainDefinition[] = [
  // Chains WITH DeBank support
  { chain: mainnet, debankId: 'eth', debankAliases: ['eth', 'ethereum'] },
  { chain: base, debankId: 'base', debankAliases: ['base'] },
  { chain: polygon, debankId: 'matic', debankAliases: ['matic', 'polygon'] },
  { chain: arbitrum, debankId: 'arb', debankAliases: ['arb', 'arbitrum'] },
  { chain: optimism, debankId: 'op', debankAliases: ['op', 'optimism'] },
  { chain: bsc, debankId: 'bsc', debankAliases: ['bsc', 'bnb'] },
  { chain: sonic, debankId: 'sonic', debankAliases: ['sonic'] },
  { chain: scroll, debankId: 'scrl', debankAliases: ['scrl', 'scroll'] },
  { chain: gnosis, debankId: 'xdai', debankAliases: ['xdai', 'gnosis'] },
  { chain: avalanche, debankId: 'avax', debankAliases: ['avax', 'avalanche'] },
  // Chains WITHOUT DeBank support (kept for future compatibility)
  { chain: apeChain, debankId: 'ape', debankAliases: ['ape', 'apechain'] },
  { chain: sei, debankId: 'sei', debankAliases: ['sei'] },
  { chain: worldchain, debankId: 'world', debankAliases: ['world', 'worldchain'] },
  { chain: unichain, debankId: 'unichain', debankAliases: ['unichain', 'uni'] },
  { chain: plasma, debankId: 'plasma', debankAliases: ['plasma'] },
  { chain: monad, debankId: 'monad', debankAliases: ['monad'] },
  { chain: hyperEvm, debankId: 'hyperevm', debankAliases: ['hyperevm', 'hyperliquid'] },
  { chain: katana, debankId: 'katana', debankAliases: ['katana'] },
] as const

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase()

export const SUPPORTED_CHAINS: readonly Chain[] = SUPPORTED_CHAIN_DEFINITIONS.map(
  (d) => d.chain
)

export const SUPPORTED_CHAIN_IDS: readonly ChainId[] = SUPPORTED_CHAIN_DEFINITIONS.map(
  (d) => d.chain.id
)

const SUPPORTED_CHAIN_ID_SET = new Set<ChainId>(SUPPORTED_CHAIN_IDS)

// All DeBank chain IDs we support (for fetching)
export const SUPPORTED_DEBANK_CHAIN_IDS: readonly string[] = SUPPORTED_CHAIN_DEFINITIONS.map(
  (d) => normalizeIdentifier(d.debankId)
)

const CHAINS_BY_ID = new Map<ChainId, Chain>()
const DEBANK_IDENTIFIER_TO_CHAIN_ID = new Map<string, ChainId>()
const DEBANK_ID_BY_CHAIN_ID = new Map<ChainId, string>()

for (const definition of SUPPORTED_CHAIN_DEFINITIONS) {
  const chainId = definition.chain.id
  CHAINS_BY_ID.set(chainId, definition.chain)

  const normalized = normalizeIdentifier(definition.debankId)
  DEBANK_ID_BY_CHAIN_ID.set(chainId, normalized)

  DEBANK_IDENTIFIER_TO_CHAIN_ID.set(normalized, chainId)
  for (const alias of definition.debankAliases) {
    DEBANK_IDENTIFIER_TO_CHAIN_ID.set(normalizeIdentifier(alias), chainId)
  }
}

const NATIVE_TOKEN_SENTINELS = new Set<string>([
  zeroAddress.toLowerCase(),
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000001010',
])

export function isSupportedChainId(chainId: number | null | undefined): chainId is ChainId {
  return typeof chainId === 'number' && SUPPORTED_CHAIN_ID_SET.has(chainId)
}

export function getChainById(chainId: ChainId): Chain | undefined {
  return CHAINS_BY_ID.get(chainId)
}

export function getChainName(chainId: ChainId): string {
  return getChainById(chainId)?.name ?? `Chain ${chainId}`
}

export function getDebankChainIdentifier(chainId: ChainId): string | undefined {
  return DEBANK_ID_BY_CHAIN_ID.get(chainId)
}

export function isNativeTokenAddress(address: string | null | undefined): boolean {
  if (!address) return false
  return NATIVE_TOKEN_SENTINELS.has(address.toLowerCase())
}

export function getChainIdFromDebankId(debankId: string): ChainId | undefined {
  if (typeof debankId !== 'string') return undefined
  const normalized = normalizeIdentifier(debankId)
  if (!normalized) return undefined
  return DEBANK_IDENTIFIER_TO_CHAIN_ID.get(normalized)
}

export { mainnet, polygon, optimism, arbitrum, base, bsc, avalanche, scroll, gnosis, sonic, apeChain, sei, worldchain, unichain, plasma, monad, hyperEvm, katana }
