export interface StationResponse {
    status : string,
    stop_name_query: string,
    area : string,
    found_stops: Station[]
}

export interface Station {
  ids: string[]
  name: string
  lat: number
  lon: number
  operator: string
  lines?: string[]
}

export interface Operator{
  id: string
  displayName: string
  color: string
}

export interface Departure {
  lineName: string
  lineNumber: string
  arrivalTime: string
  minutesUntil: number
  secondsUntil?: number
  isLive: boolean
  hasPassed: boolean,
  platform?: string
  occupancy?: "low" | "medium" | "high",
  supressed?: boolean

}

export interface BoundingBox {
  north: number
  south: number
  east: number
  west: number
}