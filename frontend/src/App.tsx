import { Routes, Route } from "react-router-dom"
import { MapView } from "./components/MapView"
import { OperatorDrawer } from "./components/OperatorDrawer"
import { DepartureSheet } from "./components/DepartureSheet"
import { FloatingButton } from "./components/FloatingButton"
import { SearchBar } from "./components/SearchBar"
import { useRouteSync } from "./hooks/useRouteSync"

function AppShell() {
  useRouteSync()
  return (
    <div className="w-screen flex flex-col relative" style={{ height: '100dvh' }}>
      <div className="flex-1 relative">
        <MapView />
        <SearchBar />
      </div>
      <FloatingButton />
      <OperatorDrawer />
      <DepartureSheet />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/:operator/:stationId" element={<AppShell />} />
      <Route path="/" element={<AppShell />} />
    </Routes>
  )
}