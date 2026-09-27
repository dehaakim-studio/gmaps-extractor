/**
 * validation.js
 * Modul Validasi — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Validasi URL Google Maps
 * - Validasi koordinat geospasial
 * - Definisi konstanta status
 * - Sanitasi HTML (XSS prevention)
 */

'use strict';

// ─────────────────────────────────────────────
// KONSTANTA STATUS & KUALITAS DATA
// ─────────────────────────────────────────────

const STATUS = {
  VALID: 'VALID',
  INVALID_URL: 'INVALID_URL',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  INVALID_COORDINATE: 'INVALID_COORDINATE',
  GEOCODING_FAILED: 'GEOCODING_FAILED',
  DUPLIKAT: 'DUPLIKAT',
};

// ─────────────────────────────────────────────
// DATA NORMALIZATION
// ─────────────────────────────────────────────

/**
 * Normalisasi string: menghapus whitespace berlebih.
 * "  Masjid   Agung  " -> "Masjid Agung"
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Mengecek apakah data lokasi lengkap.
 * @param {object} record
 * @returns {boolean}
 */
function isDataComplete(record) {
  return !!(
    record.nama_tempat && record.nama_tempat !== 'Tidak ditemukan' && record.nama_tempat !== '-' &&
    record.alamat && record.alamat !== '-' &&
    record.latitude && record.latitude !== '-' &&
    record.longitude && record.longitude !== '-' &&
    record.link_google_maps && record.link_google_maps !== '-' &&
    record.status
  );
}

// ─────────────────────────────────────────────
// SANITASI
// ─────────────────────────────────────────────

/**
 * Escape karakter HTML berbahaya untuk mencegah XSS.
 * Digunakan setiap kali data dari user/API dimasukkan ke innerHTML.
 * @param {*} str - Nilai yang akan di-escape
 * @returns {string}
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') return String(str);
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[tag] || tag)
  );
}

// ─────────────────────────────────────────────
// VALIDASI KOORDINAT
// ─────────────────────────────────────────────

/**
 * Memeriksa apakah nilai latitude dan longitude berada dalam rentang valid secara geospasial.
 * Latitude: -90 hingga 90
 * Longitude: -180 hingga 180
 * @param {string|number} lat
 * @param {string|number} lng
 * @returns {boolean}
 */
function isValidCoordinate(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  return (
    !isNaN(numLat) &&
    !isNaN(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180
  );
}

// ─────────────────────────────────────────────
// VALIDASI URL
// ─────────────────────────────────────────────

/**
 * Memeriksa apakah URL adalah link Google Maps yang dapat diproses (bukan shortlink).
 * @param {string} url
 * @returns {{ valid: boolean, reason: string }}
 */
function validateGmapsURL(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { valid: false, reason: 'URL kosong.' };
  }
  if (url.includes('maps.app.goo.gl')) {
    return { valid: false, reason: 'Shortlink (maps.app.goo.gl) tidak didukung. Gunakan link panjang.' };
  }
  if (!url.includes('google.com/maps') && !url.includes('maps.google.com')) {
    return { valid: false, reason: 'URL bukan link Google Maps yang valid.' };
  }
  return { valid: true, reason: '' };
}

/**
 * Memvalidasi data lokasi yang sudah terekstrak.
 * @param {object} location - Objek lokasi dengan properti name, lat, lng
 * @returns {{ valid: boolean, status: string, reason: string }}
 */
function validateLocationData(location) {
  if (!location) {
    return { valid: false, status: STATUS.INVALID_URL, reason: 'Data lokasi tidak tersedia.' };
  }

  const hasName = location.name && location.name !== 'Tidak ditemukan';
  const hasLat = location.lat && location.lat !== 'Tidak ditemukan';
  const hasLng = location.lng && location.lng !== 'Tidak ditemukan';

  if (!hasName && !hasLat) {
    return { valid: false, status: STATUS.INVALID_URL, reason: 'Format link tidak dikenali.' };
  }

  if (hasLat && hasLng && !isValidCoordinate(location.lat, location.lng)) {
    return { valid: false, status: STATUS.INVALID_COORDINATE, reason: 'Koordinat di luar rentang valid.' };
  }

  if (!hasLat || !hasLng) {
    return { valid: false, status: STATUS.EXTRACTION_FAILED, reason: 'Koordinat tidak dapat diekstrak dari URL.' };
  }

  return { valid: true, status: STATUS.VALID, reason: '' };
}
