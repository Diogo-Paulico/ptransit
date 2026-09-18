import type { Operator } from "../types/transit"
import { API_BASE } from "./config"

export async function fetchOperators(): Promise<Operator[]> {
    const response = await fetch(`${API_BASE}/operators`)
    if (!response.ok) {
        throw new Error("Failed to fetch operators")
    }
    return response.json()
}

