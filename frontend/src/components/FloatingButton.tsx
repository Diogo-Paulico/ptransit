import { useAppStore } from "../store/useAppStore"

export function FloatingButton() {
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen)
  return (
    <button
      className="fixed top-4 right-4 z-[1000] pointer-events-auto bg-white p-3 rounded-full shadow-lg hover:bg-gray-100 focus:outline-none"
      onClick={() => setDrawerOpen(true)}
    >
      ☰
    </button>
  )
}