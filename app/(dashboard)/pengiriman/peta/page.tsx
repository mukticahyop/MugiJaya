'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Map, Loader2, Truck, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

// Load map component dynamically with SSR disabled to avoid 'window is not defined' error
const CheckInMap = dynamic(
  () => import('@/components/shared/checkin-map'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[450px] bg-slate-100/80 animate-pulse rounded-2xl border border-slate-150 flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 bg-slate-200 rounded-full mx-auto" />
          <div className="w-32 h-4 bg-slate-200 rounded mx-auto" />
        </div>
      </div>
    )
  }
)

interface Truk {
  plat_nomor: string
}

interface Pengemudi {
  nama: string
}

interface Pengiriman {
  id: string
  id_truk: string | null
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

export default function PetaPengirimanPage() {
  const supabase = createClient()
  const [pengirimanList, setPengirimanList] = useState<Pengiriman[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTruk, setSelectedTruk] = useState<string>('all')

  const fetchCoordinates = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pengiriman')
        .select(`
          *,
          truk:id_truk (plat_nomor),
          pengemudi:id_pengemudi (nama)
        `)
        .not('check_in_berangkat', 'is', null) // Hanya ambil yang minimal sudah check-in berangkat

      if (error) throw error
      setPengirimanList(data as any[] || [])
    } catch (err: any) {
      toast.error('Gagal mengambil data lokasi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoordinates()
  }, [])

  // Ekstrak daftar truk unik dari data pengiriman
  const uniqueTrukList = useMemo(() => {
    const seen = new Set<string>()
    const list: { id_truk: string; plat_nomor: string }[] = []
    for (const p of pengirimanList) {
      if (p.id_truk && p.truk?.plat_nomor && !seen.has(p.id_truk)) {
        seen.add(p.id_truk)
        list.push({ id_truk: p.id_truk, plat_nomor: p.truk.plat_nomor })
      }
    }
    return list.sort((a, b) => a.plat_nomor.localeCompare(b.plat_nomor))
  }, [pengirimanList])

  // Filter data pengiriman sesuai truk yang dipilih
  const filteredPengiriman = useMemo(() => {
    if (selectedTruk === 'all') return pengirimanList
    return pengirimanList.filter(p => p.id_truk === selectedTruk)
  }, [pengirimanList, selectedTruk])

  const selectedTrukLabel = useMemo(() => {
    if (selectedTruk === 'all') return 'Semua Truk'
    return uniqueTrukList.find(t => t.id_truk === selectedTruk)?.plat_nomor ?? 'Semua Truk'
  }, [selectedTruk, uniqueTrukList])

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Map className="w-7 h-7 text-primary" /> Peta Check-In Pengiriman
          </h1>
          <p className="text-slate-500 text-sm mt-1">Visualisasi pemetaan titik koordinat lokasi keberangkatan dan kedatangan logistik truk CV. Mugi Jaya.</p>
        </div>

        {/* Filter Truk */}
        <div className="shrink-0">
          <Card className="border-slate-200 shadow-sm rounded-xl p-1 bg-white">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Truck className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Truk:</span>
              <div className="relative">
                <select
                  id="filter-truk"
                  value={selectedTruk}
                  onChange={e => setSelectedTruk(e.target.value)}
                  disabled={loading || uniqueTrukList.length === 0}
                  className="appearance-none bg-transparent pr-7 pl-1 py-1 text-sm font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                  style={{ color: selectedTruk !== 'all' ? '#FE7F2D' : undefined }}
                >
                  <option value="all">Semua Truk</option>
                  {uniqueTrukList.map(t => (
                    <option key={t.id_truk} value={t.id_truk}>
                      {t.plat_nomor}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Info badge ketika filter aktif */}
      {selectedTruk !== 'all' && (
        <div 
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold w-fit"
          style={{ backgroundColor: '#FE7F2D1A', color: '#FE7F2D', border: '1px solid #FE7F2D40' }}
        >
          <Truck className="w-4 h-4" />
          Menampilkan rute truk: <span className="font-black">{selectedTrukLabel}</span>
          <span className="text-xs font-medium opacity-70">
            ({filteredPengiriman.length} pengiriman)
          </span>
          <button
            onClick={() => setSelectedTruk('all')}
            className="ml-1 text-xs underline hover:no-underline opacity-70 hover:opacity-100"
          >
            Tampilkan semua
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 min-h-[450px] relative">
        {loading ? (
          <div className="w-full h-full min-h-[450px] bg-slate-100/80 animate-pulse rounded-2xl border border-slate-150 flex items-center justify-center">
            <div className="space-y-3 text-center">
              <div className="w-12 h-12 bg-slate-200 rounded-full mx-auto" />
              <div className="w-32 h-4 bg-slate-200 rounded mx-auto" />
            </div>
          </div>
        ) : (
          <CheckInMap pengirimanList={filteredPengiriman} selectedTrukId={selectedTruk} />
        )}
      </div>

      {/* Legend / Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-blue-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800">Titik Check-In Berangkat</p>
              <p className="text-[10px] text-slate-400 font-medium">Titik koordinat truk saat keluar dari gudang asal</p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-100 shadow-sm rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-green-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800">Titik Check-In Kedatangan</p>
              <p className="text-[10px] text-slate-400 font-medium">Titik koordinat truk saat tiba di lokasi proyek</p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-100 shadow-sm rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-[2px] border-t-2 border-dashed border-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800">Garis Rute Pengapalan</p>
              <p className="text-[10px] text-slate-400 font-medium">Indikator koneksi rute pengiriman logistik</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
