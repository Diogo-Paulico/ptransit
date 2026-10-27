import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { fetchStations, fetchAllStations } from "../api/stations"
import { useAppStore } from "../store/useAppStore"
import type { Station as StationType, BoundingBox } from "../types/transit"
import { API_BASE, STYLE_JSON_ENDPOINT, VECTOR_TILES_JSON_ENDPOINT } from "../api/config"

const MIN_ZOOM = 15
const DEBOUNCE_MS = 300

export function MapView() {
  const activeOperators = useAppStore((s) => s.activeOperators)
  const operators = useAppStore((s) => s.operators)
  const selectedStation = useAppStore((s) => s.selectedStation)
  const setSelectedStation = useAppStore((s) => s.setSelectedStation)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const debounceRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const cacheRef = useRef<Array<{ box: BoundingBox; stations: StationType[] }>>([])

  const [stations, setStations] = useState<StationType[]>([])
  const [debouncedBounds, setDebouncedBounds] = useState<BoundingBox | null>(null)

  function slugifyOperator(op?: string) {
    if (!op) return 'unknown'
    return op.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  function cacheContains(box: BoundingBox, inner: BoundingBox) {
    return box.north >= inner.north && box.south <= inner.south && box.east >= inner.east && box.west <= inner.west
  }

  async function fetchAndCache(bounds: BoundingBox) {
    const found = cacheRef.current.find((c) => cacheContains(c.box, bounds))
    if (found) {
      setStations(found.stations)
      return
    }
    try {
      inFlightRef.current = true
      const data = await fetchStations(bounds)
      cacheRef.current.push({ box: bounds, stations: data })
      setStations(data)
    } catch (e) {
      console.error("Failed to fetch stations for bbox", e)
    } finally {
      inFlightRef.current = false
    }
  }

  // initialize MapLibre map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_JSON_ENDPOINT,
      center: [-9.139, 38.716],
      zoom: 14 // Lisbon
    })

    map.on("load", () => {
      if (!map.getSource("stations")) {
        map.addSource("stations", { type: "geojson", data: { type: "FeatureCollection", features: [] } } as any)

        map.addLayer({
          id: "stations-circle",
          type: "circle",
          source: "stations",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 6, 16, 10, 20, 14],
            // prefer per-feature color property (set when building GeoJSON), fallback to gray
            "circle-color": ["coalesce", ["get", "color"], "#6b7280"],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.95,
          },
        })

        // load example SVG icon (placed in public/ml.svg) and add as map image
        try {
          if (typeof (map as any).hasImage === "function" && typeof (map as any).addImage === "function") {
            // prefer HTMLImageElement to avoid createImageBitmap/SVG decode issues
            if (!map.hasImage('ml-icon')) {
              const img = new Image()
              img.crossOrigin = 'anonymous'
              img.src = '/ml.svg'
              img.onload = () => {
                try {
                  // remove existing to replace if present
                  if (map.hasImage('ml-icon')) (map as any).removeImage('ml-icon')
                  ;(map as any).addImage('ml-icon', img, { pixelRatio: 2 })

                  // add a symbol layer that shows per-feature icon (icon property)
                  if (!map.getLayer('stations-symbol')) {
                    map.addLayer({
                      id: 'stations-symbol',
                      type: 'symbol',
                      source: 'stations',
                      layout: {
                        'icon-image': ['get', 'icon'],
                        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 16, 0.6, 20, 0.6],
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                      },
                      paint: { 'icon-opacity': 1 },
                    } as any)
                  }
                } catch (err) {
                  console.debug('Failed to add ml-icon image to map', err)
                }
              }
              img.onerror = (err) => console.debug('Failed to lad /ml.svg', err)
            } else {
              // image already present — ensure layer exists
              if (!map.getLayer('stations-symbol')) {
                map.addLayer({
                  id: 'stations-symbol',
                  type: 'symbol',
                  source: 'stations',
                  layout: {
                    'icon-image': ['get', 'icon'],
                    'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 16, 1, 20, 1.6],
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                  },
                  paint: { 'icon-opacity': 1 },
                } as any)
              }
            }
          }
        } catch (err) {
          console.debug('Failed to initialize ml.svg loading', err)
        }

        // keep a hidden label layer so feature.properties.label is preserved for later use
        map.addLayer({
          id: "stations-label",
          type: "symbol",
          source: "stations",
          layout: {
            "text-field": ["get", "label"],
            "text-size": 12,
            "text-offset": [1.1, 0],
            "text-anchor": "left",
            "visibility": "none",
          },
          paint: { "text-color": "#111" },
        })

        // Prefetch all stations on initial load and populate cache to avoid
        // repeated bbox requests. We'll store them under a global bbox.
        ;(async () => {
          try {
            const all = await fetchAllStations()
            const globalBox = { north: 90, south: -90, east: 180, west: -180 }
            cacheRef.current.push({ box: globalBox, stations: all })
            setStations(all)
            // ensure we show features on initial load by setting debounced bounds to the global box
            setDebouncedBounds(globalBox)
            console.debug('prefetched all stations, count:', all.length)
          } catch (err) {
            console.error('Failed to fetch all stations on load', err)
          }
        })()
      }
    })

    // click handler on station features
    map.on("click", "stations-circle", (e) => {
      const f = e.features && (e.features[0] as any)
      if (!f || !f.properties) return
      const p = f.properties
      const st: StationType = {
        ids: p.ids ? JSON.parse(p.ids) : [],
        lon: p.lon,
        lat: p.lat,
        name: p.name,
        operator: p.operator,
      }
      setSelectedStation(st)
      // broadcast selection and request fly-to; do NOT open the side drawer here
      window.dispatchEvent(new CustomEvent("app:station-selected", { detail: st }))
      window.dispatchEvent(new CustomEvent("app:fly-to", { detail: st }))
    })

    map.on("mouseenter", "stations-circle", () => (map.getCanvas().style.cursor = "pointer"))
    map.on("mouseleave", "stations-circle", () => (map.getCanvas().style.cursor = ""))

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [setSelectedStation])

  // debug: log selectedStation changes
  useEffect(() => {
    console.debug('stations: selectedStation changed', selectedStation)
  }, [selectedStation])

  // update stations GeoJSON source when visible stations change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const visible = debouncedBounds
      ? stations
          .filter((s) => (activeOperators.length ? activeOperators.includes(s.operator) : true))
          .filter((s) => s.lat <= debouncedBounds.north && s.lat >= debouncedBounds.south && s.lon <= debouncedBounds.east && s.lon >= debouncedBounds.west)
      : []

    const geo = {
      type: "FeatureCollection",
      features: visible.map((s) => {
        const op = operators.find((o) => o.id === s.operator)
        const color = op?.color ?? '#6b7280'
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
          properties: {
            ids: JSON.stringify(s.ids || []),
            name: s.name,
            operator: s.operator,
            label: s.ids?.[0] ?? "",
            // per-operator icon id (e.g. 'icon-cmet') — symbol layer will use this
            icon: `${slugifyOperator(s.operator)}`,
            // per-feature color for circle
            color,
            // iconColor can be used if using SDF icons and tinting
            iconColor: '#c61d23',
            lon: s.lon,
            lat: s.lat,
          },
        }
      }),
    }

    // Update the source reliably — prefer direct setData when style is loaded.
    try {
      if (map.isStyleLoaded && !map.isStyleLoaded()) {
        // style not ready; set on next styledata
        map.once('styledata', () => {
          try { (map.getSource('stations') as any)?.setData(geo) } catch (e) { console.debug('setData failed on styledata', e) }
        })
      } else {
        const src = map.getSource('stations') as any | undefined
        if (src && typeof src.setData === 'function') {
            try {
              src.setData(geo)
            } catch (e) {
              console.debug('Failed to setData on stations source', e)
            }
        } else {
          // fallback: wait for next styledata and then set
          map.once('styledata', () => {
            try { (map.getSource('stations') as any)?.setData(geo) } catch (e) { console.debug('fallback setData failed', e) }
          })
        }
      }
    } catch (err) {
      console.debug('Error updating stations source', err)
    }
  }, [stations, debouncedBounds, activeOperators])

  // fly-to when selectedStation changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedStation) return
    const sheetHeight = window.innerHeight * 0.45
    map.flyTo({
      center: [selectedStation.lon, selectedStation.lat],
      zoom: Math.max(map.getZoom(), 16),
      padding: { top: 0, left: 0, right: 0, bottom: sheetHeight },
      speed: 1.2,
    })
  }, [selectedStation])

  // viewport change handling with debounce
  function onViewportChange(bounds: BoundingBox, zoom: number) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setDebouncedBounds(bounds)
      if (zoom >= MIN_ZOOM && !inFlightRef.current) fetchAndCache(bounds)
      debounceRef.current = null
    }, DEBOUNCE_MS)
  }

  // attach moveend/zoomend to map to call onViewportChange
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    function handler() {
      const m = mapRef.current
      if (!m) return
      const b = m.getBounds()
      const box: BoundingBox = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
      const zoom = m.getZoom()
      onViewportChange(box, zoom)
    }

    map.on("moveend", handler)
    map.on("zoomend", handler)
    handler()
    return () => {
      map.off("moveend", handler)
      map.off("zoomend", handler)
    }
  }, [])

  // Locate button (portal)
  function LocateButton() {
    const [loading, setLoading] = useState(false)
    const handleLocate = () => {
      if (!navigator.geolocation) return
      setLoading(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: Math.max(mapRef.current!.getZoom(), 16), duration: 800 })
          setLoading(false)
        },
        () => setLoading(false),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }
    return createPortal(
      <button onClick={handleLocate} title="Center on my location" className="absolute bottom-6 left-4 z-[1000] bg-white p-3 rounded-full shadow-lg hover:bg-gray-100 focus:outline-none">
        {loading ? (
          <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            <circle cx="12" cy="12" r="8" strokeDasharray="2 4"/>
          </svg>
        )}
      </button>,
      document.getElementById("overlay-root")!
    )
  }

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />
      <LocateButton />
    </div>
  )
}
