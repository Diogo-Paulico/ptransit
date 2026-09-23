export interface StopTimeEntry{
    headsign: string 
    time: string
    line: string
    realtime?: DepartureRealtime
    cmet_url?: string
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



export interface StopTimes{
    operator: string
    times: StopTimeEntry[]
}


export interface MTSEntry{
    start_time : number
}

export interface MTSTimes{
    times : MTSEntry[]
}

//Since stops with same name may have different ids, we need to send IDs
export interface Stop{
    name: string,
    ids: string[],
    lon?: number,
    lat?: number,
    operator?: string,
    lines?: string[] 
}

export interface StopSearchResult{
    status: string
    stop_name_query: string
    area: string
    found_stops: Stop[]
}


export interface CMETOnlineStop{
    og_stop_name: string //Original stop name, before any modifications
    name: string,
    short_name: string,
    tts_name: string,
    id: string
}


export interface CMETVehicleEntry{
    id: string,
    lat: number,
    lon: number,
    speed: number,
    status: string,
    timestamp: number,
    heading: number,
    trip_id: string | null,
    pattern_id?: string | null,
}

export interface CMETRealtimeEntry{
    line_id: string,
    pattern_id: string,
    route_id: string,
    trip_id: string,
    headsign: string,
    stop_sequence: number,
    scheduled_arrival: string,
    estimated_arrival?: string | null,
    observed_arrival?: string,
    vehicle_id: string | null
}




export interface DepartureRealtime{
    scheduled_arrival: string,
    estimated_arrival: string,
    location_osm_url?: string,
    confirmed_passed: boolean
}
