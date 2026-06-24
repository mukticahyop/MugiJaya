import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const url = request.nextUrl.clone()
  const path = url.pathname

  // Skip static assets & API routes
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.includes('.') ||
    path === '/favicon.ico'
  ) {
    return supabaseResponse
  }

  const isAuthRoute = path.startsWith('/login')

  if (!user) {
    if (!isAuthRoute) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  if (isAuthRoute) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Ambil role dari tabel public.users
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as string | undefined

  // Proteksi Route berdasarkan Role (RBAC)
  if (path.startsWith('/gudang') && !['gudang', 'manajemen', 'admin'].includes(role || '')) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  if (
    path.startsWith('/pengiriman') &&
    !['pengemudi', 'manajemen', 'gudang', 'admin'].includes(role || '')
  ) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  if (path.startsWith('/proyek')) {
    if (path.startsWith('/proyek/permintaan')) {
      if (!['mandor', 'gudang', 'manajemen', 'admin'].includes(role || '')) {
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    } else if (path.startsWith('/proyek/rekap')) {
      if (!['manajemen', 'admin'].includes(role || '')) {
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    } else {
      if (!['manajemen', 'mandor', 'admin'].includes(role || '')) {
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    }
  }
  if (path.startsWith('/laporan') && !['mandor', 'manajemen', 'admin'].includes(role || '')) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  if (path.startsWith('/admin')) {
    if (path.startsWith('/admin/audit')) {
      if (!['admin', 'manajemen'].includes(role || '')) {
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    } else {
      if (role !== 'admin') {
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
