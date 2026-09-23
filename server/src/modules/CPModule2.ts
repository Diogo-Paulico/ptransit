import { StopSearchResult, StopTimeEntry, StopTimes, Departure } from "../types/interfaces";
import { calculateMinutesUntil, fetchWithTimeout, get_local_iso_time, process_time } from "../utils";






//TODO: Obtain CP https://cp.pt/fe-config.json -> need xcck as x-cp-connect-id, xccs as x-cp-connect-secret and travelApiKey as x-api-key, same info is needed for https://api-gateway.cp.pt/cp/services/travel-api/stations


/**
 * curl 'https://api-gateway.cp.pt/cp/services/travel-api/stations/94-31062/timetable/2025-12-11?start=22:35' \        ✔ 
  -H 'Accept-Language: pt;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Origin: https://cp.pt' \
  -H 'Pragma: no-cache' \
  -H 'Referer: https://cp.pt/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'Sec-GPC: 1' \
  -H 'User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36' \
  -H 'accept: application/json' \
  -H 'sec-ch-ua: "Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"' \
  -H 'sec-ch-ua-mobile: ?1' \
  -H 'sec-ch-ua-platform: "Android"' \
  -H 'x-api-key: ca3923e4-1d3c-424f-a3d0-9554cf3ef859' \
  -H 'x-cp-connect-id: 1483ea620b920be6328dcf89e808937a' \
  -H 'x-cp-connect-secret: 74bd06d5a2715c64c2f848c5cdb56e6b'

 */



interface CPStation{
    code: string,
    designation: string,
    latitude: string,
    longitude: string,
    region: string | null,
    railways: string[]
}


interface CPDepartures{
    stationStops: CPDepartureEntry[]
}

interface CPDepartureEntry{
    delay: number,
    trainOrigin: {
        code: string,
        designation: string
    },
    trainDestination: {
        code: string
        designation: string
    },
    departureTime: string
    arrivalTime: string
    trainNumber: number,
    trainService: {
        code: string
        designation: string
    },  
    platform: string
    occupancy: 1 | 2 | 3 | null
    ETA: string,
    ETD: string,
    supression: {
        code: string,
        designation: string
    } | null
}

interface Tokens{
    xcck: string,
    xccs: string,
    travelApiKey: string,
    fetchTime: number
}


let stations_list: CPStation[] = [];

let tokens : Tokens;


let options ={}



async function fetchTokens(){
    if (tokens && (Date.now() - tokens.fetchTime) < 86400000) // 24 hours
        return;
    await fetchWithTimeout("https://cp.pt/fe-config.json", 3000)
        .then(response => response.json())
        .then(data => {
            tokens = {
                xcck: data.xcck,
                xccs: data.xccs,
                travelApiKey: data.travelApiKey,
                fetchTime: Date.now()
            }
        })  

    options ={
            headers: {
                "x-cp-connect-id": tokens.xcck,
                "x-cp-connect-secret": tokens.xccs,
                "x-api-key": tokens.travelApiKey
            }
        }
    console.log("Fetched tokens: ", tokens)
}



export async function search_stop(stop_name: string) : Promise<StopSearchResult>{
    let results : StopSearchResult = {
        status: "OK -- RESULT FROM IP",
        stop_name_query: stop_name,
        area: "CP",
        found_stops: []
    }

    if(stations_list.length == 0){
        
        await fetchWithTimeout("https://api-gateway.cp.pt/cp/services/travel-api/stations", 3000, options)
            .then(response => response.json())
            .then(data => {stations_list = data})
    }

    console.log(stations_list)


    const search_stop_lower = stop_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); // $& means the whole matched string
    const search_stop_split = search_stop_lower.split(" ")
    console.log(search_stop_split)
    for(const stop of stations_list) {
        const stop_name = stop.designation.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        if(search_stop_split.every(word => stop_name.includes(word))){
            results.found_stops.push({
                name: stop.designation,
                ids: [stop.code]
            })
        }
    }
    return results
}

function formatTimeWithDelay(entry: CPDepartureEntry) : string{

    if(entry.delay == -1)
        return "SUPRIMIDO " + entry.departureTime
    

    if(entry.delay > 0)
        return entry.departureTime + " + " + entry.delay

    return entry.departureTime
}


function processCPStation(station_name : string) : string{
    return station_name.replace("Lisboa", "")
}


// export async function get_departures(stop_name: string, limit : number, giventime? : string) : Promise<StopTimeEntry[]>{
//     let stopTimes : StopTimeEntry[] = []
//     let stations = await search_stop(stop_name)
//     if(stations && stations.found_stops.length > 0){
//         let station_id = stations.found_stops[0].ids[0]

      
// }

export async function get_departures_stopId(stop_ids: string[], limit: number): Promise<Departure[]> {
    let results: CPDepartures = { stationStops: [] }
    

    await fetchTokens() // Ensure tokens are fetched before making API calls

    const localIsoTime = get_local_iso_time() 



    const today_string = localIsoTime.split('T')[0];

    const timeString = localIsoTime.split('T')[1].split(":").slice(0,2).join(":")

    const stopId = stop_ids[0].replace("_", "-") // CP API uses - instead of _ for stop IDs

    console.log(`Fetching departures for stop ID ${stopId} at time ${today_string} ${timeString}`)
    console.log("Using options: ", options)
    console.log(`Fetching URL: https://api-gateway.cp.pt/cp/services/travel-api/stations/${stopId}/timetable/${today_string}?start=${timeString}`)

    await fetchWithTimeout(`https://api-gateway.cp.pt/cp/services/travel-api/stations/${stopId}/timetable/${today_string}?start=${timeString}`, 3000, options)
    .catch(error => {
        console.error("Error fetching departures: ", error);
        return { json: () => ({ departures: [] }) }; // Return an empty departures array on error
    })
    .then(response => response.json())
    .then(data => results = data)


    let stopNames : Departure[] = []


    console.log("Raw API results: ", results)

    if(!results || !results.stationStops){
        console.log("No stationStops found in results for stop ID: ", stopId)
        return []
    }

    console.log("Processing departures for stop ID: ", stopId)  
    console.log("size of stationStops: ", results.stationStops.length)

    for(const entry of results.stationStops){
        if(entry.departureTime != null){
            console.log("Processing entry: ", entry.platform)
            stopNames.push({
                lineName: entry.trainDestination.designation,
                lineNumber: entry.trainService.code,
                arrivalTime: entry.ETA ? entry.ETA : entry.departureTime,
                minutesUntil: calculateMinutesUntil(entry.ETA ? entry.ETA : entry.departureTime),
                isLive: entry.delay != null || entry.ETA != null,
                hasPassed: calculateMinutesUntil(entry.ETA ? entry.ETA : entry.departureTime) <= 0,
                platform: entry.platform,
                occupancy: entry.occupancy != null ? (entry.occupancy == 1 ? "low" : entry.occupancy == 2 ? "medium" : entry.occupancy == 3 ? "high" : undefined) : undefined,
                supressed: entry.supression != null 
        
            })
        }
    }
    

    return stopNames.slice(0, limit).sort((a, b) => a.minutesUntil - b.minutesUntil)
    }


