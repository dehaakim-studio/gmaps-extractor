# Pengolahan Data Geospasial — Dokumentasi Proses

**Sistem:** Ekstraksi dan Pengolahan Data Geospasial Berbasis Web
**Fase:** Phase 3 (Penguatan Pengolahan Data Geospasial)
**Status:** IMPLEMENTED

---

## 1. Pipeline Lengkap

```
Input URL Google Maps
      ↓
[1] Input Validation         → validation.js → validateGmapsURL()
      ↓
[2] Extraction               → extractor.js  → parseGmapsURL()
      ↓
[3] Coordinate Validation    → validation.js → isValidCoordinate()
      ↓
[4] Data Normalization       → validation.js → normalizeText()
      ↓
[5] Reverse Geocoding        → geocoding.js  → reverseGeocode()
      ↓
[6] Duplicate Detection      → duplicate.js  → checkDuplicate()
      ↓
[7] Data Quality Status      → validation.js → STATUS constants
      ↓
[8] Storage                  → storage.js    → saveTableData() / saveArchiveData()
      ↓
[9] WebGIS Visualization     → map.js        → addMarkerFromLocation()
      ↓
[10] Search / Filter / Sort  → ui.js         → applyFilter()
      ↓
[11] Export                  → export.js     → exportToExcel/GeoJSON/KML()
```

---

## 2. Data Model

Setiap record menggunakan struktur standar:

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `id` | string | ID unik: `loc_<timestamp>_<random>` |
| `nama_tempat` | string | Nama tempat dari URL/parsing |
| `kategori` | string | Kategori manual (pilihan dropdown) |
| `kecamatan` | string | Kecamatan (input manual) |
| `alamat` | string | Alamat dari reverse geocoding |
| `link_google_maps` | string | URL Google Maps yang telah dibersihkan |
| `latitude` | string | Lintang (string, presisi dari sumber) |
| `longitude` | string | Bujur (string, presisi dari sumber) |
| `status` | string | Status kualitas data |
| `tanggal` | string | Timestamp (`toLocaleString('id-ID')`) |

---

## 3. Status Kualitas Data

| Status | Keterangan |
|--------|-----------|
| `VALID` | Data lengkap, koordinat valid, geocoding berhasil |
| `DUPLIKAT` | Terdeteksi duplikat (link / nama / jarak <10m) |
| `GEOCODING_FAILED` | Koordinat valid, tapi reverse geocoding gagal |
| `INVALID_URL` | URL bukan Google Maps atau format tidak dikenali |
| `EXTRACTION_FAILED` | URL valid, tapi koordinat tidak dapat diekstrak |
| `INVALID_COORDINATE` | Koordinat diekstrak, tapi out-of-range |

---

## 4. Validasi Input

### URL Validation (`validateGmapsURL`)
- Harus mengandung `google.com/maps` atau `maps.app.goo.gl`
- Menolak URL kosong, non-string, dan domain lain

### Coordinate Validation (`isValidCoordinate`)
- Latitude: -90 ≤ lat ≤ 90
- Longitude: -180 ≤ lng ≤ 180
- Menolak NaN dan nilai out-of-range

---

## 5. Ekstraksi Koordinat

### Format `@lat,lng`
```
Regex: /@(-?\d+\.\d+),(-?\d+\.\d+)/
Contoh: /@-6.1753924,106.8271528,15z
```

### Format `!3d/!4d`
```
Regex: /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/
Contoh: /data=!3d-7.6079!4d110.2038
```

Ekstraksi nama tempat menggunakan path segment URL yang di-decode dari `%20` dan `+`.

---

## 6. Reverse Geocoding

- Provider: Google Maps Geocoding API
- Endpoint: `https://maps.googleapis.com/maps/api/geocode/json`
- Parameter: `latlng`, `key`, `language=id`, `result_type=street_address|...`
- Timeout: 10 detik per request
- Cache: In-memory cache per sesi (`_geocodeCache` di `geocoding.js`)
- Behavior on failure: Status → `GEOCODING_FAILED`, koordinat tetap dipertahankan

---

## 7. Deteksi Duplikat (Haversine)

### Formula Haversine
```
R = 6371000 meter (radius bumi)
a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlng/2)
c = 2·atan2(√a, √(1−a))
d = R·c
```

### Threshold
- **10 meter** — titik dalam radius 10 meter dianggap duplikat

### Multi-level Detection
1. **Link**: URL identik → `DUPLIKAT`
2. **Nama**: Nama dinormalisasi identik (lowercase, alfanumerik only) → `DUPLIKAT`
3. **Jarak**: Haversine < 10 meter → `DUPLIKAT` (dengan informasi jarak dalam meter)

---

## 8. Normalisasi Data

