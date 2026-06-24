'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { FolderGit, User, Clock, AlertTriangle, Plus, MapPin, Calendar, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SkeletonTable } from '@/components/ui/skeleton'

interface Mandor {
  id: string
  nama: string
}

interface Proyek {
  id: string
  nama: string
  lokasi: string
  status: 'rencana' | 'berjalan' | 'selesai'
  tanggal_mulai: string | null
  tanggal_selesai: string | null
  id_mandor: string | null
  mandor?: Mandor
}

export default function ProyekPage() {
  const supabase = createClient()
  const [proyekList, setProyekList] = useState<Proyek[]>([])
  const [mandorList, setMandorList] = useState<Mandor[]>([])
  const [userRole, setUserRole] = useState<string>('mandor')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  
  // State Form Tambah Proyek
  const [namaProyek, setNamaProyek] = useState('')
  const [lokasi, setLokasi] = useState('')
  const [selectedMandorId, setSelectedMandorId] = useState('')
  const [tglMulai, setTglMulai] = useState('')
  const [tglSelesai, setTglSelesai] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // State Proyek Belum Lapor Hari Ini
  const [proyekBelumLapor, setProyekBelumLapor] = useState<Proyek[]>([])

  const fetchData = async () => {
    setLoadingData(true)
    try {
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

      // 1. Fetch daftar proyek
      let queryProyek = supabase
        .from('proyek')
        .select(`
          *,
          mandor:id_mandor (id, nama)
        `)
        .order('dibuat_pada', { ascending: false })

      // 2. Fetch data secara paralel untuk memotong waktu tunggu latency jaringan
      if (['admin', 'manajemen'].includes(role)) {
        const todayStr = new Date().toISOString().split('T')[0]
        const [proyekRes, mandorRes, laporanRes] = await Promise.all([
          queryProyek,
          supabase.from('users').select('id, nama').eq('role', 'mandor'),
          supabase.from('laporan_harian').select('id_proyek').eq('tanggal', todayStr)
        ])

        if (proyekRes.error) throw proyekRes.error
        setProyekList(proyekRes.data as any[] || [])
        setMandorList(mandorRes.data || [])

        // 3. Deteksi Proyek "Belum Lapor" Hari Ini
        const reportedIds = laporanRes.data?.map(l => l.id_proyek) || []
        
        let queryBelumLapor = supabase
          .from('proyek')
          .select(`
            *,
            mandor:id_mandor (id, nama)
          `)
          .eq('status', 'berjalan')
        
        if (reportedIds.length > 0) {
          queryBelumLapor = queryBelumLapor.not('id', 'in', `(${reportedIds.join(',')})`)
        }
        
        const { data: belumLapor } = await queryBelumLapor
        setProyekBelumLapor(belumLapor as any[] || [])
      } else {
        const { data: proyek, error: errProyek } = await queryProyek
        if (errProyek) throw errProyek
        setProyekList(proyek as any[] || [])
      }


    } catch (err: any) {
      toast.error('Gagal memuat data proyek: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Action Simpan Proyek Baru (Admin/Manajemen)
  const handleCreateProyek = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaProyek || !lokasi || !selectedMandorId) {
      toast.error('Kolom Nama, Lokasi, dan Mandor wajib diisi!')
      return
    }

    setLoadingSubmit(true)
    try {
      const { error } = await supabase
        .from('proyek')
        .insert({
          nama: namaProyek,
          lokasi,
          id_mandor: selectedMandorId,
          tanggal_mulai: tglMulai || null,
          tanggal_selesai: tglSelesai || null,
          status: 'rencana'
        })

      if (error) throw error

      // Audit trail
      await supabase.from('audit_trail').insert({
        id_user: currentUserId,
        aksi: `Membuat proyek konstruksi baru: ${namaProyek}`,
        tabel_terkait: 'proyek',
        detail: { nama: namaProyek, lokasi, mandorId: selectedMandorId }
      })

      // Kirim notifikasi ke mandor yang ditunjuk
      await supabase.from('notifikasi').insert({
        id_user_penerima: selectedMandorId,
        tipe: 'proyek_baru',
        pesan: `👷 Anda ditunjuk sebagai Mandor untuk proyek baru: ${namaProyek}.`
      })

      toast.success('Proyek baru berhasil disimpan!')
      setNamaProyek('')
      setLokasi('')
      setSelectedMandorId('')
      setTglMulai('')
      setTglSelesai('')
      setShowAddForm(false)
      fetchData()
    } catch (err: any) {
      toast.error('Gagal menyimpan proyek: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  // Aksi Ubah Status Proyek (Admin/Manajemen/Mandor)
  const handleUpdateStatus = async (proyekId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'rencana' ? 'berjalan' : 'selesai'
    try {
      const { error } = await supabase
        .from('proyek')
        .update({ status: nextStatus })
        .eq('id', proyekId)

      if (error) throw error

      toast.success(`Status proyek berhasil diperbarui menjadi '${nextStatus}'!`)
      fetchData()
    } catch (err: any) {
      toast.error('Gagal memperbarui status proyek: ' + err.message)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <FolderGit className="w-7 h-7 text-primary" /> Proyek Konstruksi
          </h1>
          <p className="text-slate-500 text-sm mt-1">Daftar portofolio proyek konstruksi aktif, monitoring progres fisik, dan pelaporan.</p>
        </div>
        {['admin', 'manajemen'].includes(userRole) && (
          <Button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-primary hover:bg-primary/95 font-bold rounded-xl flex items-center gap-2 text-xs"
          >
            <Plus className="w-4 h-4" /> {showAddForm ? 'Batal' : 'Buat Proyek Baru'}
          </Button>
        )}
      </div>

      {/* Form Tambah Proyek Baru */}
      {showAddForm && (
        <Card className="border-slate-100 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">Inisialisasi Proyek Baru</CardTitle>
            <CardDescription>Lengkapi detail spesifikasi proyek baru di bawah ini</CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateProyek}>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Nama Proyek</label>
                <Input 
                  placeholder="Gedung Olahraga" 
                  value={namaProyek}
                  onChange={(e) => setNamaProyek(e.target.value)}
                  className="bg-white border-slate-200 text-slate-800 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Lokasi Proyek</label>
                <Input 
                  placeholder="Kec. Depok, Sleman" 
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                  className="bg-white border-slate-200 text-slate-800 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Tunjuk Mandor</label>
                <select
                  value={selectedMandorId}
                  onChange={(e) => setSelectedMandorId(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  required
                >
                  <option value="">-- Pilih Mandor --</option>
                  {mandorList.map(m => (
                    <option key={m.id} value={m.id}>{m.nama}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Tanggal Mulai</label>
                <Input 
                  type="date"
                  value={tglMulai}
                  onChange={(e) => setFormValue(setTglMulai, e.target.value)}
                  className="bg-white border-slate-200 text-slate-805 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Tanggal Selesai</label>
                <Input 
                  type="date"
                  value={tglSelesai}
                  onChange={(e) => setFormValue(setTglSelesai, e.target.value)}
                  className="bg-white border-slate-200 text-slate-805 text-xs rounded-xl"
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end">
              <Button type="submit" disabled={loadingSubmit} className="bg-primary hover:bg-primary/95 font-bold rounded-xl text-xs">
                {loadingSubmit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan Proyek
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Widget Peringatan Belum Lapor (Manajemen/Admin) */}
      {['admin', 'manajemen'].includes(userRole) && proyekBelumLapor.length > 0 && (
        <Alert variant="destructive" className="border-amber-200 bg-amber-50/60 rounded-2xl">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-805 font-bold">Peringatan: Proyek Belum Melapor!</AlertTitle>
          <AlertDescription className="text-amber-700 text-xs mt-1 space-y-1">
            Ada <strong className="underline">{proyekBelumLapor.length} proyek berjalan</strong> yang mandornya belum menyerahkan laporan progres harian per hari ini ({new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}).
            <div className="mt-2 divide-y divide-amber-100/50">
              {proyekBelumLapor.map(p => (
                <div key={p.id} className="py-1">
                  • <strong>{p.nama}</strong> | Mandor: {p.mandor?.nama || '-'}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Daftar Proyek */}
      <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-50">
          <CardTitle className="text-md font-bold text-slate-800">Semua Proyek Kontraktual</CardTitle>
          <CardDescription>Manajemen lintasan dan status progres proyek pembangunan</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingData ? (
            <SkeletonTable rows={5} cols={6} />
          ) : proyekList.length === 0 ? (

            <div className="p-12 text-center text-slate-400 text-sm font-semibold">
              Tidak ada data proyek konstruksi terdaftar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-slate-800 text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="p-4 text-left">Nama Proyek</th>
                    <th className="p-4 text-left">Lokasi</th>
                    <th className="p-4 text-left">Mandor Penanggung Jawab</th>
                    <th className="p-4 text-left">Periode Kontrak</th>
                    <th className="p-4 text-left">Status</th>
                    {['admin', 'manajemen'].includes(userRole) && <th className="p-4 text-left">Aksi Status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {proyekList.map((proyek) => (
                    <tr key={proyek.id} className="hover:bg-slate-50/50 font-medium">
                      <td className="p-4 font-bold text-slate-800">{proyek.nama}</td>
                      <td className="p-4 text-slate-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {proyek.lokasi}</span>
                      </td>
                      <td className="p-4 text-slate-660 font-semibold">{proyek.mandor?.nama || 'Belum ditunjuk'}</td>
                      <td className="p-4 text-left text-slate-500 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {proyek.tanggal_mulai ? new Date(proyek.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                          <span>s/d</span>
                          {proyek.tanggal_selesai ? new Date(proyek.tanggal_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                        </span>
                      </td>
                      <td className="p-4 text-left">
                        <span className={`inline-block font-bold text-[9px] uppercase px-2.5 py-1 rounded-full ${
                          proyek.status === 'selesai' ? 'bg-emerald-100 text-emerald-800' :
                          proyek.status === 'berjalan' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-655'
                        }`}>
                          {proyek.status === 'selesai' ? 'Selesai' :
                           proyek.status === 'berjalan' ? 'Sedang Berjalan' : 'Tahap Rencana'}
                        </span>
                      </td>
                      {['admin', 'manajemen'].includes(userRole) && (
                        <td className="p-4 text-left">
                          {proyek.status !== 'selesai' ? (
                            <Button 
                              size="sm"
                              onClick={() => handleUpdateStatus(proyek.id, proyek.status)}
                              className={`text-[10px] font-bold rounded-lg py-1 px-2.5 h-7 border-0 shadow-sm transition-all text-white ${
                                proyek.status === 'rencana' 
                                  ? 'bg-blue-600 hover:bg-blue-500' 
                                  : 'bg-emerald-600 hover:bg-emerald-500'
                              }`}
                            >
                              {proyek.status === 'rencana' ? 'Mulai Proyek' : 'Selesaikan Proyek'}
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Closed
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  // Helper local function to avoid direct hook calling in JSX
  function setFormValue(setter: Function, value: string) {
    setter(value)
  }
}
