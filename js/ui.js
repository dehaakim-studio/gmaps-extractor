/**
 * ui.js
 * Modul UI — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Rendering tabel data dan tabel arsip
 * - Dashboard statistik
 * - Toast notifications
 * - Loader / loading state
 * - Pencarian dan filter sederhana
 * - Sorting tabel
 * - Sanitasi data sebelum dimasukkan ke DOM
 *
 * TIDAK menangani geocoding, penyimpanan, atau logika bisnis.
 */

'use strict';

// ─────────────────────────────────────────────
// KONSTANTA KATEGORI
// ─────────────────────────────────────────────

const KATEGORI_LIST = [
  '', 'Masjid', 'Mushola', 'Sekolah', 'Kantor',
  'Fasilitas Umum', 'Tempat Usaha', 'Lainnya',
];

/**
 * Update kategori pada suatu baris data.
 * @param {string} id 
 * @param {string} val 
 * @param {string} source - 'current' | 'archive'
 */
function updateRowCategory(id, val, source) {
  if (typeof tableData !== 'undefined' && source === 'current') {
    const row = tableData.find(r => String(r.id) === String(id));
    if (row) {
      row.kategori = val;
      if (typeof saveTableData === 'function') saveTableData(tableData);
    }
  } else if (typeof archiveData !== 'undefined' && source === 'archive') {
    const row = archiveData.find(r => String(r.id) === String(id));
    if (row) {
      row.kategori = val;
      if (typeof saveArchiveData === 'function') saveArchiveData(archiveData);
    }
  }
}

/**
 * Update kecamatan pada suatu baris data.
 * @param {string} id 
 * @param {string} val 
 * @param {string} source 
 */
function updateRowKecamatan(id, val, source) {
  if (typeof tableData !== 'undefined' && source === 'current') {
    const row = tableData.find(r => String(r.id) === String(id));
    if (row) {
      row.kecamatan = val;
      if (typeof saveTableData === 'function') saveTableData(tableData);
    }
  } else if (typeof archiveData !== 'undefined' && source === 'archive') {
    const row = archiveData.find(r => String(r.id) === String(id));
    if (row) {
      row.kecamatan = val;
      if (typeof saveArchiveData === 'function') saveArchiveData(archiveData);
    }
  }
}

/**
 * Helper render select kategori
 */
function renderKategoriSelect(id, currentVal, source) {
  const options = KATEGORI_LIST.map(k => {
    const selected = (k === currentVal) ? 'selected' : '';
    const label = k === '' ? '- Pilih -' : k;
    return `<option value="${escapeHTML(k)}" ${selected}>${escapeHTML(label)}</option>`;
  }).join('');
  return `<select onchange="updateRowCategory('${id}', this.value, '${source}')" style="padding: 4px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-main);">${options}</select>`;
}

// ─────────────────────────────────────────────
// STATE FILTER & SORT
// ─────────────────────────────────────────────

let _filterQuery = '';
let _filterStatus = 'ALL';
let _filterKategori = 'ALL';
let _sortKey = '';
let _sortDir = 'asc';

// ─────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────

let _toastTimer = null;

/**
 * Menampilkan notifikasi toast.
 * @param {string} message - Pesan yang ditampilkan
 * @param {string} type - 'success' | 'error'
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Sanitasi pesan sebelum dimasukkan ke innerHTML
  toast.innerHTML = (type === 'error' ? '⚠️ ' : '✅ ') + escapeHTML(message);

  toast.classList.remove('error');
  if (type === 'error') toast.classList.add('error');

  toast.style.display = 'flex';
  void toast.offsetWidth; // force reflow
  toast.classList.add('show');

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (!toast.classList.contains('show')) toast.style.display = 'none';
    }, 400);
  }, 3500);
}

// ─────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────

/**
 * Menampilkan loader dengan pesan opsional.
 * @param {string} message
 */
function showLoader(message) {
  const loader = document.getElementById('loader');
  if (!loader) return;
  loader.innerHTML = `<div class="loader-spinner"></div>${escapeHTML(message || 'Memproses...')}`;
  loader.style.display = 'block';
}

/**
 * Menyembunyikan loader dan mengembalikan teks default.
 */
function hideLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  loader.innerHTML = `<div class="loader-spinner"></div>Membaca koordinat &amp; menghubungi Google API...`;
  loader.style.display = 'none';
}

// ─────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────

/**
 * Membuat HTML badge status berwarna.
 * @param {string} statusVal
 * @returns {string} HTML string
 */
