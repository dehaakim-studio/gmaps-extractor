/**
 * storage.js
 * Modul Penyimpanan — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Simpan dan muat data dari LocalStorage
 * - Manajemen struktur data yang konsisten
 * - Migrasi/backward compatibility data lama
 * - Pembuatan ID unik per entri data
 *
 * TIDAK menangani map atau rendering.
 */

'use strict';

// ─────────────────────────────────────────────
// KUNCI LOCALSTORAGE
// ─────────────────────────────────────────────

const STORAGE_KEYS = {
  TABLE_DATA: 'gmaps_table_data',
  ARCHIVE_DATA: 'gmaps_archive_data',
  API_KEY: 'gmaps_api_key',
  THEME: 'app-theme',
  SETTINGS: 'gmaps_app_settings',
};

// ─────────────────────────────────────────────
// STRUKTUR DATA STANDAR
// ─────────────────────────────────────────────

/**
 * Membuat objek lokasi baru dengan struktur yang terstandardisasi.
 * Field 'kategori' dan 'kecamatan' dibiarkan kosong — diisi oleh user secara manual.
 *
 * @param {object} raw - Data mentah dari ekstraksi/geocoding
 * @returns {object} Objek lokasi terstruktur
 */
function createLocationRecord(raw) {
  return {
    id: raw.id || generateId(),
    nama_tempat: raw.nama_tempat || raw.name || 'Tidak ditemukan',
    kategori: raw.kategori || '',
    kecamatan: raw.kecamatan || '',
    alamat: raw.alamat || raw.address || '',
    link_google_maps: raw.link_google_maps || raw.link || '',
    latitude: raw.latitude || raw.lat || '',
    longitude: raw.longitude || raw.lng || '',
    status: raw.status || STATUS.VALID,
    tanggal: raw.tanggal || raw.date || new Date().toLocaleString('id-ID'),
  };
}

/**
 * Menghasilkan ID unik berbasis timestamp dan random string.
 * @returns {string}
 */
function generateId() {
  return `loc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// ─────────────────────────────────────────────
// MIGRASI DATA LAMA
// ─────────────────────────────────────────────

/**
 * Memigrasikan entri data lama (format lama) ke format standar baru.
 * Menjaga backward compatibility — data lama tidak hilang.
 * Field lama: { name, address, link, lat, lng, status, date }
 * Field baru: { id, nama_tempat, kategori, kecamatan, alamat, link_google_maps, latitude, longitude, status, tanggal }
 *
 * @param {object} item - Satu entri data (bisa lama atau baru)
 * @returns {object} Entri data format standar baru
 */
function migrateRecord(item) {
  if (!item) return null;

  // Jika sudah format baru (ada field 'id' dan 'nama_tempat')
  if (item.id && item.nama_tempat !== undefined) return item;

  // Migrasikan dari format lama
  return {
    id: generateId(),
    nama_tempat: item.nama_tempat || item.name || 'Tidak ditemukan',
    kategori: item.kategori || '',
    kecamatan: item.kecamatan || '',
    alamat: item.alamat || item.address || '',
    link_google_maps: item.link_google_maps || item.link || '',
    latitude: item.latitude || item.lat || '',
    longitude: item.longitude || item.lng || '',
    status: item.status || STATUS.VALID,
    tanggal: item.tanggal || item.date || '-',
  };
}

// ─────────────────────────────────────────────
// OPERASI LOCALSTORAGE
// ─────────────────────────────────────────────

/**
 * Menyimpan data ke LocalStorage secara aman.
 * @param {string} key
 * @param {*} data
 */
function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('[storage] Gagal menyimpan data:', key, e);
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      if (typeof showToast === 'function') {
        showToast('Memori browser penuh! Sebagian data mungkin tidak tersimpan.', 'error');
      }
    }
  }
}

/**
 * Memuat data dari LocalStorage secara aman.
 * Mengembalikan null jika data rusak/tidak ada.
 * @param {string} key
 * @returns {*|null}
 */
function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[storage] Gagal memuat data (mungkin korup):', key, e);
    return null;
  }
}

// ─────────────────────────────────────────────
// API PENYIMPANAN DATA UTAMA
// ─────────────────────────────────────────────

/**
 * Memuat data tabel dari LocalStorage dan memigrasikannya ke format baru.
 * @returns {Array}
 */
function loadTableData() {
  const raw = loadFromStorage(STORAGE_KEYS.TABLE_DATA);
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateRecord).filter(Boolean);
}

/**
 * Menyimpan data tabel ke LocalStorage.
 * @param {Array} data
 */
function saveTableData(data) {
  saveToStorage(STORAGE_KEYS.TABLE_DATA, data);
}

/**
 * Memuat data arsip dari LocalStorage dan memigrasikannya ke format baru.
 * @returns {Array}
 */
function loadArchiveData() {
  const raw = loadFromStorage(STORAGE_KEYS.ARCHIVE_DATA);
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateRecord).filter(Boolean);
}

/**
 * Menyimpan data arsip ke LocalStorage.
 * @param {Array} data
 */
function saveArchiveData(data) {
  saveToStorage(STORAGE_KEYS.ARCHIVE_DATA, data);
}

/**
 * Memuat API Key dari LocalStorage.
 * @returns {string}
 */
function loadApiKey() {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
}

/**
 * Menyimpan API Key ke LocalStorage.
 * @param {string} key
 */
function saveApiKey(key) {
  if (key) {
    try {
      localStorage.setItem(STORAGE_KEYS.API_KEY, key);
    } catch (e) {
      console.error('[storage] Gagal menyimpan API Key:', e);
    }
  }
}

/**
 * Menghapus API Key dari LocalStorage.
 */
function removeApiKey() {
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
}

/**
 * Memuat pengaturan aplikasi dari LocalStorage.
 * @returns {object}
 */
function loadAppSettings() {
  const defaultSettings = {
    showKategori: true,
    showKecamatan: true,
    categories: ['Masjid', 'Mushola', 'Sekolah', 'Kantor', 'Fasilitas Umum', 'Tempat Usaha', 'Lainnya']
  };
  const saved = loadFromStorage(STORAGE_KEYS.SETTINGS);
  if (!saved || typeof saved !== 'object') return defaultSettings;
  return {
    showKategori: typeof saved.showKategori === 'boolean' ? saved.showKategori : true,
    showKecamatan: typeof saved.showKecamatan === 'boolean' ? saved.showKecamatan : true,
    categories: Array.isArray(saved.categories) && saved.categories.length > 0 ? saved.categories : defaultSettings.categories
  };
}

/**
 * Menyimpan pengaturan aplikasi ke LocalStorage.
 * @param {object} settings
 */
function saveAppSettings(settings) {
  saveToStorage(STORAGE_KEYS.SETTINGS, settings);
}
