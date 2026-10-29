<div align="center">

<img src="assets/logo.svg" alt="GeoLinker Logo" width="100" />

# GeoLinker — Ekstraksi Data Geospasial

**Platform berbasis WebGIS untuk mengekstraksi, memvalidasi, dan mengekspor data lokasi dari tautan Google Maps secara otomatis.**

[![Status](https://img.shields.io/badge/status-aktif-10b981?style=flat-square)](https://github.com/dhfoundry-studio/geolinker-ekstraksi-data-geospasial)
[![License](https://img.shields.io/badge/license-MIT-3b82f6?style=flat-square)](LICENSE)
[![Made With](https://img.shields.io/badge/made%20with-Vanilla%20JS-f59e0b?style=flat-square)](https://github.com/dhfoundry-studio/geolinker-ekstraksi-data-geospasial)
[![Product by](https://img.shields.io/badge/product%20by-DH%20Founder-8b5cf6?style=flat-square)](https://wa.me/6285861731352)

</div>

---

## 📌 Tentang Aplikasi

**GeoLinker** adalah sistem berbasis web (WebGIS) yang memungkinkan pengguna untuk:

- **Mengekstrak** koordinat (Latitude & Longitude) langsung dari tautan Google Maps panjang
- **Melakukan Reverse Geocoding** secara otomatis ke alamat resmi via DistanceMatrix.ai API
- **Memvisualisasikan** titik lokasi pada peta interaktif Leaflet.js + OpenStreetMap
- **Mendeteksi duplikat** menggunakan algoritma Haversine (threshold: 10 meter)
- **Mengekspor data** ke format Excel (.xlsx), KML, dan GeoJSON
- **Menyimpan riwayat** lokasi di Arsip (persistent via LocalStorage)

Aplikasi ini dirancang khusus untuk mendukung **pemetaan dan perencanaan pembangunan daerah**, terutama di lingkungan pemerintahan dan instansi yang membutuhkan pengolahan data titik lokasi secara massal dari Google Maps.

---

## ✨ Fitur Utama

| Fitur | Keterangan |
|-------|------------|
| 🔗 **Ekstraksi Multi-Link** | Input hingga 10 tautan Google Maps sekaligus |
| 📍 **Reverse Geocoding** | Koordinat → Alamat resmi via DistanceMatrix.ai API |
| 🗺️ **Peta Interaktif** | Visualisasi marker di Leaflet.js + OpenStreetMap |
| 🔁 **Deteksi Duplikat** | Multi-level: URL, Nama, dan Jarak (Haversine <10m) |
| 📊 **Export Fleksibel** | Excel (.xlsx), KML, GeoJSON dengan dialog Save As |
| 🗂️ **Arsip Riwayat** | Penyimpanan data persisten di LocalStorage |
| 🎨 **Dark/Light Mode** | Tema dapat diubah, disimpan otomatis |
| ⚙️ **Pengaturan Kolom** | Tampilkan/sembunyikan kolom Kategori, Kecamatan, Link |
| 🏷️ **Kategori Custom** | Tambah/hapus kategori dengan sistem tag chip |
| 🔍 **Filter & Pencarian** | Cari berdasarkan nama, alamat, kecamatan, status, kategori |
| 🔒 **Password Gate** | Login sederhana untuk proteksi akses |

---

## 🚀 Demo & Deployment

> Aplikasi ini di-deploy menggunakan **Vercel**.

Untuk menjalankan secara lokal, cukup buka file `index.html` di browser — tidak memerlukan server backend. Semua proses berjalan di sisi klien (client-side only).

---

## 🗂️ Struktur Project

```
geolinker-ekstraksi-data-geospasial/
├── index.html              # Halaman utama aplikasi
├── vercel.json             # Konfigurasi deployment Vercel
├── package.json
│
├── assets/
│   └── logo.svg            # Logo GeoLinker
│
├── css/
│   └── style.css           # Stylesheet utama (dark/light theme)
│
├── js/
│   ├── validation.js       # Validasi URL & koordinat, STATUS constants
│   ├── extractor.js        # Parser tautan Google Maps → koordinat
│   ├── geocoding.js        # Reverse geocoding via DistanceMatrix.ai
│   ├── duplicate.js        # Deteksi duplikat (Haversine)
│   ├── storage.js          # Manajemen LocalStorage (CRUD, migrasi)
│   ├── map.js              # Integrasi Leaflet.js & marker WebGIS
│   ├── export.js           # Export Excel, KML, GeoJSON
│   ├── ui.js               # Rendering tabel, filter, sort, toast
│   └── app.js              # Controller utama, orkestrasi pipeline
│
└── docs/
    └── geospatial-processing.md  # Dokumentasi teknis lengkap
```

---

## ⚙️ Pipeline Pemrosesan Data

```
Input URL Google Maps
      ↓
[1] Validasi URL          → validation.js  → validateGmapsURL()
      ↓
[2] Ekstraksi Koordinat   → extractor.js   → parseGmapsURL()
      ↓
[3] Validasi Koordinat    → validation.js  → isValidCoordinate()
      ↓
[4] Normalisasi Teks      → validation.js  → normalizeText()
      ↓
[5] Reverse Geocoding     → geocoding.js   → reverseGeocode()
      ↓
[6] Deteksi Duplikat      → duplicate.js   → checkDuplicate()
      ↓
[7] Status Kualitas Data  → validation.js  → STATUS constants
      ↓
[8] Penyimpanan           → storage.js     → saveTableData()
      ↓
[9] Visualisasi WebGIS    → map.js         → addMarkerFromLocation()
      ↓
[10] Filter / Sort / Cari → ui.js          → applyFilter()
      ↓
[11] Export               → export.js      → exportToExcel/GeoJSON/KML()
```

---

## 🔑 Setup API Key

Aplikasi membutuhkan **DistanceMatrix.ai API Key** untuk fitur Reverse Geocoding.

1. Daftar / Login di [account.distancematrix.ai](https://account.distancematrix.ai/)
2. Buka **Dashboard** → cari bagian **"API Tokens"**
3. Salin token default atau buat token baru
4. Di aplikasi, buka **⚙️ Pengaturan** → masukkan API Key di kolom yang tersedia
5. API Key tersimpan otomatis di LocalStorage browser Anda

> ⚠️ **Catatan Keamanan**: API Key disimpan di sisi klien (browser). Jangan bagikan API Key Anda ke pihak lain.

---

## 📤 Format Export

### Excel (.xlsx)
Kolom: `No` | `Nama Tempat` | `Kategori` | `Kecamatan` | `Alamat Lengkap` | `Link Google Maps` | `Latitude` | `Longitude` | `Status` | `Tanggal`

### GeoJSON (RFC 7946)
```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [longitude, latitude] },
    "properties": { "nama_tempat": "...", "alamat": "...", ... }
  }]
}
```

### KML
```xml
<Placemark>
  <name>Nama Tempat</name>
  <Point>
    <coordinates>longitude,latitude,0</coordinates>
  </Point>
</Placemark>
```

---

## 📊 Status Kualitas Data

| Status | Warna Marker | Keterangan |
|--------|:---:|------------|
| `VALID` | 🟢 Hijau | Data lengkap, koordinat valid, geocoding berhasil |
| `DUPLIKAT` | 🟣 Ungu | Terdeteksi duplikat (link / nama / jarak <10m) |
| `GEOCODING_FAILED` | 🔴 Merah | Koordinat valid, tapi reverse geocoding gagal |
| `INVALID_URL` | 🟠 Oranye | URL bukan Google Maps atau format tidak dikenali |
| `EXTRACTION_FAILED` | 🟠 Oranye | URL valid, tapi koordinat tidak dapat diekstrak |
| `INVALID_COORDINATE` | 🟠 Oranye | Koordinat out-of-range |

---

## 🛠️ Teknologi yang Digunakan

| Teknologi | Kegunaan |
|-----------|----------|
| **HTML5 + CSS3** | Struktur & tampilan aplikasi |
| **Vanilla JavaScript** | Logic aplikasi (tanpa framework) |
| **[Leaflet.js](https://leafletjs.com/) v1.9.4** | Peta interaktif WebGIS |
| **[OpenStreetMap](https://www.openstreetmap.org/)** | Tile layer peta |
| **[SheetJS (xlsx)](https://sheetjs.com/)** | Export file Excel |
| **[DistanceMatrix.ai API](https://distancematrix.ai/)** | Reverse geocoding |
| **LocalStorage** | Penyimpanan data & arsip di browser |
| **[Vercel](https://vercel.com/)** | Platform deployment |

---

## ⚠️ Keterbatasan

| # | Keterbatasan | Keterangan |
|---|-------------|------------|
| 1 | **API Key Exposure** | API Key berada di sisi client — risiko arsitektur yang diketahui |
| 2 | **Geocoding Dependency** | Bergantung pada ketersediaan DistanceMatrix.ai API |
| 3 | **Kecamatan Manual** | Tidak ada automatic spatial boundary detection |
| 4 | **LocalStorage Limit** | ~5MB per origin, tidak cocok untuk dataset sangat besar |
| 5 | **No Backend** | Data hilang jika browser dibersihkan (gunakan fitur Export) |
| 6 | **Maksimal 10 Link** | Per sesi ekstraksi |

---

## 📝 Dokumentasi Teknis

Dokumentasi teknis lengkap (pipeline, data model, algoritma) tersedia di:

📄 [`docs/geospatial-processing.md`](docs/geospatial-processing.md)

---

## 👨‍💻 Developer

<div align="center">

**Product by DH Founder**

🛠️ Dikembangkan oleh **Mas Hakim**

[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/6285861731352)

</div>

---

## 📄 Lisensi

Project ini menggunakan lisensi **MIT**. Lihat file [LICENSE](LICENSE) untuk detail.

---

<div align="center">
<sub>© 2025 DH Founder · GeoLinker — Ekstraksi Data Geospasial</sub>
</div>
