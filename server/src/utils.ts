const DEFAULT_TIMEOUT = 3000;

export const ROOT_DIR = "/usr/src/app"


export async function fetchWithTimeout(resource : string, timeout? : number, options? : any) {
    const t = timeout ? timeout : DEFAULT_TIMEOUT;

    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
  
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal  
    });
    clearTimeout(id);
  
    return response;
  }


export function get_gtfs_db_search_string() {
  return `SELECT DISTINCT stop_name, stop_id FROM stops WHERE stop_name LIKE $stop_name OR tts_stop_name LIKE $stop_name`
}

/**
 * Get the current local time in ISO format (YYYY-MM-DDTHH:MM:SS)
 * @returns Current local time in ISO format (YYYY-MM-DDTHH:MM:SS)
 */
export function get_local_iso_time(timeshiftMinutes?: number) : string {
  const d = new Date();

  if (timeshiftMinutes) {
    d.setMinutes(d.getMinutes() + timeshiftMinutes);
  }

  const pad = (n: number) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}



export function process_time(time: string = "") {
  return (time && time.length > 0) ? format_given_time(time) : get_formatted_time_plus_delta(-5)
}

export function get_formated_time(date: Date) {
    return (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":"
        + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes())
        + ":00"
}

export function format_given_time(time: string) {
    const date = new Date()
    date.setHours(parseInt(time.split(":")[0]))
    date.setMinutes(parseInt(time.split(":")[1]))
    return get_formated_time(date)
}

export function get_current_formatted_time() {
    return get_formated_time(new Date())
}

export function get_formatted_time_plus_delta(delta_mins: number) {
    const date = new Date()
    date.setMinutes(date.getMinutes() + delta_mins)
    return get_formated_time(date)
}

/**
 * Receives a time in gtfs format (HH:MM) and returns the number of minutes until that time from the current time. If the time has already passed, it returns 0.
 * @param gtfs_time_formatted_time time in gtfs format (HH:MM)
 */
export function calculateMinutesUntil(gtfs_time_formatted_time: string) : number {
    const now = new Date()
    const [hours, minutes] = gtfs_time_formatted_time.split(":").map(Number)
    const targetTime = new Date()
    targetTime.setHours(hours)
    targetTime.setMinutes(minutes)
    targetTime.setSeconds(0)
    const diff = (targetTime.getTime() - now.getTime()) / 60000
    return diff > 0 ? Math.round(diff) : 0
}





export function get_8_digit_date(date: Date) {
  const month_num = (date.getMonth() + 1)
  return (date.getFullYear().toString() +
      (month_num < 10 ? "0" + month_num : month_num) +
      (date.getDate() < 10 ? "0" + date.getDate() : date.getDate()))
}

export function get_current_8_digit_date() {
  return get_8_digit_date(new Date())
}

/** Receives a time in HH:MM format and adds a specified number of minutes to it. 
 * @param time 
 * @param minutes 
 * @returns 
 */
export function add_minutes_to_time(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(mins + minutes);
  return paddedTimeString(date.getHours(), date.getMinutes());
}

export function paddedTimeString(hours?: number, minutes?: number) {
  const paddedHours = hours?.toString().padStart(2, '0') || '00';
  const paddedMinutes = minutes?.toString().padStart(2, '0') || '00';
  return `${paddedHours}:${paddedMinutes}`;
}
/**
 * Converts a Unix timestamp (in seconds) to a JavaScript Date object,keeping in mind DST and timezone differences.
 * @param timestamp - The Unix timestamp in seconds as a string.
 * @returns A Date object representing the given timestamp.
 */
export function unixTimestampToDate(timestamp: number): Date {
  const date = new Date(timestamp * 1000);
  return date;
}

export function get_current_8_digit_date_hypen() {
  const date = get_current_8_digit_date()
  return date.substring(0, 4) + "-" + date.substring(4, 6) + "-" + date.substring(6, 8)
}

 /**
* Turn time with secounds into time without secounds
* (24:00:00 -> 24:00)
* @param time time in gtfs format (HH:MM:SS)
* @returns time without secounds (HH:MM)
*/
export function gtfs_time_format(time: string) {
   let t = time
   const split = t.split(":")
   // if (t.split(":")[0] == "24") {
   //     t = "00:" + t.split(":")[1]
   // }
   // if (t.split(":")[0] == "25") {
   //     t = "01:" + t.split(":")[1]
   // }
   // if (t.split(":")[0] == "26") {
   //     t = "02:" + t.split(":")[1]
   // }
   return split[0] + ":" + split[1]
}


export const reverse_stop_filter = (stop_name: string) => {
  if(stop_name.includes("*")){
      console.log("REVERSE STOP FILTER")
      
      return stop_name.replace("*", "/")
  }
  return stop_name
}

export function headsignWithStopIndicator(stop_ids_length: number, index: number, headsign: string): string {
  if(stop_ids_length < 2 || index == 0)
      return normalizeHeadsign(headsign);

  let points = "•"
  for(let i = 2; i <= index; i++){
      points += "•"
  }

  return points + " " + normalizeHeadsign(headsign);

}

export function normalizeHeadsign(headsign: string): string {
  return headsign.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

//import fs from 'fs';

export function log_request(area: string, stop_name: string, ip: string): void {
    const datetime = new Date().toISOString();
    const entry = `${datetime} -  [${area}] ${stop_name} - ${ip}`;
    console.log(entry);
    // fs.appendFile('./files/requests.log', entry + '\n', (err) => {
    //     if (err) console.log(err);
    // });
}


