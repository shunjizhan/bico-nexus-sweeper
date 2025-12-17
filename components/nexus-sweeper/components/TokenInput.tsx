import * as React from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { isAddress } from 'viem'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TokenInputProps {
  onAdd: (chainId: number, tokenAddress: string) => Promise<void>
  disabled?: boolean
}

export const TokenInput: React.FC<TokenInputProps> = ({ onAdd, disabled }) => {
  const [chainId, setChainId] = React.useState('')
  const [tokenAddress, setTokenAddress] = React.useState('')
  const [isAdding, setIsAdding] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleAdd = async () => {
    setError(null)

    const parsedChainId = parseInt(chainId, 10)
    if (!chainId.trim() || isNaN(parsedChainId) || parsedChainId <= 0) {
      setError('Please enter a valid chain ID')
      return
    }

    if (!tokenAddress.trim()) {
      setError('Please enter a token address')
      return
    }

    if (!isAddress(tokenAddress)) {
      setError('Invalid token address')
      return
    }

    setIsAdding(true)
    try {
      await onAdd(parsedChainId, tokenAddress)
      setTokenAddress('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add token')
    } finally {
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !disabled && !isAdding) {
      void handleAdd()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {/* Chain ID Input */}
        <input
          type="number"
          value={chainId}
          onChange={(e) => {
            setChainId(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Chain ID"
          disabled={disabled || isAdding}
          className={cn(
            'w-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors',
            'placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100',
            (disabled || isAdding) && 'cursor-not-allowed opacity-50'
          )}
        />

        {/* Token Address Input */}
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => {
            setTokenAddress(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Token address (0x...)"
          disabled={disabled || isAdding}
          className={cn(
            'flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono transition-colors',
            'placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100',
            (disabled || isAdding) && 'cursor-not-allowed opacity-50'
          )}
        />

        {/* Add Button */}
        <Button
          onClick={handleAdd}
          disabled={disabled || isAdding || !tokenAddress.trim() || !chainId.trim()}
          className="rounded-xl px-4"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
    </div>
  )
}
