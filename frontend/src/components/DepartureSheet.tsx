import { createPortal } from "react-dom"
import { useAppStore } from "../store/useAppStore"
import { useQuery } from "@tanstack/react-query"
import { fetchDepartures } from "../api/departures"
import { useState, useRef, useEffect } from "react"
import { fetchStationInfo } from "../api/stations"

export function DepartureSheet() {
  const station = useAppStore((s) => s.selectedStation)
  const setSelected = useAppStore((s) => s.setSelectedStation)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showArrivalTime, setShowArrivalTime] = useState(false)
  const [visibleCount, setVisibleCount] = useState(8)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: departures = [] } = useQuery({
    queryKey: ["departures", station?.ids],
    queryFn: () => fetchDepartures(station!),
    enabled: !!station,
    refetchInterval: 30000,
  })

  function formatArrivalTime(at: string ){
    if(Number(at.split(":")[0]) > 23){
        const h = Number(at.split(":")[0]) - 24
        return "0" + String(h) + ":" + at.split(":")[1]
    }
    return at
  }

  const {data: stationInfo} = useQuery({
    queryKey: ["stationInfo", station?.ids],
    queryFn: () => fetchStationInfo(station!),
    enabled: !!station,
  })

  if (!station) return null

  // Infinite scroll: load more when reaching bottom
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      setVisibleCount((prev) => Math.min(prev + 8, departures.length))
    }
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1400]"
        onClick={() => {setSelected(null); setExpandedId(null)}}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-xl rounded-t-2xl z-[1500] pointer-events-auto flex flex-col">

        {/* Header (fixed height) */}
        <div className="flex justify-between items-center pt-4 px-4 pb-1  shrink-0">
          <h2 className="font-bold text-lg">{station.name}</h2>
          {/*Refresh departures button, refreshes the list of departures */}
          {/* <button
            className="text-gray-500 hover:text-black"
            onClick={() => {
              setVisibleCount(8)
              setExpandedId(null)
            }}
          >
            <img
              src="/refresh-icon.svg"
              alt="Refresh"
              className="w-5 h-5"
            />
          </button>  */}
          
          
          <button
            className="text-gray-500 hover:text-black"
            onClick={() => {setSelected(null); setExpandedId(null)}}
          >
            Close
          </button>
        </div>
        <div className="px-7 pb-2 overflow-x-auto whitespace-nowrap flex gap-2">
          {stationInfo && stationInfo.lines?.map((line) => (
            <span key={line} className="cmet_badge">{line}</span>
          ))}

        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className="overflow-y-auto px-4"
          style={{ maxHeight: 'calc(8 * 3rem)' }}
          onScroll={handleScroll}
        >
          {departures.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              No departures available.
            </div>
          )}
          {departures.slice(0, visibleCount).map((dep) => {
            const isExpanded = expandedId === dep.lineName+dep.lineNumber+dep.arrivalTime

            return (
              <div
                key={dep.lineName+dep.lineNumber+dep.arrivalTime} // lineNumber is not unique, but lineNumber+arrivalTime should be
                className="border-b py-3 cursor-pointer transition-all duration-200"
                onClick={() => {
                  setExpandedId(isExpanded ? null : dep.lineName+dep.lineNumber+dep.arrivalTime)
                }}
              >
                {/* Main Row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="cmet_badge ">{dep.lineNumber}</span>
                    <span className="font-medium">{dep.lineName}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    {dep.supressed && (
                      <img
                        src="/suppressed_train.svg"
                        alt="Suppressed"
                        className="w-4 h-4"
                      />
                    )}
                    {dep.isLive && !dep.supressed && (
                      <img
                        src="/live-icon.svg"
                        alt="Live"
                        className="w-4 h-4 animate-pulse"
                      />
                    )}
                    {/* onclick on minutes we switch to hour:minutes format and show the arrival time instead of minutes until, display seconds until if available, ignoring expanding click , cross time if has passed */}
                    <div className={`text-sm text-gray-500 cursor-pointer ${dep.hasPassed || dep.supressed ? 'line-through' : ''}`}>
                      {dep.minutesUntil < 30
                        ? !dep.hasPassed ? `${dep.minutesUntil} min ${dep.secondsUntil ? dep.secondsUntil + ' sec' : ''}` : `${formatArrivalTime(dep.arrivalTime)}`
                        : `${formatArrivalTime(dep.arrivalTime)}`
                          }
                    </div>
                  </span>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    {dep.lineNumber && (
                      <div>Line number: {dep.lineNumber}</div>
                    )}
                    {dep.platform && (
                      <div>Platform: {dep.platform}</div>
                    )}
                    {dep.occupancy && (
                      <div>Occupation: {dep.occupancy}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>,
    document.getElementById("overlay-root")!
  )
}