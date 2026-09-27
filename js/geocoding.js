/**
 * geocoding.js
 * Modul Reverse Geocoding — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Melakukan reverse geocoding dari koordinat ke alamat
 * - Mendukung Google Maps API dan DistanceMatrix.ai API
 * - Caching hasil geocoding ke LocalStorage
 * - Penanganan error, timeout, dan fallback
 * - Rate-limit awareness (delay antar request)
 *
 * TIDAK menangani UI rendering atau penyimpanan data utama.
 */

'use strict';

// ─────────────────────────────────────────────
// KONFIGURASI
// ─────────────────────────────────────────────

const GEOCODING_CACHE_PREFIX = 'addr_exact_';
const GEOCODING_TIMEOUT_MS = 8000; // 8 detik timeout per request

// ─────────────────────────────────────────────
// CACHING
// ─────────────────────────────────────────────

/**
 * Membuat cache key dari koordinat.
 * @param {string} lat
 * @param {string} lng
 * @returns {string}
 */
function makeGeoCacheKey(lat, lng) {
  return `${GEOCODING_CACHE_PREFIX}${lat}_${lng}`;
}

/**
 * Membaca hasil geocoding dari cache LocalStorage.
 * @param {string} lat
 * @param {string} lng
 * @returns {string|null} Alamat dari cache, atau null jika tidak ada.
 */
function getGeocodeCache(lat, lng) {
  try {
    return localStorage.getItem(makeGeoCacheKey(lat, lng));
  } catch (e) {
    return null;
  }
}

/**
 * Menyimpan hasil geocoding ke cache LocalStorage.
 * @param {string} lat
 * @param {string} lng
 * @param {string} address
 */
function setGeocodeCache(lat, lng, address) {
  try {
    localStorage.setItem(makeGeoCacheKey(lat, lng), address);
  } catch (e) {
    // LocalStorage mungkin penuh; abaikan tanpa crash
    console.warn('[geocoding] Gagal menyimpan cache:', e);
  }
}

// ─────────────────────────────────────────────
// HTTP REQUEST DENGAN TIMEOUT
// ─────────────────────────────────────────────

/**
 * Fetch dengan batas waktu (timeout).
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs = GEOCODING_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────
// KONSTRUKSI URL GEOCODING
// ─────────────────────────────────────────────

/**
 * Membangun URL endpoint geocoding berdasarkan tipe API Key.
 * - AIza... → Google Maps Geocoding API
 * - Lainnya → DistanceMatrix.ai API
 * @param {string} lat
 * @param {string} lng
 * @param {string} apiKey
 * @returns {string}
 */
function buildGeocodeURL(lat, lng, apiKey) {
  if (apiKey.startsWith('AIza')) {
    return `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
  }
  return `https://api.distancematrix.ai/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
}

// ─────────────────────────────────────────────
// MAIN GEOCODING FUNCTION
// ─────────────────────────────────────────────

/**
 * Melakukan reverse geocoding dari koordinat ke alamat.
 * Menggunakan cache jika tersedia. Menangani error secara aman.
 *
 * @param {string} lat - Latitude sebagai string
 * @param {string} lng - Longitude sebagai string
 * @param {string} apiKey - API Key (Google atau DistanceMatrix)
 * @returns {Promise<{ address: string, status: string, fromCache: boolean }>}
 *   - address: Alamat hasil geocoding
 *   - status: 'VALID' | 'GEOCODING_FAILED'
 *   - fromCache: true jika alamat dari cache
 */
async function reverseGeocode(lat, lng, apiKey) {
  // Cek cache terlebih dahulu
  const cached = getGeocodeCache(lat, lng);
  if (cached) {
    return { address: cached, status: STATUS.VALID, fromCache: true };
  }

  // Jika tidak ada cache, lakukan request
  const geocodeUrl = buildGeocodeURL(lat, lng, apiKey);

  try {
    const response = await fetchWithTimeout(geocodeUrl);

    if (!response.ok) {
      return {
        address: `Gagal terhubung ke API (HTTP ${response.status}).`,
        status: STATUS.GEOCODING_FAILED,
        fromCache: false,
      };
    }

    const geoData = await response.json();
    const resultsArr = geoData.results || geoData.result;

    if (geoData.status === 'OK') {
      let address = 'Alamat tidak ditemukan.';
      if (resultsArr && resultsArr.length > 0) {
        address = resultsArr[0].formatted_address;
      } else if (geoData.formatted_address) {
        address = geoData.formatted_address;
      }
      setGeocodeCache(lat, lng, address);
      return { address, status: STATUS.VALID, fromCache: false };
    }

    if (geoData.status === 'REQUEST_DENIED') {
      return {
        address: 'API Key tidak valid atau limit tercapai.',
        status: STATUS.GEOCODING_FAILED,
        fromCache: false,
      };
    }

    if (geoData.status === 'ZERO_RESULTS') {
      return {
        address: 'Alamat tidak ditemukan untuk koordinat ini.',
        status: STATUS.GEOCODING_FAILED,
        fromCache: false,
      };
    }

    return {
      address: `Geocoding gagal: ${geoData.status || 'status tidak diketahui'}.`,
      status: STATUS.GEOCODING_FAILED,
      fromCache: false,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        address: 'Permintaan geocoding melebihi batas waktu (timeout).',
        status: STATUS.GEOCODING_FAILED,
        fromCache: false,
      };
    }
    console.error('[geocoding] Error:', err);
    return {
      address: 'Gagal terhubung ke server geocoding.',
      status: STATUS.GEOCODING_FAILED,
      fromCache: false,
    };
  }
}
