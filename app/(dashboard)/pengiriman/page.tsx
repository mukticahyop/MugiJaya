'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Truck, MapPin, Calendar, Camera, Map, QrCode, CheckCircle, Navigation, Loader2, History, Zap } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/skeleton'

interface Truk {
  id: string
  plat_nomor: string
  kapasitas: number
}

interface Pengemudi {
  id: string
  nama: string
}

interface Pengiriman {
  id: string
  id_truk: string
  id_pengemudi: string
  asal: string
  tujuan: string
  status: 'jadwal' | 'berangkat' | 'tiba' | 'batal'
  check_in_berangkat: string | null
  lat_berangkat: number | null
  lng_berangkat: number | null
  check_in_tiba: string | null
  lat_tiba: number | null
  lng_tiba: number | null
  foto_kondisi_barang: string | null
  dibuat_pada: string
  truk?: Truk
  pengemudi?: Pengemudi
}

export default function PengirimanPage() {
  const supabase = createClient()
  const [pengirimanList, setPengirimanList] = useState<Pengiriman[]>([])
  const [trukList, setTrukList] = useState<Truk[]>([])
  const [driverList, setDriverList] = useState<Pengemudi[]>([])
  const [proyekList, setProyekList] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('pengemudi')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  
  // State Form Tambah Pengiriman
  const [selectedTrukId, setSelectedTrukId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [asal, setAsal] = useState('')
  const [tujuan, setTujuan] = useState('')
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'aktif' | 'selesai'>('aktif')

  // State File Foto Check-In Tiba
  const [fotoFile, setFotoFile] = useState<File | null>(null)

  const fetchPengiriman = async () => {
    setLoadingData(true)
    try {
      // 1. Dapatkan user & role
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User belum login')
      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      const role = profile?.role || 'pengemudi'
      setUserRole(role)

      // 2. Fetch list pengiriman (jika pengemudi, batasi miliknya sendiri)
      let query = supabase.from('pengiriman').select(`
        *,
        truk:id_truk (id, plat_nomor, kapasitas),
        pengemudi:id_pengemudi (id, nama)
      `).order('dibuat_pada', { ascending: false })

      if (role === 'pengemudi') {
        query = query.eq('id_pengemudi', user.id)
      }

      // 3. Fetch data secara paralel untuk memotong waktu tunggu latency jaringan
      if (['admin', 'gudang'].includes(role)) {
        const [pengirimanRes, trukRes, driversRes, proyekRes] = await Promise.all([
          query,
          supabase.from('truk').select('*').eq('status', 'tersedia'),
          supabase.from('users').select('id, nama').eq('role', 'pengemudi'),
          supabase.from('proyek').select('id, nama').neq('status', 'selesai')
        ])

        if (pengirimanRes.error) throw pengirimanRes.error

        setPengirimanList(pengirimanRes.data as any[] || [])
        setTrukList(trukRes.data || [])
        setDriverList(driversRes.data || [])
        setProyekList(proyekRes.data || [])
      } else {
        const { data: pengiriman, error: errPengiriman } = await query
        if (errPengiriman) throw errPengiriman
        setPengirimanList(pengiriman as any[] || [])
      }


    } catch (err: any) {
      toast.error('Gagal mengambil data pengiriman: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchPengiriman()
  }, [])

  // Filter daftar pengiriman berdasarkan tab yang aktif
  const filteredList = useMemo(() => {
    if (statusFilter === 'aktif') {
      return pengirimanList.filter(p => p.status !== 'tiba' && p.status !== 'batal')
    }
    return pengirimanList.filter(p => p.status === 'tiba' || p.status === 'batal')
  }, [pengirimanList, statusFilter])

  const countAktif = useMemo(() => pengirimanList.filter(p => p.status !== 'tiba' && p.status !== 'batal').length, [pengirimanList])
  const countSelesai = useMemo(() => pengirimanList.filter(p => p.status === 'tiba' || p.status === 'batal').length, [pengirimanList])

  // Aksi membuat jadwal pengiriman baru (Gudang/Admin)
  const handleCreatePengiriman = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTrukId || !selectedDriverId || !asal || !tujuan) {
      toast.error('Semua kolom form pengiriman wajib diisi!')
      return
    }

    setLoadingSubmit(true)
    try {
      // 1. Simpan pengiriman
      const { error: errInsert } = await supabase
        .from('pengiriman')
        .insert({
          id_truk: selectedTrukId,
          id_pengemudi: selectedDriverId,
          asal,
          tujuan,
          status: 'jadwal'
        })
      
      if (errInsert) throw errInsert

      // 2. Ubah status truk menjadi 'beroperasi'
      await supabase
        .from('truk')
        .update({ status: 'beroperasi' })
        .eq('id', selectedTrukId)

      // 3. Catat audit trail
      await supabase.from('audit_trail').insert({
        id_user: currentUserId,
        aksi: `Menjadwalkan pengiriman baru: ${asal} ke ${tujuan}`,
        tabel_terkait: 'pengiriman',
        detail: { asal, tujuan, driverId: selectedDriverId }
      })

      // 4. Kirim notifikasi ke driver
      await supabase.from('notifikasi').insert({
        id_user_penerima: selectedDriverId,
        tipe: 'pengiriman_baru',
        pesan: `🚚 Tugas Pengiriman Baru! Silakan check-in keberangkatan rute ${asal} → ${tujuan}.`
      })

      toast.success('Jadwal pengiriman baru berhasil disimpan!')
      setAsal('')
      setTujuan('')
      setSelectedTrukId('')
      setSelectedDriverId('')
      fetchPengiriman()
    } catch (err: any) {
      toast.error('Gagal menyimpan jadwal: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  // Aksi Geolocation Check-In Berangkat (Pengemudi - Simulasi GPS Demo)
  const handleCheckInBerangkat = async (pengirimanId: string) => {
    toast.loading('Simulasi mendeteksi lokasi GPS (Demo)...')
    
    // Koordinat dummy daerah Yogyakarta/Sleman
    const lat = -7.752 + (Math.random() - 0.5) * 0.02
    const lng = 110.378 + (Math.random() - 0.5) * 0.02

    setTimeout(async () => {
      toast.dismiss()
      try {
        const { error } = await supabase
          .from('pengiriman')
          .update({
            status: 'berangkat',
            check_in_berangkat: new Date().toISOString(),
            lat_berangkat: lat,
            lng_berangkat: lng
          })
          .eq('id', pengirimanId)

        if (error) throw error

        // Catat audit trail
        await supabase.from('audit_trail').insert({
          id_user: currentUserId,
          aksi: `Check-in keberangkatan pengiriman [ID: ${pengirimanId}] (Simulasi GPS)`,
          tabel_terkait: 'pengiriman',
          detail: { lat, lng }
        })

        toast.success('Check-In keberangkatan berhasil (Simulasi GPS)!')
        fetchPengiriman()
      } catch (err: any) {
        toast.error('Gagal check-in: ' + err.message)
      }
    }, 800)
  }

  // Aksi Geolocation Check-In Tiba + Upload Foto (Pengemudi - Simulasi GPS Demo)
  const handleCheckInTiba = async (pengirimanId: string, idTruk: string) => {
    // Foto wajib hanya jika user role adalah pengemudi asli
    if (!fotoFile && userRole === 'pengemudi') {
      toast.error('Harap pilih/ambil foto kondisi barang terlebih dahulu!')
      return
    }

    setLoadingSubmit(true)
    toast.loading('Mendapatkan lokasi & memproses (Simulasi GPS)...')

    // Koordinat dummy daerah Yogyakarta/Bantul (tujuan)
    const lat = -7.812 + (Math.random() - 0.5) * 0.02
    const lng = 110.362 + (Math.random() - 0.5) * 0.02

    setTimeout(async () => {
      try {
        // 1. Upload Foto ke Supabase Storage (atau simpan Base64 fallback untuk demo)
        let fotoUrl = 'https://placehold.co/600x400/png?text=Bukti+Penerimaan+Barang'

        // Menggunakan bucket 'foto_barang'
        if (fotoFile) {
          const fileExt = fotoFile.name.split('.').pop()
          const fileName = `${pengirimanId}_tiba_${Date.now()}.${fileExt}`
          const filePath = `laporan/${fileName}`

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('foto_barang')
            .upload(filePath, fotoFile)
          
          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('foto_barang')
              .getPublicUrl(filePath)
            fotoUrl = publicUrlData.publicUrl
          } else {
            console.warn('Gagal upload ke storage Supabase, menggunakan file mock Base64.')
            const reader = new FileReader()
            fotoUrl = await new Promise((resolve) => {
              reader.onloadend = () => resolve(reader.result as string)
              reader.readAsDataURL(fotoFile)
            })
          }
        }

        // 2. Update Pengiriman di DB
        const { error } = await supabase
          .from('pengiriman')
          .update({
            status: 'tiba',
            check_in_tiba: new Date().toISOString(),
            lat_tiba: lat,
            lng_tiba: lng,
            foto_kondisi_barang: fotoUrl
          })
          .eq('id', pengirimanId)

        if (error) throw error

        // 3. Bebaskan status truk kembali menjadi 'tersedia' via API admin/service_role
        if (idTruk) {
          const res = await fetch('/api/truk/release', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idTruk }),
          })
          if (!res.ok) {
            const errData = await res.json()
            throw new Error(errData.error || 'Gagal membebaskan armada truk')
          }
        }

        // 4. Catat audit trail
        await supabase.from('audit_trail').insert({
          id_user: currentUserId,
          aksi: `Check-in kedatangan pengiriman [ID: ${pengirimanId}] (Simulasi GPS)`,
          tabel_terkait: 'pengiriman',
          detail: { lat, lng, fotoUrl }
        })

        // 5. Kirim notifikasi ke gudang & manajemen
        const { data: managers } = await supabase.from('users').select('id').in('role', ['gudang', 'manajemen'])
        if (managers && managers.length > 0) {
          const notifs = managers.map(m => ({
            id_user_penerima: m.id,
            tipe: 'pengiriman_selesai',
            pesan: `✅ Pengiriman Berhasil Tiba! Truk rute ${asal || ''} → ${tujuan || ''} telah check-in kedatangan.`
          }))
          await supabase.from('notifikasi').insert(notifs)
        }

        toast.dismiss()
        toast.success('Konfirmasi kedatangan pengiriman berhasil (Simulasi GPS)!')
        setFotoFile(null)
        fetchPengiriman()
      } catch (err: any) {
        toast.dismiss()
        toast.error('Gagal memproses kedatangan: ' + err.message)
      } finally {
        setLoadingSubmit(false)
      }
    }, 1000)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" /> Pengiriman Logistik & Truk
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {userRole === 'pengemudi' 
              ? 'Kelola jadwal tugas pengiriman Anda dan lakukan check-in koordinat lokasi.' 
              : 'Jadwalkan rute pengiriman barang dan pantau titik check-in keberangkatan/kedatangan.'}
          </p>
        </div>
      </div>

      {/* Form Tambah Pengiriman (Khusus Admin/Gudang) */}
      {['admin', 'gudang'].includes(userRole) && (
        <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-50">
            <CardTitle className="text-md font-bold text-slate-800">Buat Jadwal Pengiriman Baru</CardTitle>
            <CardDescription>Tugaskan driver dan armada truk kosong untuk pengiriman barang</CardDescription>
          </CardHeader>
          <form onSubmit={handleCreatePengiriman}>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Pilih Truk (Tersedia)</label>
                <select
                  value={selectedTrukId}
                  onChange={(e) => setSelectedTrukId(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  required
                >
                  <option value="">-- Pilih Truk --</option>
                  {trukList.map(t => (
                    <option key={t.id} value={t.id}>{t.plat_nomor} ({t.kapasitas} ton)</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Pilih Pengemudi</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  required
                >
                  <option value="">-- Pilih Pengemudi --</option>
                  {driverList.map(d => (
                    <option key={d.id} value={d.id}>{d.nama}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Lokasi Asal (Gudang)</label>
                <select
                  value={asal}
                  onChange={(e) => setAsal(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  required
                >
                  <option value="">-- Pilih Gudang Asal --</option>
                  <option value="Gudang Utama Mugi Jaya">Gudang Utama Mugi Jaya</option>
                  <option value="Gudang Sleman">Gudang Sleman</option>
                  <option value="Gudang Bantul">Gudang Bantul</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Tujuan (Proyek)</label>
                <select
                  value={tujuan}
                  onChange={(e) => setTujuan(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  required
                >
                  <option value="">-- Pilih Proyek Tujuan --</option>
                  {proyekList.map(p => (
                    <option key={p.id} value={p.nama}>{p.nama}</option>
                  ))}
                </select>
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end">
              <Button type="submit" disabled={loadingSubmit} className="bg-primary hover:bg-primary/95 font-bold rounded-xl text-xs">
                {loadingSubmit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan Jadwal
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Daftar Pengiriman */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" /> Jadwal & Status Pengiriman
          </h3>
          {/* Tab Filter Status */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setStatusFilter('aktif')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'aktif'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Aktif
              {countAktif > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  statusFilter === 'aktif' ? 'bg-primary text-white' : 'bg-slate-300 text-slate-600'
                }`}>{countAktif}</span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('selesai')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'selesai'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Selesai
              {countSelesai > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  statusFilter === 'selesai' ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                }`}>{countSelesai}</span>
              )}
            </button>
          </div>
        </div>
        
        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredList.length === 0 ? (

          <div className="p-10 text-center bg-white border border-slate-100 rounded-2xl">
            {statusFilter === 'aktif' ? (
              <div className="text-slate-400 space-y-2">
                <CheckCircle className="w-10 h-10 mx-auto text-emerald-400" />
                <p className="text-sm font-bold text-slate-600">Tidak ada pengiriman aktif saat ini</p>
                <p className="text-xs text-slate-400">Semua truk telah selesai beroperasi. Buat jadwal pengiriman baru di atas, atau lihat riwayat di tab <strong>Selesai</strong>.</p>
              </div>
            ) : (
              <div className="text-slate-400 space-y-2">
                <History className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-500">Belum ada riwayat pengiriman selesai</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredList.map((del) => (
              <Card key={del.id} className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="bg-slate-50/50 border-b border-slate-50 p-4 flex flex-row justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{del.truk?.plat_nomor || '-'}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Kapasitas: {del.truk?.kapasitas} Ton</p>
                    </div>
                  </div>
                  <span className={`inline-block text-[9px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    del.status === 'tiba' ? 'bg-emerald-100 text-emerald-800' :
                    del.status === 'berangkat' ? 'bg-primary/10 text-primary' : 'bg-slate-150 text-slate-655'
                  }`}>
                    {del.status === 'tiba' ? 'Tiba di Lokasi' :
                     del.status === 'berangkat' ? 'Dalam Perjalanan' : 'Terjadwal'}
                  </span>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5 text-xs text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-500">Asal:</span> {del.asal}
                        {del.check_in_berangkat && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            🛫 Check-in: {new Date(del.check_in_berangkat).toLocaleTimeString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-slate-600">
                      <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-500">Tujuan:</span> {del.tujuan}
                        {del.check_in_tiba && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            🛬 Check-in: {new Date(del.check_in_tiba).toLocaleTimeString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      <span className="font-bold">Pengemudi:</span> {del.pengemudi?.nama || 'Belum ditugaskan'}
                    </div>
                  </div>

                  {/* Aksi Check-In & Link Surat Jalan */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50 justify-between items-center">
                    {/* QR Code / Surat Jalan Link */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" render={<Link href={`/pengiriman/surat-jalan/${del.id}`} />} className="rounded-xl border-slate-200 text-xs gap-1.5 py-1">
                        <QrCode className="w-4 h-4 text-slate-500" /> Surat Jalan
                      </Button>
                    </div>

                    {/* Tombol Check-In untuk Driver / Admin / Gudang (Demo Mode) */}
                    {['pengemudi', 'admin', 'gudang'].includes(userRole) && (
                      <div className="flex-1 flex justify-end gap-2">
                        {del.status === 'jadwal' && (
                          <Button 
                            size="sm"
                            onClick={() => handleCheckInBerangkat(del.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition-all"
                          >
                            <Navigation className="w-3.5 h-3.5 mr-1" /> Check-In Berangkat
                          </Button>
                        )}
                        {del.status === 'berangkat' && (
                          <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5">
                              <Camera className="w-4 h-4 text-slate-500" />
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => setFotoFile(e.target.files ? e.target.files[0] : null)}
                                className="text-[10px] text-slate-500 w-44"
                              />
                            </div>
                            <Button 
                              size="sm"
                              disabled={loadingSubmit}
                              onClick={() => handleCheckInTiba(del.id, del.id_truk)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs w-full shadow-sm hover:shadow transition-all"
                            >
                              {loadingSubmit && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Konfirmasi Terima (Tiba)
                            </Button>
                          </div>
                        )}
                        {del.status === 'tiba' && (
                          <span className="text-xs text-emerald-650 font-bold flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Pengiriman Selesai
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {statusFilter === 'aktif' && countSelesai > 0 && (
            <p className="text-center text-xs text-slate-400 pt-2">
              Ada <button onClick={() => setStatusFilter('selesai')} className="font-bold text-primary underline hover:no-underline">{countSelesai} pengiriman selesai</button> yang tersimpan di tab Selesai.
            </p>
          )}
          </>
        )}
      </div>
    </div>
  )
}
