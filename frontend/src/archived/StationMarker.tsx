import { Marker } from "react-leaflet"
import L from "leaflet"
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"
import { useAppStore } from "../store/useAppStore"
import type { Station } from "../types/transit"

const DEFAULT_ICON = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const OPERATOR_ICONS: Record<string, string> = {
  cmet: "/cmet.png",
  cp: "/cp.png",
  fertagus: "/fertagus.png",
  ml: "/ml.png",
  mts: "/mts.png",
  carris: "/carris.png",
}

export function getIcon(operator: string) {
    const url = OPERATOR_ICONS[operator.toLowerCase()]
    if (url) {
      return L.divIcon({
        html: `<div style="
          width:32px;height:32px;
          background:#f8f8f8;
          border-radius:7px;
          box-shadow:0 2px 8px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(0,0,0,0.18);
          border:1.5px solid #fff;
          display:flex;align-items:center;justify-content:center;
          overflow:hidden;
        "><img src="${url}" style="width:24px;height:24px;object-fit:contain;" /></div>`,
        // use Leaflet's default div icon class so positioning/transform works
        className: "leaflet-div-icon",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      })
    }
    return DEFAULT_ICON // fallback to default Leaflet marker
  }


export function StationMarker({ station }: { station: Station }) {
  const setSelected = useAppStore((s) => s.setSelectedStation)
  const icon = getIcon(station.operator)

  return (
    <Marker
      position={[station.lat, station.lon]}
      icon={icon}
      eventHandlers={{ click: () => setSelected(station) }}
    />
  )
}
