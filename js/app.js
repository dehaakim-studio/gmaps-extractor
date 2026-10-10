/**
 * app.js
 * Modul Orchestrator — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Mengorkestrasi seluruh alur pemrosesan:
 *   Input URL → Validation → Extraction → Geocoding →
 *   Duplicate Detection → Storage → UI → Map → Export
 * - Event listener aplikasi
 * - Manajemen state global (tableData, archiveData)
 * - Tab switching
 * - Inisialisasi saat DOMContentLoaded
 *
 * Bergantung pada: validation.js, extractor.js, geocoding.js,
 *                  duplicate.js, storage.js, map.js, export.js, ui.js
 */

'use strict';

// ─────────────────────────────────────────────
// STATE GLOBAL APLIKASI
// ─────────────────────────────────────────────

/** Data tabel sesi saat ini (tidak tersimpan otomatis, di-save saat addToTable) */
let tableData = [];

/** Data arsip historis (selalu tersimpan di LocalStorage) */
let archiveData = [];

/** Tab aktif saat ini: 'current' | 'archive' */
let _activeTab = 'current';

// ─────────────────────────────────────────────
// HELPER: RENDER + SYNC
// ─────────────────────────────────────────────

function refreshUI() {
  if (_activeTab === 'archive') {
    renderArchiveTable(archiveData, handleDeleteArchive);
    updateStats(archiveData);
  } else {
    const displayed = typeof applyFilter === 'function' ? applyFilter(tableData) : tableData;
    renderTable(tableData, handleDeleteRow);
    updateStats(displayed);
    renderMapFromData(displayed);
  }
}

// ─────────────────────────────────────────────
// HANDLER: DELETE
// ─────────────────────────────────────────────

/**
 * Menghapus satu baris dari tabel data berdasarkan id.
 * @param {string} id
 */
function handleDeleteRow(id) {
  if (!confirm('Hapus baris ini?')) return;
  tableData = tableData.filter(row => String(row.id) !== String(id));
  saveTableData(tableData);
  refreshUI();
}

/**
 * Menghapus satu baris dari arsip berdasarkan id.
 * @param {string} id
 */
function handleDeleteArchive(id) {
  if (!confirm('Hapus baris arsip ini?')) return;
  archiveData = archiveData.filter(row => String(row.id) !== String(id));
  saveArchiveData(archiveData);
  refreshUI();
}

// ─────────────────────────────────────────────
// PROCESSING PIPELINE
// ─────────────────────────────────────────────

/**
 * PIPELINE UTAMA: Memproses satu URL Google Maps melalui seluruh tahap.
 * Mengembalikan objek lokasi terstruktur dengan status yang tepat.
 *
 * Alur:
 *   URL → Validate → Extract → Validate Coord → Geocode → Duplicate Check → Record
 *
 * @param {string} url - URL Google Maps mentah
 * @param {string} apiKey - API Key untuk geocoding
 * @returns {Promise<object>} Lokasi terstruktur
 */
async function processSingleURL(url, apiKey) {
  // ── TAHAP 1: Validasi URL ──────────────────────────
  const urlValidation = validateGmapsURL(url);
  if (!urlValidation.valid) {
    return createLocationRecord({
      name: 'Tidak ditemukan',
      lat: '',
      lng: '',
      link: url,
      status: STATUS.INVALID_URL,
      address: urlValidation.reason,
    });
  }

  // ── TAHAP 2: Ekstraksi Data ────────────────────────
  const extracted = parseGmapsURL(url);
  // extracted: { name, lat, lng, cleanLink }

  // ── TAHAP 3: Validasi Data Lokasi ─────────────────
  const dataValidation = validateLocationData({
    name: extracted.name,
    lat: extracted.lat,
    lng: extracted.lng,
  });

  if (!dataValidation.valid) {
    return createLocationRecord({
      name: extracted.name,
      lat: extracted.lat || '',
      lng: extracted.lng || '',
      link: extracted.cleanLink,
      status: dataValidation.status,
      address: dataValidation.reason,
    });
  }

  // ── TAHAP 4: Reverse Geocoding / URL Address ──────
  let geocodeResult = { address: '', status: STATUS.VALID, fromCache: false };

  if (extracted.addressFromUrl) {
    // Gunakan alamat spesifik dari link URL agar tidak tertukar/sama persis dengan sebelahnya
    geocodeResult.address = extracted.addressFromUrl;
    geocodeResult.status = STATUS.VALID;
    // Tetap bisa jalankan geocode async di background kalau butuh, tapi di sini kita pakai data URL
  } else if (apiKey && extracted.lat && extracted.lng) {
    geocodeResult = await reverseGeocode(extracted.lat, extracted.lng, apiKey);
  } else {
    geocodeResult.address = 'API Key tidak tersedia untuk geocoding dan alamat URL kosong.';
    geocodeResult.status = STATUS.GEOCODING_FAILED;
  }

  // ── TAHAP 5: Normalisasi Data (Phase 3A.1) ───────
  const normalizedName = typeof normalizeText === 'function'
    ? normalizeText(extracted.name)
    : (extracted.name || '').trim();
  const normalizedAddress = typeof normalizeText === 'function'
    ? normalizeText(geocodeResult.address)
    : (geocodeResult.address || '').trim();

  // ── TAHAP 6: Rekam Hasil ──────────────────────────
  const location = createLocationRecord({
    name: normalizedName,
    lat: extracted.lat,
    lng: extracted.lng,
    link: extracted.cleanLink,
    address: normalizedAddress,
    status: geocodeResult.status,
    fromViewport: extracted.fromViewport,
  });

  return location;
}

