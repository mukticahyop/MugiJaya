'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, Shield, Mail, Lock, User, Loader2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { SkeletonTable } from '@/components/ui/skeleton'

interface UserProfile {
  id: string
  nama: string
  email: string
  role: 'manajemen' | 'gudang' | 'mandor' | 'pengemudi' | 'admin'
  dibuat_pada: string
}

export default function AdminPage() {
  const supabase = createClient()
  const [usersList, setUsersList] = useState<UserProfile[]>([])
  
  // State Form Pendaftaran User
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nama, setNama] = useState('')
  const [role, setRole] = useState<'manajemen' | 'gudang' | 'mandor' | 'pengemudi' | 'admin'>('pengemudi')
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const fetchUsers = async () => {
    setLoadingData(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('dibuat_pada', { ascending: false })

      if (error) throw error
      setUsersList(data || [])
    } catch (err: any) {
      toast.error('Gagal memuat daftar pengguna: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !nama || !role) {
      toast.error('Silakan lengkapi formulir pendaftaran pengguna baru!')
      return
    }

    setLoadingSubmit(true)
    try {
      // Memanggil API route handler buatan kita
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, nama, role })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan sistem.')
      }

      toast.success(`Akun baru untuk ${nama} (${email}) berhasil didaftarkan!`)
      setEmail('')
      setPassword('')
      setNama('')
      setRole('pengemudi')
      fetchUsers()
    } catch (err: any) {
      toast.error('Gagal membuat akun: ' + err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" /> Kelola Pengguna & Hak Akses
        </h1>
        <p className="text-slate-500 text-sm mt-1">Daftarkan akun staf baru dan atur otorisasi 5 role di CV. Mugi Jaya.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Pendaftaran User Baru */}
        <div className="lg:col-span-1">
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50">
              <CardTitle className="text-md font-bold text-slate-805 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> Registrasi User Baru
              </CardTitle>
              <CardDescription>Buat akun login staf baru CV. Mugi Jaya</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <User className="w-4 h-4 text-slate-400" /> Nama Lengkap
                  </label>
                  <Input 
                    placeholder="Budi Santoso"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="bg-white border-slate-200 text-slate-805 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Mail className="w-4 h-4 text-slate-400" /> Alamat Email
                  </label>
                  <Input 
                    type="email"
                    placeholder="budi@mugijaya.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white border-slate-200 text-slate-850 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Lock className="w-4 h-4 text-slate-400" /> Password Sandi
                  </label>
                  <Input 
                    type="password"
                    placeholder="Minimal 6 karakter..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-slate-200 text-slate-850 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Shield className="w-4 h-4 text-slate-400" /> Otorisasi Hak Akses (Role)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full text-xs font-semibold p-3 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                    required
                  >
                    <option value="pengemudi">Pengemudi / Driver</option>
                    <option value="mandor">Mandor Lapangan</option>
                    <option value="gudang">Admin Gudang</option>
                    <option value="manajemen">Manajemen / Pimpinan</option>
                    <option value="admin">Admin Sistem</option>
                  </select>
                </div>

                <Button 
                  type="submit" 
                  disabled={loadingSubmit} 
                  className="w-full bg-primary hover:bg-primary/95 font-bold rounded-xl text-xs py-2.5 mt-2"
                >
                  {loadingSubmit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Daftarkan Akun
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Tabel Daftar User */}
        <div className="lg:col-span-2">
          <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-50">
              <CardTitle className="text-md font-bold text-slate-800">Daftar Akun Pengguna</CardTitle>
              <CardDescription>Akun pengguna terdaftar dalam sistem CV. Mugi Jaya</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingData ? (
                <div className="p-4">
                  <SkeletonTable rows={5} cols={4} />
                </div>
              ) : usersList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm font-semibold">
                  Belum ada user terdaftar.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-slate-800 text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                        <th className="p-4 text-left">Nama</th>
                        <th className="p-4 text-left">Email</th>
                        <th className="p-4 text-center">Hak Akses (Role)</th>
                        <th className="p-4 text-center">Tanggal Dibuat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {usersList.map((usr) => (
                        <tr key={usr.id} className="hover:bg-slate-50/50 font-medium">
                          <td className="p-4 font-bold text-slate-800">{usr.nama}</td>
                          <td className="p-4 text-slate-500">{usr.email}</td>
                          <td className="p-4 text-center">
                            <span className={`inline-block font-bold text-[9px] uppercase px-2.5 py-1 rounded-full ${
                              usr.role === 'admin' ? 'bg-rose-100 text-rose-800' :
                              usr.role === 'manajemen' ? 'bg-amber-100 text-amber-800' :
                              usr.role === 'gudang' ? 'bg-primary/10 text-primary' : 
                              usr.role === 'mandor' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-655'
                            }`}>
                              {usr.role}
                            </span>
                          </td>
                          <td className="p-4 text-center text-slate-400 font-semibold">
                            <span className="flex items-center justify-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(usr.dibuat_pada).toLocaleDateString('id-ID', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </span>
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

      </div>
    </div>
  )
}
