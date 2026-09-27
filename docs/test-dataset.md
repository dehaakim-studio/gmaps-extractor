# Dataset Pengujian Pipeline — Phase 3N

**Tujuan:** Dataset ini digunakan untuk menguji pipeline ekstraksi dan pengolahan data geospasial.
Data berikut adalah **data pengujian**, bukan data lapangan nyata.

---

## Format Dataset

| # | URL | Expected Extraction | Expected Status | Catatan |
|---|-----|---------------------|-----------------|---------|
| 1 | `https://www.google.com/maps/place/Monas/@-6.1753924,106.8271528,15z` | lat=-6.1753924, lng=106.8271528 | VALID | URL valid @lat,lng |
| 2 | `https://www.google.com/maps/place/Gedung+Sate/@-6.9024831,107.6189212,15z` | lat=-6.9024831, lng=107.6189212 | VALID | URL valid @lat,lng |
| 3 | `https://www.google.com/maps/place/Borobudur+Temple/data=!3d-7.6079!4d110.2038` | lat=-7.6079, lng=110.2038 | VALID | URL valid !3d/!4d |
| 4 | `https://www.google.com/maps/place/Prambanan/data=!3d-7.7520!4d110.4913` | lat=-7.7520, lng=110.4913 | VALID | URL valid !3d/!4d |
| 5 | `https://maps.app.goo.gl/invalid` | - | INVALID_URL / EXTRACTION_FAILED | URL pendek tidak valid |
| 6 | `https://www.tokopedia.com/product/123` | - | INVALID_URL | Bukan URL Google Maps |
| 7 | ` ` (kosong) | - | INVALID_URL | Input kosong ditolak |
| 8 | `https://www.google.com/maps/place/Monas/@-6.1753924,106.8271528,15z` | duplicate | DUPLIKAT | URL persis sama dengan #1 |
| 9 | `https://www.google.com/maps/place/Tugu+Yogya/@-7.7828,110.3671,15z` | lat=-7.7828, lng=110.3671 | VALID | URL valid @lat,lng |
| 10 | `https://www.google.com/maps/place/DPRD+Jateng/@-7.0030,110.4005,15z` | lat=-7.0030, lng=110.4005 | VALID | URL valid @lat,lng |
| 11 | `https://www.google.com/maps/place/TestLocation/@-999.0,200.0,15z` | lat=-999, lng=200 | INVALID_COORDINATE | Koordinat out-of-range |
| 12 | `https://www.google.com/maps/@-6.1753930,106.8271530,15z` | lat=-6.1753930, lng=106.8271530 | DUPLIKAT | Berjarak <10m dari #1 |
| 13 | Geocoding success | alamat terbaca | VALID | API Key valid memberikan alamat |
| 14 | Geocoding failed | alamat kosong, koordinat tetap ada | GEOCODING_FAILED | API Key tidak valid atau timeout |
| 15 | Batch 5 URL campuran (#1,#2,#5,#6,#11) | 2 VALID, 1 INVALID_URL, 1 INVALID_URL, 1 INVALID_COORDINATE | - | Batch tidak berhenti saat satu gagal |
| 16 | Data tanpa nama tempat | nama_tempat = "Tidak ditemukan" | VALID/GEOCODING_FAILED | Nama fallback digunakan |
| 17 | Data tanpa alamat (geocoding fail) | alamat kosong, status GEOCODING_FAILED | GEOCODING_FAILED | Koordinat tetap disimpan |
| 18 | Kategori diisi manual | kategori = "Masjid" | - | Dropdown Kategori berfungsi |
| 19 | Kecamatan diisi manual | kecamatan = "Kecamatan Gambir" | - | Input Kecamatan berfungsi |
| 20 | Export GeoJSON | coordinates = [lng, lat] (RFC 7946) | - | Urutan koordinat benar |

---

## Cara Penggunaan

1. Jalankan aplikasi di `http://localhost:8000`
2. Masukkan API Key (dapat menggunakan dummy untuk test non-geocoding)
3. Masukkan URL dari tabel di atas ke textarea
4. Klik **Proses Link**
5. Verifikasi hasil sesuai kolom "Expected Status"

---

## Catatan

- Data ini adalah **test fixture** — bukan data survei lapangan.
- Koordinat Monas: -6.1753924, 106.8271528 (sumber: Google Maps publik).
- Koordinat Borobudur: -7.6079, 110.2038 (sumber: Google Maps publik).
- Data #12 sengaja dibuat berjarak <10 meter dari #1 untuk menguji Haversine.
- Untuk test geocoding, gunakan API Key Google Maps yang valid.
