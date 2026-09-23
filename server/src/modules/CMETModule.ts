import { CMETOnlineStop, CMETRealtimeEntry, CMETVehicleEntry, Departure, DepartureRealtime, StopSearchResult, StopTimeEntry } from '../types/interfaces';
import { ROOT_DIR, add_minutes_to_time, calculateMinutesUntil, fetchWithTimeout, get_current_8_digit_date, get_current_8_digit_date_hypen, get_current_formatted_time, get_formatted_time_plus_delta, get_gtfs_db_search_string, get_local_iso_time, gtfs_time_format, headsignWithStopIndicator, normalizeHeadsign, paddedTimeString, process_time, reverse_stop_filter, unixTimestampToDate } from '../utils';

import gtfsrealetime from "gtfs-realtime-bindings";



const CMETDBPATH = ROOT_DIR + "/files/CM.db";
import fs from "fs";
import { get_departures } from './CPModule';
import pool from '../db/db';


let cmet_online_stops: CMETOnlineStop[] = []

console.log("CMETDBPATH: " + CMETDBPATH)

const CMET_STATEMENT_STRING = `
SELECT trips.trip_headsign, routes.route_short_name, stop_times.arrival_time, stops.stop_id, routes.route_id, trips.trip_id, stop_times.stop_sequence, trips.shape_id
FROM routes 
INNER JOIN trips ON trips.route_id = routes.route_id
INNER JOIN calendar_dates on trips.service_id = calendar_dates.service_id
INNER JOIN stop_times on stop_times.trip_id = trips.trip_id
INNER JOIN stops on stops.stop_id = stop_times.stop_id
WHERE calendar_dates.date=$date AND stops.stop_name=$stop_name AND arrival_time > $time
ORDER BY stop_times.arrival_time ASC
LIMIT $limit`;

const CMET_SEARCH_STOP_STATEMENT = get_gtfs_db_search_string();

const CMET_VEHICLE_POSITION_TIMEOUT = 5000;
const CMET_REALTIME_TIMEOUT = 5000;



export class CMETModule {

    // cmetDB : Database.Database;
    // cmetDepartureStatement : Database.Statement;
    area: string = "cmet";
    // cmetStopSearchStatement : Database.Statement;

    // constructor(){
    //     this.cmetDB = new Database(CMETDBPATH);
    //     this.cmetDB.pragma('journal_mode = WAL');
    //     this.cmetDepartureStatement = this.cmetDB.prepare(CMET_STATEMENT_STRING);
    //     this.optimize_cmet_db();
    //     this.cmetStopSearchStatement = this.cmetDB.prepare(CMET_SEARCH_STOP_STATEMENT)
    // }


    // optimize_cmet_db() {
    //     this.cmetDB.prepare(`CREATE INDEX IF NOT EXISTS "arrival" ON "stop_times" ("arrival_time"	ASC)`).run()
    // }



    format_cmet_realtime(realtime: CMETRealtimeEntry, vehicles: CMETVehicleEntry[]): DepartureRealtime | undefined {
        //console.log("Vehicles len: " + vehicles.length)
        if (typeof realtime.estimated_arrival == 'undefined' || realtime.estimated_arrival == null) {
            return undefined
        } else {
            const vehicle = vehicles.find((vehicle) => vehicle.id == realtime.vehicle_id)
            return {
                scheduled_arrival: gtfs_time_format(realtime.scheduled_arrival),
                estimated_arrival: gtfs_time_format(realtime.estimated_arrival && realtime.estimated_arrival !== null ? realtime.estimated_arrival : realtime.scheduled_arrival),
                location_osm_url: (vehicle) ? `https://www.openstreetmap.org/?mlat=${vehicle.lat}&mlon=${vehicle.lon}#map=18/${vehicle.lat}/${vehicle.lon}` : undefined,
                confirmed_passed: realtime.observed_arrival !== undefined && realtime.observed_arrival < get_current_formatted_time()
            }
        }
    }


