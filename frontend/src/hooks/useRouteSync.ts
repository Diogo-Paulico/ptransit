import { useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAppStore } from "../store/useAppStore"
import { fetchStations, fetchAllStations } from "../api/stations"

/**
 * Keeps the URL in sync with the selected station.
 *
 * URL format: /:operator/:stationId
 *  - operator  — first operator slug of the station (URL-encoded)
 *  - stationId — station id (URL-encoded)
 *
 * On mount, if URL params are present the hook fetches a wide bounding box
 * and looks up the station by id so it can be pre-selected (bookmark support).
 */
export function useRouteSync() {
  const navigate = useNavigate()
  const { stationId } = useParams<{ operator: string; stationId: string }>()

  const selectedStation = useAppStore((s) => s.selectedStation)
  const setSelectedStation = useAppStore((s) => s.setSelectedStation)
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen)
  const initializing = useRef(true)

  // When the selected station changes, push/replace the URL
  useEffect(() => {
    // Avoid updating the URL while we're restoring initial state from the URL
    if (initializing.current) return

    if (selectedStation) {
      const operator = encodeURIComponent(
        selectedStation.operator ?? "unknown"
      )
      const id = encodeURIComponent(selectedStation.ids[0])
      navigate(`/${operator}/${id}`, { replace: true })
    } else {
      navigate("/", { replace: true })
    }
  }, [selectedStation, navigate])

  // On first load, if URL already has a station, resolve and select it
  useEffect(() => {
    if (!stationId || selectedStation) {
      initializing.current = false
      return
    }

    const decodedId = decodeURIComponent(stationId)

    // Try fetching all stations (more robust than a single giant bbox) and find the station by id
    fetchAllStations()
      .then((stations) => {
        // Try flexible matching: any id in the station.ids array, numeric compare ignoring leading zeros,
        // or match by a slugified station name as a last resort.
        const tryMatch = (s: any) => {
          // direct id match
          if (s.ids && s.ids.includes(decodedId)) return true
          // compare numeric values ignoring leading zeros
          const decodedNum = Number(decodedId)
          if (!Number.isNaN(decodedNum) && s.ids) {
            for (const sid of s.ids) {
              const sidNum = Number(sid)
              if (!Number.isNaN(sidNum) && sidNum === decodedNum) return true
            }
          }
          // match by slugified name (operator/station-name style)
          const slug = (s.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
          if (slug === decodedId.toLowerCase()) return true
          return false
        }

        const match = stations.find((s) => tryMatch(s))
        if (import.meta.env.DEV) console.debug("useRouteSync: looking for", decodedId, "found:", !!match)
        if (match) {
          setSelectedStation(match)
          // open the sheet so departures are visible
          try { setDrawerOpen(false) } catch (e) {}
          // also dispatch a global event so map can fly to the station immediately
          // delay slightly so MapView has time to mount and attach its listener
          try {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('app:station-selected', { detail: match }))
            }, 50)
          } catch (e) {}
          try {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('app:fly-to', { detail: match }))
            }, 70)
          } catch (e) {}
          // ensure selection is applied after a short delay in case MapView wasn't mounted yet
          try {
            setTimeout(() => setSelectedStation(match), 200)
          } catch (e) {}
         }
       })
      .catch(() => {
        // ignore — we'll fall back to root
      })
      .finally(() => {
        // allow URL sync to run after the restore attempt
        initializing.current = false
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only
}
