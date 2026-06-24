import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Warehouse, 
  Truck, 
  FolderGit, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Calendar,
  ChevronRight,
  ClipboardList,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Ambil session user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 2. Ambil profile user
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'pengemudi'
  const nama = profile?.nama || 'User'

  // 3. Fetch data agregat untuk dashboard statistik umum secara paralel
  const today = new Date().toISOString().split('T')[0]

  const [
    lowStockRes,
    totalTrukRes,
    beroperasiTrukRes,
    totalProyekRes,
    activeDeliveriesRes,
    pendingRequestsRes,
    laporanHariIniRes
  ] = await Promise.all([
    supabase.from('barang').select('*').filter('stok', 'lte', 'stok_minimum'),
    supabase.from('truk').select('*', { count: 'exact', head: true }),
    supabase.from('truk').select('*', { count: 'exact', head: true }).eq('status', 'beroperasi'),
    supabase.from('proyek').select('*', { count: 'exact', head: true }),
    supabase.from('pengiriman').select('*, id_truk(plat_nomor), id_pengemudi(nama)').in('status', ['jadwal', 'berangkat']).order('dibuat_pada', { ascending: false }).limit(5),
    supabase.from('permintaan_material').select('*, id_proyek(nama), id_barang(nama)').eq('status', 'diajukan').order('tanggal', { ascending: false }).limit(5),
    supabase.from('laporan_harian').select('id_proyek').eq('tanggal', today)
  ])

  const lowStockItems = lowStockRes.data
  const totalTruk = totalTrukRes.count
  const beroperasiTruk = beroperasiTrukRes.count
  const totalProyek = totalProyekRes.count
  const activeDeliveries = activeDeliveriesRes.data
  const pendingRequests = pendingRequestsRes.data
  const laporanHariIni = laporanHariIniRes.data

  const reportedProjectIds = laporanHariIni?.map(l => l.id_proyek) || []
  
  let queryProyekBelumLapor = supabase
    .from('proyek')
    .select('*, id_mandor(nama)')
    .eq('status', 'berjalan')
  
  if (reportedProjectIds.length > 0) {
    queryProyekBelumLapor = queryProyekBelumLapor.not('id', 'in', `(${reportedProjectIds.join(',')})`)
  }
  const { data: proyekBelumLapor } = await queryProyekBelumLapor


  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#233D4D] p-6 md:p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-primary/10 blur-3xl rounded-full" />
        <div className="relative z-10 space-y-2">
          <span className="bg-primary/20 text-primary font-semibold px-3 py-1 rounded-full text-xs uppercase tracking-wider">
            Sistem Terintegrasi
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Selamat Datang, {nama}!</h1>
          <p className="text-slate-300 text-sm md:text-base font-medium">
            Anda masuk sebagai <strong className="text-primary uppercase">{role}</strong>. Berikut adalah ringkasan operasional CV. Mugi Jaya hari ini.
          </p>
        </div>
      </div>

      {/* 1. DASHBOARD MANAJEMEN */}
      {role === 'manajemen' && (
        <div className="space-y-8">
          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-slate-100 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyek Konstruksi</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">{totalProyek || 0}</h3>
                </div>
                <div className="bg-primary/10 p-3.5 rounded-2xl text-primary">
                  <FolderGit className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Armada Logistik</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">
                    {beroperasiTruk || 0} <span className="text-slate-400 text-sm font-medium">/ {totalTruk || 0}</span>
                  </h3>
                </div>
                <div className="bg-emerald-50 p-3.5 rounded-2xl text-emerald-600">
                  <Truck className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stok Kritis Gudang</p>
                  <h3 className="text-3xl font-bold text-rose-600 mt-1">{lowStockItems?.length || 0}</h3>
                </div>
                <div className="bg-rose-50 p-3.5 rounded-2xl text-rose-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyek Belum Lapor</p>
                  <h3 className="text-3xl font-bold text-amber-600 mt-1">{proyekBelumLapor?.length || 0}</h3>
                </div>
                <div className="bg-amber-50 p-3.5 rounded-2xl text-amber-600">
                  <Clock className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Widget Proyek Belum Lapor */}
            <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardHeader className="bg-slate-50/50 border-b border-slate-50">
                <CardTitle className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" /> Proyek Belum Melapor Hari Ini
                </CardTitle>
                <CardDescription>Daftar proyek aktif yang belum mengirim laporan harian</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {proyekBelumLapor && proyekBelumLapor.length > 0 ? (
                    proyekBelumLapor.map(proyek => (
                      <div key={proyek.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{proyek.nama}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Lokasi: {proyek.lokasi} | Mandor: {proyek.id_mandor?.nama || 'Belum ditunjuk'}</p>
                        </div>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                          Belum Lapor
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm font-semibold">
                      🎉 Semua mandor proyek sudah mengirimkan laporan hari ini!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Widget Pengiriman Aktif */}
            <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardHeader className="bg-slate-50/50 border-b border-slate-50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" /> Pengiriman Truk Aktif
                  </CardTitle>
                  <CardDescription>Daftar surat jalan yang sedang dalam perjalanan</CardDescription>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/pengiriman" />} className="text-primary hover:text-primary/90 font-bold gap-1">
                  Semua <ChevronRight className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {activeDeliveries && activeDeliveries.length > 0 ? (
                    activeDeliveries.map(del => (
                      <div key={del.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Rute: {del.asal} → {del.tujuan}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Truk: {del.id_truk?.plat_nomor || '-'} | Pengemudi: {del.id_pengemudi?.nama || '-'}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                          del.status === 'berangkat' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-655'
                        }`}>
                          {del.status === 'berangkat' ? 'Dalam Perjalanan' : 'Terjadwal'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm font-semibold">
                      Tidak ada pengiriman truk aktif saat ini.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 2. DASHBOARD ADMIN GUDANG */}
      {role === 'gudang' && (
        <div className="space-y-8">
          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="border-slate-100 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Item Stok Kritis</p>
                  <h3 className="text-3xl font-bold text-rose-600 mt-1">{lowStockItems?.length || 0}</h3>
                </div>
                <div className="bg-rose-50 p-3.5 rounded-2xl text-rose-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Permintaan Material Pending</p>
                  <h3 className="text-3xl font-bold text-primary mt-1">{pendingRequests?.length || 0}</h3>
                </div>
                <div className="bg-primary/10 p-3.5 rounded-2xl text-primary">
                  <ClipboardList className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Armada Logistik</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">{totalTruk || 0}</h3>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl text-slate-600">
                  <Truck className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Widget Stok Kritis Detail */}
            <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardHeader className="bg-slate-50/50 border-b border-slate-50">
                <CardTitle className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" /> Peringatan Stok Kritis
                </CardTitle>
                <CardDescription>Segera lakukan restock untuk barang dengan jumlah di bawah minimum</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {lowStockItems && lowStockItems.length > 0 ? (
                    lowStockItems.map(item => (
                      <div key={item.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{item.nama}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Kategori: {item.kategori}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-rose-600">{item.stok} {item.satuan}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Min: {item.stok_minimum} {item.satuan}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm font-semibold">
                      ✅ Seluruh stok barang aman.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Widget Permintaan Material Pending */}
            <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
              <CardHeader className="bg-slate-50/50 border-b border-slate-50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" /> Permintaan Material Terbaru
                  </CardTitle>
                  <CardDescription>Ajuan material yang membutuhkan konfirmasi pengeluaran</CardDescription>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/proyek/permintaan" />} className="text-primary hover:text-primary/90 font-bold gap-1">
                  Semua <ChevronRight className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {pendingRequests && pendingRequests.length > 0 ? (
                    pendingRequests.map(req => (
                      <div key={req.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Material: {req.id_barang?.nama}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Jumlah: {req.jumlah} | Proyek: {req.id_proyek?.nama}</p>
                        </div>
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                          Diajukan
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm font-semibold">
                      Tidak ada pengajuan material baru saat ini.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. DASHBOARD MANDOR LAPANGAN */}
      {role === 'mandor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col justify-between hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
            <div className="space-y-4">
              <div className="bg-primary/10 text-primary w-12 h-12 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Laporan Progres Proyek</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Kirimkan laporan progres fisik harian untuk proyek konstruksi yang Anda tangani hari ini. Ingat, laporan dikirim maksimal satu kali setiap hari untuk satu proyek.
              </p>
            </div>
            <Button className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold w-full rounded-xl" render={<Link href="/laporan" />}>
              Buat Laporan Hari Ini
            </Button>
          </Card>

          <Card className="border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col justify-between hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
            <div className="space-y-4">
              <div className="bg-emerald-50 text-emerald-650 w-12 h-12 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Permintaan Material</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Stok material di lapangan menipis? Ajukan permintaan material ke Admin Gudang untuk disiapkan dan dikirim menggunakan armada logistik CV. Mugi Jaya.
              </p>
            </div>
            <Button className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold w-full rounded-xl" render={<Link href="/proyek/permintaan" />}>
              Ajukan Permintaan Material
            </Button>
          </Card>
        </div>
      )}

      {/* 4. DASHBOARD PENGEMUDI */}
      {role === 'pengemudi' && (
        <div className="space-y-8">
          <Card className="border-slate-100 shadow-sm rounded-2xl p-6 bg-gradient-to-tr from-slate-900 to-[#233D4D] text-white">
            <div className="space-y-4">
              <div className="bg-primary/20 text-primary w-12 h-12 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Menu Pengemudi Logistik</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Lihat jadwal pengiriman yang ditugaskan kepada Anda hari ini. Lakukan check-in keberangkatan saat berangkat dari gudang dan check-in kedatangan saat tiba di lokasi proyek beserta unggahan bukti kondisi barang.
              </p>
              <Button className="bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl" render={<Link href="/pengiriman" />}>
                Mulai Check-In Pengiriman
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 5. DASHBOARD ADMIN SISTEM */}
      {role === 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <Card className="border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col justify-between hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
            <div className="space-y-3">
              <div className="bg-primary/10 text-primary w-10 h-10 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800">Manajemen Pengguna</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kelola kredensial akun, pendaftaran user baru, dan otorisasi dari 5 role pengguna CV. Mugi Jaya.
              </p>
            </div>
            <Button className="mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold w-full rounded-xl" render={<Link href="/admin" />}>
              Kelola User
            </Button>
          </Card>

          <Card className="border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col justify-between hover:shadow-md hover:border-slate-200/50 transition-all duration-300">
            <div className="space-y-3">
              <div className="bg-slate-50 text-slate-655 w-10 h-10 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800">Audit Trail</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pantau log audit keamanan, melacak aktivitas dan transaksi penting untuk mencegah anomali.
              </p>
            </div>
            <Button className="mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold w-full rounded-xl" render={<Link href="/admin/audit" />}>
              Lihat Audit Trail
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
