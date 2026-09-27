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

  // ── TAHAP 4: Reverse Geocoding ────────────────────
  let geocodeResult = { address: '', status: STATUS.VALID, fromCache: false };

  if (apiKey && extracted.lat && extracted.lng) {
    geocodeResult = await reverseGeocode(extracted.lat, extracted.lng, apiKey);
  } else {
    geocodeResult.address = 'API Key tidak tersedia untuk geocoding.';
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

  if (tab === 'archive') {
    Object.assign(tabArchive.style, activeStyle);
    Object.assign(tabCurrent.style, inactiveStyle);
    currentWrapper.style.display = 'none';
    currentActions.style.display = 'none';
    archiveWrapper.style.display = 'block';
    archiveActions.style.display = 'flex';
  } else {
    Object.assign(tabCurrent.style, activeStyle);
    Object.assign(tabArchive.style, inactiveStyle);
    archiveWrapper.style.display = 'none';
    archiveActions.style.display = 'none';
    currentWrapper.style.display = 'block';
    currentActions.style.display = 'flex';
  }

  refreshUI();
}

// ─────────────────────────────────────────────
// EXPORT WRAPPERS
// ─────────────────────────────────────────────

function handleExportExcel() {
  const filenameEl = document.getElementById('exportFileName');
  const filename = filenameEl ? filenameEl.value.trim() : '';
  const result = exportToExcel(tableData, filename);
  showToast(result.message, result.success ? 'success' : 'error');
  if (!result.success && filenameEl) filenameEl.focus();
}

function handleExportGeoJSON(target) {
  const data = target === 'archive' ? archiveData : tableData;
  const result = exportToGeoJSON(data, target);
  showToast(result.message, result.success ? 'success' : 'error');
}

function handleExportKML(target) {
  const data = target === 'archive' ? archiveData : tableData;
  const result = exportToKML(data, target);
  showToast(result.message, result.success ? 'success' : 'error');
}

function handleExportArchiveExcel() {
  const result = exportArchiveToExcel(archiveData);
  showToast(result.message, result.success ? 'success' : 'error');
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

function copyAllFormatted() {
  const name = document.getElementById('resName')?.textContent;
  const address = document.getElementById('resAddress')?.textContent;
  const lat = document.getElementById('resLat')?.textContent;
  const lng = document.getElementById('resLng')?.textContent;
  const link = document.getElementById('resLink')?.textContent;

  const formatted = `Nama Lokasi : ${name}\nAlamat      : ${address}\nLatitude    : ${lat}\nLongitude   : ${lng}\nLink Gmaps  : ${link}`;
  navigator.clipboard.writeText(formatted);
  showToast('Seluruh rekap data berhasil disalin!');
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
// INISIALISASI
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Inisialisasi tema
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  updateThemeIcon(savedTheme);

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
