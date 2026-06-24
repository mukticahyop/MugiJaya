'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Proyek {
  id: string
  nama: string
  lokasi: string
}

interface Barang {
  id: string
  nama: string
  stok: number
  stok_minimum: number
  satuan: string
}

export default function AlokasiPage() {
  const supabase = createClient()
  const [proyekList, setProyekList] = useState<Proyek[]>([])
  const [barangList, setBarangList] = useState<Barang[]>([])
  
  // State Form Alokasi
  const [selectedProyekId, setSelectedProyekId] = useState('')
  const [selectedBarangId, setSelectedBarangId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const fetchData = async () => {
    setLoadingData(true)
    try {
      // 1. Fetch data proyek & barang secara paralel
      const [proyekRes, barangRes] = await Promise.all([
        supabase.from('proyek').select('*').eq('status', 'berjalan').order('nama', { ascending: true }),
        supabase.from('barang').select('*').order('nama', { ascending: true })
      ])

      if (proyekRes.error) throw proyekRes.error
      if (barangRes.error) throw barangRes.error

      setProyekList(proyekRes.data || [])
      setBarangList(barangRes.data || [])

    } catch (err: any) {
      toast.error('Gagal mengambil data: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAlokasi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProyekId || !selectedBarangId || !quantity || parseInt(quantity) <= 0) {
      toast.error('Semua data alokasi wajib diisi dengan kuantitas yang valid!')
      return
    }

    const qtyVal = parseInt(quantity)
    const targetBarang = barangList.find(b => b.id === selectedBarangId)
    const targetProyek = proyekList.find(p => p.id === selectedProyekId)
    if (!targetBarang || !targetProyek) return

    if (targetBarang.stok < qtyVal) {
      toast.error(`Stok material [${targetBarang.nama}] tidak mencukupi! Stok tersisa: ${targetBarang.stok} ${targetBarang.satuan}`)
      return
    }

    setLoadingSubmit(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Pengguna tidak teridentifikasi.')

      const stokBaru = targetBarang.stok - qtyVal

      // 1. Simpan Transaksi Gudang Keluar
      const { error: errTrans } = await supabase
        .from('transaksi_gudang')
        .insert({
          id_barang: selectedBarangId,
          tipe: 'keluar',
          jumlah: qtyVal,
          id_user: user.id
        })

      if (errTrans) throw errTrans

      // 2. Kurangi stok di database barang
      const { error: errUpdate } = await supabase
        .from('barang')
        .update({ stok: stokBaru })
        .eq('id', selectedBarangId)

      if (errUpdate) throw errUpdate

      // 3. Peringatan Stok Kritis
      if (stokBaru <= targetBarang.stok_minimum) {
        const { data: usersToNotify } = await supabase
          .from('users')
          .select('id')
          .in('role', ['gudang', 'manajemen'])

        if (usersToNotify && usersToNotify.length > 0) {
          const notifications = usersToNotify.map(u => ({
            id_user_penerima: u.id,
            tipe: 'stok_kritis',
            pesan: `⚠️ Peringatan: Stok barang [${targetBarang.nama}] kritis pasca alokasi ke proyek [${targetProyek.nama}]. Tersisa ${stokBaru} ${targetBarang.satuan}.`,
          }))
          await supabase.from('notifikasi').insert(notifications)
        }
      }

      // 4. Catat ke Audit Trail
      await supabase.from('audit_trail').insert({
        id_user: user.id,
        aksi: `Alokasi material ke proyek ${targetProyek.nama} - ${targetBarang.nama} (${qtyVal} ${targetBarang.satuan})`,
        tabel_terkait: 'transaksi_gudang',
        detail: { proyek: targetProyek.nama, barang: targetBarang.nama, jumlah: qtyVal }
      })

      toast.success(`Alokasi material ${qtyVal} ${targetBarang.satuan} ${targetBarang.nama} ke proyek ${targetProyek.nama} sukses!`)
      setQuantity('')
      fetchData()
    } catch (err: any) {
      toast.error('Gagal memproses alokasi: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="w-7 h-7 text-primary" /> Alokasi Material ke Proyek
        </h1>
        <p className="text-slate-500 text-sm mt-1">Lakukan penyaluran stok material konstruksi langsung ke proyek yang sedang berjalan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Form Card */}
        <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-50">
            <CardTitle className="text-md font-bold text-slate-800">Form Alokasi</CardTitle>
            <CardDescription>Pilih proyek aktif dan kuantitas material yang didelegasikan</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loadingData ? (
              <div className="space-y-5 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-10 bg-slate-200 rounded-xl w-full" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-10 bg-slate-200 rounded-xl w-full" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-10 bg-slate-200 rounded-xl w-full" />
                </div>
                <div className="h-10 bg-slate-200 rounded-xl w-full mt-4" />
              </div>
            ) : proyekList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-semibold">
                Tidak ada proyek aktif (berstatus &quot;berjalan&quot;). Tambahkan atau jalankan proyek terlebih dahulu.
              </div>
            ) : (
              <form onSubmit={handleAlokasi} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Pilih Proyek Penerima</label>
                  <select
                    value={selectedProyekId}
                    onChange={(e) => setSelectedProyekId(e.target.value)}
                    className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                    required
                  >
                    <option value="">-- Pilih Proyek Aktif --</option>
                    {proyekList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nama} (Lokasi: {p.lokasi})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Material yang Dialokasikan</label>
                  <select
                    value={selectedBarangId}
                    onChange={(e) => setSelectedBarangId(e.target.value)}
                    className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                    required
                  >
                    <option value="">-- Pilih Barang --</option>
                    {barangList.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nama} (Stok: {item.stok} {item.satuan})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Kuantitas</label>
                  <Input 
                    type="number" 
                    placeholder="Masukkan jumlah alokasi..."
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="bg-white border-slate-200 text-slate-800 text-xs rounded-xl"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loadingSubmit} 
                  className="w-full bg-primary hover:bg-primary/95 font-bold rounded-xl text-xs py-2.5 mt-2"
                >
                  {loadingSubmit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Proses Alokasi
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Info Card / Visual Representation */}
        <Card className="border-slate-100 shadow-sm rounded-2xl p-6 bg-slate-50/30 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Bagaimana alokasi bekerja?</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              Setiap kali alokasi diproses, sistem akan secara otomatis memotong stok barang di gudang. Transaksi dicatat sebagai pengeluaran barang dengan riwayat lengkap yang terdokumentasi untuk keperluan audit manajemen.
            </p>
            <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Ketentuan RLS & Keamanan</span>
              <ul className="text-[11px] text-slate-500 space-y-2">
                <li>• Hanya akun dengan role <strong>Admin Gudang</strong> atau <strong>Admin Sistem</strong> yang memiliki wewenang untuk mengeksekusi formulir alokasi.</li>
                <li>• Kuantitas alokasi divalidasi ketat di sisi server untuk menghindari nilai negatif atau melebihi stok yang tersedia.</li>
              </ul>
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}
