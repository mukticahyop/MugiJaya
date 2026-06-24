import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    // 1. Inisialisasi client admin dengan service role key (untuk memotong RLS)
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

    // 2. Verifikasi session
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    // 3. Baca body request
    const { idTruk } = await request.json()
    if (!idTruk) {
      return NextResponse.json({ error: 'ID Truk wajib disertakan' }, { status: 400 })
    }

    // 4. Ubah status truk menjadi 'tersedia'
    const { error: updateErr } = await supabaseAdmin
      .from('truk')
      .update({ status: 'tersedia' })
      .eq('id', idTruk)

    if (updateErr) {
      throw updateErr
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal mengubah status truk' }, { status: 500 })
  }
}