// ─────────────────────────────────────────────
// FUNGSI UTAMA: PARSE BATCH URL
// ─────────────────────────────────────────────

/**
 * Memproses batch URL Google Maps dari textarea.
 * Menjaga batch berjalan meskipun satu URL gagal.
 * Setiap URL melalui pipeline lengkap secara independen.
 */
async function parseGmapsLink() {
  const inputText = document.getElementById('gmapsUrl').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();

  if (!inputText) {
    showToast('Masukkan setidaknya satu URL Google Maps!');
    return;
  }
  if (!apiKey) {
    showToast('Harap masukkan API Key terlebih dahulu!');
    return;
  }

  saveApiKey(apiKey);

  const urls = inputText.split(/\r?\n/).map(u => u.trim()).filter(u => u.length > 0);
  if (urls.length === 0) return;
  if (urls.length > 10) {
    showToast('Maksimal hanya 10 link yang dapat diproses sekaligus!', 'error');
    return;
  }

  showLoader(`Memproses 0 dari ${urls.length} link...`);
  clearMapMarkers();

  let processedCount = 0;
  let addedCount = 0;
  let lastLocation = null;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    showLoader(`Memproses ${i + 1} dari ${urls.length} link...`);

    try {
      // Jalankan pipeline lengkap untuk satu URL
      const location = await processSingleURL(url, apiKey);
      lastLocation = location;

      // ── TAHAP 6: Pengecekan Duplikat ─────────────
      const dupCheck = checkDuplicate(location, tableData, archiveData);

      if (dupCheck.isDuplicate) {
        location.status = STATUS.DUPLIKAT;
        location.alamat = `[DUPLIKAT] ${dupCheck.reason} - ${location.alamat}`;
        showToast(`Peringatan Duplikat: ${dupCheck.reason}`, 'error');
        // Jangan continue! Tetap masukkan sebagai record duplikat sesuai spesifikasi Phase 3
      }

      // ── TAHAP 7: Simpan ke data ──────────────────
      tableData.push(location);
      archiveData.push({ ...location, tanggal: new Date().toLocaleString('id-ID') });
      saveArchiveData(archiveData);
      saveTableData(tableData);

      // ── TAHAP 8: Update UI & Map ─────────────────
      displayPreview(location);
      addedCount++;
      processedCount++;

      // Tambahkan marker jika koordinat valid
      if (location.status === STATUS.VALID || location.status === STATUS.GEOCODING_FAILED) {
        addMarkerFromLocation(location);
      }

      refreshUI();

      // Delay antar request API (rate-limit awareness)
      if (i < urls.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (err) {
      // Error per-item TIDAK menghentikan batch
      console.error(`[app] Gagal proses URL ke-${i + 1}:`, err);
      showToast(`URL ${i + 1} gagal diproses. Melanjutkan...`, 'error');
    }
  }

  hideLoader();
  refreshUI();

  // Kosongkan textarea setelah selesai diproses secara otomatis
  document.getElementById('gmapsUrl').value = '';

  if (addedCount > 0) {
    showToast(`Berhasil menambahkan ${addedCount} dari ${urls.length} link!`);
  } else if (processedCount === 0) {
    showToast('Tidak ada data baru yang berhasil ditambahkan.', 'error');
  }
}

// ─────────────────────────────────────────────
// FUNGSI: TAMBAHKAN KE TABEL (MANUAL)
// ─────────────────────────────────────────────

/**
 * Menambahkan data hasil preview secara manual ke tabel.
 * Digunakan saat user menekan tombol "Tambahkan ke Tabel".
 */
function addToTable() {
  const name = document.getElementById('resName')?.textContent?.trim();
  const address = document.getElementById('resAddress')?.textContent?.trim();
  const lat = document.getElementById('resLat')?.textContent?.trim();
  const lng = document.getElementById('resLng')?.textContent?.trim();
  const link = document.getElementById('resLink')?.textContent?.trim();

  if (!name || name === '-' || name === 'Tidak ditemukan') {
    showToast('Belum ada data lokasi yang valid diproses!', 'error');
    return;
  }

  const newItem = { name, address, lat, lng, link };

  // Cek duplikat
  const dupCheck = checkDuplicate(newItem, tableData, archiveData);
  const status = dupCheck.isDuplicate ? STATUS.DUPLIKAT : STATUS.VALID;
  let finalAddress = address;
  if (dupCheck.isDuplicate) {
    showToast(`Peringatan Duplikat: ${dupCheck.reason}`, 'error');
    finalAddress = `[DUPLIKAT] ${dupCheck.reason} - ${address}`;
  }

  const record = createLocationRecord({ name, address: finalAddress, lat, lng, link, status: status });
  tableData.push(record);
  archiveData.push({ ...record, tanggal: new Date().toLocaleString('id-ID') });
  saveArchiveData(archiveData);
  saveTableData(tableData);

  refreshUI();
  showToast('Data berhasil ditambahkan ke tabel!');
}

// ─────────────────────────────────────────────
// CLEAR TABLE / ARCHIVE
// ─────────────────────────────────────────────

function clearTable() {
  if (tableData.length === 0) return;
  if (!confirm('Yakin ingin membersihkan seluruh isi tabel?')) return;
  tableData = [];
  saveTableData(tableData);
  refreshUI();
  showToast('Tabel berhasil dibersihkan.');
}

function clearArchive() {
  if (archiveData.length === 0) return;
  if (!confirm('Yakin ingin menghapus seluruh arsip riwayat?')) return;
  archiveData = [];
  saveArchiveData(archiveData);
  refreshUI();
  showToast('Arsip berhasil dihapus.');
}

// ─────────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────────

function switchTab(tab) {
  _activeTab = tab;

  const tabCurrent = document.getElementById('tab-current');
  const tabArchive = document.getElementById('tab-archive');
  const currentWrapper = document.getElementById('current-table-wrapper');
  const archiveWrapper = document.getElementById('archive-table-wrapper');
  const currentActions = document.getElementById('current-actions');
  const archiveActions = document.getElementById('archive-actions');

  const activeStyle = { color: 'var(--primary)', borderBottom: '2px solid var(--primary)' };
  const inactiveStyle = { color: 'var(--text-muted)', borderBottom: '2px solid transparent' };

  const currentWarning = document.getElementById('current-warning-box');

  if (tab === 'archive') {
    Object.assign(tabArchive.style, activeStyle);
    Object.assign(tabCurrent.style, inactiveStyle);
    currentWrapper.style.display = 'none';
    currentActions.style.display = 'none';
    if (currentWarning) currentWarning.style.display = 'none';
    archiveWrapper.style.display = 'block';
    archiveActions.style.display = 'flex';
  } else {
    Object.assign(tabCurrent.style, activeStyle);
    Object.assign(tabArchive.style, inactiveStyle);
    archiveWrapper.style.display = 'none';
    archiveActions.style.display = 'none';
    currentWrapper.style.display = 'block';
    currentActions.style.display = 'flex';
    if (currentWarning) currentWarning.style.display = 'block';
  }

  refreshUI();
}

// ─────────────────────────────────────────────
// EXPORT WRAPPERS — pakai Save As dialog (File System Access API)
// ─────────────────────────────────────────────

/**
 * Helper: tampilkan dialog Save As dan tulis blob ke file yang dipilih user.
 * Fallback ke triggerDownload jika browser tidak support showSaveFilePicker.
 * @param {Blob} blob - Isi file
 * @param {string} suggestedName - Nama file default
 * @param {Array} types - Array filter tipe file untuk dialog
 */
async function saveWithDialog(blob, suggestedName, types) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, aborted: true };
      console.warn('[saveWithDialog] fallback ke download:', err);
    }
  }
  // Fallback: download otomatis
  const url = URL.createObjectURL(blob);
  triggerDownload(url, suggestedName);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { success: true };
}

