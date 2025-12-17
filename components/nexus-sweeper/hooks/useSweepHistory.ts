import * as React from 'react'

import type { SweepHistoryEntry } from '../types'
import { addToSweepHistory, loadSweepHistory } from '../utils'

interface UseSweepHistoryReturn {
  sweepHistory: SweepHistoryEntry[]
  addEntry: (entry: SweepHistoryEntry) => void
}

export const useSweepHistory = (): UseSweepHistoryReturn => {
  const [sweepHistory, setSweepHistory] = React.useState<SweepHistoryEntry[]>([])

  // Load sweep history on mount
  React.useEffect(() => {
    setSweepHistory(loadSweepHistory())
  }, [])

  const addEntry = React.useCallback((entry: SweepHistoryEntry) => {
    const newHistory = addToSweepHistory(entry)
    setSweepHistory(newHistory)
  }, [])

  return {
    sweepHistory,
    addEntry,
  }
}