function renderStatusBadge(statusVal) {
  const s = escapeHTML(statusVal || STATUS.VALID);
  let bg = '#10b981';
  if (s === 'GEOCODING_FAILED') bg = '#ef4444';
  else if (s === 'INVALID_URL' || s === 'INVALID_COORDINATE' || s === 'EXTRACTION_FAILED') bg = '#f59e0b';
  else if (s === 'DUPLIKAT') bg = '#8b5cf6';
  return `<span style="padding:3px 8px;border-radius:4px;background:${bg};color:white;font-size:0.72rem;font-weight:700;white-space:nowrap;">${s}</span>`;
}

// ─────────────────────────────────────────────
// FILTER & SORT
// ─────────────────────────────────────────────

/**
 * Memfilter data berdasarkan query pencarian dan filter status.
 * Tidak mengubah array asli.
 * @param {Array} data
 * @returns {Array}
 */
function applyFilter(data) {
  if (!Array.isArray(data)) return [];

  let result = data;

  // Filter status
  if (_filterStatus && _filterStatus !== 'ALL') {
    result = result.filter(row => (row.status || STATUS.VALID) === _filterStatus);
  }

  // Filter kategori
  if (_filterKategori && _filterKategori !== 'ALL') {
    result = result.filter(row => (row.kategori || '') === _filterKategori);
  }

  // Pencarian teks
  if (_filterQuery) {
    const q = _filterQuery.toLowerCase();
    result = result.filter(row => {
      const name = (row.nama_tempat || row.name || '').toLowerCase();
      const address = (row.alamat || row.address || '').toLowerCase();
      const kecamatan = (row.kecamatan || '').toLowerCase();
      const kategori = (row.kategori || '').toLowerCase();
      const status = (row.status || '').toLowerCase();
      return name.includes(q) || address.includes(q) || kecamatan.includes(q) || kategori.includes(q) || status.includes(q);
    });
  }

  // Sort
  if (_sortKey) {
    result = [...result].sort((a, b) => {
      const keyMap = {
        nama: ['nama_tempat', 'name'],
        status: ['status'],
        latitude: ['latitude', 'lat'],
        longitude: ['longitude', 'lng'],
        tanggal: ['tanggal', 'date'],
      };

      const keys = keyMap[_sortKey] || [_sortKey];
      let aVal = '', bVal = '';
      for (const k of keys) {
        if (a[k] !== undefined) { aVal = String(a[k]); break; }
      }
      for (const k of keys) {
        if (b[k] !== undefined) { bVal = String(b[k]); break; }
      }

      const cmp = aVal.localeCompare(bVal, 'id', { numeric: true });
      return _sortDir === 'asc' ? cmp : -cmp;
    });
  }

  return result;
}

/**
 * Update state filter dan re-render tabel.
 * @param {string} query - Teks pencarian
 */
function setSearchQuery(query) {
  _filterQuery = (query || '').trim();
}

/**
 * Update state filter status.
 * @param {string} status - 'ALL' | 'VALID' | 'GEOCODING_FAILED' | dll.
 */
function setFilterStatus(status) {
  _filterStatus = status || 'ALL';
}

/**
 * Update state filter kategori.
 * @param {string} kategori
 */
function setFilterKategori(kategori) {
  _filterKategori = kategori || 'ALL';
}

// Inline HTML handlers (called via oninput/onchange)
function handleSearchInput(query) { _filterQuery = (query || '').trim(); if (typeof refreshUI === 'function') refreshUI(); }
function handleFilterStatus(status) { _filterStatus = status || 'ALL'; if (typeof refreshUI === 'function') refreshUI(); }
function handleFilterKategori(kategori) { _filterKategori = kategori || 'ALL'; if (typeof refreshUI === 'function') refreshUI(); }

/**
 * Update sort key dan arah.
 * @param {string} key
 * @param {string} dir - 'asc' | 'desc'
 */
function setSort(key, dir) {
  _sortKey = key || '';
  _sortDir = dir || 'asc';
}

// ─────────────────────────────────────────────
// RENDERING TABEL DATA SAAT INI
// ─────────────────────────────────────────────

/**
 * Merender tabel data saat ini.
 * @param {Array} tableData - Data tabel
 * @param {Function} onDelete - Callback hapus baris (menerima id)
 */
