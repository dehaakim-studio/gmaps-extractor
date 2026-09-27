# Dokumentasi Arsitektur — Sistem Ekstraksi Data Geospasial

Aplikasi ini merupakan single-page application (SPA) berbasis web tanpa backend yang memproses ekstraksi URL Google Maps menjadi data lokasi terstruktur. Aplikasi ini dirancang menggunakan arsitektur modular murni berbasis Vanilla JavaScript.

## 1. Flow Diagram Pipeline Utama

Proses ekstraksi bekerja sebagai sebuah *Pipeline* linier di mana kegagalan pada satu tahap tidak menghentikan keseluruhan program (terutama saat batch processing), melainkan memberikan `status` pada data.

```text
       User (Browser)
             │
             ▼
     Input URL (Batch / Single)
             │
             ▼
[ validation.js ] ──► Validasi Format URL (Tolak shortlink)
             │
             ▼
[ extractor.js ]  ──► Ekstraksi Regex (Nama Tempat, !3d/!4d, @lat,lng)
             │
             ▼
[ validation.js ] ──► Validasi Koordinat (Rentang Geospasial: ±90, ±180)
             │
             ▼
[ geocoding.js ]  ──► Reverse Geocoding (Google Maps API / DistanceMatrix API)
             │        (Menggunakan Timeout & LocalStorage Cache)
             ▼
[ duplicate.js ]  ──► Duplicate Detection (Haversine Formula < 10m, String Match)
             │
             ▼
[ storage.js ]    ──► Format Standardisasi Data & Penyimpanan ke LocalStorage
             │
             ▼
 ┌───────────┼───────────┐
 ▼           ▼           ▼
Table      WebGIS      Export
(ui.js)   (map.js)   (export.js)
```

## 2. Struktur Modul & Tanggung Jawab (Separation of Concerns)

Sistem ini memecah *monolithic script* menjadi 8 modul utama:

### A. `app.js` (Orchestrator)
Bertindak sebagai *Controller* utama. 
- Menginisialisasi aplikasi.
- Mengatur *Event Listeners* DOM.
- Menjalankan pipeline `processSingleURL()`.
- Menjaga state global (`tableData` dan `archiveData`).
- Menjalankan loop pada fitur *batch processing*.

### B. `validation.js`
Menangani validasi input sebelum diproses dan menetapkan konstanta `STATUS`.
- `validateGmapsURL()`: Memastikan tidak ada format `maps.app.goo.gl` (shortlink) atau URL kosong.
- `isValidCoordinate(lat, lng)`: Menjaga integritas matematis bumi (Lat: ±90, Lng: ±180).
- `validateLocationData()`: Menentukan status awal (contoh: `EXTRACTION_FAILED`, `INVALID_COORDINATE`).
- `escapeHTML()`: Keamanan sistem terhadap *Cross-Site Scripting (XSS)* saat merender data DOM.

### C. `extractor.js`
Menangani pemrosesan string menggunakan *Regular Expression* murni tanpa manipulasi DOM.
- `extractPlaceName()`
- `extractCoordinates()`
- `buildCleanLink()`: Konversi Place ID menjadi format *Hex to Decimal* (CID) Google Maps standar.

### D. `geocoding.js`
Bertanggung jawab dalam komunikasi jaringan ke external API.
- Request via `fetch` dengan pengamanan *Timeout* dan *AbortController*.
- Fallback caching menggunakan LocalStorage untuk mencegah limit exhaustion.
- Mengubah response menjadi alamat string atau status error `GEOCODING_FAILED`.

### E. `duplicate.js`
Pusat algoritma matematis dan deteksi duplikasi data geospasial.
- **Identical URL Match**: Cek duplikat link persis.
- **Normalized String Match**: Cek duplikat nama tempat.
- **Haversine Formula**: Cek kedekatan spasial dua titik dalam radius toleransi (secara default < 10 meter). Menghindari double marker di WebGIS.

### F. `storage.js`
Berperan sebagai *Data Access Object (DAO)* ke `LocalStorage` klien.
- `createLocationRecord()`: Mendefinisikan struktur model data yang solid dan tunggal *(Single Source of Truth)* yang terdiri atas: `id`, `nama_tempat`, `kategori`, `kecamatan`, `alamat`, `link_google_maps`, `latitude`, `longitude`, `status`, dan `tanggal`.
- Bertanggung jawab melakukan konversi atau migrasi apabila ada data dengan format lama.

### G. `map.js`
Modul spesifik *WebGIS* menggunakan Leaflet.js.
- Hanya bergantung pada data valid (`STATUS.VALID` atau `GEOCODING_FAILED` asalkan titik koordinatnya masuk akal).
- `buildPopupContent()`: Merender informasi detail popup.

### H. `export.js`
Menangani konversi format dan pengunduhan *(blob download)*.
- **Excel**: Menggunakan `SheetJS`.
- **GeoJSON**: Ekspor standar Spasial GIS, mempertahankan hierarki koordinat spesifikasi RFC 7946 `[longitude, latitude]`.
- **KML**: Ekspor format XML GIS (digunakan Google Earth).
- **Excel to KML Converter**: Algoritma mandiri yang membaca array Excel, mendeteksi kolom (Nama, Lat, Lng) dari header baris pertama, dan membuat KML secara *client-side*.

### I. `ui.js`
Bertugas secara eksklusif untuk rendering DOM.
- Merender tabel dengan dukungan fitur `search` (pencarian), `filter` (berdasarkan status), dan `sorting`.
- `updateStats()`: Mengkalkulasi jumlah total data, valid, invalid, dan duplikat secara real-time.
- `showToast()` dan `showLoader()`.

## 3. Konsep Single Source of Truth
Seluruh rendering UI (Tabel, Peta, Dashboard Statistik, dan Export) **bersumber dari satu objek array yang sama** (yaitu `tableData` atau `archiveData` di memory).
Artinya, ketika tabel difilter, map tetap memiliki relasi yang terjamin pada *identifier* (id) data, mencegah inkonsistensi yang umum terjadi di mana data tabel berubah tapi poin di web map tertinggal atau sebaliknya.
