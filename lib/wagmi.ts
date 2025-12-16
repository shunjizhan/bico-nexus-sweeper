import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import type { Chain } from 'viem'

import { SUPPORTED_CHAINS } from '@/lib/chains'

const chains = SUPPORTED_CHAINS as unknown as [Chain, ...Chain[]]

export const wagmiConfig = getDefaultConfig({
  appName: 'Nexus Sweeper',
  projectId: 'c376a06084e2e5ecbfdf8c549dd20781',
  chains,
  ssr: true,
})
