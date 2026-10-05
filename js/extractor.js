/**
 * extractor.js
 * Modul Ekstraksi — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Ekstraksi nama tempat dari URL Google Maps
 * - Ekstraksi koordinat (latitude, longitude) dari URL Google Maps
 * - Mendukung format: !3d/!4d dan @lat,lng
 * - Konstruksi clean link (CID-based)
 *
 * TIDAK menangani UI, geocoding, atau penyimpanan data.
 */

'use strict';

// ─────────────────────────────────────────────
// EKSTRAKSI NAMA TEMPAT
// ─────────────────────────────────────────────

/**
 * Mengekstrak nama tempat dan alamat dari URL Google Maps melalui pola /place/NAMA_TEMPAT/
 * @param {string} url
 * @returns {{ name: string, addressFromUrl: string|null }}
 */
function extractPlaceNameAndAddress(url) {
  if (!url) return { name: 'Tidak ditemukan', addressFromUrl: null };
  const nameMatch = url.match(/\/place\/([^\/]+)\//);
  if (nameMatch) {
    let decoded = '';
    try {
      decoded = decodeURIComponent(nameMatch[1].replace(/\+/g, ' '));
    } catch (e) {
      decoded = nameMatch[1].replace(/\+/g, ' ');
    }
    
    // Pisahkan nama dan alamat berdasarkan koma pertama
    const parts = decoded.split(',');
    if (parts.length > 1) {
      const name = parts[0].trim();
      const addressFromUrl = parts.slice(1).join(',').trim();
      return { name, addressFromUrl };
    }
    return { name: decoded.trim(), addressFromUrl: null };
  }
  return { name: 'Tidak ditemukan', addressFromUrl: null };
}

// ─────────────────────────────────────────────
// EKSTRAKSI KOORDINAT
// ─────────────────────────────────────────────

/**
 * Mengekstrak latitude dari URL Google Maps.
 * Prioritas:
 *   1. Format !3d<lat>     → koordinat tempat (paling akurat)
 *   2. Format ll=<lat>,<lng> → dari query param
 *   3. Format @<lat>,<lng>  → viewport kamera (kurang akurat, last resort)
 * @param {string} url
 * @returns {string|null} String latitude atau null jika tidak ditemukan.
 */
function extractLatitude(url) {
  if (!url) return null;
  // Format 1: !3dLATITUDE — koordinat place yang presisi
  const latMatch = url.match(/!3d(-?\d+\.\d+)/);
  if (latMatch) return latMatch[1];
  // Format 2: query param ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return llMatch[1];
  // Format 3: @lat,lng (viewport kamera — last resort, bisa tidak akurat)
  const viewportMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (viewportMatch) return viewportMatch[1];
  return null;
}

/**
 * Mengekstrak longitude dari URL Google Maps.
 * Prioritas:
 *   1. Format !4d<lng>     → koordinat tempat (paling akurat)
 *   2. Format ll=<lat>,<lng> → dari query param
 *   3. Format @<lat>,<lng>  → viewport kamera (kurang akurat, last resort)
 * @param {string} url
 * @returns {string|null} String longitude atau null jika tidak ditemukan.
 */
function extractLongitude(url) {
  if (!url) return null;
  // Format 1: !4dLONGITUDE — koordinat place yang presisi
  const lngMatch = url.match(/!4d(-?\d+\.\d+)/);
  if (lngMatch) return lngMatch[1];
  // Format 2: query param ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return llMatch[1];
  // Format 3: @lat,lng (viewport kamera — last resort, bisa tidak akurat)
  const viewportMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (viewportMatch) return viewportMatch[2];
  return null;
}

/**
 * Mendeteksi apakah koordinat yang diekstrak berasal dari viewport (@)
 * sehingga caller bisa memberi peringatan akurasi rendah.
 * @param {string} url
 * @returns {boolean}
 */
function isCoordFromViewport(url) {
  if (!url) return false;
  const has3d = /!3d(-?\d+\.\d+)/.test(url);
  const hasLl = /[?&]ll=(-?\d+\.\d+)/.test(url);
  return !has3d && !hasLl;
}

/**
 * Mengekstrak pasangan koordinat dari URL Google Maps.
 * @param {string} url
 * @returns {{ lat: string|null, lng: string|null, fromViewport: boolean }}
 */
function extractCoordinates(url) {
  return {
    lat: extractLatitude(url),
    lng: extractLongitude(url),
    fromViewport: isCoordFromViewport(url),
  };
}

// ─────────────────────────────────────────────
// KONSTRUKSI LINK BERSIH
// ─────────────────────────────────────────────

/**
 * Membuat "clean link" dari URL Google Maps.
 * (Fitur konversi CID dinonaktifkan sementara karena Google Maps sering menyertakan CID dari pencarian sebelumnya, yang memicu duplikat link palsu).
 * @param {string} url
 * @returns {string}
 */
function buildCleanLink(url) {
  if (!url) return url;
  return url.trim();
}

// ─────────────────────────────────────────────
// MAIN EXTRACTOR
// ─────────────────────────────────────────────

/**
 * Mengekstrak seluruh data penting dari satu URL Google Maps.
 * Mengembalikan objek mentah sebelum divalidasi atau di-geocode.
 * @param {string} url - URL Google Maps panjang
 * @returns {{
 *   name: string,
 *   lat: string|null,
 *   lng: string|null,
 *   cleanLink: string,
 *   fromViewport: boolean,
 *   addressFromUrl: string|null
 * }}
 */
function parseGmapsURL(url) {
  const { name, addressFromUrl } = extractPlaceNameAndAddress(url);
  const { lat, lng, fromViewport } = extractCoordinates(url);
  const cleanLink = buildCleanLink(url);
  return { name, lat, lng, cleanLink, fromViewport, addressFromUrl };
}