async function handleExportExcel() {
  if (!tableData || tableData.length === 0) {
    showToast('Data masih kosong!', 'error'); return;
  }
  const defaultName = `Data_Maps_current_${new Date().toISOString().slice(0, 10)}.xlsx`;
  try {
    // Build workbook pakai SheetJS, hasilkan ArrayBuffer
    const saved = localStorage.getItem('app-settings');
    let settings = { showKategori: true, showKecamatan: true, showLink: true };
    if (saved) { try { settings = { ...settings, ...JSON.parse(saved) }; } catch (e) {} }

    const headers = ['No', 'Nama Tempat'];
    if (settings.showKategori) headers.push('Kategori');
    if (settings.showKecamatan) headers.push('Kecamatan');
    headers.push('Alamat Lengkap');
    if (settings.showLink !== false) headers.push('Link Google Maps');
    headers.push('Latitude', 'Longitude', 'Status', 'Tanggal');

    const wsData = [headers];
    tableData.forEach((row, idx) => {
      const rowData = [idx + 1, safeStr(row.nama_tempat || row.name)];
      if (settings.showKategori) rowData.push(safeStr(row.kategori));
      if (settings.showKecamatan) rowData.push(safeStr(row.kecamatan));
      rowData.push(safeStr(row.alamat || row.address));
      if (settings.showLink !== false) rowData.push(safeStr(row.link_google_maps || row.link));
      rowData.push(safeStr(row.latitude || row.lat), safeStr(row.longitude || row.lng), safeStr(row.status || STATUS.VALID), safeStr(row.tanggal || row.date));
      wsData.push(rowData);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Data Maps');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const res = await saveWithDialog(blob, defaultName, [{
      description: 'Excel Workbook',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }]);
    if (!res.aborted) showToast(res.success ? 'Berhasil export ke Excel!' : 'Gagal export ke Excel.', res.success ? 'success' : 'error');
  } catch (err) {
    console.error('[export] Excel error:', err);
    showToast('Gagal export ke Excel.', 'error');
  }
}

