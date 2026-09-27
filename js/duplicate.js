/**
 * duplicate.js
 * Modul Deteksi Duplikat — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Deteksi duplikat berdasarkan URL (exact match)
 * - Deteksi duplikat berdasarkan nama tempat (normalized string match)
 * - Deteksi duplikat berdasarkan jarak koordinat (algoritma Haversine)
 * - Mengembalikan alasan duplikat jika terdeteksi
 *
 * TIDAK menangani DOM atau penyimpanan.
 */

'use strict';

// ─────────────────────────────────────────────
// KONFIGURASI
// ─────────────────────────────────────────────

/** Threshold jarak (dalam meter) untuk mendeteksi duplikat koordinat */
const DUPLICATE_DISTANCE_THRESHOLD_METERS = 10;

// ─────────────────────────────────────────────
// ALGORITMA HAVERSINE
// ─────────────────────────────────────────────

/**
 * Menghitung jarak antara dua titik koordinat menggunakan Formula Haversine.
 * Formula ini memperhitungkan kelengkungan permukaan bumi (radius 6371 km).
 *
 * @param {number} lat1 - Latitude titik 1 (derajat)
 * @param {number} lon1 - Longitude titik 1 (derajat)
 * @param {number} lat2 - Latitude titik 2 (derajat)
 * @param {number} lon2 - Longitude titik 2 (derajat)
 * @returns {number} Jarak dalam meter
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius bumi dalam meter
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─────────────────────────────────────────────
// NORMALISASI STRING & HELPER
// ─────────────────────────────────────────────

/**
 * Menormalisasi string untuk perbandingan (lowercase, hanya alfanumerik).
 * @param {string} str
 * @returns {string}
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Memeriksa apakah nama merupakan placeholder (nama default/tidak valid)
 * yang tidak boleh digunakan untuk mencocokkan duplikat nama.
 * @param {string} name
 * @returns {boolean}
 */
function isPlaceholderName(name) {
  if (!name) return true;
  const norm = normalizeString(name);
  if (!norm) return true;
  const placeholders = [
    'tidakditemukan',
    'tanpanama',
    'tidakadanama',
    'unnamedlocation',
    'unknown',
    'null',
    'undefined'
  ];
  return placeholders.includes(norm);
}

// ─────────────────────────────────────────────
// PENGECEKAN DUPLIKAT
// ─────────────────────────────────────────────

/**
 * Memeriksa apakah suatu lokasi sudah ada berdasarkan URL yang identik.
 * @param {string} link - Link lokasi baru
 * @param {Array} existingData - Array data yang sudah ada
 * @param {string} [currentId] - ID entri yang sedang diperiksa (untuk mengabaikan diri sendiri)
 * @returns {{ isDuplicate: boolean, reason: string }}
 */
function checkDuplicateByLink(link, existingData, currentId = null) {
  if (!link || typeof link !== 'string' || !link.trim() || link === '-' || link === 'Tidak ditemukan' || !Array.isArray(existingData)) {
    return { isDuplicate: false, reason: '' };
  }

  const found = existingData.find(item => {
    if (currentId && String(item.id) === String(currentId)) return false;
    const itemLink = item.link_google_maps || item.link;
    return itemLink && itemLink === link;
  });

  if (found) {
    return {
      isDuplicate: true,
      reason: `Link duplikat dengan: ${found.nama_tempat || found.name || 'data yang sudah ada'}.`,
    };
  }
  return { isDuplicate: false, reason: '' };
}

/**
 * Memeriksa apakah suatu lokasi sudah ada berdasarkan nama tempat yang sama (normalized).
 * Abaikan nama placeholder seperti 'Tidak ditemukan'.
 * @param {string} name - Nama tempat baru
 * @param {Array} existingData - Array data yang sudah ada
 * @param {string} [currentId] - ID entri yang sedang diperiksa
 * @returns {{ isDuplicate: boolean, reason: string }}
 */
