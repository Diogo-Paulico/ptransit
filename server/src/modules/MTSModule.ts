import pool from "../db/db";
import { Departure } from "../types/interfaces";
import { calculateMinutesUntil, get_local_iso_time, paddedTimeString } from "../utils";
import gtfsrealetime from "gtfs-realtime-bindings";


const LIMIT = 20; //DEFAULT LIMIT FOR DEPARTURES


export async function get_departures_stopId(stop_ids: string[], limit: number): Promise<Departure[]> {
    let departures : Departure[] = [];
    let tripIds : Map<string, string> = new Map(); // Map to store departureId and tripId pairs
    
    const localIsoTime = get_local_iso_time(); // Get current local ISO time

    const dateString = localIsoTime.split('T')[0] + " 00:00:00.000"; // Get current date in YYYY-MM-DD format
    const timeString = localIsoTime.split('T')[1].split(":").slice(0,2).join(":") + ":00"; // Get current time in HH:MM:SS format

    try {
        const SQL = `
        select ad.route_short_name, ad.trip_headsign , ad.arrival_time from mts.arrivals_departures ad where ad."date" ='${dateString}' and ad.stop_id =$1 and ad.arrival_time  > $2 order by ad.arrival_time`;

        //console.log("Executing SQL query:", SQL, "with parameters:", stop_ids[0], timeString);

        const result = await pool.query(SQL, [stop_ids[0], timeString]);

        for (const row of result.rows) {
            departures.push({
            lineNumber: row.route_short_name,
            lineName: row.trip_headsign,
            arrivalTime: paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes),
            isLive: false,
            hasPassed: false,
            minutesUntil: calculateMinutesUntil(paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes)),
        });
            
        }



        
        return departures
    } catch (err) {
        console.error('Error querying Postgres for all stations:', err);
        return [];
    }


}