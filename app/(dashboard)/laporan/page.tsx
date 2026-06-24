'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FileText, Camera, Calendar, MapPin, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SkeletonCard } from '@/components/ui/skeleton'

interface Proyek {
  id: string
  nama: string
  lokasi: string
}

interface LaporanHarian {
  id: string
  id_proyek: string
  isi: string
  foto: string | null
  tanggal: string
  dibuat_pada: string
  proyek?: Proyek
}

export default function LaporanHarianPage() {
  const supabase = createClient()
  const [proyekList, setProyekList] = useState<Proyek[]>([])
  const [laporanList, setLaporanList] = useState<LaporanHarian[]>([])
  const [userRole, setUserRole] = useState<string>('mandor')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  
  // State Form Laporan
  const [selectedProyekId, setSelectedProyekId] = useState('')
  const [isiLaporan, setIsiLaporan] = useState('')
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0])
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const fetchData = async () => {
    setLoadingData(true)
    try {
      // 1. Fetch user & role
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User belum login')
      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      const role = profile?.role || 'mandor'
      setUserRole(role)

      // 2. Fetch proyek & laporan secara paralel
      let queryProyek = supabase.from('proyek').select('*').eq('status', 'berjalan')
      if (role === 'mandor') {
        queryProyek = queryProyek.eq('id_mandor', user.id)
      }

      let queryLaporan = supabase.from('laporan_harian').select(`
        *,
        proyek:id_proyek (id, nama, lokasi)
      `)

      if (role === 'mandor') {
        queryLaporan = queryLaporan.eq('ditangani_oleh', user.id)
      }

      const [proyekRes, laporanRes] = await Promise.all([
        queryProyek,
        queryLaporan.order('tanggal', { ascending: false })
      ])

      if (proyekRes.error) throw proyekRes.error
      if (laporanRes.error) throw laporanRes.error

      setProyekList(proyekRes.data || [])
      setLaporanList(laporanRes.data as any[] || [])

    } catch (err: any) {
      toast.error('Gagal mengambil data laporan: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProyekId || !isiLaporan || !tanggal) {
      toast.error('Silakan lengkapi formulir laporan harian!')
      return
    }

    // Cek apakah mandor sudah mengirimkan laporan untuk proyek ini di tanggal yang sama (mencegah double report)
    const isDoubleReport = laporanList.some(
      (l) => l.id_proyek === selectedProyekId && l.tanggal === tanggal
    )

    if (isDoubleReport) {
      toast.error('Anda sudah mengirimkan laporan untuk proyek ini pada tanggal yang dipilih! (Maksimal 1 kali sehari)')
      return
    }

    setLoadingSubmit(true)
    try {
      // 1. Upload Foto (jika ada) ke bucket 'foto_laporan'
      let fotoUrl = null

      if (fotoFile) {
        const fileExt = fotoFile.name.split('.').pop()
        const fileName = `${selectedProyekId}_laporan_${Date.now()}.${fileExt}`
        const filePath = `proyek/${fileName}`

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('foto_laporan')
          .upload(filePath, fotoFile)
        
        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('foto_laporan')
            .getPublicUrl(filePath)
          fotoUrl = publicUrlData.publicUrl
        } else {
          console.warn('Gagal upload ke bucket, menggunakan Base64 fallback.')
          const reader = new FileReader()
          fotoUrl = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(fotoFile)
          })
        }
      }

      // 2. Simpan Laporan Harian ke Database
      const { error } = await supabase
        .from('laporan_harian')
        .insert({
          id_proyek: selectedProyekId,
          ditangani_oleh: currentUserId,
          isi: isiLaporan,
          foto: fotoUrl,
          tanggal
        })

      if (error) throw error

      // 3. Catat ke Audit Trail
      await supabase.from('audit_trail').insert({
        id_user: currentUserId,
        aksi: `Mengirim laporan progres harian proyek [ID: ${selectedProyekId}] untuk tanggal ${tanggal}`,
        tabel_terkait: 'laporan_harian',
        detail: { proyekId: selectedProyekId, tanggal }
      })

      toast.success('Laporan progres harian berhasil dikirim!')
      setIsiLaporan('')
      setFotoFile(null)
      fetchData()
    } catch (err: any) {
      toast.error('Gagal mengirim laporan: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <FileText className="w-7 h-7 text-primary" /> Laporan Progres Harian Proyek
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {userRole === 'mandor' 
            ? 'Buat laporan harian mengenai kendala, progress fisik, dan kebutuhan di lapangan.' 
            : 'Pantau laporan harian proyek konstruksi dari mandor lapangan.'}
        </p>
      </div>

      {/* Form Laporan Harian (Khusus Mandor) */}
      {userRole === 'mandor' && (
        <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-50">
            <CardTitle className="text-md font-bold text-slate-800">Buat Laporan Hari Ini</CardTitle>
            <CardDescription>Laporkan progres fisik proyek Anda secara detail dan jujur</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmitReport}>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Pilih Proyek Pekerjaan</label>
                  <select
                    value={selectedProyekId}
                    onChange={(e) => setSelectedProyekId(e.target.value)}
                    className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                    required
                  >
                    <option value="">-- Pilih Proyek Aktif --</option>
                    {proyekList.map(p => (
                      <option key={p.id} value={p.id}>{p.nama} (Lokasi: {p.lokasi})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Tanggal Laporan</label>
                  <Input 
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="bg-white border-slate-200 text-slate-805 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Isi Laporan Harian (Progres / Kendala / Kebutuhan)</label>
                <textarea 
                  placeholder="Tulis rincian aktivitas pekerjaan hari ini, hambatan cuaca/teknis, serta kebutuhan material mendesak..."
                  value={isiLaporan}
                  onChange={(e) => setIsiLaporan(e.target.value)}
                  rows={4}
                  className="w-full text-xs font-medium p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700 resize-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Camera className="w-4 h-4 text-slate-400" /> Unggah Foto Progres Lapangan</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setFotoFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end">
              <Button type="submit" disabled={loadingSubmit} className="bg-primary hover:bg-primary/95 font-bold rounded-xl text-xs">
                {loadingSubmit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Kirim Laporan Harian
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Riwayat Laporan Harian */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-505" /> Riwayat Laporan Harian
        </h3>
        
        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : laporanList.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-100 rounded-2xl text-slate-400 text-sm font-semibold">
            Belum ada laporan harian terkirim.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {laporanList.map((lap) => (
              <Card key={lap.id} className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="bg-slate-50/50 border-b border-slate-50 p-4 flex flex-row justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{lap.proyek?.nama}</p>
                      <span className="text-[10px] text-slate-405 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" /> {lap.proyek?.lokasi}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {new Date(lap.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                      {lap.isi}
                    </p>
                    {lap.foto && (
                      <div className="rounded-xl overflow-hidden border border-slate-100 shadow-sm max-h-48 flex items-center justify-center">
                        <img 
                          src={lap.foto} 
                          alt="Foto Progres Lapangan" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
