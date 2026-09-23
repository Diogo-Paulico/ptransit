import pool from "../db/db";
import { Departure } from "../types/interfaces";
import { add_minutes_to_time, calculateMinutesUntil, get_local_iso_time, paddedTimeString, unixTimestampToDate } from "../utils";
import gtfsrealetime from "gtfs-realtime-bindings";


const LIMIT = 20; //DEFAULT LIMIT FOR DEPARTURES

export async function get_departures_stopId(stop_ids: string[], limit: number): Promise<Departure[]> {
    let departures : Departure[] = [];
    let tripIds : Map<string, string> = new Map(); // Map to store departureId and tripId pairs

    const localIsoTime = get_local_iso_time(-15); // Get current local ISO time- 15 minutes to account for potential delays in data updates

    const dateString = localIsoTime.split('T')[0] + " 00:00:00.000"; // Get current date in YYYY-MM-DD format
    const timeString = localIsoTime.split('T')[1].split(":").slice(0,2).join(":") + ":00"; // Get current time in HH:MM:SS format

    try {
        const SQL = `
        select ad.route_short_name, ad.route_long_name, ad.direction_id, ad.arrival_time, ad.trip_id, ad.stop_sequence_consec  from carris.arrivals_departures ad where ad."date" ='${dateString}' and ad.stop_id =$1 and ad.arrival_time  > $2 order by ad.arrival_time`;

        //console.log("Executing SQL query:", SQL, "with parameters:", stop_ids[0], timeString);

        const result = await pool.query(SQL, [stop_ids[0], timeString]);

        let vehicles : gtfsrealetime.transit_realtime.IFeedEntity[] = [];

        await fetch("https://gateway.carris.pt/gateway/gtfs/api/v2.8/GTFS/realtime/vehiclepositions").then(response => response.arrayBuffer())
        .then(buffer => {
            vehicles = gtfsrealetime.transit_realtime.FeedMessage.decode(new Uint8Array(buffer)).entity;
        }).catch(err => {
            console.error("Error fetching GTFS real-time data:", err);
        });

        //console.log(`Fetched ${vehicles.length} live vehicles from GTFS real-time data.`);

        //console.log(vehicles[0].vehicle?.trip?.tripId);

        for (const row of result.rows) {
            const vehicle = vehicles.find(v => v.vehicle?.trip?.tripId == row.trip_id);
            let minutesDiff = 0;
            let busLive = false;
            let busStopSequence = 0;
            //console.log(`Checking for live vehicle for trip_id ${row.trip_id}`);
            if (vehicle && (vehicle.vehicle) && (vehicle.vehicle?.trip) && (vehicle.vehicle?.timestamp )) {
                const vehicleInfo = vehicle.vehicle;
                // console.log(`Found live vehicle for trip_id ${row.trip_id}:`, vehicle);
                const SQL = `select st.arrival_time from carris.stop_times st 
                where st.trip_id = '${vehicleInfo.trip?.tripId}' and st.stop_sequence_consec = ${vehicleInfo.currentStopSequence}`;


                // console.log(`Executing SQL query to get stop time for trip_id ${vehicleInfo.trip?.tripId} at stop_sequence ${vehicleInfo.currentStopSequence}:`, SQL);

                const stopTimeResult = await pool.query(SQL);

                if (stopTimeResult.rows.length > 0 && vehicleInfo.timestamp && Number.isNaN(Number(vehicleInfo.timestamp)) === false) {
                    const timestamp = Number(vehicleInfo.timestamp)


                    //TODO: remake time dif to be aware of dates too, imporant when bus is around midnight
                    busStopSequence = vehicleInfo.currentStopSequence!;

                    
                    console.log(`Found stop time for trip_id ${vehicleInfo.trip?.tripId} at stop_sequence ${vehicleInfo.currentStopSequence}:`, stopTimeResult.rows[0].arrival_time);
                    const stopTime = stopTimeResult.rows[0].arrival_time;
                   
                    const busScheduledArrivalTime = new Date()
                    busScheduledArrivalTime.setHours(stopTime.hours);
                    busScheduledArrivalTime.setMinutes(stopTime.minutes);
                    const busGTFSTime: Date = unixTimestampToDate(timestamp);
                    console.log(`Bus name: ${row.route_short_name}`)
                    console.log(`Currently at stop_sequence: ${vehicleInfo.currentStopSequence}`)
                    console.log('Our stop sequence: ', row.stop_sequence_consec)
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

            
            // console.log(row.arrival_time)
            // console.log(paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes))

            let arrival_time = busLive ? add_minutes_to_time(paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes), minutesDiff) : paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes);
            

            const hasPassed = busLive ? busStopSequence >= row.stop_sequence_consec : calculateMinutesUntil(arrival_time) <= 0;

            if (hasPassed && busLive) {
                arrival_time = paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes);
            }


            //console.log(`arrival_time for trip_id ${row.trip_id} is ${arrival_time} (live: ${busLive}, minutesDiff: ${minutesDiff})`);

            let headsign = row.route_long_name;
            if(headsign.includes("-")) {
                const headsignindex = row.direction_id == 0 ? 1 : 0;
                headsign = headsign.split("-")[headsignindex].trim();
            }




            
            departures.push({
            lineNumber: row.route_short_name,
            lineName: headsign,
            arrivalTime: arrival_time,
            isLive: busLive,
            hasPassed: hasPassed,
            minutesUntil: calculateMinutesUntil(arrival_time),
            }); 

            //let lastDeparture = departures[departures.length - 1];

            //Confirmed departures older than 5 minutes are removed 
            // if(lastDeparture.minutesUntil < -5 && lastDeparture.isLive){
            //     departures.pop();
            // }
        }


        console.log("------------------------------Separating departures---------------------")

        
        return departures.sort((a, b) => a.minutesUntil - b.minutesUntil)
    } catch (err) {
        console.error('Error querying Postgres for all stations:', err);
        return [];
    }


}