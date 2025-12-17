'use client'

import * as React from 'react'
import { useAccount } from 'wagmi'
import { Loader2, Wallet } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import {
  SmartAccountCopyButton,
  SweepSection,
  SweepHistory,
  WalletButton,
  VersionSelector,
} from './components'
import { useNexusAccounts, useTokens, useSweep, useSweepHistory } from './hooks'
import type { SelectedVersion } from './types'

export const NexusSweeper: React.FC = () => {
  const { isConnected } = useAccount()
  const [selectedVersion, setSelectedVersion] = React.useState<SelectedVersion>('2.1.0')

  const {
    nexusAddress210,
    nexusAddress220,
    resolvingAccount,
    accountError,
  } = useNexusAccounts()

  const {
    tokens210,
    tokens220,
    loadingTokens,
    tokenError,
    fetchTokens,
    feeTokenOptions220,
    selectedFeeTokenId220,
    setSelectedFeeTokenId220,
    selectedFeeToken220,
  } = useTokens(nexusAddress210, nexusAddress220)

  const { sweepHistory, addEntry } = useSweepHistory()

  const {
    sweepState210,
    sweepError210,
    supertxHash210,
    sweepState220,
    sweepError220,
    supertxHash220,
    handleSweep,
    isAnySweepBusy,
  } = useSweep({
    nexusAddress210,
    nexusAddress220,
    tokens210,
    tokens220,
    selectedFeeToken220,
    onSweepSuccess: addEntry,
    onTokensRefresh: fetchTokens,
  })

  // Get data for selected version
  const isV210 = selectedVersion === '2.1.0'
  const nexusAddress = isV210 ? nexusAddress210 : nexusAddress220
  const tokens = isV210 ? tokens210 : tokens220
  const sweepState = isV210 ? sweepState210 : sweepState220
  const sweepError = isV210 ? sweepError210 : sweepError220
  const supertxHash = isV210 ? supertxHash210 : supertxHash220

  // Filter history by selected version
  const filteredHistory = React.useMemo(() => {
    return sweepHistory.filter((entry) => entry.version === selectedVersion)
  }, [sweepHistory, selectedVersion])

  // Not connected state
  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Wallet className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-lg normal-case">Connect Your Wallet</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-slate-500">
            Connect your wallet to view and sweep tokens from your Nexus account.
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Nexus Sweeper</h1>
          <p className="text-slate-500 text-sm mt-1">Sweep tokens from your Nexus account</p>
        </div>
        <div className="shrink-0">
          <WalletButton />
        </div>
      </div>

      {/* Nexus Account Info */}
      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <CardTitle>Smart Account</CardTitle>
          <VersionSelector
            selectedVersion={selectedVersion}
            onVersionChange={setSelectedVersion}
          />
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Address
              </span>
              {resolvingAccount ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving...
                </div>
              ) : accountError ? (
                <span className="text-sm text-rose-600">{accountError}</span>
              ) : (
                <span className="font-mono text-sm font-medium text-slate-700">
                  {nexusAddress ?? '—'}
                </span>
              )}
            </div>
            <SmartAccountCopyButton address={nexusAddress} />
          </div>
        </CardContent>
      </Card>

      {/* Sweep Section for Selected Version */}
      <SweepSection
        version={selectedVersion}
        tokens={tokens}
        canSweep={isV210 ? tokens.length > 0 : tokens.length > 0 && feeTokenOptions220.length > 0}
        feeTokenOptions={isV210 ? undefined : feeTokenOptions220}
        selectedFeeTokenId={isV210 ? undefined : selectedFeeTokenId220}
        onFeeTokenChange={isV210 ? undefined : setSelectedFeeTokenId220}
        loading={loadingTokens}
        error={tokenError}
        sweepState={sweepState}
        sweepError={sweepError}
        supertxHash={supertxHash}
        onRefresh={fetchTokens}
        onSweep={() => void handleSweep(selectedVersion)}
        disabled={!nexusAddress || isAnySweepBusy}
      />

      {/* Sweep History for Selected Version */}
      <SweepHistory
        history={filteredHistory}
        supertxHash210={supertxHash210}
        supertxHash220={supertxHash220}
        sweepState210={sweepState210}
        sweepState220={sweepState220}
      />
    </div>
  )
}
