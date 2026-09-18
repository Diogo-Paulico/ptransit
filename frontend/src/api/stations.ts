import type { BoundingBox, Station, StationResponse } from "../types/transit"
import { API_BASE } from "./config"

export async function fetchStations(bounds: BoundingBox): Promise<Station[]> {
  // API expects longitude for minx/maxx and latitude for miny/maxy
  const params = new URLSearchParams({
    maxx: bounds.east.toString(),   // max longitude
    minx: bounds.west.toString(),   // min longitude
    maxy: bounds.north.toString(),  // max latitude
    miny: bounds.south.toString(),  // min latitude
  })

  const res = await fetch(`${API_BASE}/stops/bbox?${params}`)
  if (!res.ok) throw new Error("Failed to fetch stops")
  const data : StationResponse  = await res.json()

  if (!data.status.startsWith("OK")) throw new Error("Failed to fetch stops")
  return data.found_stops
}


export async function fetchStationInfo(station: Station): Promise<Station> {
  const ids : string = station.ids.join(",")
  const res = await fetch(`${API_BASE}/stops/${station.operator}/${ids}`)
  if (!res.ok) throw new Error("Failed to fetch station info")
  return await res.json()
}

export async function fetchAllStations(): Promise<Station[]> {
  // Try a dedicated endpoint first
  try {
    const res = await fetch(`${API_BASE}/stops/all`)
    if (res.ok) {
      const data: StationResponse = await res.json()
      if (data.status && data.found_stops) return data.found_stops
    }
  } catch (e) {
    // ignore and fallback
  }

  // Fallback to generic /stops endpoint if available
  try {
    const res = await fetch(`${API_BASE}/stops`)
    if (res.ok) {
      const data: StationResponse = await res.json()
      if (data.status && data.found_stops) return data.found_stops
    }
  } catch (e) {
    // ignore and fallback
  }




  // Last resort: request a very large bbox covering the globe
  const params = new URLSearchParams({
    minx: (-180).toString(),
    miny: (-90).toString(),
    maxx: (180).toString(),
    maxy: (90).toString(),
  })
  const res = await fetch(`${API_BASE}/stops/bbox?${params}`)
  if (!res.ok) throw new Error("Failed to fetch all stops")
  const data: StationResponse = await res.json()
  if (!data.status.startsWith("OK")) throw new Error("Failed to fetch all stops")
  return data.found_stops
}