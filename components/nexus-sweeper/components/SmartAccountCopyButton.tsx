import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import type { Address } from 'viem'

import { Button } from '@/components/ui/button'

interface SmartAccountCopyButtonProps {
  address: Address | null
}

export const SmartAccountCopyButton: React.FC<SmartAccountCopyButtonProps> = ({ address }) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      disabled={!address}
      className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-all"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}
