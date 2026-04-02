"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"

interface SelectMapProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void
}

function LocationMarker({ onLocationSelect }: SelectMapProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)

  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng)
      onLocationSelect(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
    },
    locationfound(e) {
      setPosition(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
    },
  })

  useEffect(() => {
    map.locate()
  }, [map])

  return position === null ? null : (
    <Marker position={position} />
  )
}

export default function SelectMap({ onLocationSelect }: SelectMapProps) {
  return (
    <div className="h-[300px] w-full rounded-md overflow-hidden border border-border mt-4">
      <MapContainer
        center={[51.505, -0.09]} // Default center before user location is found
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker onLocationSelect={onLocationSelect} />
      </MapContainer>
    </div>
  )
}
