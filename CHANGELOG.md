# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) dan [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-11-13

### Added
- Auto-selection chip "Recently uploaded" / "Baru diupload" di beranda.
- Filter umur video berbasis DOM metadata, mendukung format Inggris dan Indonesia.
- Filter video yang sudah ditonton dengan ambang persentase (default 15%).
- Penghapusan shelf Shorts, Mix, dan radio renderer.
- Opsi paksa sort by upload date di halaman hasil pencarian.
- Panel kontrol melayang dengan penyimpanan opsi via `GM_setValue`.
- Badge penghitung video tersembunyi.
- Dukungan view-model renderer YouTube 2025/2026 (`yt-lockup-view-model`, `yt-content-metadata-view-model`).

### Fixed
- Video lama tidak lagi lolos filter ketika metadata belum ter-hydrate (fallback `aria-label`).
- Kartu dalam grid tidak lagi menyisakan sel kosong setelah pembatasan selektor ke container level atas.
- False positive hover-preview pada deteksi status "sudah ditonton".

[2.0.0]: https://github.com/Fikricraft/youtube-algo-fixer/releases/tag/v2.0.0