### `normalizeText(text)`
```
"  Masjid   Agung  " → "Masjid Agung"
```
- Menghapus whitespace berlebih
- `String.trim()` + `replace(/\s+/g, ' ')`
- Diterapkan pada: `nama_tempat`, `alamat`

---

## 9. Data Completeness Check

### `isDataComplete(record)`
Mengembalikan `false` jika salah satu field berikut kosong/tidak valid:
- `nama_tempat` (bukan "Tidak ditemukan" atau "-")
- `alamat`
- `latitude`
- `longitude`
- `link_google_maps`
- `status`

Incomplete records **tidak** dihapus otomatis. Hanya ditandai di statistik dashboard.

---

## 10. Analisis Geospasial

### A. Bounding Box
```
minLat = min(all valid latitudes)
maxLat = max(all valid latitudes)
minLng = min(all valid longitudes)
maxLng = max(all valid longitudes)
```

### B. Mean Coordinate (Centroid Sederhana)
```
meanLat = Σ(lat) / n
meanLng = Σ(lng) / n
```
> ⚠️ Ini adalah **mean koordinat**, bukan centroid geometri kompleks.
> Tidak cocok digunakan sebagai representasi pusat untuk polygon non-konveks.

### C. Valid Points
Jumlah record dengan `isValidCoordinate(lat, lng) === true`.

---

## 11. WebGIS / Leaflet

| Aspek | Implementasi |
|-------|-------------|
| Library | Leaflet.js (CDN) |
| Tile Layer | OpenStreetMap |
| Marker | `L.divIcon` dengan warna berdasarkan status |
| Popup | HTML tersanitasi via `escapeHTML()` |
| Sinkronisasi | `tableData → renderMapFromData()` (single source of truth) |
| fitBounds | Otomatis menyesuaikan viewport ke semua marker |

### Warna Marker Berdasarkan Status
| Status | Warna |
|--------|-------|
| VALID | Hijau (`#10b981`) |
| DUPLIKAT | Ungu (`#8b5cf6`) |
| GEOCODING_FAILED | Merah (`#ef4444`) |
| INVALID_* | Oranye (`#f59e0b`) |

---

## 12. Filter dan Pencarian

### Search (case-insensitive)
- `nama_tempat`
- `alamat`
- `kecamatan`
- `kategori`
- `status`

### Filter
- **Status**: VALID / DUPLIKAT / GEOCODING_FAILED / INVALID_URL / INVALID_COORDINATE / EXTRACTION_FAILED
- **Kategori**: Masjid / Mushola / Sekolah / Kantor / Fasilitas Umum / Tempat Usaha / Lainnya

### Sorting
```javascript
const result = [...data].sort(...)  // tidak memutasi array asli
```

---

## 13. Export Format

### Excel (.xlsx)
Kolom: No, Nama Tempat, Kategori, Kecamatan, Alamat Lengkap, Link Google Maps, Latitude, Longitude, Status, Tanggal.
API Key **tidak** masuk ke kolom manapun.

### GeoJSON (RFC 7946)
```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": [longitude, latitude]
    },
    "properties": { ... }
  }]
}
```
> Koordinat dalam urutan **[longitude, latitude]** sesuai RFC 7946.

### KML
```xml
<coordinates>longitude,latitude,0</coordinates>
```
> KML menggunakan urutan `longitude,latitude,altitude`.

---

## 14. LocalStorage Schema

```
gmaps_table_data    → Array<LocationRecord>  (sesi aktif)
gmaps_archive_data  → Array<LocationRecord>  (riwayat)
gmaps_api_key       → string                 (API Key terenkripsi client-side)
app-theme           → 'dark' | 'light'
```

### Quota Handling
- `saveToStorage()` memiliki `try/catch` yang menangkap `QuotaExceededError`
- User diberikan notifikasi Toast jika storage penuh
- Data lama **tidak** dihapus otomatis

### Migration
- `migrateRecord()` mengkonversi format lama ke format baru secara otomatis saat load

---

## 15. Keterbatasan (Limitations)

| # | Keterbatasan | Keterangan |
|---|-------------|-----------|
| 1 | **API Key Exposure** | API Key berada di sisi client — termasuk risiko arsitektur. Bukan secret. |
| 2 | **Geocoding Dependency** | Hasil bergantung pada ketersediaan Google Geocoding API. |
| 3 | **Kecamatan Manual** | Tidak ada automatic spatial boundary — kecamatan diisi manual. |
| 4 | **Kategori Manual** | Bukan automatic classification. Pilihan manual dari dropdown. |
| 5 | **LocalStorage Limit** | ~5MB per origin. Tidak cocok untuk dataset besar. |
| 6 | **Geospatial Analysis** | Hanya Haversine + bounding box. Ini adalah **basic geospatial processing**, bukan advanced spatial analysis. |
| 7 | **No Backend** | Tidak ada persistensi server-side. Data hilang jika browser dibersihkan. |
