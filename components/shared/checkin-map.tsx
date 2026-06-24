'use client'

import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Truk {
  plat_nomor: string
}

interface Pengemudi {
  nama: string
}

interface Pengiriman {
  id: string
  asal: string
  tujuan: string
  status: string
  check_in_berangkat: string | null
  lat_berangkat: number | null
  lng_berangkat: number | null
  check_in_tiba: string | null
  lat_tiba: number | null
  lng_tiba: number | null
  truk?: Truk
  pengemudi?: Pengemudi
}

interface CheckInMapProps {
  pengirimanList: Pengiriman[]
  selectedTrukId?: string
}

export default function CheckInMap({ pengirimanList, selectedTrukId = 'all' }: CheckInMapProps) {
  useEffect(() => {
    // Override icon default Leaflet agar ter-render sempurna
    // (leaflet default icon paths pecah saat dibundel oleh Webpack/Next.js)
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })
  }, [])

  // Ikon kustom untuk berangkat (Biru) dan tiba (Hijau)
  const startIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })

  const endIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })

  // Set default view ke koordinat Jawa Tengah/DIY (lokasi operasional CV. Mugi Jaya)
  const defaultCenter: [number, number] = [-7.7956, 110.3695]
  const defaultZoom = 10

  // Kumpulkan semua titik koordinat yang valid dari data yang telah difilter
  const validCoordinates: [number, number][] = []
  pengirimanList.forEach(p => {
    if (p.lat_berangkat && p.lng_berangkat) validCoordinates.push([p.lat_berangkat, p.lng_berangkat])
    if (p.lat_tiba && p.lng_tiba) validCoordinates.push([p.lat_tiba, p.lng_tiba])
  })

  const center: [number, number] = validCoordinates.length > 0 ? validCoordinates[0] : defaultCenter
  const zoom = validCoordinates.length > 0 ? 11 : defaultZoom

  // Key dinamis: memaksa MapContainer untuk re-mount (dan re-center) ketika filter/koordinat berubah.
  // Ini penting karena <MapContainer> pada React Leaflet tidak bereaksi terhadap perubahan prop `center`
  // setelah komponen pertama kali dimount.
  const mapKey = `${selectedTrukId}-${center[0].toFixed(4)}-${center[1].toFixed(4)}`

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative z-10">
      <MapContainer 
        key={mapKey}
        center={center} 
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {pengirimanList.map((del) => {
          const hasStart = del.lat_berangkat && del.lng_berangkat
          const hasEnd = del.lat_tiba && del.lng_tiba
          const path: [number, number][] = []

          if (hasStart) path.push([del.lat_berangkat!, del.lng_berangkat!])
          if (hasEnd) path.push([del.lat_tiba!, del.lng_tiba!])

          return (
            <React.Fragment key={del.id}>
              {/* Marker Keberangkatan */}
              {hasStart && (
                <Marker position={[del.lat_berangkat!, del.lng_berangkat!]} icon={startIcon}>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-blue-700">🛫 Check-In Keberangkatan</p>
                      <p><strong>Asal:</strong> {del.asal}</p>
                      <p><strong>Truk:</strong> {del.truk?.plat_nomor || '-'}</p>
                      <p><strong>Pengemudi:</strong> {del.pengemudi?.nama || '-'}</p>
                      <p className="text-[10px] text-slate-400">
                        Waktu: {new Date(del.check_in_berangkat!).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Marker Kedatangan */}
              {hasEnd && (
                <Marker position={[del.lat_tiba!, del.lng_tiba!]} icon={endIcon}>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-green-700">🛬 Check-In Kedatangan</p>
                      <p><strong>Tujuan:</strong> {del.tujuan}</p>
                      <p><strong>Truk:</strong> {del.truk?.plat_nomor || '-'}</p>
                      <p><strong>Pengemudi:</strong> {del.pengemudi?.nama || '-'}</p>
                      <p className="text-[10px] text-slate-400">
                        Waktu: {new Date(del.check_in_tiba!).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Garis Polyline Menghubungkan Rute Keberangkatan & Kedatangan */}
              {path.length === 2 && (
                <Polyline 
                  positions={path} 
                  pathOptions={{ color: '#FE7F2D', weight: 4, dashArray: '6, 6', opacity: 0.8 }} 
                />
              )}
            </React.Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}
