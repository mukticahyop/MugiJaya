import React from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QRCodeWrapper from '@/components/shared/qr-code'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, MapPin, Calendar, User, ArrowLeft, Printer, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SuratJalanDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch detail pengiriman
  const { data: del, error } = await supabase
    .from('pengiriman')
    .select(`
      *,
      truk:id_truk (plat_nomor, kapasitas),
      pengemudi:id_pengemudi (nama)
    `)
    .eq('id', id)
    .single()

  if (error || !del) {
    notFound()
  }

  // Definisikan verification URL untuk QR Code
  // Di production, URL ini akan mengarah ke domain hosting (misal Vercel)
  const verificationUrl = `https://mugi-jaya.vercel.app/pengiriman/surat-jalan/${del.id}`

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Action buttons */}
      <div className="flex justify-between items-center no-print">
        <Button variant="ghost" render={<Link href="/pengiriman" />} className="rounded-xl border-slate-200 text-xs font-bold text-slate-600 gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Button>
        <Button 
          onClick={() => typeof window !== 'undefined' && window.print()}
          className="bg-primary hover:bg-primary/95 font-bold rounded-xl text-xs gap-1.5"
        >
          <Printer className="w-4 h-4" /> Cetak Surat Jalan
        </Button>
      </div>

      {/* Surat Jalan Document Sheet */}
      <Card className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-md print:shadow-none print:border-none">
        <CardContent className="p-8 md:p-12 space-y-8">
          
          {/* Header Surat Jalan */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-slate-100 pb-8">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 w-12 h-12 rounded-2xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-805">CV. MUGI JAYA</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Logistik & Konstruksi Terintegrasi</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <h1 className="text-lg font-black text-primary tracking-wider">SURAT JALAN DIGITAL</h1>
              <p className="text-xs text-slate-450 font-bold mt-1">ID: {del.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>

          {/* Rincian Identitas Pengiriman */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs border-b border-slate-105/50 pb-8">
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Spesifikasi Armada</span>
              <div className="space-y-2">
                <p className="text-slate-700 flex items-center gap-2 font-medium">
                  <Truck className="w-4 h-4 text-slate-450 shrink-0" />
                  <span>Plat Nomor Truk:</span> <strong className="text-slate-850">{del.truk?.plat_nomor || '-'}</strong>
                </p>
                <p className="text-slate-700 flex items-center gap-2 font-medium">
                  <User className="w-4 h-4 text-slate-450 shrink-0" />
                  <span>Nama Pengemudi:</span> <strong className="text-slate-850">{del.pengemudi?.nama || '-'}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Informasi Waktu</span>
              <div className="space-y-2">
                <p className="text-slate-700 flex items-center gap-2 font-medium">
                  <Calendar className="w-4 h-4 text-slate-450 shrink-0" />
                  <span>Tanggal Tugas:</span> <strong className="text-slate-850">
                    {new Date(del.dibuat_pada).toLocaleDateString('id-ID', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          {/* Lokasi Asal & Tujuan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs border-b border-slate-105/50 pb-8">
            <div className="space-y-2 p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Lokasi Keberangkatan (Asal)
              </span>
              <p className="font-bold text-slate-800 text-sm pl-5">{del.asal}</p>
              {del.check_in_berangkat && (
                <span className="block text-[10px] text-slate-450 pl-5 mt-1">
                  ⏱️ Waktu berangkat: {new Date(del.check_in_berangkat).toLocaleString('id-ID')}
                </span>
              )}
            </div>

            <div className="space-y-2 p-4 bg-emerald-50/20 rounded-2xl border border-emerald-50/40">
              <span className="text-[10px] font-bold text-emerald-650 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Lokasi Kedatangan (Tujuan)
              </span>
              <p className="font-bold text-slate-800 text-sm pl-5">{del.tujuan}</p>
              {del.check_in_tiba && (
                <span className="block text-[10px] text-slate-450 pl-5 mt-1">
                  ⏱️ Waktu tiba: {new Date(del.check_in_tiba).toLocaleString('id-ID')}
                </span>
              )}
            </div>
          </div>

          {/* Section Validitas & QR Code */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 pt-4">
            <div className="space-y-3 max-w-sm text-center sm:text-left">
              <h3 className="font-bold text-slate-800 text-sm">Verifikasi Status Keamanan</h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Scan kode QR di samping untuk memverifikasi keabsahan dokumen surat jalan logistik secara digital langsung dari server data CV. Mugi Jaya.
              </p>
              {del.status === 'tiba' && (
                <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Pengiriman Telah Tiba & Dikonfirmasi
                </div>
              )}
            </div>

            <div className="shrink-0">
              <QRCodeWrapper value={verificationUrl} size={110} />
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