function renderTable(tableData, onDelete) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const displayed = applyFilter(tableData);

  if (displayed.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted);">Tidak ada data yang sesuai filter.</td></tr>`;
    return;
  }

  displayed.forEach((row, index) => {
    const tr = document.createElement('tr');
    const rowId = escapeHTML(String(row.id || index));

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHTML(row.nama_tempat || row.name || '-')}</td>
      <td class="col-kategori">${renderKategoriSelect(rowId, row.kategori || '', 'current')}</td>
      <td class="col-kecamatan"><input type="text" value="${escapeHTML(row.kecamatan || '')}" onchange="updateRowKecamatan('${rowId}', this.value, 'current')" placeholder="-" style="width: 100px; padding: 4px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-main);"></td>
      <td>${escapeHTML(row.alamat || row.address || '-')}</td>
      <td class="col-link"><a href="${escapeHTML(row.link_google_maps || row.link || '#')}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);">Buka Link</a></td>
      <td>${escapeHTML(row.latitude || row.lat || '-')}</td>
      <td>${escapeHTML(row.longitude || row.lng || '-')}</td>
      <td>${renderStatusBadge(row.status)}</td>
      <td>
        <button class="btn-delete" onclick="(${onDelete.toString()})('${rowId}')" style="padding:4px 8px;font-size:0.75rem;">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────
// RENDERING TABEL ARSIP
// ─────────────────────────────────────────────

/**
 * Merender tabel arsip/riwayat.
 * @param {Array} archiveData
 * @param {Function} onDelete - Callback hapus baris (menerima id)
 */
function renderArchiveTable(archiveData, onDelete) {
  const tbody = document.getElementById('archiveTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const displayed = applyFilter(archiveData);

  if (displayed.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text-muted);">Tidak ada data arsip yang sesuai filter.</td></tr>`;
    return;
  }

  displayed.forEach((row, index) => {
    const tr = document.createElement('tr');
    const rowId = escapeHTML(String(row.id || index));

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHTML(row.tanggal || row.date || '-')}</td>
      <td>${escapeHTML(row.nama_tempat || row.name || '-')}</td>
      <td class="col-kategori">${renderKategoriSelect(rowId, row.kategori || '', 'archive')}</td>
      <td class="col-kecamatan"><input type="text" value="${escapeHTML(row.kecamatan || '')}" onchange="updateRowKecamatan('${rowId}', this.value, 'archive')" placeholder="-" style="width: 100px; padding: 4px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-main);"></td>
      <td>${escapeHTML(row.alamat || row.address || '-')}</td>
      <td class="col-link"><a href="${escapeHTML(row.link_google_maps || row.link || '#')}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);">Buka Link</a></td>
      <td>${escapeHTML(row.latitude || row.lat || '-')}</td>
      <td>${escapeHTML(row.longitude || row.lng || '-')}</td>
      <td>${renderStatusBadge(row.status)}</td>
      <td>
        <button class="btn-delete" onclick="(${onDelete.toString()})('${rowId}')" style="padding:4px 8px;font-size:0.75rem;">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────
// DASHBOARD STATISTIK
// ─────────────────────────────────────────────

/**
 * Memperbarui angka statistik pada dashboard.
 * Dihitung dari data aktual — tidak ada angka hardcoded.
 * @param {Array} activeData - Data yang sedang ditampilkan (tabel atau arsip)
 */
function updateStats(activeData) {
  const el = id => document.getElementById(id);
  if (!el('stat-total')) return;

  const data = Array.isArray(activeData) ? activeData : [];

  const total = data.length;
  const valid = data.filter(d => (d.status || STATUS.VALID) === STATUS.VALID).length;
  const duplikat = data.filter(d => (d.status || '') === STATUS.DUPLIKAT).length;
  const geoFail = data.filter(d => (d.status || '') === STATUS.GEOCODING_FAILED).length;
  const invalid = data.filter(d => {
    const s = d.status || '';
    return s === STATUS.INVALID_URL || s === STATUS.INVALID_COORDINATE || s === STATUS.EXTRACTION_FAILED;
  }).length;
  
  const incomplete = data.filter(d => typeof isDataComplete === 'function' && !isDataComplete(d)).length;

  el('stat-total').textContent = total;
  el('stat-valid').textContent = valid;
  el('stat-duplikat') && (el('stat-duplikat').textContent = duplikat);
  el('stat-geofail').textContent = geoFail;
  el('stat-invalid').textContent = invalid;
  el('stat-incomplete') && (el('stat-incomplete').textContent = incomplete);


}

// ─────────────────────────────────────────────
// PREVIEW HASIL EKSTRAKSI (PANEL KIRI)
// ─────────────────────────────────────────────

/**
 * Menampilkan hasil ekstraksi satu URL di panel preview.
 * @param {object} location - Objek lokasi terstruktur
 */
function displayPreview(location) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
  };

  set('resName', location.nama_tempat || location.name);
  set('resAddress', location.alamat || location.address);
  set('resLat', location.latitude || location.lat);
  set('resLng', location.longitude || location.lng);
  set('resLink', location.link_google_maps || location.link);

  const card = document.getElementById('resultsCard');
  if (card) card.style.display = 'block';
}

/**
 * Menyembunyikan panel preview hasil ekstraksi.
 */
function hidePreview() {
  const card = document.getElementById('resultsCard');
  if (card) card.style.display = 'none';
}
