import { create } from "zustand"
import type { Station, Operator } from "../types/transit"


interface AppState {
  isDrawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  activeOperators: string[]
  operators: Operator[]
  setOperators: (ops: Operator[]) => void
  toggleOperator: (op: string) => void
  selectedStation: Station | null
  setSelectedStation: (station: Station | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  isDrawerOpen: false,
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  operators: [],
  setOperators: (ops: Operator[]) => set({ operators: ops }),
  activeOperators: [],
  toggleOperator: (op) =>
    set((state) => ({
      activeOperators: state.activeOperators.includes(op)
        ? state.activeOperators.filter((o) => o !== op)
        : [...state.activeOperators, op],
    })),
  selectedStation: null,
  setSelectedStation: (station) => set({ selectedStation: station }),
}))