import pool from "../db/db";
import { Departure } from "../types/interfaces";
import { calculateMinutesUntil, get_local_iso_time, paddedTimeString } from "../utils";
import gtfsrealetime from "gtfs-realtime-bindings";


const LIMIT = 20; //DEFAULT LIMIT FOR DEPARTURES

interface IPDepartures{
    departures: IPDeparture[];
    timestamp: number;
}


interface IPDeparture {
    ComboioPassou : boolean;
    DataHoraPartidaChegada : string; // "08:48"
    NomeEstacaoDestino: string, // "SINTRA"
    NomeEstacaoOrigem: string, // "LISBOA-ORIENTE"
    Observacoes: string, // "Circula com atraso de 11 min." OU "SUPRIMIDO"
    Operador: string,
    TipoServico: "URB|SUBUR" | "REGIONAL" | "IC" | "ALFA" | "IR" | "INTERNACIONAL" | "ESPECIAL",
}

interface CachedIPDeparture {
    departure: IPDeparture;
    timestamp: number;
}





let IPDeparturesCache = new Map<string, CachedIPDeparture>(); // 


const FERTAGUS_STATION_ID_TO_IP_ID: { [key: string]: string } = {
    "FTStop1": "9417186",
    "FTStop2": "9417152",
    "FTStop3": "9417137",
    "FTStop4": "9417087",
    "FTStop5": "9467033",
    "FTStop6": "9466076",
    "FTStop7": "9466050",
    "FTStop8": "9466035",
    "FTStop9": "9417236",
    "FTStop10": "9417221",
    "FTStop11": "9417095",
    "FTStop12": "9468007",
    "FTStop13": "9468049",
    "FTStop14": "9468098",
    "FTStop15": "9468122"
};




function arrrivalTimeFromLive(departure: IPDeparture): string {
    if(departure.Observacoes.includes("Circula com atraso de")){
        const delayMatch = departure.Observacoes.match(/Circula com atraso de (\d+) min/);
        if (delayMatch && delayMatch[1]) {
            const delayMinutes = parseInt(delayMatch[1], 10);
            const [hours, minutes] = departure.DataHoraPartidaChegada.split(":").map(Number);
            const date = new Date();
            date.setHours(hours);
            date.setMinutes(minutes + delayMinutes);
            return paddedTimeString(date.getHours(), date.getMinutes());
        }
    }
    return departure.DataHoraPartidaChegada;
}

function getSuppressionStatus(observacoes: string): boolean {
    return observacoes.includes("SUPRIMIDO");
}

function cacheGC(){
    void Promise.all(Array.from(IPDeparturesCache.entries()).map(async ([departureId, cachedDeparture]) => {
        if(Date.now() - cachedDeparture.timestamp > 20*60000){ // 20 minute
            console.log("Removing cached departure: " + departureId);
            IPDeparturesCache.delete(departureId);
        }
    }))
}




export async function get_departures_stopId(stop_ids: string[], limit: number): Promise<Departure[]> {
    let departures : Departure[] = [];
    // let tripIds : Map<string, string> = new Map(); // Map to store departureId and tripId pairs
    
    const localIsoTime = get_local_iso_time(); // Get current local ISO time

    const dateString = localIsoTime.split('T')[0] + " 00:00:00.000"; // Get current date in YYYY-MM-DD format
    const timeString = localIsoTime.split('T')[1].split(":").slice(0,2).join(":") + ":00"; // Get current time in HH:MM:SS format

    cacheGC(); // Clean up old cached departures

    try {
        const SQL = `
        select ad.route_short_name, ad.trip_headsign , ad.arrival_time from fertagus.arrivals_departures ad where ad."date" ='${dateString}' and ad.stop_id =$1 and ad.arrival_time  > $2 order by ad.arrival_time`;

        const result = await pool.query(SQL, [stop_ids[0], timeString]);
        for (const row of result.rows) {

            const departureId = paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes) + row.trip_headsign.toUpperCase(); // Create a unique departure ID using arrival time and trip headsign "08:48SINTRA"
            const cachedDeparture = IPDeparturesCache.get(departureId)?.departure; // Check if the departure is in the IPDeparturesCache


            const arrivalTime = cachedDeparture ? arrrivalTimeFromLive(cachedDeparture) : paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes);

            departures.push({
            lineNumber: "U",
            lineName: row.trip_headsign,
            arrivalTime: cachedDeparture ? arrrivalTimeFromLive(cachedDeparture) : paddedTimeString(row.arrival_time.hours, row.arrival_time.minutes),
            isLive: cachedDeparture !== undefined,
            hasPassed: cachedDeparture ? cachedDeparture.ComboioPassou : false,
            minutesUntil: calculateMinutesUntil(arrivalTime),
            supressed: cachedDeparture ? getSuppressionStatus(cachedDeparture.Observacoes) : false
            });
        }


        const IPStopId = FERTAGUS_STATION_ID_TO_IP_ID[stop_ids[0]]




        //fetch IP departures and cache them, so they can be used for next calls without having to wait for IP (avg response time is 14 seconds)
        const headers = {
            "accept-language": "pt;q=0.8",
            "accept": "application/json, text/plain, */*",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "priority": "u=1, i",
            "referer": "https://www.infraestruturasdeportugal.pt/negocios-e-servicos/horarios",
            "sec-ch-ua": '"Brave";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": '"Android"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "sec-gpc": "1",
            "user-agent": "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36"
        }


        fetch(`https://www.infraestruturasdeportugal.pt/negocios-e-servicos/partidas-chegadas/${IPStopId}/%2000:00/%2023:59/INTERNACIONAL,%20ALFA,%20IC,%20IR,%20REGIONAL,%20URB%7CSUBUR,%20ESPECIAL`,{headers: headers}).then(
            response =>
            response.json()).then((data) => {
            console.log("Fetched departures from IP for stop: " + stop_ids[0] + " with IP Stop ID: " + IPStopId);
            console.log(data)
            data.response[0].NodesComboioTabelsPartidasChegadas.forEach((departure: IPDeparture) => {
                console.log("Caching departure from IP: " + departure.DataHoraPartidaChegada + " to " + departure.NomeEstacaoDestino + " from operator: " + departure.Operador);


                if(departure.Operador === "FERTAGUS"){
                    console.log("Departure is from FERTAGUS, caching it.");
                    const departureId = departure.DataHoraPartidaChegada + departure.NomeEstacaoDestino;
                    IPDeparturesCache.set(departureId, {departure, timestamp: Date.now()});
                }
            }
            )
        }
        )


        return departures
    } catch (err) {
        console.error('Error querying Postgres for all stations:', err);
        return [];
    }


}