    sort_cmet(a: StopTimeEntry, b: StopTimeEntry): number {
        // Sorting is done as follows:
        // 1. If both have realtime, sort by realtime
        // 2. If only one has realtime, we compare the realtime to the scheduled
        // 3. If none have realtime, we compare the scheduled times

        if (a.realtime && b.realtime) {
            if (a.realtime.estimated_arrival < b.realtime.estimated_arrival) {
                return -1
            } else if (a.realtime.estimated_arrival > b.realtime.estimated_arrival) {
                return 1
            } else {
                return 0
            }
        }

        if (a.realtime && !b.realtime) {
            if (a.realtime.estimated_arrival < b.time) {
                return -1
            } else if (a.realtime.estimated_arrival > b.time) {
                return 1
            } else {
                return 0
            }
        }

        if (!a.realtime && b.realtime) {
            if (a.time < b.realtime.estimated_arrival) {
                return -1
            } else if (a.time > b.realtime.estimated_arrival) {
                return 1
            } else {
                return 0
            }
        }

        if (a.time < b.time)
            return -1
        if (a.time > b.time)
            return 1

        return 0
    }


    private cmet_url_generator = (line_id: string, stop_id: string, route_id: string, trip_id: string, stop_sequence: string, pattern_id: string) => {
        const cmet_url: string = "https://api.carrismetropolitana.pt/v2/lines/"
        return cmet_url +
            line_id + "?" +
            "active_waypoint_stop_id=" + stop_id +
            "&active_pattern_id=" + trip_id.split("|")[0] +
            "&active_waypoint_stop_sequence=" + stop_sequence
    }