async function handleExportGeoJSON(target) {
  const data = target === 'archive' ? archiveData : tableData;
  if (!data || data.length === 0) { showToast('Data masih kosong!', 'error'); return; }
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultName = `Data_Maps_${target || 'export'}_${dateStr}.geojson`;
  try {
    const features = data
      .filter(row => { const la = parseFloat(row.latitude || row.lat), lo = parseFloat(row.longitude || row.lng); return !isNaN(la) && !isNaN(lo); })
      .map(row => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [parseFloat(row.longitude || row.lng), parseFloat(row.latitude || row.lat)] }, properties: { nama_tempat: safeStr(row.nama_tempat || row.name), kategori: safeStr(row.kategori), kecamatan: safeStr(row.kecamatan), alamat: safeStr(row.alamat || row.address), link_google_maps: safeStr(row.link_google_maps || row.link), status: safeStr(row.status || STATUS.VALID), tanggal: safeStr(row.tanggal || row.date) } }));
    const geojson = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const res = await saveWithDialog(blob, defaultName, [{ description: 'GeoJSON File', accept: { 'application/geo+json': ['.geojson', '.json'] } }]);
    if (!res.aborted) showToast(res.success ? 'Berhasil export ke GeoJSON!' : 'Gagal export ke GeoJSON.', res.success ? 'success' : 'error');
  } catch (err) {
    console.error('[export] GeoJSON error:', err);
    showToast('Gagal export ke GeoJSON.', 'error');
  }
}

