import { useRef, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'

interface HistorySnapshot {
  nodes: Node[]
  edges: Edge[]
}

const MAX_HISTORY = 50

export interface HistoryState {
  pushSnapshot: (nodes: Node[], edges: Edge[]) => void
  undo: () => HistorySnapshot | null
  redo: () => HistorySnapshot | null
  canUndo: () => boolean
  canRedo: () => boolean
  clearHistory: () => void
}

export function useHistory(): HistoryState {
  const historyRef = useRef<HistorySnapshot[]>([])
  const historyIndexRef = useRef(-1)

  const pushSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    // Deep clone to avoid reference issues
    const snapshot: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    }

    // Trim future history if we're not at the end
    const history = historyRef.current
    const idx = historyIndexRef.current
    if (idx < history.length - 1) {
      historyRef.current = history.slice(0, idx + 1)
    }

    // Add snapshot
    historyRef.current.push(snapshot)
    // Trim oldest entries if over limit
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY)
    }
    historyIndexRef.current = historyRef.current.length - 1
  }, [])

  const undo = useCallback((): HistorySnapshot | null => {
    const history = historyRef.current
    const idx = historyIndexRef.current
    if (idx < 0 || history.length === 0) return null

    // Move back one step
    const newIdx = idx - 1
    historyIndexRef.current = newIdx
    if (newIdx < 0) {
      // Return empty state (initial state)
      return { nodes: [], edges: [] }
    }
    // Deep clone to avoid mutation
    const snap = history[newIdx]
    return {
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
    }
  }, [])

  const redo = useCallback((): HistorySnapshot | null => {
    const history = historyRef.current
    const idx = historyIndexRef.current
    if (idx >= history.length - 1) return null

    const newIdx = idx + 1
    historyIndexRef.current = newIdx
    const snap = history[newIdx]
    return {
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
    }
  }, [])

  const canUndo = useCallback((): boolean => {
    return historyIndexRef.current >= 0 && historyRef.current.length > 0
  }, [])

  const canRedo = useCallback((): boolean => {
    return historyIndexRef.current < historyRef.current.length - 1
  }, [])

  const clearHistory = useCallback(() => {
    historyRef.current = []
    historyIndexRef.current = -1
  }, [])

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  }
}
