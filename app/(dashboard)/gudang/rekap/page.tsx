'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { BarChart3, Loader2, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react'
import { toast } from 'sonner'

interface ChartData {
  tanggal: string
  masuk: number
  keluar: number
}

interface ItemRekap {
  nama: string
  masuk: number
  keluar: number
  satuan: string
}

export default function RekapGudangPage() {
  const supabase = createClient()
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [tableData, setTableData] = useState<ItemRekap[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalMasuk: 0, totalKeluar: 0 })

  const fetchRekapData = async () => {
    setLoading(true)
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const startDateStr = sevenDaysAgo.toISOString().split('T')[0]

      // Fetch transaksi 7 hari terakhir
      const { data: trans, error } = await supabase
        .from('transaksi_gudang')
        .select(`
          *,
          barang:id_barang (nama, satuan)
        `)
        .gte('tanggal', startDateStr)

      if (error) throw error

      // Agregasi chart per hari
      const dailyMap: Record<string, { masuk: number; keluar: number }> = {}
      // Inisialisasi 7 hari terakhir
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
        dailyMap[dateStr] = { masuk: 0, keluar: 0 }
      }

      // Agregasi tabel per barang
      const itemMap: Record<string, { masuk: number; keluar: number; satuan: string }> = {}

      let sumMasuk = 0
      let sumKeluar = 0

      trans?.forEach((t: any) => {
        const tDate = new Date(t.tanggal)
        const dateStr = tDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
        
        const qty = t.jumlah

        // Agregasi chart (hanya jika masuk dalam 7 hari yang diinisialisasi)
        if (dailyMap[dateStr]) {
          if (t.tipe === 'masuk') {
            dailyMap[dateStr].masuk += qty
          } else {
            dailyMap[dateStr].keluar += qty
          }
        }

        // Agregasi total statistics
        if (t.tipe === 'masuk') {
          sumMasuk += qty
        } else {
          sumKeluar += qty
        }

        // Agregasi table
        const bName = t.barang?.nama || 'Material Tak Dikenal'
        const bUnit = t.barang?.satuan || 'unit'
        if (!itemMap[bName]) {
          itemMap[bName] = { masuk: 0, keluar: 0, satuan: bUnit }
        }
        if (t.tipe === 'masuk') {
          itemMap[bName].masuk += qty
        } else {
          itemMap[bName].keluar += qty
        }
      })

      // Format Chart Data
      const cData: ChartData[] = Object.entries(dailyMap).map(([key, value]) => ({
        tanggal: key,
        masuk: value.masuk,
        keluar: value.keluar,
      }))

      // Format Table Data
      const tData: ItemRekap[] = Object.entries(itemMap).map(([key, value]) => ({
        nama: key,
        masuk: value.masuk,
        keluar: value.keluar,
        satuan: value.satuan,
      }))

      setChartData(cData)
      setTableData(tData)
      setStats({ totalMasuk: sumMasuk, totalKeluar: sumKeluar })
    } catch (err: any) {
      toast.error('Gagal memuat rekap mingguan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRekapData()
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" /> Rekapitulasi Mingguan Gudang
          </h1>
          <p className="text-slate-500 text-sm mt-1">Ringkasan agregat perputaran barang masuk dan keluar selama 7 hari terakhir.</p>
        </div>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-655 shadow-sm">
          <Calendar className="w-4 h-4 text-primary" /> 7 Hari Terakhir
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {/* Summary Stats Skeleton Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="border border-slate-100 shadow-sm rounded-2xl bg-white p-6 flex items-center justify-between animate-pulse">
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-slate-200 rounded w-1/2" />
                <div className="h-8 bg-slate-200 rounded w-1/3" />
              </div>
              <div className="w-14 h-14 bg-slate-200 rounded-2xl shrink-0" />
            </div>
            <div className="border border-slate-100 shadow-sm rounded-2xl bg-white p-6 flex items-center justify-between animate-pulse">
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-slate-200 rounded w-1/2" />
                <div className="h-8 bg-slate-200 rounded w-1/3" />
              </div>
              <div className="w-14 h-14 bg-slate-200 rounded-2xl shrink-0" />
            </div>
          </div>

          {/* Chart Skeleton */}
          <div className="border border-slate-100 shadow-sm rounded-2xl bg-white p-6 animate-pulse">
            <div className="space-y-2 mb-6">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-3 bg-slate-200 rounded w-1/3" />
            </div>
            <div className="h-80 bg-slate-100 rounded-xl" />
          </div>

          {/* Table Skeleton */}
          <div className="border border-slate-100 shadow-sm rounded-2xl bg-white p-6 animate-pulse">
            <div className="space-y-2 mb-6">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-3 bg-slate-200 rounded w-1/3" />
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-full" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Barang Masuk (7 Hari)</p>
                  <h3 className="text-3xl font-extrabold text-primary mt-1">{stats.totalMasuk} <span className="text-xs text-slate-400 font-medium">unit</span></h3>
                </div>
                <div className="bg-primary/10 p-4 rounded-2xl text-primary">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Barang Keluar (7 Hari)</p>
                  <h3 className="text-3xl font-extrabold text-rose-600 mt-1">{stats.totalKeluar} <span className="text-xs text-slate-400 font-medium">unit</span></h3>
                </div>
                <div className="bg-rose-50 p-4 rounded-2xl text-rose-600">
                  <ArrowDownRight className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Section */}
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50">
              <CardTitle className="text-md font-bold text-slate-800">Tren Arus Barang Masuk & Keluar</CardTitle>
              <CardDescription>Grafik kuantitas mutasi harian gudang</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="tanggal" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                    <Tooltip contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '12px', border: 'none', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#334155' }} />
                    <Bar dataKey="masuk" name="Barang Masuk" fill="#FE7F2D" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="keluar" name="Barang Keluar" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table Breakdown Section */}
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50">
              <CardTitle className="text-md font-bold text-slate-800">Rincian Perputaran per Barang</CardTitle>
              <CardDescription>Akumulasi total barang masuk dan keluar per jenis material</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {tableData.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm font-semibold">
                  Tidak ada data mutasi material dalam seminggu terakhir.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-slate-800 text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                        <th className="p-4 text-left">Nama Material</th>
                        <th className="p-4 text-right">Total Masuk</th>
                        <th className="p-4 text-right">Total Keluar</th>
                        <th className="p-4 text-center">Rasio Masuk/Keluar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tableData.map((item, idx) => {
                        const total = item.masuk + item.keluar
                        const ratioMasuk = total > 0 ? Math.round((item.masuk / total) * 100) : 0
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 font-medium">
                            <td className="p-4 font-bold text-slate-800">{item.nama}</td>
                            <td className="p-4 text-right font-extrabold text-primary">+{item.masuk} {item.satuan}</td>
                            <td className="p-4 text-right font-extrabold text-rose-600">-{item.keluar} {item.satuan}</td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden flex">
                                  <div className="bg-primary h-full" style={{ width: `${ratioMasuk}%` }} />
                                  <div className="bg-rose-500 h-full" style={{ width: `${100 - ratioMasuk}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-550 font-semibold">{ratioMasuk}% M / {100 - ratioMasuk}% K</span>
                              </div>
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
        </>
      )}
    </div>
  )
}
