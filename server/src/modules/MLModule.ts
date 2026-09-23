import { StopSearchResult, StopTimeEntry } from "../types/interfaces";
import { reverse_stop_filter } from "../utils";

const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;



class MLLines {
    static Amarela = "Amarela";
    static Azul = "Azul";
    static Verde = "Verde";
    static Vermelha = "Vermelha";
}


interface MLTOKENRESPONSE {
    access_token: string,
    token_type: string,
    expires_in: number,
    scope: string
}

interface MLStation {
    stop_id: string,
    stop_name: string,
    linha: MLLines[]
}

interface MLDestination {
    id_destino: string,
    nome_destino: string
}

interface MLStopDeparture {
    stop_id: string,
    tempoChegada1: string,
    tempoChegada2?: string,
    tempoChegada3?: string
    destino: string
}

let token_validity: Date;
let token: string = ""




let stations: { [name: string]: MLStation } = {}

let destinations: { [id: string]: string } = {}

const ML_API_TOKEN_URL = "https://api.metrolisboa.pt:8243/token";

const ML_API_URL = "https://api.metrolisboa.pt:8243/estadoServicoML/1.0.1/"

const ML_DESTINATIONS_ENDPOINT = "infoDestinos/todos"

const ML_STATIONS_ENDPOINT = "infoEstacao/todos"

const ML_WAITIME_PER_LINE_ENDPOINT = "tempoEspera/Linha/"


