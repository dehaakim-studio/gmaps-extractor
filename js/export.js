/**
 * export.js
 * Modul Export Data — Sistem Ekstraksi Data Geospasial
 *
 * Tanggung jawab:
 * - Export data ke format Excel (.xlsx) menggunakan SheetJS
 * - Export data ke format GeoJSON (koordinat: [longitude, latitude])
 * - Export data ke format KML
 * - Konversi file Excel ke KML
 *
 * GeoJSON menggunakan konvensi [longitude, latitude] (RFC 7946).
 * KML menggunakan format <coordinates>longitude,latitude,altitude</coordinates>.
 *
 * TIDAK menangani LocalStorage utama atau rendering peta.
 */

'use strict';

// ─────────────────────────────────────────────
// HELPER: DOWNLOAD FILE
// ─────────────────────────────────────────────

/**
 * Memicu download file di browser.
 * @param {string} dataStr - Data URL atau Blob URL
 * @param {string} filename - Nama file yang akan diunduh
 */
function triggerDownload(dataStr, filename) {
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Mendapatkan nilai string dari field dengan fallback ke string kosong.
 * @param {*} val
 * @returns {string}
 */
function safeStr(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

// ─────────────────────────────────────────────
// EXPORT EXCEL
// ─────────────────────────────────────────────

/**
 * Export data ke file Excel (.xlsx).
 * Menggunakan SheetJS (XLSX library).
 * @param {Array} data - Array objek lokasi
 * @param {string} filename - Nama file (tanpa ekstensi)
 * @returns {{ success: boolean, message: string }}
 */
function exportToExcel(data, filename) {
  if (!data || data.length === 0) {
    return { success: false, message: 'Data masih kosong!' };
  }
  if (!filename || filename.trim() === '') {
    return { success: false, message: 'Nama file wajib diisi!' };
  }

  try {
    const wsData = [
      ['No', 'Nama Tempat', 'Kategori', 'Kecamatan', 'Alamat Lengkap', 'Link Google Maps', 'Latitude', 'Longitude', 'Status', 'Tanggal'],
    ];

    data.forEach((row, idx) => {
      wsData.push([
        idx + 1,
        safeStr(row.nama_tempat || row.name),
        safeStr(row.kategori),
        safeStr(row.kecamatan),
        safeStr(row.alamat || row.address),
        safeStr(row.link_google_maps || row.link),
        safeStr(row.latitude || row.lat),
        safeStr(row.longitude || row.lng),
        safeStr(row.status || STATUS.VALID),
        safeStr(row.tanggal || row.date),
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Tambahkan hyperlink untuk kolom Link Google Maps (indeks kolom 5)
    for (let R = 1; R <= data.length; ++R) {
      const cellRef = XLSX.utils.encode_cell({ c: 5, r: R });
      if (ws[cellRef] && ws[cellRef].v) {
        ws[cellRef].l = { Target: ws[cellRef].v };
      }
    }

    ws['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
      { wch: 50 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 22 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Data Maps');
    XLSX.writeFile(wb, `${filename.trim()}.xlsx`);
    return { success: true, message: 'Berhasil export ke Excel!' };
  } catch (err) {
    console.error('[export] Excel error:', err);
    return { success: false, message: 'Gagal export ke Excel.' };
  }
}

/**
 * Export data arsip ke file Excel (.xlsx).
 * @param {Array} data - Array objek arsip
 * @returns {{ success: boolean, message: string }}
 */
function exportArchiveToExcel(data) {
  if (!data || data.length === 0) {
    return { success: false, message: 'Arsip masih kosong!' };
  }

  try {
    const filename = `Arsip_Maps_${new Date().toISOString().slice(0, 10)}`;
    return exportToExcel(data, filename);
  } catch (err) {
    console.error('[export] Archive Excel error:', err);
    return { success: false, message: 'Gagal export Arsip ke Excel.' };
  }
}

// ─────────────────────────────────────────────
// EXPORT GEOJSON
// ─────────────────────────────────────────────

/**
 * Export data ke file GeoJSON.
 * Koordinat menggunakan konvensi GeoJSON: [longitude, latitude] (RFC 7946).
 * @param {Array} data - Array objek lokasi
 * @param {string} target - 'current' atau 'archive' (untuk penamaan file)
 * @returns {{ success: boolean, message: string }}
 */
function exportToGeoJSON(data, target) {
  if (!data || data.length === 0) {
    return { success: false, message: 'Data masih kosong!' };
  }

  try {
    const features = data
      .filter(row => {
        const lat = parseFloat(row.latitude || row.lat);
        const lng = parseFloat(row.longitude || row.lng);
        return !isNaN(lat) && !isNaN(lng);
      })
      .map(row => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          // GeoJSON: [longitude, latitude] — sesuai RFC 7946
          coordinates: [
            parseFloat(row.longitude || row.lng),
            parseFloat(row.latitude || row.lat),
          ],
        },
        properties: {
          id: safeStr(row.id),
          nama_tempat: safeStr(row.nama_tempat || row.name),
          kategori: safeStr(row.kategori),
          kecamatan: safeStr(row.kecamatan),
          alamat: safeStr(row.alamat || row.address),
          link_google_maps: safeStr(row.link_google_maps || row.link),
          status: safeStr(row.status || STATUS.VALID),
          tanggal: safeStr(row.tanggal || row.date),
        },
      }));

    const geojson = {
      type: 'FeatureCollection',
      features,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const filename = `Data_Maps_${target || 'export'}_${new Date().toISOString().slice(0, 10)}.geojson`;
    triggerDownload(dataStr, filename);
    return { success: true, message: 'Berhasil export ke GeoJSON!' };
  } catch (err) {
    console.error('[export] GeoJSON error:', err);
    return { success: false, message: 'Gagal export ke GeoJSON.' };
  }
}

// ─────────────────────────────────────────────
// EXPORT KML
// ─────────────────────────────────────────────

/**
 * Escape karakter khusus XML/KML.
 * @param {string} str
 * @returns {string}
 */
function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export data ke file KML (Keyhole Markup Language).
 * Koordinat: longitude,latitude,altitude (standar KML).
 * @param {Array} data - Array objek lokasi
 * @param {string} target - 'current' atau 'archive' (untuk penamaan file)
 * @returns {{ success: boolean, message: string }}
 */
function exportToKML(data, target) {
  if (!data || data.length === 0) {
    return { success: false, message: 'Data masih kosong!' };
  }

  try {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Data Maps ${escapeXML(target || 'export')}</name>\n`;

    data.forEach(row => {
      const lat = parseFloat(row.latitude || row.lat);
      const lng = parseFloat(row.longitude || row.lng);
      if (isNaN(lat) || isNaN(lng)) return; // Skip baris tanpa koordinat valid

      kml += `    <Placemark>\n`;
      kml += `      <name>${escapeXML(row.nama_tempat || row.name || 'Tanpa Nama')}</name>\n`;
      kml += `      <description><![CDATA[\n`;
      kml += `        <b>Alamat:</b> ${safeStr(row.alamat || row.address)}<br/>\n`;
      kml += `        <b>Kategori:</b> ${safeStr(row.kategori) || '-'}<br/>\n`;
      kml += `        <b>Kecamatan:</b> ${safeStr(row.kecamatan) || '-'}<br/>\n`;
      kml += `        <b>Status:</b> ${safeStr(row.status || STATUS.VALID)}<br/>\n`;
      kml += `        <b>Link:</b> <a href="${safeStr(row.link_google_maps || row.link)}">${safeStr(row.link_google_maps || row.link)}</a>\n`;
      kml += `      ]]></description>\n`;
      kml += `      <Point>\n`;
      // KML: longitude,latitude,altitude
      kml += `        <coordinates>${lng},${lat},0</coordinates>\n`;
      kml += `      </Point>\n`;
      kml += `    </Placemark>\n`;
    });

    kml += `  </Document>\n</kml>`;

    const dataStr = 'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(kml);
    const filename = `Data_Maps_${target || 'export'}_${new Date().toISOString().slice(0, 10)}.kml`;
    triggerDownload(dataStr, filename);
    return { success: true, message: 'Berhasil export ke KML!' };
  } catch (err) {
    console.error('[export] KML error:', err);
    return { success: false, message: 'Gagal export ke KML.' };
  }
}

// ─────────────────────────────────────────────
// KONVERSI EXCEL → KML
// ─────────────────────────────────────────────

/**
 * Mengkonversi file Excel (.xlsx/.xls) ke format KML.
 * Mendeteksi kolom secara otomatis dari header baris pertama.
 * @param {Event} event - File input change event
 * @param {Function} onToast - Callback untuk menampilkan notifikasi
 */
function convertExcelToKML(event, onToast) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Excel_To_KML_${escapeXML(file.name)}</name>\n`;
      let validSheetsCount = 0;

      for (let si = 0; si < workbook.SheetNames.length; si++) {
        const sheetName = workbook.SheetNames[si];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rows.length < 2) continue;

        const headerRow = rows[0].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');

        const nameIdx = headerRow.findIndex(h => h.includes('nama tempat') || h.includes('business name') || h === 'name' || h === 'nama_tempat');
        const addressIdx = headerRow.findIndex(h => h.includes('alamat') || h.includes('address'));
        const linkIdx = headerRow.findIndex(h => h.includes('link') || h.includes('google maps'));
        const latIdx = headerRow.findIndex(h => h.includes('latitude') || h === 'lat');
        const lngIdx = headerRow.findIndex(h => h.includes('longitude') || h === 'lng' || h === 'lon');

        if (nameIdx === -1 || latIdx === -1 || lngIdx === -1) continue;

        validSheetsCount++;
        kml += `    <Folder>\n      <name>${escapeXML(sheetName)}</name>\n`;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const name = escapeXML(String(row[nameIdx] || 'Unknown'));
          const address = addressIdx !== -1 ? safeStr(row[addressIdx]) : '-';
          const link = linkIdx !== -1 ? safeStr(row[linkIdx]) : '-';
          const latVal = parseFloat(String(row[latIdx]).replace(',', '.'));
          const lngVal = parseFloat(String(row[lngIdx]).replace(',', '.'));

          if (isNaN(latVal) || isNaN(lngVal)) continue;

          kml += `      <Placemark>\n        <name>${name}</name>\n`;
          kml += `        <description><![CDATA[\n`;
          kml += `          <b>Alamat:</b> ${address}<br/>\n`;
          kml += `          <b>Link:</b> <a href="${link}">${link}</a>\n`;
          kml += `        ]]></description>\n`;
          kml += `        <Point>\n          <coordinates>${lngVal},${latVal},0</coordinates>\n        </Point>\n`;
          kml += `      </Placemark>\n`;
        }

        kml += `    </Folder>\n`;
      }

      if (validSheetsCount === 0) {
        if (onToast) onToast('Format header Excel tidak dikenali! Pastikan ada kolom Nama, Latitude, dan Longitude.', 'error');
        event.target.value = '';
        return;
      }

      kml += `  </Document>\n</kml>`;

      const dataStr = 'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(kml);
      const outName = file.name.replace(/\.[^/.]+$/, '') + '.kml';
      triggerDownload(dataStr, outName);

      if (onToast) onToast('Berhasil convert Excel ke KML!');
    } catch (err) {
      console.error('[export] Excel→KML error:', err);
      if (onToast) onToast('Gagal memproses file Excel.', 'error');
    }
    event.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}