    private data_scrub = (data: any) => {
        let scrubbed_data: any[] = []

        for (const stop of data) {
            stop.og_stop_name = stop.name
            stop.name = stop.name ? stop.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
            stop.short_name = stop.short_name ? stop.short_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
            stop.tts_name = stop.short_name ? stop.tts_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z ]/g, " ").toLowerCase() : "";
            scrubbed_data.push(stop)
        }

        return scrubbed_data

    }



    // public async search_stop(stop_name: string): Promise<StopSearchResult>{

    //     let results: StopSearchResult = { status: "OK", area: this.area, stop_name_query: stop_name, found_stops: [] }

    //     if(cmet_online_stops.length === 0 || cmet_online_stops === undefined || cmet_online_stops === null){
    //         await fetch("https://api.carrismetropolitana.pt/v2/stops").then(response => response.json()).then(data => {
    //             cmet_online_stops = this.data_scrub(data);
    //             console.log("Writing to file")
    //             fs.writeFileSync(ROOT_DIR + "/files/cmet_online_stops.json", JSON.stringify(cmet_online_stops))
    //         })
    //     }



    //     let found_stop_names = new Map<string, number>();

    //     const search_stop_lower = stop_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); // $& means the whole matched string
    //     const search_stop_split = search_stop_lower.split(" ")
    //     console.log(search_stop_split)
    //     for(const stop of cmet_online_stops) {            


    //         if(search_stop_split.every(word => stop.name.includes(word) || stop.short_name.includes(word) || stop.tts_name.includes(word))){
    //             if(found_stop_names.has(stop.name)){
    //                 const index : number = found_stop_names.get(stop.name)!
    //                 results.found_stops[index].ids.push(stop.id)
    //             }else{
    //                 results.found_stops.push({name: stop.og_stop_name, ids: [stop.id]})
    //                 found_stop_names.set(stop.name, results.found_stops.length - 1)
    //             }
    //         }



    //         // if(stop.name.search(search_stop_lower) !== -1 || stop.short_name.search(search_stop_lower) !== -1 || stop.tts_name.search(search_stop_lower) !== -1){
    //         //     if(found_stop_names.has(stop.name)){
    //         //         const index : number = found_stop_names.get(stop.name)!
    //         //         results.found_stops[index].ids.push(stop.id)
    //         //     }else{
    //         //         results.found_stops.push({name: stop.name, ids: [stop.id]})
    //         //         found_stop_names.set(stop.name, results.found_stops.length - 1)
    //         //     }

    //         // }
    //     }


    //     if(results.found_stops.length > 0){
    //         return results
    //     }





    //     let stop_search_statement = this.cmetStopSearchStatement;

    //     const DBresults = stop_search_statement.all({
    //         stop_name: "%" + stop_name + "%"
    //     })

    //     let stop_ids = new Map<string, string[]>();

    //     for (const result of DBresults) {
    //         if (stop_ids.has(result.stop_name)) {
    //             stop_ids.get(result.stop_name)?.push(result.stop_id)
    //         }
    //         else {
    //             stop_ids.set(result.stop_name, [result.stop_id])
    //         }
    //     }

    //     for (const [key, value] of stop_ids) {
    //         results.found_stops.push(
    //             {
    //                 name: key,
    //                 ids: value
    //             }
    //         )
    //     }

    //     return results
    // }

    public async get_departures_stopId(stop_ids: string[], limit: number, giventime?: string): Promise<Departure[]> {

        let results: Departure[] = []

        let api_miss = false
        let vehicles_requested = false
        let departures;
        let vehicles_json: CMETVehicleEntry[] = [];

        //  const request_vehicles = async () : Promise<CMETVehicleEntry[]> => {
        //     vehicles_requested = true
        //     let vehicles;
        //     try {
        //             vehicles = await fetchWithTimeout("https://api.carrismetropolitana.pt/v2/vehicles/", CMET_VEHICLE_POSITION_TIMEOUT)
        //         }catch(error: any){
        //             if(error.name == 'AbortError')
        //                 console.log("Timed out - vehicles")
        //         }

        //         if(vehicles && vehicles.ok)
        //             return await vehicles.json()
        //         else
        //             return []
        //}

        for (let index = 0; index < stop_ids.length; index++) {
            let departures;
            try {
                departures = await fetchWithTimeout(`https://api.carrismetropolitana.pt/stops/${stop_ids[index]}/realtime`, CMET_REALTIME_TIMEOUT)
            } catch (error: any) {
                if (error.name == 'AbortError')
                    console.log("Timed out  - departures")
            }
            if (departures && departures.ok) {
                // if(!vehicles_requested){
                //     vehicles_json = await request_vehicles()
                // }
                let departures_json: CMETRealtimeEntry[] = await departures.json()

                //console.log(departures_json)
                console.log("departures_json len: " + departures_json.length)
                //
                const formatted_timeMinusDelta = get_formatted_time_plus_delta(-5)
                departures_json = departures_json.filter((entry) => (entry.estimated_arrival !== undefined && entry.estimated_arrival !== null && entry.estimated_arrival >= formatted_timeMinusDelta) || entry.scheduled_arrival >= formatted_timeMinusDelta)




                departures_json.splice(0, limit).forEach((entry) => {
                    const isLive = entry.estimated_arrival !== undefined && entry.estimated_arrival !== null

                    const hasPassed = isLive ? entry.observed_arrival !== undefined && entry.observed_arrival < get_current_formatted_time() : false

                    const arrivalTime = hasPassed ? gtfs_time_format(entry.observed_arrival!) : (isLive ? gtfs_time_format(entry.estimated_arrival!) : gtfs_time_format(entry.scheduled_arrival))

                    const minutesUntil = calculateMinutesUntil(arrivalTime)
                    results.push({
                        lineNumber: entry.line_id,
                        lineName: entry.headsign,
                        isLive: isLive,
                        hasPassed: hasPassed,
                        arrivalTime: arrivalTime,
                        minutesUntil: minutesUntil
                    })
                })
            } else {
                api_miss = true
                break
            }
        }

        if (api_miss || results.length == 0) {
            const localIsoTime = get_local_iso_time(); // Get current local ISO time



            const dateString = localIsoTime.split('T')[0] + " 00:00:00.000"; // Get current date in YYYY-MM-DD format
            const timeString = localIsoTime.split('T')[1].split(":").slice(0, 2).join(":") + ":00"; // Get current time in HH:MM:SS format

            const SQL = `
            select ad.route_short_name, ad.trip_headsign , ad.arrival_time, ad.trip_id, ad.stop_sequence from cmet.arrivals_departures ad where ad."date" ='${dateString}' and ad.stop_id =$1 and ad.arrival_time  > $2 order by ad.arrival_time`;

            const result = await pool.query(SQL, [stop_ids[0], timeString]);

            let vehicles: gtfsrealetime.transit_realtime.IFeedEntity[] = [];


            await fetch("https://api.carrismetropolitana.pt/v2/vehicles.pb", { signal: AbortSignal.timeout(5000) }).then(response => response.arrayBuffer())
                .then(buffer => {
                    vehicles = gtfsrealetime.transit_realtime.FeedMessage.decode(new Uint8Array(buffer)).entity;
                }).catch(err => {
                    console.error("Error fetching GTFS real-time data:", err);
                });
            



            for (const row of result.rows) {
                const stopSequence = row.stop_sequence;
                const vehicle = vehicles.find(v => v.vehicle?.trip?.tripId == row.trip_id);
                let minutesDiff = 0;
                let busLive = false;
                let busStopID_legacy = "";
                let busStopSequence = 0;
                let vehicleTimestamp = 0;

                if (vehicle && (vehicle.vehicle) && (vehicle.vehicle?.trip) && (vehicle.vehicle?.timestamp && Number.isNaN(Number(vehicle.vehicle?.timestamp)) === false)) {
                    const vehicleInfo = vehicle.vehicle;
                    busStopID_legacy = vehicleInfo.stopId || "";
                    vehicleTimestamp = Number(vehicleInfo.timestamp)



                    const SQL = `select st.arrival_time, st.stop_sequence from cmet.stop_times st 
                    where st.trip_id = '${vehicleInfo.trip?.tripId}' and st.stop_id = (select s.stop_id  from cmet.stops s where s.legacy_ids  = '${busStopID_legacy}')`;

                    const stopTimeResult = await pool.query(SQL);

                    if (stopTimeResult.rows.length > 0) {
                        busStopSequence = stopTimeResult.rows[0].stop_sequence;


                        console.log(`Found stop time for trip_id ${vehicleInfo.trip?.tripId}:`, stopTimeResult.rows[0].arrival_time);

                        const stopTime = stopTimeResult.rows[0].arrival_time;

                        const busScheduledArrivalTime = new Date()
                        busScheduledArrivalTime.setHours(stopTime.hours);
                        busScheduledArrivalTime.setMinutes(stopTime.minutes);
                        const busGTFSTime: Date = unixTimestampToDate(vehicleTimestamp);
                        console.log(`Bus name: ${row.route_short_name}`)
                        console.log(`Currently at stop_sequence: ${busStopSequence}`)
                        console.log(`Our stop sequence: ${stopSequence}`)
                        console.log('busScheduledArrivalTime:', busScheduledArrivalTime);
                        console.log('busGTFSTime:', busGTFSTime);
                        console.log('delay in minutes:', (busGTFSTime.getTime() - busScheduledArrivalTime.getTime()) / 60000);
                        console.log('Estimated time at our stop by schedule: ', paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes))
                        console.log('Estimated time at our stop by GTFS: ', add_minutes_to_time(paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes), Math.floor((busGTFSTime.getTime() - busScheduledArrivalTime.getTime()) / 60000)))
                        console.log('--------------------------')
                        const timeDiff = busGTFSTime.getTime() - busScheduledArrivalTime.getTime();
                        busLive = true;
                        minutesDiff = Math.floor(timeDiff / 60000);
                    }
                }

                    let arrival_time = busLive ? add_minutes_to_time(paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes), minutesDiff) : paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes);


                    const hasPassed = busLive ? busStopSequence >= stopSequence : calculateMinutesUntil(arrival_time) <= 0;

                    if (hasPassed && busLive) {
                        arrival_time = paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes);
                    }
                



                    results.push({
                        lineNumber: row.route_short_name,
                        lineName: row.trip_headsign,
                        arrivalTime: arrival_time,
                        isLive: busLive,
                        hasPassed: hasPassed,
                        minutesUntil: calculateMinutesUntil(arrival_time),
                    });
            }
        }

        return results
    }
}
