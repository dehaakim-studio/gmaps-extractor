# Test Case — Sistem Ekstraksi Data Geospasial

Dokumen ini berisi skenario pengujian (Regression dan Feature Testing) mencakup Fase 2 (modularisasi) dan Fase 3 (penguatan geospasial).

## Modul Ekstraksi & Validasi

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-001 | Validation | URL kosong | Input string kosong atau spasi | `INVALID_URL` dengan alasan "URL kosong" | PASS |
| TC-002 | Validation | Shortlink Goo.gl | `https://maps.app.goo.gl/xxx` | Ditolak. Harus link panjang | PASS |
| TC-003 | Extraction | URL format `!3d/!4d` | URL mengandung `!3d-6.200!4d106.816` | Latitude: `-6.200`, Longitude: `106.816` | PASS |
| TC-004 | Extraction | URL format `@lat,lng` | URL mengandung `@-6.200,106.816,15z` | Latitude: `-6.200`, Longitude: `106.816` | PASS |
| TC-005 | Extraction | Ekstraksi Nama Tempat | URL mengandung `/place/Monumen+Nasional/` | Nama: `Monumen Nasional` | PASS |
| TC-006 | Validation | Latitude/Longitude Invalid | URL menghasilkan Lat: `100`, Lng: `200` | `INVALID_COORDINATE` | PASS |

## Modul Geocoding & Pipeline (Batch)

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-007 | Geocoding | Reverse Geocoding Berhasil | Lat/Lng valid, API Key valid | Alamat terisi, status `VALID` | PASS |
| TC-008 | Geocoding | API Key Invalid/Limit | Lat/Lng valid, API Key salah | Alamat error, status `GEOCODING_FAILED` | PASS |
| TC-009 | Pipeline | Caching Geocoding | Input URL yang sama 2x berurutan | Request ke-2 menggunakan nilai cache | PASS |
| TC-010 | Pipeline | Batch Processing (Error Handling) | 3 URL: 1 Valid, 1 Invalid URL, 1 Invalid Coord | Sistem tetap memproses ketiganya tanpa crash | PASS |

## Modul Deteksi Duplikat

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-011 | Duplicate | URL Identik | Input URL yang sama persis 2x | Baris ke-2 ditandai `DUPLIKAT` (Link duplikat) | PASS |
| TC-012 | Duplicate | Nama Tempat Identik | Input URL berbeda tapi nama tempat sama | Ditandai `DUPLIKAT` (Nama identik) | PASS |
| TC-013 | Duplicate | Jarak Haversine < 10m | Input koordinat berbeda tapi berjarak 5 meter | Ditandai `DUPLIKAT` dengan info jarak dalam meter | PASS |
| TC-013b | Duplicate | Jarak Haversine > 10m | Dua titik berjarak 50 meter | Tidak dianggap duplikat, masuk sebagai record baru | PASS |

## Modul UI, Storage, Map & Export

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-014 | Storage | Penyimpanan Otomatis | Input URL valid, refresh halaman | Data tetap ada di Tabel Data dan Arsip | PASS |
| TC-015 | UI | Pencarian & Filter | Ketik nama tempat di kotak pencarian | Tabel hanya menampilkan baris yang relevan | PASS |
| TC-016 | UI | Sorting Tabel | Klik header "Status" | Tabel diurutkan berdasarkan alfabet status | PASS |
| TC-017 | Map | Render Marker & Popup | Data divalidasi ke peta | Marker muncul. Popup terhindar dari XSS. | PASS |
| TC-018 | Export | Export ke Excel | Klik "Export Excel" dengan nama file | File `.xlsx` terunduh berisi kolom terstruktur | PASS |
| TC-019 | Export | Export ke GeoJSON | Klik "Export GeoJSON" | File `.geojson` terunduh, format koordinat `[lng, lat]` | PASS |
| TC-020 | Export | Export ke KML | Klik "Export KML" | File `.kml` terunduh, koordinat `lng,lat,0` | PASS |
| TC-021 | Export | Excel to KML Converter | Upload file Excel dengan kolom valid | Terkonversi otomatis menjadi `.kml` | PASS |

## Phase 3 — Data Quality Pipeline

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-022 | Normalization | Whitespace berlebih | Nama tempat: `"  Monas  "` | Tersimpan sebagai `"Monas"` | PASS |
| TC-023 | Normalization | Tab/multiple spaces | Alamat: `"Jl.  Medan  Merdeka"` | Tersimpan sebagai `"Jl. Medan Merdeka"` | PASS |
| TC-024 | Data Quality | Record incomplete | Data tanpa alamat (geocoding fail) | `stat-incomplete` bertambah | PASS |
| TC-025 | Dashboard | Statistik akurat | Proses 3 VALID + 1 DUPLIKAT + 1 GEOCODING_FAILED | Dashboard menampilkan angka yang sesuai | PASS |
| TC-026 | Geospatial | Bounding Box | 3 titik valid diproses | `geo-bbox` menampilkan min/max lat/lng dari 3 titik | PASS |
| TC-027 | Geospatial | Mean Coordinate | 2 titik valid diproses | `geo-mean` menampilkan rata-rata lat/lng | PASS |
| TC-028 | Geospatial | Valid Points count | 2 VALID + 1 GEOCODING_FAILED (coord ada) + 1 INVALID | `geo-points` = 3 | PASS |