async function updateMLToken(): Promise<boolean> {
    //  console.log("Updating ML Token");
    const now = new Date();
    console.log("Token validity: " + token_validity);
    console.log("Current time: " + now);
    if (token_validity && (now.getTime() < token_validity.getTime())) {
        console.log("Token still valid");
        return true;
    }

    const response = await fetch(ML_API_TOKEN_URL, {
        method: "POST",
        headers: {
            "Authorization": "Basic " + Buffer.from(CONSUMER_KEY + ":" + CONSUMER_SECRET).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    })
    console.log("Token response status: " + response.status);



    if (response.status != 200) {
        console.log("Error getting token: " + response.status + " " + response.statusText);
        return false;
    }

    let token_response: MLTOKENRESPONSE = await response.json()
    console.log("Token response: " + token_response);
    //    let token_response : MLTOKENRESPONSE = JSON.parse(token_response_txt.substring(0, token_response_txt.length - 1));

    if (token_response.access_token) {
        token = token_response.access_token;
        token_validity = new Date((new Date()).getTime() + token_response.expires_in * 1000);
        return true;
    } else {
        return false;
    }
}


async function updateMLStations(): Promise<boolean> {
    //    console.log("Updating ML Stations");
    if (Object.keys(stations).length > 0) {
        return true;
    }

    //await updateMLToken();

    const response = await fetch(ML_API_URL + ML_STATIONS_ENDPOINT, {
        headers: {
            "Authorization": "Bearer " + token,
            "accept": "application/json"
        }
    })

    let stations_response: [] = (await response.json())["resposta"];
    if (stations_response) {
        stations_response.map((station: any) => {
            stations[station.stop_name] = {
                stop_id: station.stop_id,
                stop_name: station.stop_name,
                linha: lineStringToMLLine(station.linha)
            }
        })
        return true;
    } else {
        return false;
    }
}

export async function search_stop(_stop_name: string): Promise<StopSearchResult> {
    let result: StopSearchResult = {
        status: "OK -- RESULT FROM ML",
        stop_name_query: _stop_name,
        area: "ML",
        found_stops: []
    }

    await updateMLStations();

    if (Object.keys(stations).length == 0) {
        console.log("No stations found");
        return result;
    }

    console.log("Searching for stop: " + _stop_name);
    console.log("Stations: " + Object.keys(stations).length);

    Object.keys(stations).map((_station_name) => {
        let station_name = _station_name.toUpperCase();
        let stop_name = _stop_name.toUpperCase();

        console.log("Station: " + station_name + " Stop: " + stop_name);



        if (station_name.includes(stop_name)) {
            result.found_stops.push({
                name: _station_name,
                ids: [stations[_station_name].stop_id],
            })
        }
    })
    console.log("Found stops: " + result.found_stops.length);
    return result;
}


function getStation(station_name: string): MLStation | undefined {
    if (Object.keys(stations).length == 0) {
        return undefined;
    }

    return stations[station_name];
}

async function updateMLDestinations(): Promise<boolean> {
    if (Object.keys(destinations).length > 0) {
        return true;
    }

    const response = await fetch(ML_API_URL + ML_DESTINATIONS_ENDPOINT, {
        headers: {
            "Authorization": "Bearer " + token
        }
    })

    let destinations_response: MLDestination[] = (await response.json())["resposta"];

    if (destinations_response) {
        destinations_response.map((destination) => {
            destinations[destination.id_destino] = destination.nome_destino;
        })
        return true;
    }

    return false;
}


export async function get_departures(_station_id: string, limit: number, giventime?: string): Promise<StopTimeEntry[]> {
    let result: StopTimeEntry[] = []
    await updateMLToken();
    console.log("Getting departures for station: " + _station_id);


    const station_name = reverse_stop_filter(_station_id);

    if (!(await updateMLToken() && await updateMLStations() && await updateMLDestinations()))
        return result;

    let station = getStation(station_name);


    if (!station) {
        return result;
    }

    // console.log(station);
    const lines = station.linha;

    const stop_id = station.stop_id;


    for (const line of lines) {
        console.log(line);
        const response = await fetch(ML_API_URL + ML_WAITIME_PER_LINE_ENDPOINT + line, {
            headers: {
                "Authorization": "Bearer " + token
            }
        })

        console.log(response.status);
        console.log(response.statusText);



        if (response.status != 200) {
            return result;
        }

        let a = (await response.json())

        const response_code = a["codigo"];

        if (response_code != "200") {
            result.push({
                headsign: "ML API Erro",
                line: "Error",
                time: "Erro",
            })
            return result;
        }

    
        console.log(a);

        const departures_response: MLStopDeparture[] = a["resposta"];

        console.log("Departures response: ");
        console.log(departures_response);

        if (departures_response) {
            departures_response.map((departure) => {
                if (departure.stop_id == stop_id) {
                    console.log(departure)
                    const headsign = destinations[departure.destino];
                    const lineStr = lineStringFromMLLine(line);
                    result.push({
                        headsign: headsign,
                        line: lineStr,
                        time: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada1),
                        realtime: {
                            scheduled_arrival: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada1),
                            estimated_arrival: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada1),
                            confirmed_passed: false
                        }
                    })
                    if (departure.tempoChegada2) {
                        result.push({
                            headsign: headsign,
                            line: lineStr,
                            time: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada2),
                            realtime: {
                                scheduled_arrival: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada2),
                                estimated_arrival: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada2),
                                confirmed_passed: false
                            }
                        })
                    }
                    if (departure.tempoChegada3) {
                        result.push({
                            headsign: headsign,
                            line: lineStr,
                            time: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada3),
                            realtime: {
                                scheduled_arrival: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada3),
                                estimated_arrival: MLTimeToMinutesAndSecondsFromNow(departure.tempoChegada3),
                                confirmed_passed: false
                            }
                        })
                    }
                }
            })

        }


        result.sort((a, b) => {
            if (a.time < b.time) {
                return -1;
            } else if (a.time > b.time) {
                return 1;
            } else {
                return 0;
            }
        })
    }

    console.log("Departures: " + result.length);
    console.log(result);
    return result;

}

//Convert ML time (seconds until arrival) to HH:MM
function MLTimeToHoursAndMinutes(time: string): string {
    const msTimeNow = new Date().getTime();
    const msTimeTrain = msTimeNow + Number(time) * 1000;

    const date = new Date(msTimeTrain);
    return (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes());

}


function MLTimeToMinutesAndSecondsFromNow(time: string): string {
    const minutes = Math.floor(Number(time) / 60);
    const seconds = Number(time) % 60;
    return (minutes < 10 ? "0" + minutes : minutes) + "m:" + (seconds < 10 ? "0" + seconds : seconds) + "s";
}



function lineStringToMLLine(lines: string) {
    let result: MLLines[] = []

    if (lines.includes(MLLines.Amarela))
        result.push(MLLines.Amarela);
    if (lines.includes(MLLines.Azul))
        result.push(MLLines.Azul);
    if (lines.includes(MLLines.Verde))
        result.push(MLLines.Verde);
    if (lines.includes(MLLines.Vermelha))
        result.push(MLLines.Vermelha);

    return result;
}





function lineStringFromMLLine(line: MLLines) {
    switch (line) {
        case MLLines.Amarela:
            return "Y";
        case MLLines.Azul:
            return "B";
        case MLLines.Verde:
            return "G";
        case MLLines.Vermelha:
            return "R";
    }
    return ""
}