function checkDuplicateByName(name, existingData, currentId = null) {
  if (!name || isPlaceholderName(name) || !Array.isArray(existingData)) {
    return { isDuplicate: false, reason: '' };
  }

  const normNew = normalizeString(name);
  if (!normNew) return { isDuplicate: false, reason: '' };

  const found = existingData.find(item => {
    if (currentId && String(item.id) === String(currentId)) return false;
    const itemName = item.nama_tempat || item.name || '';
    if (isPlaceholderName(itemName)) return false;
    return normalizeString(itemName) === normNew;
  });

  if (found) {
    return {
      isDuplicate: true,
      reason: `Nama tempat identik dengan: ${found.nama_tempat || found.name}.`,
    };
  }
  return { isDuplicate: false, reason: '' };
}

/**
 * Memeriksa apakah suatu lokasi sudah ada berdasarkan jarak koordinat (Haversine).
 * Threshold: < DUPLICATE_DISTANCE_THRESHOLD_METERS meter.
 * @param {string|number} lat - Latitude baru
 * @param {string|number} lng - Longitude baru
 * @param {Array} existingData - Array data yang sudah ada
 * @param {string} [currentId] - ID entri yang sedang diperiksa
 * @returns {{ isDuplicate: boolean, reason: string, distanceM: number }}
 */
function checkDuplicateByDistance(lat, lng, existingData, currentId = null) {
  if (!lat || !lng || !Array.isArray(existingData)) return { isDuplicate: false, reason: '', distanceM: -1 };

  const newLat = parseFloat(lat);
  const newLng = parseFloat(lng);

  if (isNaN(newLat) || isNaN(newLng)) return { isDuplicate: false, reason: '', distanceM: -1 };
  if (newLat === 0 && newLng === 0) return { isDuplicate: false, reason: '', distanceM: -1 };

  for (const item of existingData) {
    if (currentId && String(item.id) === String(currentId)) continue;

    const itemLat = parseFloat(item.latitude || item.lat);
    const itemLng = parseFloat(item.longitude || item.lng);

    if (isNaN(itemLat) || isNaN(itemLng) || (itemLat === 0 && itemLng === 0)) continue;

    const dist = calculateHaversineDistance(newLat, newLng, itemLat, itemLng);
    if (dist < DUPLICATE_DISTANCE_THRESHOLD_METERS) {
      return {
        isDuplicate: true,
        reason: `Jarak terlalu dekat (${dist.toFixed(1)} m < ${DUPLICATE_DISTANCE_THRESHOLD_METERS} m) dengan: ${item.nama_tempat || item.name || 'lokasi yang ada'}.`,
        distanceM: dist,
      };
    }
  }

  return { isDuplicate: false, reason: '', distanceM: -1 };
}

/**
 * Pemeriksaan duplikat lengkap: cek link, nama, dan jarak koordinat.
 * Menggabungkan ketiga metode dalam satu fungsi.
 *
 * @param {{ name: string, lat: string, lng: string, link: string, id?: string }} newItem - Data lokasi baru
 * @param {Array} tableData - Data tabel saat ini
 * @param {Array} archiveData - Data arsip (history)
 * @returns {{ isDuplicate: boolean, reason: string }}
 */
function checkDuplicate(newItem, tableData, archiveData) {
  const allData = [...(tableData || []), ...(archiveData || [])];
  const name = newItem.nama_tempat || newItem.name;
  const link = newItem.link_google_maps || newItem.link;
  const lat = newItem.latitude || newItem.lat;
  const lng = newItem.longitude || newItem.lng;
  const currentId = newItem.id || null;

  // Filter agar tidak membandingkan dengan objek yang persis sama (jika id sudah ada)
  const filteredData = currentId
    ? allData.filter(item => String(item.id) !== String(currentId))
    : allData;

  // 1. Cek berdasarkan link
  const byLink = checkDuplicateByLink(link, filteredData, currentId);
  if (byLink.isDuplicate) return byLink;

  // 2. Cek berdasarkan nama
  const byName = checkDuplicateByName(name, filteredData, currentId);
  if (byName.isDuplicate) return byName;

  // 3. Cek berdasarkan jarak (Haversine)
  const byDistance = checkDuplicateByDistance(lat, lng, filteredData, currentId);
  if (byDistance.isDuplicate) return byDistance;

  return { isDuplicate: false, reason: '' };
}
