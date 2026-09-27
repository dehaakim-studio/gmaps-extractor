
    // Inisialisasi tema sebelum DOM selesai dimuat untuk menghindari flash
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('app-theme', newTheme);
      document.getElementById('theme-toggle').textContent = newTheme === 'light' ? '☀️' : '🌙';
    }

    // Set initial icon
    window.addEventListener('DOMContentLoaded', () => {
      const savedTheme = localStorage.getItem('app-theme') || 'dark';
      document.getElementById('theme-toggle').textContent = savedTheme === 'light' ? '☀️' : '🌙';
    });
  

    // Fungsi Toggle Tema
    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('app-theme', newTheme);
      updateThemeIcon(newTheme);

      // Sinkronisasi dengan iframe jika ada
      const iframe = document.getElementById('settings-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ theme: newTheme }, '*');
      }
    }

    function updateThemeIcon(theme) {
      const btn = document.getElementById('theme-toggle');
      if (btn) {
        btn.innerHTML = theme === 'light' ? '🌞' : '🌙';
      }
    }

    // Memuat API Key yang tersimpan saat halaman dibuka
    document.addEventListener('DOMContentLoaded', () => {
      const savedTheme = localStorage.getItem('app-theme') || 'dark';
      updateThemeIcon(savedTheme);

      const savedKey = localStorage.getItem('gmaps_api_key');
      if (savedKey) {
        document.getElementById('apiKey').value = savedKey;
      }

      // Dukungan tombol Enter dan auto-save untuk input API Key
      document.getElementById('apiKey').addEventListener('input', function(e) {
        localStorage.setItem('gmaps_api_key', this.value.trim());
      });
      
      document.getElementById('apiKey').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          parseGmapsLink();
        }
      });




    });

    function openApiKeyModal() {
      document.getElementById('apikey-modal').style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeApiKeyModal() {
      document.getElementById('apikey-modal').style.display = 'none';
      document.body.style.overflow = 'auto';
    }

    async function pasteFromClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          document.getElementById('gmapsUrl').value = text;
          showToast('Link di-paste dari clipboard! Memproses...');
          // Langsung otomatis diproses setelah dipaste
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
          localStorage.setItem('gmaps_api_key', text.trim());
          showToast('API Key berhasil di-paste dan disimpan!');
        }
      } catch (err) {
        showToast('Gagal mem-paste. Pastikan browser mengizinkan akses clipboard.', 'error');
      }
    }

    function resetForm() {
      document.getElementById('gmapsUrl').value = '';
      document.getElementById('resultsCard').style.display = 'none';
      document.getElementById('resName').textContent = '-';
      document.getElementById('resAddress').textContent = '-';
      document.getElementById('resLat').textContent = '-';
      document.getElementById('resLng').textContent = '-';
      document.getElementById('resLink').textContent = '-';
      showToast('Kolom berhasil dibersihkan.');
    }

    function resetApiKey() {
      document.getElementById('apiKey').value = '';
      localStorage.removeItem('gmaps_api_key');
      showToast('API Key dihapus! Silakan masukkan key baru dari dashboard Anda.');
      document.getElementById('apiKey').focus();
    }

    
    let leafMap = null;
    let leafMarkers = null;

    function initMap() {
      if (!leafMap) {
        document.getElementById('mapContainer').style.display = 'block';
        leafMap = L.map('map').setView([-2.5489, 118.0149], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(leafMap);
        leafMarkers = L.featureGroup().addTo(leafMap);
      }
    }

    function addMarker(lat, lng, title) {
      initMap();
      const marker = L.marker([lat, lng]).bindPopup(title);
      leafMarkers.addLayer(marker);
      leafMap.fitBounds(leafMarkers.getBounds(), {padding: [30, 30], maxZoom: 16});
    }

    async function parseGmapsLink() {
      const inputText = document.getElementById('gmapsUrl').value.trim();
      const apiKey = document.getElementById('apiKey').value.trim();
      const resultsCard = document.getElementById('resultsCard');
      const loader = document.getElementById('loader');

      if (!inputText) {
        showToast('Masukkan setidaknya satu URL Google Maps!');
        return;
      }
      if (!apiKey) {
        showToast('Harap masukkan API Key terlebih dahulu!');
        return;
      }

      localStorage.setItem('gmaps_api_key', apiKey);
      
      const urls = inputText.split(/\r?\n/).map(u => u.trim()).filter(u => u.length > 0);
      if(urls.length === 0) { loader.style.display='none'; return; }
      
      if(urls.length > 10) {
        showToast('Maksimal hanya 10 link yang dapat diproses sekaligus!', 'error');
        return;
      }

      loader.style.display = 'block';
      let processedCount = 0;
      let newRowsAdded = false;
      
      // Reset map layers for new batch
      if(leafMap && leafMarkers) {
        leafMarkers.clearLayers();
      }
      
      for (const inputUrl of urls) {
        if (inputUrl.includes('maps.app.goo.gl')) {
          showToast('Ditemukan shortlink (maps.app.goo.gl). Harap gunakan Link Panjang!', 'error');
          continue;
        }

        if (urls.length > 1) {
            loader.innerHTML = `<div class="loader-spinner"></div>Memproses ${processedCount + 1} dari ${urls.length} link...`;
        } else {
            loader.innerHTML = `<div class="loader-spinner"></div>Membaca koordinat & menghubungi Google API...`;
        }

        try {
          let lat = 'Tidak ditemukan';
          let lng = 'Tidak ditemukan';
          let name = 'Tidak ditemukan';
          let address = 'Mencari alamat...';
          let apiHit = false;

          const latMatch = inputUrl.match(/!3d(-?\d+\.\d+)/);
          const lngMatch = inputUrl.match(/!4d(-?\d+\.\d+)/);
          if (latMatch && lngMatch) {
            lat = latMatch[1];
            lng = lngMatch[1];
          } else {
            const viewportMatch = inputUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (viewportMatch) {
              lat = viewportMatch[1];
              lng = viewportMatch[2];
            }
          }

          const nameMatch = inputUrl.match(/\/place\/([^\/]+)\//);
          if (nameMatch) {
            name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' '));
          }

          if (lat === 'Tidak ditemukan' && name === 'Tidak ditemukan') {
            throw new Error('Format link tidak dikenali.');
          }

          if (lat !== 'Tidak ditemukan' && lng !== 'Tidak ditemukan') {
            const cacheKey = `addr_exact_${lat}_${lng}`;
            const cachedAddress = localStorage.getItem(cacheKey);

            if (cachedAddress) {
              address = cachedAddress;
            } else {
              apiHit = true;
              try {
                let geocodeUrl = apiKey.startsWith('AIza') 
                  ? `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
                  : `https://api.distancematrix.ai/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

                const geoResponse = await fetch(geocodeUrl);
                const geoData = await geoResponse.json();
                const resultsArr = geoData.results || geoData.result;

                if (geoData.status === 'OK') {
                  if (resultsArr && resultsArr.length > 0) {
                    address = resultsArr[0].formatted_address;
                  } else if (geoData.formatted_address) {
                    address = geoData.formatted_address;
                  } else {
                    address = 'Alamat tidak ditemukan.';
                  }
                  localStorage.setItem(cacheKey, address);
                } else if (geoData.status === 'REQUEST_DENIED') {
                  address = 'Error: API Key tidak valid / limit.';
                } else if (geoData.status === 'ZERO_RESULTS') {
                  address = 'Alamat tidak ditemukan.';
                } else {
                  address = `Error: ${geoData.status}`;
                }
              } catch (geoErr) {
                address = 'Gagal memuat alamat.';
              }
            }
            
            addMarker(parseFloat(lat), parseFloat(lng), name !== 'Tidak ditemukan' ? name : address);
          } else {
            address = 'Koordinat tidak ditemukan.';
          }

          let cleanLink = inputUrl;
          const cidMatch = inputUrl.match(/1s0x[0-9a-fA-F]+:0x([0-9a-fA-F]+)/);
          if (cidMatch && cidMatch[1]) {
            try {
              const cidDecimal = BigInt('0x' + cidMatch[1]).toString();
              cleanLink = `https://maps.google.com/?cid=${cidDecimal}&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA`;
            } catch (e) {}
          }

          // UI Update for the last processed
          document.getElementById('resName').textContent = name;
          document.getElementById('resAddress').textContent = address;
          document.getElementById('resLat').textContent = lat;
          document.getElementById('resLng').textContent = lng;
          document.getElementById('resLink').textContent = cleanLink;
          resultsCard.style.display = 'block';

          // Auto add to table
          tableData.push({ name, address, link: cleanLink, lat, lng });
          newRowsAdded = true;
          processedCount++;

          renderTable();
          const wrapper = document.querySelector('.excel-table-wrapper');
          if(wrapper) wrapper.scrollTop = wrapper.scrollHeight;

          if(urls.length > 1 && processedCount < urls.length && apiHit) {
              await new Promise(r => setTimeout(r, 600)); // Delay 600ms
          }
        } catch (err) {
           console.error(err);
        }
      } // end for loop

      if(newRowsAdded) {
         renderTable();
         const wrapper = document.querySelector('.excel-table-wrapper');
         setTimeout(() => wrapper.scrollTop = wrapper.scrollHeight, 100);
      }

      loader.innerHTML = `<div class="loader-spinner"></div>Membaca koordinat & menghubungi Google API...`;
      loader.style.display = 'none';
      
      if(processedCount > 0) {
        showToast(`Berhasil memproses ${processedCount} link!`);
      }
    }
    
    // Legacy function, replaced above
    function _old_parse() {}

    function copyText(elementId) {
      const text = document.getElementById(elementId).textContent;
      if (text && text !== '-') {
        navigator.clipboard.writeText(text);
        showToast('Berhasil disalin ke clipboard!');
      }
    }



    let tableData = [];
    
    function addToTable() {
      const name = document.getElementById('resName').textContent;
      const address = document.getElementById('resAddress').textContent;
      const lat = document.getElementById('resLat').textContent;
      const lng = document.getElementById('resLng').textContent;
      const link = document.getElementById('resLink').textContent;

      if (name === '-' || name === 'Tidak ditemukan') {
        showToast('Belum ada data lokasi yang valid diproses!', 'error');
        return;
      }

      const row = {
        name, address, link, lat, lng
      };
      
      tableData.push(row);
      renderTable();
      showToast('Data berhasil ditambahkan ke tabel!');
      
      // Auto scroll to bottom of table container
      const wrapper = document.querySelector('.excel-table-wrapper');
      setTimeout(() => {
        wrapper.scrollTop = wrapper.scrollHeight;
      }, 100);
    }
    
    function renderTable() {
      const tbody = document.getElementById('tableBody');
      tbody.innerHTML = '';
      
      tableData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${row.name}</td>
          <td>${row.address}</td>
          <td><a href="${row.link}" target="_blank" style="color: var(--primary);">Buka Link</a></td>
          <td>${row.lat}</td>
          <td>${row.lng}</td>
          <td>
            <button class="btn-delete" onclick="deleteRow(${index})" style="padding: 4px 8px; font-size: 0.75rem;">Hapus</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    
    function deleteRow(index) {
      if (confirm('Hapus baris ini?')) {
        tableData.splice(index, 1);
        renderTable();
      }
    }
    
    function clearTable() {
      if (tableData.length === 0) return;
      if (confirm('Yakin ingin membersihkan seluruh isi tabel?')) {
        tableData = [];
        renderTable();
        showToast('Tabel berhasil dibersihkan.');
      }
    }
    
    function exportToExcel() {
      if (tableData.length === 0) {
        showToast('Tabel masih kosong!', 'error');
        return;
      }
      
      const customNameInput = document.getElementById('exportFileName');
      const customName = customNameInput ? customNameInput.value.trim() : '';
      
      if (!customName) {
        showToast('Harap isi Nama File terlebih dahulu!', 'error');
        if (customNameInput) customNameInput.focus();
        return;
      }
      
      try {
        const wsData = [
          ['No', 'Nama Tempat', 'Alamat Lengkap', 'Link Google Maps', 'Latitude', 'Longitude']
        ];
        
        tableData.forEach((row, idx) => {
          wsData.push([
            idx + 1,
            row.name,
            row.address,
            row.link,
            row.lat,
            row.lng
          ]);
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Add hyperlink properties for Google Maps Link (Column D, index 3)
        for (let R = 1; R <= tableData.length; ++R) {
          const cell_ref = XLSX.utils.encode_cell({c: 3, r: R});
          if (ws[cell_ref] && ws[cell_ref].v) {
            ws[cell_ref].l = { Target: ws[cell_ref].v };
          }
        }
        
        // Auto-size columns slightly
        const wscols = [
          {wch: 5}, {wch: 30}, {wch: 50}, {wch: 40}, {wch: 15}, {wch: 15}
        ];
        ws['!cols'] = wscols;
        
        XLSX.utils.book_append_sheet(wb, ws, "Data Maps");
        
        // Generate filename
        const filename = `${customName}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        showToast('Berhasil export ke Excel!');
      } catch(err) {
        console.error(err);
        showToast('Gagal export ke Excel.', 'error');
      }
    }

    function copyAllFormatted() {
      const name = document.getElementById('resName').textContent;
      const address = document.getElementById('resAddress').textContent;
      const lat = document.getElementById('resLat').textContent;
      const lng = document.getElementById('resLng').textContent;
      const link = document.getElementById('resLink').textContent;

      const formatted = `Nama Lokasi : ${name}\nAlamat      : ${address}\nLatitude    : ${lat}\nLongitude   : ${lng}\nLink Gmaps  : ${link}`;

      navigator.clipboard.writeText(formatted);
      showToast('Seluruh rekap data berhasil disalin!');
    }

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.innerHTML = type === 'error' ? '⚠️ ' + message : '✅ ' + message;

      if (type === 'error') {
        toast.classList.add('error');
      } else {
        toast.classList.remove('error');
      }

      toast.style.display = 'flex';
      // Force reflow
      void toast.offsetWidth;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (!toast.classList.contains('show')) {
            toast.style.display = 'none';
          }
        }, 400); // Wait for transition
      }, 3500);
    }

    // Mendukung fitur tombol Enter cerdas (Smart Enter)
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        const apiModal = document.getElementById('apikey-modal');

        if (apiModal && apiModal.style.display === 'flex') {
          return;
        }

        const gmapsInput = document.getElementById('gmapsUrl');
        const sendBtn = document.getElementById('btn-confirm-send');
        const resultsCard = document.getElementById('resultsCard');
        const isResultsReady = sendBtn && !sendBtn.disabled && resultsCard && resultsCard.style.display === 'block';

        if (document.activeElement === gmapsInput) {
          // Do nothing, let the textarea insert a newline natively
          return;
        }

        // Jika user menekan Enter bukan di input URL, dan hasilnya siap dikirim
        if (isResultsReady) {
          const tag = document.activeElement ? document.activeElement.tagName : '';
          const isFocusingOtherInput = (tag === 'INPUT' || tag === 'TEXTAREA') && document.activeElement.id !== 'apiKey';

          if (!isFocusingOtherInput) {
            event.preventDefault();
            addToTable();
          }
        }
      }
    });
  