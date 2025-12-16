import type { Address } from 'viem'

export interface Chain {
  id: string
  community_id: number
  name: string
  logo_url: string | null
  native_token_id: string | null
  wrapped_token_id: string | null
}

export interface Token {
  id: string
  chain: string
  name: string
  symbol: string
  display_symbol: string | null
  optimized_symbol: string
  decimals: number
  logo_url: string
  protocol_id: string
  price: number
  is_verified: boolean
  is_core: boolean
  is_wallet: boolean
  time_at: number
  amount: number
  raw_amount?: number
  tokenAddress?: Address | null
}

export interface TotalBalance {
  total_usd_value: number
  chain_list: Chain[]
}

export interface CompletePortfolio {
  totalBalance: TotalBalance | null
  tokens: Token[]
}

export interface PortfolioSummary {
  totalValue: number
  tokenValue: number
  tokenCount: number
}
