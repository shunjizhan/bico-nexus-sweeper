import * as React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getChainName } from '@/lib/chains'
import type { TokenInfo } from '@/lib/tokens'

interface ManualTokenListProps {
  tokens: TokenInfo[]
  onRemove: (index: number) => void
  disabled?: boolean
}

export const ManualTokenList: React.FC<ManualTokenListProps> = ({
  tokens,
  onRemove,
  disabled,
}) => {
  if (tokens.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500">No tokens added yet. Add tokens above to sweep them.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tokens.map((token, index) => {
        const chainName = token.isSupported
          ? getChainName(token.chainId)
          : `Chain ${token.chainId}`
        const hasBalance = token.balance > 0n
        const canSweep = hasBalance && token.isSupported

        return (
          <div
            key={`${token.chainId}-${token.address}-${index}`}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              !token.isSupported
                ? 'border-rose-200 bg-rose-50'
                : hasBalance
                  ? 'border-slate-200 bg-white'
                  : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
              {token.symbol.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{token.symbol}</span>
                <span className="text-xs text-slate-500">{token.name}</span>
                {!token.isSupported && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600">
                    <AlertTriangle className="h-3 w-3" />
                    Unsupported chain
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{chainName}</span>
                <span>•</span>
                <span className="font-mono truncate max-w-[200px]">{token.address}</span>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${canSweep ? 'text-slate-900' : !token.isSupported ? 'text-rose-600' : 'text-amber-600'}`}>
                {Number(token.formattedBalance).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
              </p>
              {!hasBalance && token.isSupported && (
                <p className="text-xs text-amber-600">No balance</p>
              )}
              {!token.isSupported && (
                <p className="text-xs text-rose-600">Cannot sweep</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              disabled={disabled}
              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
