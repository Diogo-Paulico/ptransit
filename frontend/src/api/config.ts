//API BASE SET TO BASE OF THE UI + THE /api 

//export const API_BASE = "http://192.168.1.164:3069"
export const API_BASE = import.meta.env.VITE_API_BASE || ""



export const STYLE_JSON_ENDPOINT = import.meta.env.VITE_STYLE_JSON_ENDPOINT || "http://localhost:5433/styles/basic-preview/style.json"

