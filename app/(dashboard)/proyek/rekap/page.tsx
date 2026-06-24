'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BarChart3, Loader2, Calendar, FileText, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface ChartData {
  tanggal: string
  laporanCount: number
}

interface ProyekStatus {
  nama: string
  lokasi: string
  mandor: string
  reportedToday: boolean
  totalLaporanMingguIni: number
}

export default function RekapProyekPage() {
  const supabase = createClient()
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [tableData, setTableData] = useState<ProyekStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalLaporan: 0, proyekAktif: 0 })

  const fetchRekapProyek = async () => {
    setLoading(true)
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const startDateStr = sevenDaysAgo.toISOString().split('T')[0]
      const todayStr = new Date().toISOString().split('T')[0]

      // 1. Fetch proyek berjalan dan laporan harian secara paralel
      const [proyekRes, laporanRes] = await Promise.all([
        supabase
          .from('proyek')
          .select(`
            id,
            nama,
            lokasi,
            mandor:id_mandor (nama)
          `)
          .eq('status', 'berjalan'),
        supabase
          .from('laporan_harian')
          .select('*')
          .gte('tanggal', startDateStr)
      ])

      if (proyekRes.error) throw proyekRes.error
      if (laporanRes.error) throw laporanRes.error

      const proyek = proyekRes.data
      const laporan = laporanRes.data

      // Agregasi chart tren laporan harian masuk per hari
      const dailyMap: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
        dailyMap[dateStr] = 0
      }

      // Agregasi laporan mingguan per proyek
      const proyekReportMap: Record<string, { count: number; reportedToday: boolean }> = {}
      proyek?.forEach(p => {
        proyekReportMap[p.id] = { count: 0, reportedToday: false }
      })

      laporan?.forEach((lap: any) => {
        const lapDate = new Date(lap.tanggal)
        const dateStr = lapDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
        const lapDateStr = lap.tanggal

        if (dailyMap[dateStr] !== undefined) {
          dailyMap[dateStr] += 1
        }

        if (proyekReportMap[lap.id_proyek]) {
          proyekReportMap[lap.id_proyek].count += 1
          if (lapDateStr === todayStr) {
            proyekReportMap[lap.id_proyek].reportedToday = true
          }
        }
      })

      // Format Chart Data
      const cData: ChartData[] = Object.entries(dailyMap).map(([key, value]) => ({
        tanggal: key,
        laporanCount: value,
      }))

      // Format Table Data
      const tData: ProyekStatus[] = (proyek as any[] || []).map(p => {
        const reportInfo = proyekReportMap[p.id] || { count: 0, reportedToday: false }
        const mandorName = Array.isArray(p.mandor)
          ? p.mandor[0]?.nama
          : p.mandor?.nama
        return {
          nama: p.nama,
          lokasi: p.lokasi,
          mandor: mandorName || 'Belum ditunjuk',
          reportedToday: reportInfo.reportedToday,
          totalLaporanMingguIni: reportInfo.count
        }
      })

      setChartData(cData)
      setTableData(tData)
      setStats({
        totalLaporan: laporan?.length || 0,
        proyekAktif: proyek?.length || 0
      })

    } catch (err: any) {
      toast.error('Gagal mengambil rekap proyek: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRekapProyek()
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" /> Rekapitulasi Progres Proyek
          </h1>
          <p className="text-slate-500 text-sm mt-1">Ringkasan aktivitas pengiriman laporan harian dari seluruh proyek aktif selama seminggu terakhir.</p>
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
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Laporan Masuk (7 Hari)</p>
                  <h3 className="text-3xl font-extrabold text-primary mt-1">{stats.totalLaporan} <span className="text-xs text-slate-400 font-medium">laporan</span></h3>
                </div>
                <div className="bg-primary/10 p-4 rounded-2xl text-primary">
                  <FileText className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyek Aktif Dipantau</p>
                  <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{stats.proyekAktif} <span className="text-xs text-slate-400 font-medium">proyek</span></h3>
                </div>
                <div className="bg-slate-105 p-4 rounded-2xl text-slate-600">
                  <BarChart3 className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Section */}
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50">
              <CardTitle className="text-md font-bold text-slate-800">Tren Pemasukan Laporan Harian</CardTitle>
              <CardDescription>Grafik kuantitas laporan terkumpul per hari dari seluruh proyek konstruksi</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="tanggal" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                    <Tooltip contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '12px', border: 'none', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#334155' }} />
                    <Line type="monotone" dataKey="laporanCount" name="Laporan Diterima" stroke="#FE7F2D" strokeWidth={3} dot={{ fill: '#FE7F2D', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table Proyek Status Section */}
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50">
              <CardTitle className="text-md font-bold text-slate-800">Status Kelengkapan Laporan Proyek</CardTitle>
              <CardDescription>Kepatuhan mandor dalam melapor per hari ini serta akumulasi mingguan</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {tableData.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm font-semibold">
                  Tidak ada proyek konstruksi aktif berstatus sedang berjalan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-slate-800 text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                        <th className="p-4 text-left">Nama Proyek</th>
                        <th className="p-4 text-left">Lokasi</th>
                        <th className="p-4 text-left">Mandor</th>
                        <th className="p-4 text-center">Laporan Hari Ini</th>
                        <th className="p-4 text-center">Total Laporan (7 Hari)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tableData.map((proyek, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 font-medium">
                          <td className="p-4 font-bold text-slate-805">{proyek.nama}</td>
                          <td className="p-4 text-slate-500">{proyek.lokasi}</td>
                          <td className="p-4 text-slate-650 font-bold">{proyek.mandor}</td>
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center gap-1 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full ${
                              proyek.reportedToday 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-amber-105 text-amber-800'
                            }`}>
                              {proyek.reportedToday ? (
                                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sudah Lapor</>
                              ) : (
                                <><Clock className="w-3.5 h-3.5 text-amber-600" /> Belum Lapor</>
                              )}
                            </span>
                          </td>
                          <td className="p-4 text-center font-extrabold text-slate-700">{proyek.totalLaporanMingguIni} / 7</td>
                        </tr>
                      ))}
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
