# Mugi Jaya - Sistem Informasi Logistik & Proyek

> Proyek mata kuliah Pemrograman Web oleh **Team Nguyen**. Aplikasi ini dirancang untuk mempermudah pengelolaan proyek, stok gudang, dan pemantauan pengiriman barang secara *real-time*.

---

## 👥 Hak Akses & Peran Pengguna

Sistem ini memisahkan hak akses menjadi **5 peran** utama untuk alur kerja yang terintegrasi:

*   **📊 Manajemen**
    *   Memantau ringkasan proyek yang sedang berjalan.
    *   Melihat rekapitulasi laporan harian dan data logistik pengiriman.
*   **🔑 Administrator**
    *   Mengelola pembuatan akun pengguna (users).
    *   Memantau catatan riwayat aktivitas sistem (*audit trail*).
*   **📦 Staf Gudang**
    *   Mengelola data stok material/barang.
    *   Mencatat mutasi barang masuk dan keluar.
    *   Meninjau dan memproses pengajuan material dari proyek.
*   **🚧 Mandor Lapangan**
    *   Mengelola status proyek yang ditugaskan.
    *   Membuat pengajuan kebutuhan material ke gudang.
    *   Melaporkan progres harian proyek dengan menyertakan teks dan foto.
*   **🚚 Pengemudi**
    *   Menerima tugas pengiriman barang.
    *   Melakukan *check-in* titik keberangkatan dan kedatangan menggunakan lokasi GPS.
    *   Mengunggah bukti foto kondisi barang saat tiba di lokasi.

---

## 🛠️ Teknologi yang Digunakan

*   **Frontend & Framework:** Next.js (App Router) & TypeScript
*   **Styling & UI:** Tailwind CSS, Lucide React (Icons), & shadcn/ui
*   **Backend & Database:** Supabase (PostgreSQL, Supabase Auth, Storage)
*   **Design & Versioning:** Figma & Git

---

## 🚀 Cara Menjalankan Proyek Secara Lokal

1.  **Clone repository:**
    ```bash
    git clone https://github.com/mukticahyop/MugiJaya.git
    cd MugiJaya
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Konfigurasi Environment Variables:**
    Buat file bernama `.env.local` di folder root dan masukkan kredensial Supabase Anda:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Jalankan server lokal:**
    ```bash
    npm run dev
    ```
    Buka `http://localhost:3000` pada browser Anda.

---

## 🧑‍💻 Tim Pengembang (Team Nguyen)

*   Tor Fatah Onggara Lubis
*   Eleonora Adeo Victoria
*   Mukti Cahyo Pamungkas
*   Raymond Olga Saputra
*   Zahra Jemima Zahabiya Rahmadhani
*   Ahmad Rizal Dwi Nugraha
