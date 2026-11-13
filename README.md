# YouTube Algo Fixer

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](youtube-algo-fixer.user.js)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-required-orange.svg)](https://www.tampermonkey.net/)

Userscript Tampermonkey yang memaksa beranda dan sidebar YouTube menampilkan **konten terbaru** — bukan rekomendasi lama yang diputar ulang terus-menerus.

Cocok kalau kamu bosan buka YouTube dan isinya video 3 tahun lalu, Shorts, dan Mix tanpa akhir.

## Fitur

| Fitur | Default | Keterangan |
|---|---|---|
| Auto pilih chip "Recently uploaded" | ON | Otomatis klik chip newest di beranda |
| Filter video lama | ON | Sembunyikan video lebih tua dari batas hari |
| Batas umur video | 14 hari | 1–365 hari |
| Sembunyikan video sudah ditonton | ON | Berdasarkan progress bar resume |
| Ambang "sudah ditonton" | 15% | Cegah false positive dari hover preview |
| Sembunyikan Shorts & Mix | ON | Shelf Shorts, radio/mix, dan mix tanpa timestamp |
| Paksa urut terbaru di Search | OFF | Menambahkan `&sp=CAI%3D` (sort by upload date) |

Semua opsi bisa diubah langsung dari panel melayang di kiri bawah halaman. Nilai disimpan permanen via `GM_setValue`.

## Instalasi

1. Pasang [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox, Safari, Opera).
2. Buka file mentah script ini:
   `https://raw.githubusercontent.com/Fikricraft/youtube-algo-fixer/main/youtube-algo-fixer.user.js`
3. Tampermonkey akan menampilkan halaman instalasi — klik **Install**.
4. Buka [youtube.com](https://www.youtube.com/) dan refresh.

Update otomatis aktif karena header sudah memuat `@updateURL` dan `@downloadURL`.

## Cara Kerja

1. **Chip newest** — memindai `yt-chip-cloud-chip-renderer` / `chip-view-model`, lalu klik chip dengan label "Recently uploaded" / "Baru diupload".
2. **Age filter** — membaca metadata umur (`#metadata-line span`, `.inline-metadata-item`, kelas view-model 2025/2026) lalu mengonversi `jam/hari/minggu/bulan/tahun` dan `menit/hari/minggu/bulan/tahun` ke satuan hari. Fallback ke `aria-label` judul kalau metadata belum ter-hydrate.
3. **Watched filter** — cek lebar progress bar resume; hanya disembunyikan jika persentase ≥ ambang.
4. **Shorts & Mix** — menghapus shelf Shorts, `ytd-compact-radio-renderer`, dan kartu dengan `start_radio=1` atau `/shorts/`.
5. **Search sort** — redirect sekali ke `&sp=CAI%3D` saat opsi diaktifkan.
6. **Anti-layout-kosong** — kalau sisa item terlihat < 6, dispatch event `scroll` supaya YouTube memuat batch berikutnya.

Semua selektor dicek ulang setiap `yt-navigate-finish` dan lewat `MutationObserver`, jadi tetap jalan pada navigasi SPA.

## Kompatibilitas

- Bahasa antarmuka: Inggris dan Indonesia (`ago` / `lalu`, `hour` / `jam`, dst).
- Didesain untuk YouTube versi 2025–2026 (Polymer + view-model renderer).
- Tidak mengirim data ke mana pun. Semua proses lokal di browser.

## Batasan

- YouTube sering mengganti nama class; selektor mungkin perlu diperbarui sewaktu-waktu.
- Video tanpa metadata umur (mis. hasil rekomendasi sidebar tertentu) tidak difilter umurnya.
- Filter bekerja per kartu yang sudah ter-render, bukan pada API YouTube.

## Kontribusi

Pull request dan issue terbuka. Kalau ada class YouTube baru yang bikin filter meleset, sertakan screenshot DOM card-nya di issue.

## Lisensi

[MIT](LICENSE) © 2026 Fikricraft
