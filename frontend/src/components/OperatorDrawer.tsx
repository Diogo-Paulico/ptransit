import { createPortal } from "react-dom"
import { useAppStore } from "../store/useAppStore"
import { fetchOperators } from "../api/operators"
import { useQuery } from "@tanstack/react-query"
import type { Operator } from "../types/transit"

export function OperatorDrawer() {
  const isDrawerOpen = useAppStore((s) => s.isDrawerOpen)
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen)
  const activeOperators = useAppStore((s) => s.activeOperators)
  const operators = useAppStore((s) => s.operators)
  const setOperators = useAppStore((s) => s.setOperators)
  const toggleOperator = useAppStore((s) => s.toggleOperator)

  useQuery<Operator[]>({
    queryKey: ["operators"],
    queryFn: fetchOperators,
    staleTime: Infinity,
    onSuccess: setOperators,
  })



  if (!isDrawerOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1400]"
      onClick={() => setDrawerOpen(false)}
    >
    <div className="fixed top-0 right-0 h-full w-64 bg-white shadow-xl p-4 z-[2000] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
      <button className="mb-4 text-gray-500 hover:text-black" onClick={() => setDrawerOpen(false)}>
        Close
      </button>
      <h3 className="font-bold mb-2">Operators</h3>
      {operators.map((op) => (
        <div className="flex items-center" key={op.id}>
        <label key={op.id} className="block mb-1">
          <input
            type="checkbox"
            checked={activeOperators.includes(op.id)}
            onChange={() => toggleOperator(op.id)}
            className="mr-2"
          />
          {op.displayName}
        </label>
        <div className="w-4 h-4 rounded-full border border-gray-300 ml-2 inline-block" style={{ backgroundColor: op.color }} />
        </div>
      ))}
    </div>
    </div>,
    document.getElementById("overlay-root")!
  )
}