'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Truck, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Email dan password wajib diisi!')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      toast.success('Login berhasil! Mengalihkan ke dashboard...')
      router.refresh()
      router.push('/')
    } catch (err: any) {
      toast.error(err.message || 'Gagal login, periksa kembali email & password Anda.')
    } finally {
      setLoading(false)
    }
  }

  // Helper login demo agar penguji mudah mengetes 5 role
  const loginAsDemo = async (roleEmail: string) => {
    setLoading(true)
    setEmail(roleEmail)
    setPassword('password123') // default password demo

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: roleEmail,
        password: 'password123',
      })

      if (error) throw error

      toast.success(`Berhasil masuk sebagai demo ${roleEmail.split('@')[0]}!`)
      router.refresh()
      router.push('/')
    } catch (err: any) {
      toast.error(`Kredensial demo belum disetup di Supabase Auth. Silakan gunakan login manual atau daftarkan user terlebih dahulu di database.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-tr from-slate-950 via-[#233D4D] to-[#111E26] overflow-hidden font-sans p-4">
      {/* Decorative Structural Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FE7F2D]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#233D4D]/30 rounded-full blur-3xl" />

      <Card className="w-full max-w-[410px] bg-white border-slate-100 text-slate-800 shadow-2xl relative z-10 rounded-3xl overflow-hidden">
        <CardHeader className="space-y-2 text-center pt-7 pb-4">
          <div className="mx-auto bg-primary w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-xl font-extrabold tracking-tight text-slate-800 mt-2">
            CV. Mugi Jaya
          </CardTitle>
          <CardDescription className="text-slate-500 font-bold text-xs">
            Sistem Informasi Logistik & Konstruksi Terintegrasi
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 py-2 px-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-450 flex items-center gap-1.5 uppercase tracking-wide">
                <Mail className="w-3.5 h-3.5 text-primary" /> Email
              </label>
              <Input
                type="email"
                placeholder="nama@mugijaya.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="bg-slate-50/75 border-slate-200 text-slate-900 placeholder-slate-400 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-white rounded-xl h-10 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-450 flex items-center gap-1.5 uppercase tracking-wide">
                <Lock className="w-3.5 h-3.5 text-primary" /> Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="bg-slate-50/75 border-slate-200 text-slate-900 placeholder-slate-400 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-white rounded-xl h-10 text-xs"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-primary/10 transition-all hover:translate-y-[-1px] active:translate-y-[1px] mt-2 text-xs"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Login <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </CardContent>
        </form>

        <CardFooter className="flex flex-col space-y-3 pb-7 pt-4 px-6">
          <div className="w-full text-center border-t border-slate-100 pt-4 mb-1">
            <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">
              Akses Demo Cepat (Quick Login)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => loginAsDemo('manajemen@mugijaya.com')}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-primary hover:border-primary/30 text-[11px] font-bold rounded-xl py-1.5 shadow-sm h-8"
            >
              Manajemen
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => loginAsDemo('gudang@mugijaya.com')}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-primary hover:border-primary/30 text-[11px] font-bold rounded-xl py-1.5 shadow-sm h-8"
            >
              Admin Gudang
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => loginAsDemo('mandor@mugijaya.com')}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-primary hover:border-primary/30 text-[11px] font-bold rounded-xl py-1.5 shadow-sm h-8"
            >
              Mandor Lapangan
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => loginAsDemo('driver@mugijaya.com')}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-primary hover:border-primary/30 text-[11px] font-bold rounded-xl py-1.5 shadow-sm h-8"
            >
              Pengemudi
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => loginAsDemo('admin@mugijaya.com')}
            className="w-full text-primary hover:text-primary/90 hover:bg-primary/10 text-xs font-bold rounded-xl h-8 mt-1"
          >
            Masuk sebagai Administrator
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
