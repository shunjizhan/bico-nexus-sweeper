'use client'

import { type PropsWithChildren, useMemo, useState } from 'react'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

import { wagmiConfig } from '@/lib/wagmi'

import '@rainbow-me/rainbowkit/styles.css'

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient())
  const rainbowTheme = useMemo(() => lightTheme({ borderRadius: 'large' }), [])

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
