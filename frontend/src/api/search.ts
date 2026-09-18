import type { Station, StationResponse } from "../types/transit"
import { API_BASE } from "./config"

export async function searchStations(query: string): Promise<Station[]> {
  const res = await fetch(`${API_BASE}/stops/search?stop_name=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error("Failed to search stations")
  const response : StationResponse = await res.json()
  return response.found_stops
}