async function handleExportKML(target) {
  const data = target === 'archive' ? archiveData : tableData;
  if (!data || data.length === 0) { showToast('Data masih kosong!', 'error'); return; }
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultName = `Data_Maps_${target || 'export'}_${dateStr}.kml`;
  try {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Data Maps ${target || 'export'}</name>\n`;
    data.forEach(row => {
      const lat = parseFloat(row.latitude || row.lat), lng = parseFloat(row.longitude || row.lng);
      if (isNaN(lat) || isNaN(lng)) return;
      kml += `    <Placemark>\n      <name>${escapeXML(row.nama_tempat || row.name || 'Tanpa Nama')}</name>\n      <description><![CDATA[\n        <b>Alamat:</b> ${safeStr(row.alamat || row.address)}<br/>\n        <b>Kategori:</b> ${safeStr(row.kategori) || '-'}<br/>\n        <b>Kecamatan:</b> ${safeStr(row.kecamatan) || '-'}<br/>\n        <b>Status:</b> ${safeStr(row.status || STATUS.VALID)}<br/>\n        <b>Link:</b> <a href="${safeStr(row.link_google_maps || row.link)}">${safeStr(row.link_google_maps || row.link)}</a>\n      ]]></description>\n      <Point>\n        <coordinates>${lng},${lat},0</coordinates>\n      </Point>\n    </Placemark>\n`;
    });
    kml += `  </Document>\n</kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const res = await saveWithDialog(blob, defaultName, [{ description: 'KML File', accept: { 'application/vnd.google-earth.kml+xml': ['.kml'] } }]);
    if (!res.aborted) showToast(res.success ? 'Berhasil export ke KML!' : 'Gagal export ke KML.', res.success ? 'success' : 'error');
  } catch (err) {
    console.error('[export] KML error:', err);
    showToast('Gagal export ke KML.', 'error');
  }
}

async function handleExportArchiveExcel() {
  if (!archiveData || archiveData.length === 0) { showToast('Arsip masih kosong!', 'error'); return; }
  const defaultName = `Arsip_Maps_${new Date().toISOString().slice(0, 10)}.xlsx`;
  try {
    const wb = XLSX.utils.book_new();
    const headers = ['No', 'Nama Tempat', 'Kategori', 'Kecamatan', 'Alamat Lengkap', 'Link Google Maps', 'Latitude', 'Longitude', 'Status', 'Tanggal'];
    const wsData = [headers];
    archiveData.forEach((row, idx) => {
      wsData.push([idx + 1, safeStr(row.nama_tempat || row.name), safeStr(row.kategori), safeStr(row.kecamatan), safeStr(row.alamat || row.address), safeStr(row.link_google_maps || row.link), safeStr(row.latitude || row.lat), safeStr(row.longitude || row.lng), safeStr(row.status || STATUS.VALID), safeStr(row.tanggal || row.date)]);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Arsip Maps');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const res = await saveWithDialog(blob, defaultName, [{ description: 'Excel Workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]);
    if (!res.aborted) showToast(res.success ? 'Berhasil export Arsip ke Excel!' : 'Gagal export Arsip ke Excel.', res.success ? 'success' : 'error');
  } catch (err) {
    console.error('[export] Archive Excel error:', err);
    showToast('Gagal export Arsip ke Excel.', 'error');
  }
}

function handleConvertExcelToKML(event) {
  convertExcelToKML(event, showToast);
}

// ─────────────────────────────────────────────
// CLIPBOARD HELPERS
// ─────────────────────────────────────────────

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      document.getElementById('gmapsUrl').value = text;
      showToast('Link di-paste dari clipboard! Memproses...');
      parseGmapsLink();
    }
  } catch (err) {
    showToast('Gagal mem-paste. Pastikan browser mengizinkan akses clipboard.', 'error');
  }
}

async function pasteApiKey() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      document.getElementById('apiKey').value = text;
      saveApiKey(text.trim());
      showToast('API Key berhasil di-paste dan disimpan!');
    }
  } catch (err) {
    showToast('Gagal mem-paste. Pastikan browser mengizinkan akses clipboard.', 'error');
  }
}

function copyText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent;
  if (text && text !== '-') {
    navigator.clipboard.writeText(text);
    showToast('Berhasil disalin ke clipboard!');
  }
}


// ─────────────────────────────────────────────
// RESET HELPERS
// ─────────────────────────────────────────────

function resetForm() {
  document.getElementById('gmapsUrl').value = '';
  hidePreview();
  showToast('Kolom berhasil dibersihkan.');
}

function resetApiKey() {
  document.getElementById('apiKey').value = '';
  removeApiKey();
  showToast('API Key dihapus! Silakan masukkan key baru dari dashboard Anda.');
  document.getElementById('apiKey').focus();
}

// ─────────────────────────────────────────────
// MODAL API KEY
// ─────────────────────────────────────────────

