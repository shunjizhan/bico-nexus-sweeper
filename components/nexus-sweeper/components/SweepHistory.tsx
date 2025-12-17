import * as React from 'react'
import { Check, ExternalLink, History } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { SweepHistoryEntry, SweepState } from '../types'
import { formatSupertxHash } from '../utils'

interface SweepHistoryProps {
  history: SweepHistoryEntry[]
  supertxHash210: string | null
  supertxHash220: string | null
  sweepState210: SweepState
  sweepState220: SweepState
}

export const SweepHistory: React.FC<SweepHistoryProps> = ({
  history,
  supertxHash210,
  supertxHash220,
  sweepState210,
  sweepState220,
}) => {
  if (history.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <History className="h-5 w-5 text-slate-400" />
        <CardTitle>Sweep History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((entry) => {
            const isLatest210 = entry.hash === supertxHash210
            const isLatest220 = entry.hash === supertxHash220
            const isLatest = isLatest210 || isLatest220
            const latestSweepState = isLatest210 ? sweepState210 : isLatest220 ? sweepState220 : 'idle'
            const date = new Date(entry.timestamp)
            const formattedDate = date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
            const formattedTime = date.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={entry.hash}
                className={cn(
                  'rounded-xl border px-4 py-3 transition-colors',
                  isLatest && latestSweepState === 'success'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <a
                      className="inline-flex items-center gap-1 font-mono text-sm font-medium text-slate-700 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
                      href={`https://meescan.biconomy.io/details/${entry.hash}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {formatSupertxHash(entry.hash)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {isLatest && latestSweepState === 'success' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <Check className="h-3 w-3" />
                        Success
                      </span>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{formattedDate}</p>
                    <p>{formattedTime}</p>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.tokenCount} token{entry.tokenCount !== 1 ? 's' : ''} swept
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
