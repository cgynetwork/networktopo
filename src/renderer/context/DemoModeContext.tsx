import { createContext, useContext } from 'react'

export interface DemoModeState {
  isDemoMode: boolean
  toggleDemoMode: () => void
}

export const DemoModeContext = createContext<DemoModeState>({
  isDemoMode: false,
  toggleDemoMode: () => {},
})

export function useDemoMode() {
  return useContext(DemoModeContext)
}
