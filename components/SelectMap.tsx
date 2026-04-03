"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"

interface SelectMapProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void
  searchedLocation?: { lat: number; lng: number } | null
}

function LocationMarker({ onLocationSelect, searchedLocation }: SelectMapProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)

  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng)
      onLocationSelect(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
    },
    locationfound(e) {
      // Only set initial location if we haven't searched intentionally
      if (!searchedLocation && !position) {
        setPosition(e.latlng)
        map.flyTo(e.latlng, map.getZoom())
      }
    },
  })

  useEffect(() => {
    map.locate()
  }, [map])

  useEffect(() => {
    if (searchedLocation) {
      setPosition(searchedLocation)
      map.flyTo(searchedLocation, 13)
    }
  }, [searchedLocation, map])

  return position === null ? null : (
    <Marker position={position} />
  )
}

export default function SelectMap({ onLocationSelect, searchedLocation }: SelectMapProps) {
  return (
    <div className="h-[300px] w-full rounded-md overflow-hidden border border-border mt-4">
      <MapContainer
        center={[3.1390, 101.6869]} // Default center before user location is found
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker onLocationSelect={onLocationSelect} searchedLocation={searchedLocation} />
      </MapContainer>
    </div>
  )
}
