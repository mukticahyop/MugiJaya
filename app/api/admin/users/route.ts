import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    // 1. Inisialisasi client admin dengan service role key (untuk memotong RLS & melakukan tindakan admin)
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {},
        },
      }
    )

    // 2. Verifikasi session & role pemanggil
    const { data: { user: adminUser }, error: authErr } = await supabaseAdmin.auth.getUser()
    if (authErr || !adminUser) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Tidak memiliki hak akses (Hanya Admin)' }, { status: 403 })
    }

    // 3. Baca body request
    const { email, password, nama, role } = await request.json()
    if (!email || !password || !nama || !role) {
      return NextResponse.json({ error: 'Kolom email, password, nama, dan role wajib diisi' }, { status: 400 })
    }

    // 4. Daftarkan user baru lewat auth.admin
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nama, role }
    })

    if (createErr) {
      throw createErr
    }

    // Catatan: trigger on_auth_user_created di Postgres akan otomatis menyalin profil ke public.users

    // 5. Catat audit trail
    await supabaseAdmin.from('audit_trail').insert({
      id_user: adminUser.id,
      aksi: `Mendaftarkan pengguna baru: ${nama} (${email}) dengan role ${role}`,
      tabel_terkait: 'users',
      detail: { email, role, nama }
    })

    return NextResponse.json({ success: true, user: newUser.user })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal mendaftarkan pengguna baru' }, { status: 500 })
  }
}
