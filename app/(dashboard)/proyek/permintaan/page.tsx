'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ClipboardList, Clock, CheckCircle2, XCircle, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SkeletonTable } from '@/components/ui/skeleton'


interface Proyek {
  id: string
  nama: string
}

interface Barang {
  id: string
  nama: string
  satuan: string
  stok: number
}

interface PermintaanMaterial {
  id: string
  id_proyek: string
  id_barang: string
  jumlah: number
  status: 'diajukan' | 'disetujui' | 'ditolak' | 'selesai'
  catatan_gudang: string | null
  diajukan_oleh: string
  tanggal: string
  proyek?: Proyek
  barang?: Barang
  requester?: {
    nama: string
  }
}

export default function PermintaanMaterialPage() {
  const supabase = createClient()
  const [permintaanList, setPermintaanList] = useState<PermintaanMaterial[]>([])
  const [proyekList, setProyekList] = useState<Proyek[]>([])
  const [barangList, setBarangList] = useState<Barang[]>([])
  const [userRole, setUserRole] = useState<string>('mandor')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  
  // State Form Permintaan
  const [selectedProyekId, setSelectedProyekId] = useState('')
  const [selectedBarangId, setSelectedBarangId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // State Dialog Aksi Gudang
  const [catatanGudang, setCatatanGudang] = useState('')

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

      // 2. Fetch proyek (jika mandor, hanya proyek miliknya)
      let queryProyek = supabase.from('proyek').select('id, nama').eq('status', 'berjalan')
      if (role === 'mandor') {
        queryProyek = queryProyek.eq('id_mandor', user.id)
      }

      // 3. Fetch list permintaan material
      let queryPermintaan = supabase.from('permintaan_material').select(`
        *,
        proyek:id_proyek (id, nama),
        barang:id_barang (id, nama, satuan, stok),
        requester:diajukan_oleh (nama)
      `).order('tanggal', { ascending: false })

      if (role === 'mandor') {
        queryPermintaan = queryPermintaan.eq('diajukan_oleh', user.id)
      }

      // 4. Fetch data secara paralel untuk memotong waktu tunggu latency jaringan
      const [proyekRes, barangRes, permintaanRes] = await Promise.all([
        queryProyek,
        supabase.from('barang').select('id, nama, satuan, stok'),
        queryPermintaan
      ])

      if (permintaanRes.error) throw permintaanRes.error

      setProyekList(proyekRes.data || [])
      setBarangList(barangRes.data || [])
      setPermintaanList(permintaanRes.data as any[] || [])


    } catch (err: any) {
      toast.error('Gagal memuat data permintaan: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Aksi simpan permintaan material baru (Mandor)
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProyekId || !selectedBarangId || !quantity || parseInt(quantity) <= 0) {
      toast.error('Silakan lengkapi formulir permintaan material dengan benar!')
      return
    }

    setLoadingSubmit(true)
    try {
      const { error } = await supabase
        .from('permintaan_material')
        .insert({
          id_proyek: selectedProyekId,
          id_barang: selectedBarangId,
          jumlah: parseInt(quantity),
          diajukan_oleh: currentUserId,
          status: 'diajukan'
        })

      if (error) throw error

      // Notifikasi ke semua Admin Gudang
      const { data: gudangUsers } = await supabase.from('users').select('id').eq('role', 'gudang')
      if (gudangUsers && gudangUsers.length > 0) {
        const notifs = gudangUsers.map(g => ({
          id_user_penerima: g.id,
          tipe: 'permintaan_material',
          pesan: `📝 Pengajuan Permintaan Material Baru dari Lapangan untuk proyek [${proyekList.find(p => p.id === selectedProyekId)?.nama || ''}].`
        }))
        await supabase.from('notifikasi').insert(notifs)
      }

      // Audit trail
      await supabase.from('audit_trail').insert({
        id_user: currentUserId,
        aksi: `Mengajukan permintaan material - ${barangList.find(b => b.id === selectedBarangId)?.nama} (${quantity})`,
        tabel_terkait: 'permintaan_material',
        detail: { proyekId: selectedProyekId, barangId: selectedBarangId, jumlah: quantity }
      })

      toast.success('Permintaan material berhasil diajukan!')
      setQuantity('')
      setSelectedBarangId('')
      setSelectedProyekId('')
      fetchData()
    } catch (err: any) {
      toast.error('Gagal mengajukan permintaan: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  // Aksi persetujuan/tolak/proses (Admin Gudang / Admin)
  const handleRespondRequest = async (reqId: string, action: 'disetujui' | 'ditolak' | 'selesai', reqItem: PermintaanMaterial) => {
    setLoadingSubmit(true)
    try {
      // Jika diselesaikan (dikirim/dikeluarkan dari gudang), kita potong stok barang
      if (action === 'selesai') {
        const targetBarang = barangList.find(b => b.id === reqItem.id_barang)
        if (!targetBarang) return

        if (targetBarang.stok < reqItem.jumlah) {
          toast.error(`Stok barang [${targetBarang.nama}] tidak mencukupi untuk disalurkan! Stok saat ini: ${targetBarang.stok} ${targetBarang.satuan}`)
          setLoadingSubmit(false)
          return
        }

        const stokBaru = targetBarang.stok - reqItem.jumlah

        // 1. Kurangi stok barang
        const { error: errUpdate } = await supabase
          .from('barang')
          .update({ stok: stokBaru })
          .eq('id', reqItem.id_barang)
        if (errUpdate) throw errUpdate

        // 2. Simpan transaksi keluar
        await supabase.from('transaksi_gudang').insert({
          id_barang: reqItem.id_barang,
          tipe: 'keluar',
          jumlah: reqItem.jumlah,
          id_user: currentUserId
        })
      }

      // Update status permintaan_material
      const { error } = await supabase
        .from('permintaan_material')
        .update({
          status: action,
          catatan_gudang: catatanGudang || null
        })
        .eq('id', reqId)

      if (error) throw error

      // Audit trail
      await supabase.from('audit_trail').insert({
        id_user: currentUserId,
        aksi: `Memproses permintaan material [ID: ${reqId}] menjadi '${action}'`,
        tabel_terkait: 'permintaan_material',
        detail: { status: action, catatan: catatanGudang }
      })

      // Kirim notifikasi ke pemohon (Mandor)
      await supabase.from('notifikasi').insert({
        id_user_penerima: reqItem.diajukan_oleh,
        tipe: 'permintaan_direspon',
        pesan: `📋 Permintaan material [${reqItem.barang?.nama}] Anda telah ${action} oleh Gudang.`
      })

      toast.success(`Permintaan material berhasil diperbarui menjadi '${action}'!`)
      setCatatanGudang('')
      fetchData()
    } catch (err: any) {
      toast.error('Gagal memperbarui status permintaan: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" /> Permintaan Material Konstruksi
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {userRole === 'mandor' 
            ? 'Ajukan pengadaan material untuk proyek konstruksi aktif dan pantau status persetujuan.' 
            : 'Verifikasi dan kelola pengajuan pengeluaran stok material dari lapangan.'}
        </p>
      </div>

      {/* Form Ajukan Permintaan (Khusus Mandor) */}
      {userRole === 'mandor' && (
        <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-50">
            <CardTitle className="text-md font-bold text-slate-800">Ajukan Pengadaan Material</CardTitle>
            <CardDescription>Pilih proyek aktif dan barang material yang dibutuhkan lapangan</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmitRequest}>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Proyek Lapangan Anda</label>
                <select
                  value={selectedProyekId}
                  onChange={(e) => setSelectedProyekId(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  required
                >
                  <option value="">-- Pilih Proyek --</option>
                  {proyekList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Material yang Dibutuhkan</label>
                <select
                  value={selectedBarangId}
                  onChange={(e) => setSelectedBarangId(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  required
                >
                  <option value="">-- Pilih Barang --</option>
                  {barangList.map(b => (
                    <option key={b.id} value={b.id}>{b.nama} (Stok: {b.stok} {b.satuan})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Jumlah Kebutuhan</label>
                <Input 
                  type="number" 
                  placeholder="Kuantitas kebutuhan..."
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-white border-slate-200 text-slate-800 text-xs rounded-xl"
                  required
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end">
              <Button type="submit" disabled={loadingSubmit} className="bg-primary hover:bg-primary/95 font-bold rounded-xl text-xs">
                {loadingSubmit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Ajukan Permintaan
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabel Pengajuan Terlacak */}
      <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-50">
          <CardTitle className="text-md font-bold text-slate-800">Daftar Permintaan Material</CardTitle>
          <CardDescription>Status real-time pengajuan pengadaan barang antar divisi</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingData ? (
            <SkeletonTable rows={5} cols={7} />
          ) : permintaanList.length === 0 ? (

            <div className="p-12 text-center text-slate-400 text-sm font-semibold">
              Tidak ada data pengajuan material.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-slate-800 text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="p-4 text-left">Nama Barang</th>
                    <th className="p-4 text-left">Proyek Penerima</th>
                    <th className="p-4 text-right">Jumlah</th>
                    <th className="p-4 text-left">Diajukan Oleh</th>
                    <th className="p-4 text-left">Catatan Gudang</th>
                    <th className="p-4 text-center">Status</th>
                    {['admin', 'gudang'].includes(userRole) && <th className="p-4 text-center">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {permintaanList.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 font-medium">
                      <td className="p-4 font-bold text-slate-800">{req.barang?.nama || 'Material Deleted'}</td>
                      <td className="p-4 text-slate-500">{req.proyek?.nama || 'Proyek Deleted'}</td>
                      <td className="p-4 text-right font-extrabold">{req.jumlah} {req.barang?.satuan}</td>
                      <td className="p-4 text-slate-650 font-semibold">{req.requester?.nama || 'Mandor'}</td>
                      <td className="p-4 text-slate-400 italic">{req.catatan_gudang || '-'}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-block font-bold text-[9px] uppercase px-2.5 py-1 rounded-full ${
                          req.status === 'selesai' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'disetujui' ? 'bg-primary/10 text-primary' : 
                          req.status === 'ditolak' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-655'
                        }`}>
                          {req.status === 'selesai' ? 'Selesai disalurkan' :
                           req.status === 'disetujui' ? 'Disetujui' : 
                           req.status === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                        </span>
                      </td>
                      {['admin', 'gudang'].includes(userRole) && (
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            {req.status === 'diajukan' && (
                              <>
                                <Button 
                                  size="sm"
                                  onClick={() => handleRespondRequest(req.id, 'disetujui', req)}
                                  className="text-[10px] font-bold rounded-lg py-1 px-2.5 h-7 bg-primary hover:bg-primary/95 text-white border-0 shadow-sm transition-all"
                                >
                                  Setujui
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={() => handleRespondRequest(req.id, 'ditolak', req)}
                                  className="text-[10px] font-bold rounded-lg py-1 px-2.5 h-7 bg-rose-600 hover:bg-rose-500 text-white border-0 shadow-sm transition-all"
                                >
                                  Tolak
                                </Button>
                              </>
                            )}
                            {req.status === 'disetujui' && (
                              <Button 
                                size="sm"
                                onClick={() => handleRespondRequest(req.id, 'selesai', req)}
                                className="text-[10px] font-bold rounded-lg py-1 px-2.5 h-7 bg-emerald-600 hover:bg-emerald-500"
                              >
                                Keluarkan Barang
                              </Button>
                            )}
                            {['ditolak', 'selesai'].includes(req.status) && (
                              <span className="text-[10px] text-slate-400">No Action</span>
                            )}
                          </div>
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
}
