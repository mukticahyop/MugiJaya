-- 1. Enum untuk Role Pengguna (Tepat 5 Role)
CREATE TYPE public.user_role AS ENUM ('manajemen', 'gudang', 'mandor', 'pengemudi', 'admin');

-- 2. Tabel Users (Menghubungkan Supabase Auth dengan profil aplikasi)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nama TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role public.user_role NOT NULL DEFAULT 'pengemudi',
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Tabel Truk
CREATE TABLE public.truk (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plat_nomor TEXT NOT NULL UNIQUE,
    kapasitas NUMERIC NOT NULL, -- dalam ton atau m3
    status TEXT NOT NULL CHECK (status IN ('tersedia', 'beroperasi', 'perbaikan')) DEFAULT 'tersedia',
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Tabel Pengiriman
CREATE TABLE public.pengiriman (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_truk UUID REFERENCES public.truk(id) ON DELETE SET NULL,
    id_pengemudi UUID REFERENCES public.users(id) ON DELETE SET NULL,
    asal TEXT NOT NULL,
    tujuan TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('jadwal', 'berangkat', 'tiba', 'batal')) DEFAULT 'jadwal',
    check_in_berangkat TIMESTAMP WITH TIME ZONE,
    lat_berangkat DOUBLE PRECISION,
    lng_berangkat DOUBLE PRECISION,
    check_in_tiba TIMESTAMP WITH TIME ZONE,
    lat_tiba DOUBLE PRECISION,
    lng_tiba DOUBLE PRECISION,
    foto_kondisi_barang TEXT, -- URL image Supabase Storage
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Tabel Barang
CREATE TABLE public.barang (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE,
    kategori TEXT NOT NULL,
    stok INT NOT NULL DEFAULT 0,
    stok_minimum INT NOT NULL DEFAULT 10,
    satuan TEXT NOT NULL, -- sak, m3, batang, kaleng
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Tabel Transaksi Gudang
CREATE TABLE public.transaksi_gudang (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_barang UUID REFERENCES public.barang(id) ON DELETE CASCADE NOT NULL,
    tipe TEXT NOT NULL CHECK (tipe IN ('masuk', 'keluar')),
    jumlah INT NOT NULL CHECK (jumlah > 0),
    id_user UUID REFERENCES public.users(id) ON DELETE SET NULL,
    tanggal TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. Tabel Proyek
CREATE TABLE public.proyek (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE,
    lokasi TEXT NOT NULL,
    id_mandor UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('rencana', 'berjalan', 'selesai')) DEFAULT 'rencana',
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 8. Tabel Laporan Harian
CREATE TABLE public.laporan_harian (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_proyek UUID REFERENCES public.proyek(id) ON DELETE CASCADE NOT NULL,
    ditangani_oleh UUID REFERENCES public.users(id) ON DELETE SET NULL NOT NULL,
    isi TEXT NOT NULL,
    foto TEXT, -- URL image Supabase Storage
    tanggal DATE DEFAULT CURRENT_DATE NOT NULL,
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(id_proyek, tanggal) -- Mencegah mandor kirim laporan ganda pada hari yang sama
);

-- 9. Tabel Permintaan Material
CREATE TABLE public.permintaan_material (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_proyek UUID REFERENCES public.proyek(id) ON DELETE CASCADE NOT NULL,
    id_barang UUID REFERENCES public.barang(id) ON DELETE CASCADE NOT NULL,
    jumlah INT NOT NULL CHECK (jumlah > 0),
    status TEXT NOT NULL CHECK (status IN ('diajukan', 'disetujui', 'ditolak', 'selesai')) DEFAULT 'diajukan',
    catatan_gudang TEXT,
    diajukan_oleh UUID REFERENCES public.users(id) ON DELETE SET NULL NOT NULL,
    tanggal TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 10. Tabel Audit Trail
CREATE TABLE public.audit_trail (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_user UUID REFERENCES public.users(id) ON DELETE SET NULL,
    aksi TEXT NOT NULL,
    tabel_terkait TEXT NOT NULL,
    detail JSONB,
    waktu TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 11. Tabel Notifikasi
CREATE TABLE public.notifikasi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_user_penerima UUID REFERENCES public.users(id) ON DELETE CASCADE,
    tipe TEXT NOT NULL,
    pesan TEXT NOT NULL,
    dibaca BOOLEAN DEFAULT FALSE NOT NULL,
    waktu TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- PostgreSQL Helper Function untuk RLS Policy (Hardening)
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.users WHERE id = user_uuid;
$$;

-- Trigger untuk sinkronisasi Profil User saat user melakukan sign up di Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users (id, nama, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nama', 'Pengguna Baru'),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'pengemudi'::public.user_role)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- A. Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_baca_semua ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_kelola_users ON public.users FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin') WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- B. Truk
ALTER TABLE public.truk ENABLE ROW LEVEL SECURITY;
CREATE POLICY semua_baca_truk ON public.truk FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_gudang_kelola_truk ON public.truk FOR ALL TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'gudang')) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'gudang'));

-- C. Pengiriman
ALTER TABLE public.pengiriman ENABLE ROW LEVEL SECURITY;
CREATE POLICY pengemudi_baca_milik_sendiri ON public.pengiriman FOR SELECT TO authenticated USING (auth.uid() = id_pengemudi);
CREATE POLICY pengemudi_update_milik_sendiri ON public.pengiriman FOR UPDATE TO authenticated USING (auth.uid() = id_pengemudi) WITH CHECK (auth.uid() = id_pengemudi);
CREATE POLICY staf_baca_semua_pengiriman ON public.pengiriman FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('manajemen', 'admin', 'gudang'));
CREATE POLICY gudang_admin_kelola_pengiriman ON public.pengiriman FOR ALL TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'gudang')) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'gudang'));

