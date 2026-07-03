import { createContext, useContext } from 'react'

/** Shared drag state so RackNode can highlight when a device is dragged over it */
export interface DragState {
  dragOverRackId: string | null
  isDraggingDevice: boolean
}

export const DragStateContext = createContext<DragState>({
  dragOverRackId: null,
  isDraggingDevice: false,
})

export function useDragState() {
  return useContext(DragStateContext)
}
