'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Warehouse, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  Plus, 
  Search,
  CheckCircle,
  Loader2,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { SkeletonTable } from '@/components/ui/skeleton'


interface Barang {
  id: string
  nama: string
  kategori: string
  stok: number
  stok_minimum: number
  satuan: string
}

interface TransaksiGudang {
  id: string
  id_barang: string
  tipe: 'masuk' | 'keluar'
  jumlah: number
  tanggal: string
  id_user: string
  barang?: {
    nama: string
    satuan: string
  }
}

export default function GudangPage() {
  const supabase = createClient()
  const [barangList, setBarangList] = useState<Barang[]>([])
  const [transaksiList, setTransaksiList] = useState<TransaksiGudang[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  
  // State Form Transaksi
  const [selectedBarangId, setSelectedBarangId] = useState('')
  const [transType, setTransType] = useState<'masuk' | 'keluar'>('masuk')
  const [quantity, setQuantity] = useState('')
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // State Form Tambah Barang Baru
  const [showAddForm, setShowAddForm] = useState(false)
  const [newBarangName, setNewBarangName] = useState('')
  const [newBarangKategori, setNewBarangKategori] = useState('')
  const [newBarangMinStock, setNewBarangMinStock] = useState('10')
  const [newBarangSatuan, setNewBarangSatuan] = useState('sak')

  const fetchData = async () => {
    setLoadingData(true)
    try {
      // 1. Fetch data barang & transaksi secara paralel
      const [barangRes, transRes] = await Promise.all([
        supabase.from('barang').select('*').order('nama', { ascending: true }),
        supabase.from('transaksi_gudang').select(`
          *,
          barang:id_barang (nama, satuan)
        `).order('tanggal', { ascending: false }).limit(10)
      ])
      
      if (barangRes.error) throw barangRes.error
      if (transRes.error) throw transRes.error

      setBarangList(barangRes.data || [])
      setTransaksiList(transRes.data as any[] || [])

    } catch (err: any) {
      toast.error('Gagal mengambil data gudang: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Action Simpan Transaksi (Barang Masuk/Keluar)
  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBarangId || !quantity || parseInt(quantity) <= 0) {
      toast.error('Silakan pilih barang dan masukkan jumlah yang valid!')
      return
    }

    const qtyVal = parseInt(quantity)
    const targetBarang = barangList.find(b => b.id === selectedBarangId)
    if (!targetBarang) return

    if (transType === 'keluar' && targetBarang.stok < qtyVal) {
      toast.error(`Stok tidak mencukupi! Stok saat ini: ${targetBarang.stok} ${targetBarang.satuan}`)
      return
    }

    setLoadingSubmit(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Pengguna tidak teridentifikasi.')

      // 1. Hitung stok baru
      const stokBaru = transType === 'masuk' 
        ? targetBarang.stok + qtyVal 
        : targetBarang.stok - qtyVal

      // 2. Simpan Transaksi Gudang
      const { error: errTrans } = await supabase
        .from('transaksi_gudang')
        .insert({
          id_barang: selectedBarangId,
          tipe: transType,
          jumlah: qtyVal,
          id_user: user.id
        })
      
      if (errTrans) throw errTrans

      // 3. Update Stok di tabel Barang
      const { error: errUpdate } = await supabase
        .from('barang')
        .update({ stok: stokBaru })
        .eq('id', selectedBarangId)

      if (errUpdate) throw errUpdate

      // 4. Peringatan Stok Kritis Otomatis (Trigger Notifikasi)
      if (stokBaru <= targetBarang.stok_minimum) {
        // Cari admin gudang & manajemen
        const { data: usersToNotify } = await supabase
          .from('users')
          .select('id')
          .in('role', ['gudang', 'manajemen'])

        if (usersToNotify && usersToNotify.length > 0) {
          const notifications = usersToNotify.map(u => ({
            id_user_penerima: u.id,
            tipe: 'stok_kritis',
            pesan: `⚠️ Peringatan: Stok barang [${targetBarang.nama}] kritis! Saat ini tinggal ${stokBaru} ${targetBarang.satuan} (Min: ${targetBarang.stok_minimum}).`,
          }))
          
          await supabase.from('notifikasi').insert(notifications)
        }
      }

      // 5. Catat ke Audit Trail
      await supabase.from('audit_trail').insert({
        id_user: user.id,
        aksi: `Mencatat barang ${transType === 'masuk' ? 'masuk' : 'keluar'} - ${targetBarang.nama} (${qtyVal} ${targetBarang.satuan})`,
        tabel_terkait: 'transaksi_gudang',
        detail: { barang: targetBarang.nama, jumlah: qtyVal, tipe: transType }
      })

      toast.success(`Transaksi barang ${transType === 'masuk' ? 'masuk' : 'keluar'} berhasil disimpan!`)
      setQuantity('')
      fetchData()
    } catch (err: any) {
      toast.error('Gagal mencatat transaksi: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  // Action Tambah Barang Baru
  const handleCreateBarang = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBarangName || !newBarangKategori || !newBarangMinStock || !newBarangSatuan) {
      toast.error('Semua kolom data barang baru wajib diisi!')
      return
    }

    setLoadingSubmit(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('barang')
        .insert({
          nama: newBarangName,
          kategori: newBarangKategori,
          stok_minimum: parseInt(newBarangMinStock),
          satuan: newBarangSatuan,
          stok: 0
        })

      if (error) throw error

      // Audit trail
      if (user) {
        await supabase.from('audit_trail').insert({
          id_user: user.id,
          aksi: `Menambah barang baru ke inventaris: ${newBarangName}`,
          tabel_terkait: 'barang',
          detail: { nama: newBarangName, kategori: newBarangKategori }
        })
      }

      toast.success('Barang baru berhasil ditambahkan!')
      setNewBarangName('')
      setNewBarangKategori('')
      setNewBarangMinStock('10')
      setNewBarangSatuan('sak')
      setShowAddForm(false)
      fetchData()
    } catch (err: any) {
      toast.error('Gagal menambah barang: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  const filteredBarang = barangList.filter(item => 
    item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kategori.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const lowStockItems = barangList.filter(item => item.stok <= item.stok_minimum)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary" /> Manajemen Inventaris Gudang
          </h1>
          <p className="text-slate-500 text-sm mt-1">Kelola stok material konstruksi, barang masuk/keluar, dan monitoring stok kritis.</p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary hover:bg-primary/95 font-bold rounded-xl flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {showAddForm ? 'Batal Tambah' : 'Tambah Barang Baru'}
        </Button>
      </div>

      {/* Form Tambah Barang Baru */}
      {showAddForm && (
        <Card className="border-slate-100 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">Form Tambah Material Baru</CardTitle>
            <CardDescription>Masukkan rincian spesifikasi barang untuk ditambahkan ke daftar inventaris.</CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateBarang}>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Nama Barang</label>
                <Input 
                  placeholder="Semen Tiga Roda" 
                  value={newBarangName}
                  onChange={(e) => setNewBarangName(e.target.value)}
                  className="bg-slate-55/40 border-slate-200 text-slate-800 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Kategori</label>
                <Input 
                  placeholder="Semen / Besi / Kayu" 
                  value={newBarangKategori}
                  onChange={(e) => setNewBarangKategori(e.target.value)}
                  className="bg-slate-55/40 border-slate-200 text-slate-800 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Stok Minimum</label>
                <Input 
                  type="number"
                  placeholder="10" 
                  value={newBarangMinStock}
                  onChange={(e) => setNewBarangMinStock(e.target.value)}
                  className="bg-slate-55/40 border-slate-200 text-slate-800 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Satuan</label>
                <Input 
                  placeholder="sak / m³ / batang" 
                  value={newBarangSatuan}
                  onChange={(e) => setNewBarangSatuan(e.target.value)}
                  className="bg-slate-55/40 border-slate-200 text-slate-800 rounded-xl"
                  required
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end">
              <Button type="submit" disabled={loadingSubmit} className="bg-primary hover:bg-primary/95 font-bold rounded-xl">
                {loadingSubmit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan Barang
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Peringatan Stok Kritis (jika ada) */}
      {lowStockItems.length > 0 && (
        <Alert variant="destructive" className="border-rose-200 bg-rose-50/60 rounded-2xl">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <AlertTitle className="text-rose-800 font-bold">Peringatan: Stok Barang Kritis!</AlertTitle>
          <AlertDescription className="text-rose-700 text-xs mt-1 space-y-1">
            {lowStockItems.map(item => (
              <div key={item.id}>
                • <strong>{item.nama}</strong> saat ini tinggal <span className="font-bold underline">{item.stok} {item.satuan}</span> (Batas minimum: {item.stok_minimum} {item.satuan}).
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Kolom 1 & 2: Tabel Inventaris */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-md font-bold text-slate-800">Daftar Stok Inventaris</CardTitle>
                <CardDescription>Semua barang material konstruksi yang terdaftar di gudang</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Cari material..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white border-slate-200 text-slate-800 text-xs rounded-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingData ? (
                <SkeletonTable rows={5} cols={5} />
              ) : filteredBarang.length === 0 ? (

                <div className="p-12 text-center text-slate-400 text-sm font-semibold">
                  Tidak ada barang ditemukan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-slate-800 text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                        <th className="p-4 text-left">Nama Barang</th>
                        <th className="p-4 text-left">Kategori</th>
                        <th className="p-4 text-right">Stok Saat Ini</th>
                        <th className="p-4 text-right">Batas Min.</th>
                        <th className="p-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredBarang.map((item) => {
                        const isCritical = item.stok <= item.stok_minimum
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 font-medium">
                            <td className="p-4 font-bold text-slate-800">{item.nama}</td>
                            <td className="p-4 text-slate-500">{item.kategori}</td>
                            <td className="p-4 text-right font-extrabold">{item.stok} {item.satuan}</td>
                            <td className="p-4 text-right text-slate-400">{item.stok_minimum} {item.satuan}</td>
                            <td className="p-4 text-center">
                              <span className={`inline-block font-bold text-[10px] uppercase px-2.5 py-1 rounded-full ${
                                isCritical 
                                  ? 'bg-rose-100 text-rose-800' 
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isCritical ? '⚠️ Low Stock' : '✓ Aman'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom 3: Form Transaksi & Riwayat Singkat */}
        <div className="space-y-6">
          {/* Form Transaksi */}
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50">
              <CardTitle className="text-md font-bold text-slate-800">Catat Transaksi Gudang</CardTitle>
              <CardDescription>Pencatatan mutasi barang masuk/keluar dari gudang</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleRecordTransaction} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Pilih Material</label>
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
                  <label className="text-xs font-bold text-slate-500">Tipe Transaksi</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={transType === 'masuk' ? 'default' : 'outline'}
                      onClick={() => setTransType('masuk')}
                      className={`font-bold rounded-xl text-xs flex gap-2 ${
                        transType === 'masuk' ? 'bg-primary hover:bg-primary/95' : 'border-slate-200'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" /> Barang Masuk
                    </Button>
                    <Button
                      type="button"
                      variant={transType === 'keluar' ? 'default' : 'outline'}
                      onClick={() => setTransType('keluar')}
                      className={`font-bold rounded-xl text-xs flex gap-2 ${
                        transType === 'keluar' ? 'bg-primary hover:bg-primary/95' : 'border-slate-200'
                      }`}
                    >
                      <ArrowDownRight className="w-4 h-4" /> Barang Keluar
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Jumlah Mutasi</label>
                  <Input 
                    type="number" 
                    placeholder="Masukkan kuantitas..."
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="bg-white border-slate-200 text-slate-800 text-xs rounded-xl"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loadingSubmit} 
                  className="w-full bg-slate-900 hover:bg-slate-800 font-bold rounded-xl text-xs py-2.5 mt-2"
                >
                  {loadingSubmit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan Transaksi
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Riwayat Transaksi Singkat */}
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50">
              <CardTitle className="text-md font-bold text-slate-800">Mutasi Terakhir</CardTitle>
              <CardDescription>Log 10 transaksi teranyar di gudang</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                {transaksiList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                    Belum ada transaksi tercatat.
                  </div>
                ) : (
                  transaksiList.map((tr) => (
                    <div key={tr.id} className="p-4 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{tr.barang?.nama}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(tr.tanggal).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-full ${
                          tr.tipe === 'masuk' ? 'bg-primary/10 text-primary' : 'bg-rose-50 text-rose-655'
                        }`}>
                          {tr.tipe === 'masuk' ? '+' : '-'} {tr.jumlah} {tr.barang?.satuan}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
