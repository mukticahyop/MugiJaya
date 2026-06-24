'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, LogOut, User, Check, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface TopbarProps {
  userId: string
  nama: string
  role: string
}

interface Notifikasi {
  id: string
  tipe: string
  pesan: string
  dibaca: boolean
  waktu: string
}

export default function Topbar({ userId, nama, role }: TopbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [notifList, setNotifList] = useState<Notifikasi[]>([])
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch Notifikasi
  const fetchNotifikasi = async () => {
    try {
      const { data, error } = await supabase
        .from('notifikasi')
        .select('*')
        .eq('id_user_penerima', userId)
        .order('waktu', { ascending: false })
        .limit(10)

      if (error) throw error
      setNotifList(data || [])
    } catch (err: any) {
      console.error('Error fetching notifications:', err.message)
    }
  }

  // Realtime subscription & Polling fallback
  useEffect(() => {
    fetchNotifikasi()

    // 1. Setup Supabase Realtime subscription
    const channel = supabase
      .channel(`notif_user_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifikasi',
          filter: `id_user_penerima=eq.${userId}`
        },
        (payload) => {
          setNotifList((prev) => [payload.new as Notifikasi, ...prev].slice(0, 10))
          toast.info((payload.new as Notifikasi).pesan)
        }
      )
      .subscribe()

    // 2. Polling fallback setiap 5 menit
    const interval = setInterval(fetchNotifikasi, 5 * 60 * 1000)

    // Close dropdown on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userId])

  // Mark all or single as read
  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifikasi')
        .update({ dibaca: true })
        .eq('id', id)

      if (error) throw error

      setNotifList((prev) =>
        prev.map((notif) => (notif.id === id ? { ...notif, dibaca: true } : notif))
      )
      toast.success('Notifikasi ditandai telah dibaca')
    } catch (err: any) {
      toast.error('Gagal memperbarui notifikasi: ' + err.message)
    }
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast.success('Berhasil keluar.')
      router.refresh()
      router.push('/login')
    } catch (err: any) {
      toast.error('Gagal keluar: ' + err.message)
    }
  }

  const unreadCount = notifList.filter((n) => !n.dibaca).length

  return (
    <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between px-8 shrink-0 relative z-20 shadow-sm shadow-slate-100/30">
      {/* Search / Section Info */}
      <div className="flex items-center gap-4">
        <span className="text-slate-400 font-medium hidden md:inline text-sm">
          Selamat datang kembali di Panel CV. Mugi Jaya
        </span>
      </div>

      {/* User Actions & Notifications */}
      <div className="flex items-center gap-4">
        {/* Notifikasi Dropdown Trigger */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 transition-colors"
          >
            <Bell className="w-5 h-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </Button>

          {/* Notifikasi Dropdown Content */}
          {showNotifDropdown && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-30">
              <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <span className="font-bold text-slate-800 text-sm">Notifikasi Masuk</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-rose-100 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} Baru
                  </span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 scrollbar-thin">
                {notifList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium">
                    Tidak ada notifikasi baru
                  </div>
                ) : (
                  notifList.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 transition-colors hover:bg-slate-50/65 flex gap-3 text-xs ${
                        !notif.dibaca ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <p className={`text-slate-800 ${!notif.dibaca ? 'font-bold' : 'font-medium'}`}>
                          {notif.pesan}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(notif.waktu).toLocaleString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>
                      {!notif.dibaca && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="self-center bg-primary/10 hover:bg-primary/20 text-primary p-1.5 rounded-full transition-colors"
                          title="Tandai telah dibaca"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-[1px] h-6 bg-slate-100" />

        {/* Profile Card & Logout */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right hidden sm:flex">
            <span className="text-xs font-bold text-slate-800">{nama}</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
              {role}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-full w-10 h-10 transition-colors"
            title="Keluar dari Sistem"
          >
            <LogOut className="w-5 h-5 text-slate-655" />
          </Button>
        </div>
      </div>
    </header>
  )
}
