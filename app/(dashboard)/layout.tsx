import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/shared/sidebar'
import Topbar from '@/components/shared/topbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Ambil user auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Ambil user profile dari public.users
  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    // Jika auth ada tapi profil belum disinkronkan, paksa signout atau tampilkan fallback default
    // Untuk safety, berikan default profile dummy jika belum sinkron penuh agar tidak crash
    const fallbackProfile = {
      id: user.id,
      nama: user.user_metadata?.nama || user.email?.split('@')[0] || 'User',
      role: (user.user_metadata?.role as any) || 'pengemudi',
      email: user.email || '',
    }
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
        <Sidebar role={fallbackProfile.role} nama={fallbackProfile.nama} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar
            userId={fallbackProfile.id}
            nama={fallbackProfile.nama}
            role={fallbackProfile.role}
          />
          <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar role={profile.role} nama={profile.nama} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar userId={profile.id} nama={profile.nama} role={profile.role} />
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
