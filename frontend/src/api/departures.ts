import type { Departure, Station } from "../types/transit"
import { API_BASE } from "./config"

export async function fetchDepartures(
  station: Station
): Promise<Departure[]> {
  const ids : string = station.ids.join(",")  
  const res = await fetch(`${API_BASE}/api/stations/${station.operator}/${ids}/departures`)
  if (!res.ok) throw new Error("Failed to fetch departures")
  return await res.json()

}