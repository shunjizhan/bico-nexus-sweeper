import * as React from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { http, type Address } from 'viem'
import {
  MEEVersion,
  getMEEVersion,
  toMultichainNexusAccount,
} from '@biconomy/abstractjs'

import { base } from '@/lib/chains'
import { getRpcUrl } from '@/lib/rpc'

interface UseNexusAccountsReturn {
  nexusAddress210: Address | null
  nexusAddress220: Address | null
  resolvingAccount: boolean
  accountError: string | null
  resolveNexusAccount: () => Promise<void>
}

export const useNexusAccounts = (): UseNexusAccountsReturn => {
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [nexusAddress210, setNexusAddress210] = React.useState<Address | null>(null)
  const [nexusAddress220, setNexusAddress220] = React.useState<Address | null>(null)
  const [resolvingAccount, setResolvingAccount] = React.useState(false)
  const [accountError, setAccountError] = React.useState<string | null>(null)

  const resolveNexusAccount = React.useCallback(async () => {
    if (!walletClient) {
      setNexusAddress210(null)
      setNexusAddress220(null)
      return
    }

    setResolvingAccount(true)
    setAccountError(null)

    try {
      // Resolve v2.1.0 address
      const account210 = await toMultichainNexusAccount({
        chainConfigurations: [
          {
            chain: base,
            transport: http(getRpcUrl(base.id)),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
        signer: walletClient,
      })
      setNexusAddress210(account210.addressOn(base.id) as Address)

      // Resolve v2.2.0 address
      const account220 = await toMultichainNexusAccount({
        chainConfigurations: [
          {
            chain: base,
            transport: http(getRpcUrl(base.id)),
            version: getMEEVersion(MEEVersion.V2_2_0),
          },
        ],
        signer: walletClient,
      })
      setNexusAddress220(account220.addressOn(base.id) as Address)
    } catch (error) {
      console.error('Failed to resolve Nexus account:', error)
      setNexusAddress210(null)
      setNexusAddress220(null)
      setAccountError('Failed to resolve Nexus account. Please try again.')
    } finally {
      setResolvingAccount(false)
    }
  }, [walletClient])

  // Resolve account when wallet connects
  React.useEffect(() => {
    if (isConnected && walletClient) {
      void resolveNexusAccount()
    } else {
      setNexusAddress210(null)
      setNexusAddress220(null)
      setAccountError(null)
    }
  }, [isConnected, walletClient, resolveNexusAccount])

  return {
    nexusAddress210,
    nexusAddress220,
    resolvingAccount,
    accountError,
    resolveNexusAccount,
  }
}
