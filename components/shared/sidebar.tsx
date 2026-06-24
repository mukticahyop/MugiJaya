'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Warehouse, 
  Truck, 
  Map, 
  FolderGit, 
  FileText, 
  Users, 
  Activity,
  ArrowLeftRight,
  ClipboardList,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  role: 'manajemen' | 'gudang' | 'mandor' | 'pengemudi' | 'admin'
  nama: string
}

export default function Sidebar({ role, nama }: SidebarProps) {
  const pathname = usePathname()

  // Struktur menu berbasis role (RBAC)
  const getMenuItems = () => {
    const items = [
      {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        roles: ['manajemen', 'gudang', 'mandor', 'pengemudi', 'admin']
      },
      // MODUL GUDANG
      {
        title: 'Inventaris Stok',
        href: '/gudang',
        icon: Warehouse,
        roles: ['gudang', 'manajemen', 'admin']
      },
      {
        title: 'Alokasi Material',
        href: '/gudang/alokasi',
        icon: ArrowLeftRight,
        roles: ['gudang', 'admin']
      },
      {
        title: 'Rekap Gudang',
        href: '/gudang/rekap',
        icon: BarChart3,
        roles: ['gudang', 'manajemen', 'admin']
      },
      // MODUL PENGIRIMAN
      {
        title: 'Pengiriman Truk',
        href: '/pengiriman',
        icon: Truck,
        roles: ['pengemudi', 'gudang', 'manajemen', 'admin']
      },
      {
        title: 'Peta Check-In',
        href: '/pengiriman/peta',
        icon: Map,
        roles: ['gudang', 'manajemen', 'admin']
      },
      // MODUL PROYEK & LAPORAN
      {
        title: 'Proyek Aktif',
        href: '/proyek',
        icon: FolderGit,
        roles: ['manajemen', 'mandor', 'admin']
      },
      {
        title: 'Permintaan Material',
        href: '/proyek/permintaan', // dialihkan ke sub-modul proyek/permintaan
        icon: ClipboardList,
        roles: ['mandor', 'gudang', 'manajemen', 'admin']
      },
      {
        title: 'Laporan Harian',
        href: '/laporan',
        icon: FileText,
        roles: ['mandor', 'manajemen', 'admin']
      },
      {
        title: 'Rekap Proyek',
        href: '/proyek/rekap',
        icon: BarChart3,
        roles: ['manajemen', 'admin']
      },
      // MODUL ADMIN
      {
        title: 'Kelola Pengguna',
        href: '/admin',
        icon: Users,
        roles: ['admin']
      },
      {
        title: 'Audit Trail',
        href: '/admin/audit',
        icon: Activity,
        roles: ['admin', 'manajemen']
      }
    ]

    return items.filter(item => item.roles.includes(role))
  }

  const menuItems = getMenuItems()

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col h-screen text-slate-300 shrink-0">
      {/* Header Sidebar */}
      <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
        <div className="bg-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Truck className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-extrabold text-white text-sm tracking-wide">CV. Mugi Jaya</h2>
          <p className="text-[10px] text-primary font-bold tracking-wider uppercase font-heading">Integrated System</p>
        </div>
      </div>

      {/* Navigasi Menu */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-850">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (
            item.href !== '/' && 
            pathname.startsWith(item.href + '/') &&
            !menuItems.some(other => other.href !== item.href && other.href.startsWith(item.href + '/') && pathname.startsWith(other.href))
          )

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group relative",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/15" 
                  : "text-slate-400 hover:text-white hover:bg-slate-850"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-white rounded-r-md" />
              )}
              <Icon className={cn(
                "w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105",
                isActive ? "text-primary-foreground" : "text-slate-500 group-hover:text-slate-300"
              )} />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer Sidebar */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-900/30">
        <div className="flex items-center gap-3 bg-slate-950/30 p-3 rounded-xl border border-slate-800/40">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary uppercase text-sm font-heading">
            {nama.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-white truncate">{nama}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate">{role}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