function openApiKeyModal() {
  document.getElementById('apikey-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeApiKeyModal() {
  document.getElementById('apikey-modal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ─────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.innerHTML = theme === 'light' ? '🌞' : '🌙';
}

// ─────────────────────────────────────────────
// SEARCH & FILTER HANDLERS (untuk HTML inline)
// ─────────────────────────────────────────────

function handleSearchInput(value) {
  setSearchQuery(value);
  refreshUI();
}

function handleFilterStatus(value) {
  setFilterStatus(value);
  refreshUI();
}

// ─────────────────────────────────────────────
// PENGATURAN APLIKASI
// ─────────────────────────────────────────────

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

function loadSettings() {
  const defaultSettings = {
    showKategori: true,
    showKecamatan: true,
    showLink: true
  };
  const saved = localStorage.getItem('app-settings');
  let settings = defaultSettings;
  if (saved) {
    try {
      settings = { ...defaultSettings, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
  }
  
  // Update UI Checkboxes
  const cbKategori = document.getElementById('setting-show-kategori');
  const cbKecamatan = document.getElementById('setting-show-kecamatan');
  const cbLink = document.getElementById('setting-show-link');
  
  if (cbKategori) cbKategori.checked = settings.showKategori;
  if (cbKecamatan) cbKecamatan.checked = settings.showKecamatan;
  if (cbLink) cbLink.checked = settings.showLink;
  
  applySettingsToUI(settings);
}

function applySettingsToUI(settings) {
  if (settings.showKategori) {
    document.body.classList.remove('hide-col-kategori');
  } else {
    document.body.classList.add('hide-col-kategori');
  }
  
  if (settings.showKecamatan) {
    document.body.classList.remove('hide-col-kecamatan');
  } else {
    document.body.classList.add('hide-col-kecamatan');
  }

  if (settings.showLink) {
    document.body.classList.remove('hide-col-link');
  } else {
    document.body.classList.add('hide-col-link');
  }
}

function saveCurrentSettingsFromUI(showToastMsg = false) {
  const cbKategori = document.getElementById('setting-show-kategori');
  const cbKecamatan = document.getElementById('setting-show-kecamatan');
  const cbLink = document.getElementById('setting-show-link');
  
  const settings = {
    showKategori: cbKategori ? cbKategori.checked : true,
    showKecamatan: cbKecamatan ? cbKecamatan.checked : true,
    showLink: cbLink ? cbLink.checked : true
  };
  
  localStorage.setItem('app-settings', JSON.stringify(settings));
  applySettingsToUI(settings);
  
  if (showToastMsg && typeof showToast === 'function') {
    showToast('Pengaturan berhasil disimpan!');
    closeSettingsModal();
  }
}

function resetDefaultSettings() {
  const cbKategori = document.getElementById('setting-show-kategori');
  const cbKecamatan = document.getElementById('setting-show-kecamatan');
  const cbLink = document.getElementById('setting-show-link');
  if (cbKategori) cbKategori.checked = true;
  if (cbKecamatan) cbKecamatan.checked = true;
  if (cbLink) cbLink.checked = true;
  saveCurrentSettingsFromUI(true);
}

// ─────────────────────────────────────────────
// INISIALISASI
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Inisialisasi tema
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  updateThemeIcon(savedTheme);

  // Load Settings
  if (typeof loadSettings === 'function') loadSettings();

  // Load API Key
  const savedKey = loadApiKey();
  if (savedKey) {
    document.getElementById('apiKey').value = savedKey;
  }

  // Load data dari LocalStorage (dengan migrasi otomatis)
  tableData = loadTableData();
  archiveData = loadArchiveData();

  // Render UI awal
  refreshUI();

  // Event: auto-save API Key
  document.getElementById('apiKey').addEventListener('input', function () {
    saveApiKey(this.value.trim());
  });

  // Event: Auto-process saat paste di textarea Google Maps Link
  document.getElementById('gmapsUrl').addEventListener('paste', function () {
    setTimeout(() => {
      parseGmapsLink();
    }, 50);
  });

  // Event: Enter pada API Key field → proses
  document.getElementById('apiKey').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      parseGmapsLink();
    }
  });

  // Event: Smart Enter
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;

    const apiModal = document.getElementById('apikey-modal');
    if (apiModal && apiModal.style.display === 'flex') return;

    const gmapsInput = document.getElementById('gmapsUrl');
    if (document.activeElement === gmapsInput) return;

    const sendBtn = document.getElementById('btn-confirm-send');
    const resultsCard = document.getElementById('resultsCard');
    const isResultsReady = sendBtn && !sendBtn.disabled && resultsCard && resultsCard.style.display === 'block';

    if (isResultsReady) {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      const isFocusingOtherInput = (tag === 'INPUT' || tag === 'TEXTAREA') && document.activeElement.id !== 'apiKey';
      if (!isFocusingOtherInput) {
        event.preventDefault();
        addToTable();
      }
    }
  });
});