## Phase 3 — Kategori & Kecamatan

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-029 | Kategori | Pilih dropdown kategori | Pilih "Masjid" di kolom kategori baris 1 | Data tersimpan otomatis di localStorage | PASS |
| TC-030 | Kecamatan | Input manual kecamatan | Ketik "Gambir" di kolom kecamatan | Data tersimpan otomatis di localStorage | PASS |
| TC-031 | Filter Kategori | Filter berdasarkan kategori | Pilih "Masjid" di dropdown filter | Hanya baris berkategori "Masjid" yang ditampilkan | PASS |
| TC-032 | Kategori Export | Kategori masuk ke Excel | Export data dengan kategori terisi | Kolom Kategori berisi nilai yang diisi user | PASS |

## Phase 3 — WebGIS Enhancement

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-033 | Map | Marker status VALID | Proses URL valid | Marker berwarna hijau (#10b981) | PASS |
| TC-034 | Map | Marker status DUPLIKAT | Proses URL duplikat | Marker berwarna ungu (#8b5cf6) | PASS |
| TC-035 | Map | Marker GEOCODING_FAILED | Geocoding gagal | Marker berwarna merah (#ef4444) | PASS |
| TC-036 | Map | Popup lengkap | Klik marker di peta | Popup menampilkan: Nama, Kategori, Kecamatan, Alamat, Lat, Lng, Tanggal, Status, Link Maps | PASS |
| TC-037 | Map | Popup XSS safe | Data mengandung `<script>alert(1)</script>` | Tag tidak dieksekusi, karakter di-escape | PASS |
| TC-038 | Map | Invalid coord tidak di-plot | INVALID_COORDINATE record | Tidak ada marker di peta untuk record tersebut | PASS |
| TC-039 | Map | Sinkronisasi filter | Filter kategori/status — peta update | Marker sinkron dengan hasil filter tabel | PASS |
| TC-039.1 | Map | Initial state | Buka app, filter = "Semua Kategori" | Semua marker dan baris tampil | PASS |
| TC-039.2 | Map | Single category filter | Pilih "Fasilitas Umum" → hanya Monas tampil | Tabel: 1 baris. Map: 1 marker. | PASS |
| TC-039.3 | Map | Category switching | Ganti ke "Kantor" → Gedung Sate tampil | Marker lama bersih, marker baru tepat | PASS |
| TC-039.4 | Map | Reset filter | Pilih "Semua Kategori" | Semua record/marker kembali tampil | PASS |
| TC-039.5 | Map | Search + category | Kombinasi search dan filter aktif | Tabel dan peta menggunakan dataset intersection | PASS (code audit) |
| TC-039.6 | Map | Invalid coordinate | Record tanpa lat/lng valid | Tetap tampil di tabel; tidak ada marker; tidak crash | PASS (code audit) |
| TC-039.7 | Map | Duplicate record | Record status DUPLIKAT difilter per kategori | Filter bekerja; marker ungu; data tidak hilang | PASS (code audit) |
| TC-039.8 | Map | Popup content | Klik marker "Kantor" | Popup: Nama=Gedung Sate, Kategori=Kantor, data akurat | PASS |
| TC-039.9 | Map | Sorting + filter | Sort kolom saat filter aktif | Filter tetap aktif; map tidak berubah filter | PASS (code audit) |
| TC-039.10 | Export | Export scope | Export saat filter aktif | Export seluruh dataset (tidak difilter) — desain by intention | NOT APPLICABLE |
| TC-039.11 | Map | Rapid filter change | Ganti filter berulang cepat | Tidak ada marker duplikat; tidak ada JS error | PASS |
| TC-039.12 | Storage | LocalStorage persist | Reload halaman setelah set kategori | Data tetap tersimpan; filter bisa diaktifkan kembali | PASS |
| TC-039.13 | Responsive | Mobile filter | Gunakan filter di viewport mobile | Dropdown dapat digunakan; peta update | PASS (code audit) |


## Phase 3 — Storage & Security

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-040 | Storage | Quota Exceeded | localStorage penuh (simulasi) | Toast error muncul, aplikasi tidak crash | PASS (code review) |
| TC-041 | Storage | Migration data lama | Data lama format `{name, lat, lng}` dimuat | Berhasil dimigrasikan ke format baru | PASS |
| TC-042 | Security | API Key tidak di export | Export Excel/GeoJSON/KML | Tidak ada field API Key di file export | PASS |
| TC-043 | Security | API Key tidak di console | Proses URL | API Key tidak muncul di console.log | PASS |

## Phase 3 — Responsive

| ID | Modul | Skenario | Input / Aksi | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-044 | Responsive | Desktop (1280px) | Buka di browser 1280px | Layout 2 kolom (form kiri, tabel kanan) | PASS |
| TC-045 | Responsive | Tablet (768px) | Resize ke 768px | Layout berubah menjadi 1 kolom | PASS |
| TC-046 | Responsive | Mobile (375px) | Resize ke 375px | UI masih usable, tombol dapat diklik | PASS |
