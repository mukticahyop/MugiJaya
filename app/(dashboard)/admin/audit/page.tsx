'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Activity, Search, Calendar, FileDown, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { SkeletonTable } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface AuditLog {
  id: string
  id_user: string
  aksi: string
  tabel_terkait: string
  detail: any
  waktu: string
  user?: {
    nama: string
    email: string
  }
}

export default function AuditTrailPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDate, setFilterDate] = useState('')
  
  // State Dialog detail
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const fetchAuditLogs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('audit_trail')
        .select(`
          *,
          user:id_user (nama, email)
        `)
        .order('waktu', { ascending: false })

      if (error) throw error
      setLogs(data as any[] || [])
    } catch (err: any) {
      toast.error('Gagal mengambil audit trail: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  // Fungsi Simulator Ekspor CSV Nyata
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('Tidak ada data audit log untuk diekspor.')
      return
    }

    try {
      // 1. Buat header
      const headers = ['Waktu', 'Pengguna', 'Email', 'Aksi', 'Tabel Terkait', 'Detail']
      const rows = logs.map(log => [
        new Date(log.waktu).toLocaleString('id-ID'),
        log.user?.nama || 'System / Auto',
        log.user?.email || '-',
        log.aksi,
        log.tabel_terkait,
        JSON.stringify(log.detail)
      ])

      // 2. Gabung ke format CSV string
      const csvContent = [
        headers.join(','),
        ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      // 3. Trigger download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `Audit_Trail_Mugi_Jaya_${Date.now()}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Audit trail berhasil diekspor ke file CSV!')
    } catch (err: any) {
      toast.error('Gagal melakukan ekspor: ' + err.message)
    }
  }

  const filteredLogs = logs.filter(log => {
    const userName = log.user?.nama || 'System'
    const userEmail = log.user?.email || ''
    const matchSearch = 
      log.aksi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tabel_terkait.toLowerCase().includes(searchQuery.toLowerCase())

    const matchDate = filterDate ? log.waktu.startsWith(filterDate) : true

    return matchSearch && matchDate
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary" /> Audit Trail & Logs Sistem
          </h1>
          <p className="text-slate-500 text-sm mt-1">Lacak rekam jejak aktivitas penting, audit manipulasi data, dan logs keamanan.</p>
        </div>
        <Button 
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl flex items-center gap-2 text-xs"
        >
          <FileDown className="w-4 h-4" /> Ekspor Log CSV
        </Button>
      </div>

      {/* Filter panel */}
      <Card className="border-slate-100 shadow-sm rounded-2xl">
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Cari aksi / user..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200 text-slate-805 text-xs rounded-xl"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200 text-slate-805 text-xs rounded-xl"
            />
          </div>

          <Button 
            variant="outline" 
            onClick={() => { setSearchQuery(''); setFilterDate('') }}
            className="border-slate-200 text-slate-655 font-bold rounded-xl text-xs"
          >
            Reset Filter
          </Button>
        </CardContent>
      </Card>

      {/* Table Audit Logs */}
      <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-50">
          <CardTitle className="text-md font-bold text-slate-800">Log Aktivitas Keamanan</CardTitle>
          <CardDescription>Daftar aksi penulisan data dan perubahan status yang terekam</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <SkeletonTable rows={8} cols={5} />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm font-semibold">
              Tidak ada data log audit trail ditemukan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-slate-800 text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="p-4 text-left">Waktu</th>
                    <th className="p-4 text-left">Pengguna</th>
                    <th className="p-4 text-left">Aksi Kegiatan</th>
                    <th className="p-4 text-left">Modul</th>
                    <th className="p-4 text-center">Detail JSON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 font-medium">
                      <td className="p-4 text-slate-400 font-semibold">
                        {new Date(log.waktu).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{log.user?.nama || 'System (Trigger)'}</span>
                          <span className="text-[10px] text-slate-400">{log.user?.email || '-'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-700 font-semibold">{log.aksi}</td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-655 text-[9px] font-bold uppercase px-2.5 py-1 rounded-full">
                          {log.tabel_terkait}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <Dialog>
                          <DialogTrigger
                            render={
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setSelectedLog(log)}
                                className="w-8 h-8 rounded-full text-slate-500 hover:text-primary hover:bg-primary/10"
                              />
                            }
                          >
                            <Info className="w-4 h-4" />
                          </DialogTrigger>
                          {selectedLog && (
                            <DialogContent className="max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl text-slate-800">
                              <DialogHeader>
                                <DialogTitle className="text-slate-805 font-bold text-md">Detail Log Metadata</DialogTitle>
                                <DialogDescription className="text-slate-400 text-xs">
                                  ID Log: {selectedLog.id}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 pt-2 text-xs">
                                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <p className="font-bold text-slate-500">Aksi Kegiatan:</p>
                                  <p className="font-semibold text-slate-805 text-sm">{selectedLog.aksi}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-500">Payload Detail JSON:</p>
                                  <pre className="bg-slate-900 text-emerald-450 p-4 rounded-xl font-mono text-[10px] overflow-x-auto max-h-48 border border-slate-800">
                                    {JSON.stringify(selectedLog.detail, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </DialogContent>
                          )}
                        </Dialog>
                      </td>
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
