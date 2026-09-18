import { useState, useRef, useEffect } from "react"
import { useAppStore } from "../store/useAppStore"
import { searchStations } from "../api/search"
import type { Station } from "../types/transit"

export function SearchBar() {
  const setSelected = useAppStore((s) => s.setSelectedStation)
  const operators = useAppStore((s) => s.operators)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Station[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchStations(query.trim())
        setResults(data)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSelect = (station: Station) => {
    setSelected(station)
    setQuery("")
    setResults([])
    setOpen(false)
  }

  return (
    // responsive: on small screens use left/right padding to avoid overlapping side drawers;
    // on md+ keep centered with a fixed max width
    <div ref={wrapperRef} className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[min(360px,calc(100vw-5rem))] max-w-[90vw] z-[1000]">
      <div className="flex items-center bg-white rounded-full shadow-lg px-4 py-2 gap-2 min-w-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stations…"
          className="flex-1 outline-none text-sm bg-transparent placeholder-gray-400 min-w-0 truncate"
        />
        {loading && (
          <span className="text-gray-400 text-xs animate-spin">⟳</span>
        )}
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false) }} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="mt-2 bg-white rounded-2xl shadow-xl max-h-[40vh] overflow-y-auto">
          {results.map((station) => (
            <li
              key={station.ids.join(",")}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b last:border-b-0"
              onMouseDown={() => handleSelect(station)}
            >

              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                {/* <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/> */}
                <image xlinkHref={`/${station.operator}.svg`} x="0" y="0" width="24" height="24" />
              </svg>
              <div>
                <div className="text-sm font-medium">{station.name}</div>
                {station.lines && station.lines.map(line => (
                  <span key={line} className="search_line_badge">{line}</span>
                ))}
                {/* <div className="text-xs text-gray-400">{station.operator ? operators.find(op => op.id === station.operator)?.displayName : "Unknown Operator"}</div> */}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div className="mt-2 bg-white rounded-2xl shadow-xl px-4 py-3 text-sm text-gray-400">
          No stations found
        </div>
      )}
    </div>
  )
}