-- D. Barang
ALTER TABLE public.barang ENABLE ROW LEVEL SECURITY;
CREATE POLICY semua_baca_barang ON public.barang FOR SELECT TO authenticated USING (true);
CREATE POLICY gudang_admin_kelola_barang ON public.barang FOR ALL TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'gudang')) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'gudang'));

-- E. Transaksi Gudang
ALTER TABLE public.transaksi_gudang ENABLE ROW LEVEL SECURITY;
CREATE POLICY staf_baca_transaksi ON public.transaksi_gudang FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('manajemen', 'admin', 'gudang'));
CREATE POLICY gudang_admin_buat_transaksi ON public.transaksi_gudang FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'gudang'));

-- F. Proyek
ALTER TABLE public.proyek ENABLE ROW LEVEL SECURITY;
CREATE POLICY semua_baca_proyek ON public.proyek FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_manajemen_kelola_proyek ON public.proyek FOR ALL TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'manajemen')) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'manajemen'));

-- G. Laporan Harian
ALTER TABLE public.laporan_harian ENABLE ROW LEVEL SECURITY;
CREATE POLICY mandor_baca_laporan ON public.laporan_harian FOR SELECT TO authenticated USING (ditangani_oleh = auth.uid() OR get_user_role(auth.uid()) IN ('manajemen', 'admin', 'gudang'));
CREATE POLICY mandor_buat_laporan ON public.laporan_harian FOR INSERT TO authenticated WITH CHECK (ditangani_oleh = auth.uid());
CREATE POLICY mandor_update_laporan ON public.laporan_harian FOR UPDATE TO authenticated USING (ditangani_oleh = auth.uid()) WITH CHECK (ditangani_oleh = auth.uid());

-- H. Permintaan Material
ALTER TABLE public.permintaan_material ENABLE ROW LEVEL SECURITY;
CREATE POLICY mandor_kelola_permintaan_sendiri ON public.permintaan_material FOR ALL TO authenticated USING (diajukan_oleh = auth.uid()) WITH CHECK (diajukan_oleh = auth.uid());
CREATE POLICY gudang_admin_manajemen_baca_permintaan ON public.permintaan_material FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'gudang', 'manajemen'));
CREATE POLICY gudang_admin_update_permintaan ON public.permintaan_material FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'gudang')) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'gudang'));

-- I. Audit Trail
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY manajemen_admin_baca_audit ON public.audit_trail FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'manajemen'));
CREATE POLICY sistem_buat_audit ON public.audit_trail FOR INSERT TO authenticated WITH CHECK (true);

-- J. Notifikasi
ALTER TABLE public.notifikasi ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifikasi_baca_sendiri ON public.notifikasi FOR SELECT TO authenticated USING (auth.uid() = id_user_penerima);
CREATE POLICY notifikasi_update_sendiri ON public.notifikasi FOR UPDATE TO authenticated USING (auth.uid() = id_user_penerima) WITH CHECK (auth.uid() = id_user_penerima);
CREATE POLICY staf_buat_notifikasi ON public.notifikasi FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('gudang', 'mandor', 'manajemen', 'admin'));

-- ==========================================
-- K. SUPABASE STORAGE BUCKETS & POLICIES (AUTO SETUP)
-- ==========================================

-- 1. Membuat bucket 'foto_laporan' jika belum ada (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('foto_laporan', 'foto_laporan', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Membuat bucket 'foto_barang' jika belum ada (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('foto_barang', 'foto_barang', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Kebijakan unggah (INSERT) foto_laporan untuk user login
CREATE POLICY "Allow Authenticated Upload Laporan"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'foto_laporan');

-- 4. Kebijakan baca (SELECT) foto_laporan untuk publik
CREATE POLICY "Allow Public Read Laporan"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'foto_laporan');

-- 5. Kebijakan unggah (INSERT) foto_barang untuk user login
CREATE POLICY "Allow Authenticated Upload Barang"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'foto_barang');

-- 6. Kebijakan baca (SELECT) foto_barang untuk publik
CREATE POLICY "Allow Public Read Barang"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'foto_barang');
