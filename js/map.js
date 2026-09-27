/**
 * map.js
 * Modul WebGIS / Peta Leaflet — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Inisialisasi peta Leaflet
 * - Menambahkan marker berdasarkan data lokasi
 * - Popup berisi informasi lengkap lokasi
 * - Sinkronisasi peta dengan data aktual (single source of truth)
 * - Pembersihan layer saat batch baru
 *
 * TIDAK menangani penyimpanan data atau rendering tabel.
 */

'use strict';

// ─────────────────────────────────────────────
// STATE INTERNAL
// ─────────────────────────────────────────────

let _leafMap = null;
let _leafMarkers = null;

// ─────────────────────────────────────────────
// INISIALISASI PETA
// ─────────────────────────────────────────────

/**
 * Menginisialisasi peta Leaflet jika belum ada.
 * Merender peta pada elemen dengan id="map".
 * Menggunakan tile OpenStreetMap.
 */
function initMap() {
  if (_leafMap) return;

  const mapContainer = document.getElementById('mapContainer');
  if (mapContainer) mapContainer.style.display = 'block';

  _leafMap = L.map('map').setView([-2.5489, 118.0149], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(_leafMap);

  _leafMarkers = L.featureGroup().addTo(_leafMap);
}

// ─────────────────────────────────────────────
// POPUP CONTENT
// ─────────────────────────────────────────────

/**
 * Membangun konten HTML popup peta dari satu lokasi.
 * Semua data disanitasi sebelum dimasukkan ke HTML.
 * @param {object} location - Objek lokasi standar
 * @returns {string} HTML string
 */
function buildPopupContent(location) {
  const name = escapeHTML(location.nama_tempat || location.name || '-');
  const address = escapeHTML(location.alamat || location.address || '-');
  const lat = escapeHTML(location.latitude || location.lat || '-');
  const lng = escapeHTML(location.longitude || location.lng || '-');
  const statusVal = escapeHTML(location.status || STATUS.VALID);
  const kategori = escapeHTML(location.kategori || '-');
  const kecamatan = escapeHTML(location.kecamatan || '-');
  const tanggal = escapeHTML(location.tanggal || '-');
  const link = escapeHTML(location.link_google_maps || location.link || '#');

  const statusColor = statusVal === STATUS.VALID
    ? '#10b981'
    : (statusVal === 'DUPLIKAT' ? '#8b5cf6'
      : (statusVal.includes('FAILED') || statusVal.includes('INVALID') ? '#ef4444' : '#f59e0b'));

  return `
    <div style="font-family: 'Outfit', sans-serif; font-size: 13px; color: #1e293b; min-width: 200px; max-width: 300px;">
      <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
        📍 ${name}
      </div>
      <div style="display: grid; gap: 4px;">
        <div><span style="color: #64748b; font-weight: 500;">Kategori:</span> ${kategori}</div>
        <div><span style="color: #64748b; font-weight: 500;">Kecamatan:</span> ${kecamatan}</div>
        <div><span style="color: #64748b; font-weight: 500;">Alamat:</span> ${address}</div>
        <div><span style="color: #64748b; font-weight: 500;">Latitude:</span> ${lat}</div>
        <div><span style="color: #64748b; font-weight: 500;">Longitude:</span> ${lng}</div>
        <div><span style="color: #64748b; font-weight: 500;">Tanggal:</span> ${tanggal}</div>
        <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px;">
          <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">
            ${statusVal}
          </span>
          <a href="${link}" target="_blank" rel="noopener noreferrer" style="color: #0d9488; font-size: 0.8rem; font-weight: 600; text-decoration: none;">Buka Maps ↗</a>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// OPERASI MARKER
// ─────────────────────────────────────────────

/**
 * Menambahkan satu marker ke peta berdasarkan objek lokasi.
 * Hanya menambah marker jika koordinat valid.
 * @param {object} location - Objek lokasi standar
 */
function addMarkerFromLocation(location) {
  const lat = parseFloat(location.latitude || location.lat);
  const lng = parseFloat(location.longitude || location.lng);

  if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) return;

  initMap();

  const statusVal = location.status || STATUS.VALID;
  let markerColor = '#10b981'; // VALID: green
  if (statusVal === STATUS.DUPLIKAT) markerColor = '#8b5cf6'; // violet
  else if (statusVal === STATUS.GEOCODING_FAILED) markerColor = '#ef4444'; // red
  else if (statusVal.includes('INVALID') || statusVal.includes('FAILED')) markerColor = '#f59e0b'; // orange

  const svgIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${markerColor}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const popupContent = buildPopupContent(location);
  const marker = L.marker([lat, lng], { icon: svgIcon }).bindPopup(popupContent);
  _leafMarkers.addLayer(marker);
}

/**
 * Menambahkan marker sederhana dari koordinat mentah (untuk kompatibilitas mundur).
 * @param {number} lat
 * @param {number} lng
 * @param {string} title
 */
function addMarker(lat, lng, title) {
  if (!isValidCoordinate(lat, lng)) return;
  initMap();

  const popup = `
    <div style="font-family: 'Outfit', sans-serif; font-size: 13px; color: #333;">
      <strong style="font-size: 15px; color: #000;">${escapeHTML(String(title))}</strong><br/>
      <b>Lat/Lng:</b> ${escapeHTML(String(lat))}, ${escapeHTML(String(lng))}
    </div>
  `;
  const marker = L.marker([lat, lng]).bindPopup(popup);
  _leafMarkers.addLayer(marker);
  if (_leafMarkers.getLayers().length > 0) {
    _leafMap.fitBounds(_leafMarkers.getBounds(), { padding: [30, 30], maxZoom: 16 });
  }
}

/**
 * Menghapus seluruh marker dari peta (untuk batch baru).
 */
function clearMapMarkers() {
  if (_leafMarkers) {
    _leafMarkers.clearLayers();
  }
}

/**
 * Merender ulang seluruh marker peta dari array data.
 * Ini adalah cara utama untuk menjaga sinkronisasi: data → map.
 * @param {Array} locations - Array objek lokasi
 */
function renderMapFromData(locations) {
  if (!Array.isArray(locations)) return;
  clearMapMarkers();

  const validLocations = locations.filter(loc => {
    const lat = parseFloat(loc.latitude || loc.lat);
    const lng = parseFloat(loc.longitude || loc.lng);
    return isValidCoordinate(lat, lng);
  });

  if (validLocations.length === 0) return;

  initMap();
  validLocations.forEach(addMarkerFromLocation);

  if (_leafMarkers && _leafMarkers.getLayers().length > 0) {
    _leafMap.fitBounds(_leafMarkers.getBounds(), { padding: [30, 30], maxZoom: 16 });
  }
}

/**
 * Menyesuaikan ukuran peta jika container berubah ukuran.
 */
function invalidateMapSize() {
  if (_leafMap) {
    _leafMap.invalidateSize();
  }
}
