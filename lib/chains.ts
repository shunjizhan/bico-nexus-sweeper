import { zeroAddress, type Chain } from 'viem'
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'

type ChainId = number

interface SupportedChainDefinition {
  chain: Chain
  identifiers: readonly string[]
  debankId: string
  debankAliases: readonly string[]
}

const SUPPORTED_CHAIN_DEFINITIONS: readonly SupportedChainDefinition[] = [
  {
    chain: mainnet,
    debankId: 'eth',
    debankAliases: ['eth', 'ethereum'],
    identifiers: ['ethereum', 'eth', 'mainnet'],
  },
  {
    chain: polygon,
    debankId: 'matic',
    debankAliases: ['matic', 'polygon'],
    identifiers: ['polygon', 'matic'],
  },
  {
    chain: optimism,
    debankId: 'op',
    debankAliases: ['op', 'optimism'],
    identifiers: ['optimism'],
  },
  {
    chain: arbitrum,
    debankId: 'arb',
    debankAliases: ['arb', 'arbitrum'],
    identifiers: ['arbitrum'],
  },
  {
    chain: base,
    debankId: 'base',
    debankAliases: ['base'],
    identifiers: ['base'],
  },
] as const

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase()

export const SUPPORTED_CHAINS: readonly Chain[] = SUPPORTED_CHAIN_DEFINITIONS.map(
  (d) => d.chain
)

export const SUPPORTED_CHAIN_IDS: readonly ChainId[] = SUPPORTED_CHAIN_DEFINITIONS.map(
  (d) => d.chain.id
)

const SUPPORTED_CHAIN_ID_SET = new Set<ChainId>(SUPPORTED_CHAIN_IDS)

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

export function getChainMetadata(chainId: ChainId): Chain | undefined {
  return CHAINS_BY_ID.get(chainId)
}

export function getChainName(chainId: ChainId): string {
  return getChainMetadata(chainId)?.name ?? `Chain ${chainId}`
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

export { arbitrum, base, mainnet, optimism, polygon }
