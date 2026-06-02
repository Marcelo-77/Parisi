const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
const API_LOCATION_PRODUCT = API_BASE + '/api/location-product';
const API_LOCATIONS = API_BASE + '/api/locations';
const API_WAREHOUSE = API_BASE + '/api/warehouse';
const API_SITUATIONS = API_BASE + '/api/situations';

let records = [];
let locations = [];
let products = [];
let situations = [];

function setupHeaderDropdowns() {
  const usersMenuBtn = document.getElementById('usersMenuBtn');
  const usersDropdownMenu = document.getElementById('usersDropdownMenu');
  const productMenuBtn = document.getElementById('productMenuBtn');
  const productDropdownMenu = document.getElementById('productDropdownMenu');
  const locationMenuBtn = document.getElementById('locationMenuBtn');
  const locationDropdownMenu = document.getElementById('locationDropdownMenu');
  const locationProductMenuBtn = document.getElementById('locationProductMenuBtn');
  const locationProductDropdownMenu = document.getElementById('locationProductDropdownMenu');
  const movementMenuBtn = document.getElementById('movementMenuBtn');
  const movementDropdownMenu = document.getElementById('movementDropdownMenu');
  const pickingMenuBtn = document.getElementById('pickingMenuBtn');
  const pickingDropdownMenu = document.getElementById('pickingDropdownMenu');
  const customerMenuBtn = document.getElementById('customerMenuBtn');
  const customerDropdownMenu = document.getElementById('customerDropdownMenu');
  const helpMenuBtn = document.getElementById('helpMenuBtn');
  const helpDropdownMenu = document.getElementById('helpDropdownMenu');

  function closeAll() {
    [usersDropdownMenu, productDropdownMenu, locationDropdownMenu, locationProductDropdownMenu, movementDropdownMenu, pickingDropdownMenu, customerDropdownMenu, helpDropdownMenu].forEach(el => {
      if (el) el.setAttribute('aria-hidden', 'true');
    });
    [usersMenuBtn, productMenuBtn, locationMenuBtn, locationProductMenuBtn, movementMenuBtn, pickingMenuBtn, customerMenuBtn, helpMenuBtn].forEach(el => {
      if (el) el.setAttribute('aria-expanded', 'false');
    });
  }
  if (usersMenuBtn && usersDropdownMenu) {
    usersMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      const open = usersDropdownMenu.getAttribute('aria-hidden') !== 'true';
      usersDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      usersMenuBtn.setAttribute('aria-expanded', !open);
    });
  }
  if (productMenuBtn && productDropdownMenu) {
    productMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      const open = productDropdownMenu.getAttribute('aria-hidden') !== 'true';
      productDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      productMenuBtn.setAttribute('aria-expanded', !open);
    });
  }
  if (locationMenuBtn && locationDropdownMenu) {
    locationMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      const open = locationDropdownMenu.getAttribute('aria-hidden') !== 'true';
      locationDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      locationMenuBtn.setAttribute('aria-expanded', !open);
    });
  }
  if (locationProductMenuBtn && locationProductDropdownMenu) {
    locationProductMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      const open = locationProductDropdownMenu.getAttribute('aria-hidden') !== 'true';
      locationProductDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      locationProductMenuBtn.setAttribute('aria-expanded', !open);
    });
  }
  if (movementMenuBtn && movementDropdownMenu) {
    movementMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      const open = movementDropdownMenu.getAttribute('aria-hidden') !== 'true';
      movementDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      movementMenuBtn.setAttribute('aria-expanded', !open);
    });
  }
  if (pickingMenuBtn && pickingDropdownMenu) {
    pickingMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      const open = pickingDropdownMenu.getAttribute('aria-hidden') !== 'true';
      pickingDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      pickingMenuBtn.setAttribute('aria-expanded', !open);
    });
  }
  if (customerMenuBtn && customerDropdownMenu) {
    customerMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      const open = customerDropdownMenu.getAttribute('aria-hidden') !== 'true';
      customerDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      customerMenuBtn.setAttribute('aria-expanded', !open);
    });
  }
  if (helpMenuBtn && helpDropdownMenu) {
    helpMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      const open = helpDropdownMenu.getAttribute('aria-hidden') !== 'true';
      helpDropdownMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      helpMenuBtn.setAttribute('aria-expanded', !open);
    });
  }
  const newProductBtn = document.getElementById('newProductBtn');
  const searchProductBtn = document.getElementById('searchProductBtn');
  if (newProductBtn) newProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
  if (searchProductBtn) searchProductBtn.addEventListener('click', () => { window.location.href = 'warehouse.html'; });
  document.addEventListener('click', closeAll);
}

document.addEventListener('DOMContentLoaded', () => {
  setupHeaderDropdowns();
  const tableBody = document.getElementById('tableBody');
  const recordModal = document.getElementById('recordModal');
  const recordForm = document.getElementById('recordForm');
  const filterLocationCode = document.getElementById('filterLocationCode');
  const filterProductCode = document.getElementById('filterProductCode');
  const filterSituation = document.getElementById('filterSituation');
  const filterEntryFrom = document.getElementById('filterEntryFrom');
  const filterEntryTo = document.getElementById('filterEntryTo');

  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? isoStr : d.toLocaleString();
    } catch (_) {
      return isoStr;
    }
  }

  function toISODateTimeLocal(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function loadLocations() {
    try {
      const res = await fetch(API_LOCATIONS);
      const data = await res.json();
      locations = (data.success && data.data) ? data.data : [];
    } catch (e) {
      console.error('Error loading locations:', e);
      locations = [];
    }
  }

  async function loadProducts() {
    try {
      const res = await fetch(API_WAREHOUSE);
      const data = await res.json();
      products = (data.success && data.data) ? data.data : [];
    } catch (e) {
      console.error('Error loading products:', e);
      products = [];
    }
  }

  async function loadSituations() {
    try {
      const res = await fetch(API_SITUATIONS);
      const data = await res.json();
      situations = (data.success && data.data) ? data.data : [];
    } catch (e) {
      console.error('Error loading situations:', e);
      situations = [];
    }
  }

  function fillRecordModalDropdowns() {
    const locSelect = document.getElementById('recordLocationCode');
    const prodSelect = document.getElementById('recordProductCode');
    const sitSelect = document.getElementById('recordSituation');

    locSelect.innerHTML = '<option value="">Select location</option>' +
      locations.map(l => `<option value="${escapeHtml(l.location)}">${escapeHtml(l.location)}</option>`).join('');

    prodSelect.innerHTML = '<option value="">Select product</option>' +
      products.map(p => `<option value="${escapeHtml(p.codigo)}">${escapeHtml(p.codigo)} - ${escapeHtml(p.nome || '')}</option>`).join('');

    const situationOptions = situations.length
      ? situations.map(s => {
          const label = (s.siprNmDescription && String(s.siprNmDescription).trim()) || ('Situation #' + s.siprSqNumber);
          return `<option value="${Number(s.siprSqNumber)}">${escapeHtml(label)}</option>`;
        }).join('')
      : '<option value="">No situations loaded</option>';
    sitSelect.innerHTML = '<option value="">Select situation</option>' + situationOptions;
  }

  function fillFilterSituation() {
    const sel = document.getElementById('filterSituation');
    const current = sel.value;
    const opts = situations.map(s => {
      const label = (s.siprNmDescription && String(s.siprNmDescription).trim()) || ('Situation #' + s.siprSqNumber);
      return `<option value="${Number(s.siprSqNumber)}">${escapeHtml(label)}</option>`;
    }).join('');
    sel.innerHTML = '<option value="">All</option>' + opts;
    sel.value = current || '';
  }

  let hasSearched = false;

  async function loadRecords() {
    hasSearched = true;
    const params = new URLSearchParams();
    if (filterLocationCode.value.trim()) params.set('locationCode', filterLocationCode.value.trim());
    if (filterProductCode.value.trim()) params.set('productCode', filterProductCode.value.trim());
    if (filterSituation.value) params.set('siprSqNumber', filterSituation.value);
    if (filterEntryFrom.value) params.set('entryFrom', new Date(filterEntryFrom.value).toISOString());
    if (filterEntryTo.value) params.set('entryTo', new Date(filterEntryTo.value).toISOString());

    try {
      const res = await fetch(`${API_LOCATION_PRODUCT}?${params}`);
      const data = await res.json();
      records = (data.success && data.data) ? data.data : [];
      renderTable();
    } catch (e) {
      console.error('Error loading records:', e);
      records = [];
      renderTable();
    }
  }

  function renderTable() {
    const tbody = document.getElementById('tableBody');
    const countEl = document.getElementById('resultsCount');

    if (!hasSearched) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fas fa-search"></i>
            <p>Use filters and click Search to load records.</p>
          </td>
        </tr>
      `;
      if (countEl) countEl.textContent = '';
      return;
    }

    if (!records.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No records. Click "New Record" to add.</p>
          </td>
        </tr>
      `;
      countEl.textContent = '0 records';
      return;
    }

    tbody.innerHTML = records.map(r => {
      const entryDt = r.entryDatetime ? (typeof r.entryDatetime === 'string' ? r.entryDatetime : new Date(r.entryDatetime).toISOString()) : '';
      return `
        <tr>
          <td>${escapeHtml(r.locationCode)}</td>
          <td>${escapeHtml(r.productCode)}</td>
          <td>${formatDateTime(r.entryDatetime)}</td>
          <td>${escapeHtml(r.situationDescription || '')}</td>
          <td>${r.quantityInformed ?? 0}</td>
          <td>${r.quantityCurrent ?? 0}</td>
          <td class="td-actions">
            <button type="button" class="btn btn-edit btn-edit-qty-current" data-location="${escapeHtml(r.locationCode)}" data-product="${escapeHtml(r.productCode)}" data-entry="${escapeHtml(entryDt)}" data-sipr="${r.siprSqNumber}" data-qty-informed="${r.quantityInformed ?? 0}" data-qty-current="${r.quantityCurrent ?? 0}" title="Edit Quantity Current">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button type="button" class="btn btn-delete btn-delete-record" data-location="${escapeHtml(r.locationCode)}" data-product="${escapeHtml(r.productCode)}" data-entry="${escapeHtml(entryDt)}" data-sipr="${r.siprSqNumber}" title="Delete">
              <i class="fas fa-trash-alt"></i> Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');

    countEl.textContent = `${records.length} record${records.length !== 1 ? 's' : ''}`;

    tbody.querySelectorAll('.btn-edit-qty-current').forEach(btn => {
      btn.addEventListener('click', () => openEditQuantityCurrentModal(btn.dataset));
    });
    tbody.querySelectorAll('.btn-delete-record').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(btn.dataset));
    });
  }

  const editQuantityCurrentModal = document.getElementById('editQuantityCurrentModal');
  const editQuantityCurrentForm = document.getElementById('editQuantityCurrentForm');

  function openEditQuantityCurrentModal(dataset) {
    document.getElementById('editLocationCode').value = dataset.location || '';
    document.getElementById('editProductCode').value = dataset.product || '';
    document.getElementById('editEntryDatetime').value = dataset.entry || '';
    document.getElementById('editSiprSqNumber').value = dataset.sipr || '';
    document.getElementById('editQuantityInformed').value = dataset.qtyInformed ?? 0;
    document.getElementById('editQuantityCurrent').value = dataset.qtyCurrent ?? 0;
    document.getElementById('editRecordSummary').textContent =
      `${dataset.location} / ${dataset.product} / ${formatDateTime(dataset.entry)} — Quantity Informed: ${dataset.qtyInformed ?? 0} (read-only)`;
    editQuantityCurrentModal.classList.add('show');
  }

  function closeEditQuantityCurrentModal() {
    editQuantityCurrentModal.classList.remove('show');
  }

  editQuantityCurrentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const locationCode = document.getElementById('editLocationCode').value;
    const productCode = document.getElementById('editProductCode').value;
    const entryDatetime = document.getElementById('editEntryDatetime').value;
    const siprSqNumber = parseInt(document.getElementById('editSiprSqNumber').value, 10);
    const quantityInformed = parseInt(document.getElementById('editQuantityInformed').value, 10) || 0;
    const quantityCurrent = parseInt(document.getElementById('editQuantityCurrent').value, 10) || 0;

    try {
      const res = await fetch(API_LOCATION_PRODUCT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationCode,
          productCode,
          entryDatetime,
          siprSqNumber,
          quantityInformed,
          quantityCurrent
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Quantity Current updated.');
        closeEditQuantityCurrentModal();
        loadRecords();
      } else {
        alert('Error: ' + (data.message || data.error || 'Failed to update'));
      }
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  });

  async function openRecordModal() {
    document.getElementById('recordModalTitle').innerHTML = '<i class="fas fa-plus"></i> New Record';
    recordForm.reset();
    document.getElementById('recordQuantityInformed').value = 0;
    document.getElementById('recordQuantityCurrent').value = 0;
    document.getElementById('recordEntryDatetime').value = toISODateTimeLocal(new Date());
    recordModal.classList.add('show');
    await Promise.all([loadLocations(), loadProducts(), loadSituations()]);
    fillRecordModalDropdowns();
  }

  function closeRecordModal() {
    recordModal.classList.remove('show');
  }

  recordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const locationCode = document.getElementById('recordLocationCode').value.trim();
    const productCode = document.getElementById('recordProductCode').value.trim();
    let entryDatetime = document.getElementById('recordEntryDatetime').value;
    if (!entryDatetime) {
      alert('Entry date/time is required.');
      return;
    }
    if (entryDatetime.length === 16) entryDatetime += ':00';
    const siprSqNumber = parseInt(document.getElementById('recordSituation').value, 10);
    const quantityInformed = parseInt(document.getElementById('recordQuantityInformed').value, 10) || 0;
    const quantityCurrent = parseInt(document.getElementById('recordQuantityCurrent').value, 10) || 0;

    const payload = {
      locationCode,
      productCode,
      entryDatetime: new Date(entryDatetime).toISOString(),
      siprSqNumber,
      quantityInformed,
      quantityCurrent,
      statCdId: 'A'
    };

    try {
      const res = await fetch(API_LOCATION_PRODUCT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Record created.');
        closeRecordModal();
        loadRecords();
      } else {
        alert('Error: ' + (data.message || data.error || 'Failed to create'));
      }
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  });

  function confirmDelete(dataset) {
    const loc = dataset.location || '';
    const prod = dataset.product || '';
    if (!confirm(`Delete record: ${loc} / ${prod}?`)) return;

    const entryEnc = encodeURIComponent(dataset.entry || '');
    const params = new URLSearchParams({
      locationCode: loc,
      productCode: prod,
      entryDatetime: dataset.entry || '',
      siprSqNumber: dataset.sipr || ''
    });

    fetch(`${API_LOCATION_PRODUCT}?${params}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert('Record deleted.');
          loadRecords();
        } else {
          alert('Error: ' + (data.message || data.error || 'Failed to delete'));
        }
      })
      .catch(err => {
        console.error(err);
        alert('Error: ' + err.message);
      });
  }

  document.getElementById('newRecordBtn').addEventListener('click', openRecordModal);
  document.getElementById('closeRecordModal').addEventListener('click', closeRecordModal);
  document.getElementById('cancelRecordBtn').addEventListener('click', closeRecordModal);
  document.getElementById('closeEditQuantityCurrentModal').addEventListener('click', closeEditQuantityCurrentModal);
  document.getElementById('cancelEditQuantityCurrentBtn').addEventListener('click', closeEditQuantityCurrentModal);
  document.getElementById('applyFiltersBtn').addEventListener('click', loadRecords);
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    filterLocationCode.value = '';
    filterProductCode.value = '';
    filterSituation.value = '';
    filterEntryFrom.value = '';
    filterEntryTo.value = '';
    loadRecords();
  });
  const printBtn = document.getElementById('printBtn');
  const printModal = document.getElementById('printModal');
  const closePrintModalBtn = document.getElementById('closePrintModal');
  const closePrintModalBtn2 = document.getElementById('closePrintModalBtn');
  const doPrintBtn = document.getElementById('doPrintBtn');
  const printLocationCodesList = document.getElementById('printLocationCodesList');

  async function openPrintModal() {
    if (!printModal || !printLocationCodesList) return;
    printModal.style.display = 'block';
    printLocationCodesList.innerHTML = '<p>Loading...</p>';
    try {
      const url = API_LOCATION_PRODUCT + '/location-codes-with-quantity';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Network response was not ok: ' + res.status);
      }
      const data = await res.json();
      let codes = [];
      if (data.success && data.data != null) {
        codes = Array.isArray(data.data)
          ? data.data.map(c => (typeof c === 'string' ? c : (c && (c.location_code || c.locationCode)) || ''))
          : [];
      }
      codes = codes.filter(c => c != null && String(c).trim() !== '');
      if (codes.length === 0) {
        printLocationCodesList.innerHTML = '<p class="empty-state">No location codes found in location_product.</p>';
        return;
      }
      const optionsHtml = codes
        .map(code => `<option value="${escapeHtml(String(code))}">${escapeHtml(String(code))}</option>`)
        .join('');
      printLocationCodesList.innerHTML = `
        <label for="printLocationCodeSelect" class="print-location-code-item">
          Location code:
          <select id="printLocationCodeSelect" class="form-control" style="margin-left:8px; min-width: 160px;">
            <option value="">Select location code</option>
            ${optionsHtml}
          </select>
        </label>
      `;
    } catch (e) {
      console.error('Print modal error:', e);
      printLocationCodesList.innerHTML = '<p class="error-message">Error loading location codes. Check console and ensure the server is running.</p>';
    }
  }

  function closePrintModal() {
    printModal.style.display = 'none';
  }

  function getSelectedLocationCode() {
    const sel = document.getElementById('printLocationCodeSelect');
    return sel && sel.value ? sel.value : null;
  }

  if (printBtn) printBtn.addEventListener('click', openPrintModal);
  if (closePrintModalBtn) closePrintModalBtn.addEventListener('click', closePrintModal);
  if (closePrintModalBtn2) closePrintModalBtn2.addEventListener('click', closePrintModal);
  if (doPrintBtn) {
    doPrintBtn.addEventListener('click', async () => {
      const selected = getSelectedLocationCode();
      if (!selected) {
        alert('Select one location code.');
        return;
      }
      try {
        const res = await fetch(API_LOCATION_PRODUCT + '?locationCode=' + encodeURIComponent(selected));
        if (!res.ok) throw new Error('Failed to load records');
        const data = await res.json();
        const allRecords = (data.success && data.data) ? data.data : [];
        const records = allRecords
          .filter(r => (r.locationCode || r.location_code) === selected)
          .sort((a, b) => {
            const pa = String(a.productCode != null ? a.productCode : a.product_code || '').toUpperCase();
            const pb = String(b.productCode != null ? b.productCode : b.product_code || '').toUpperCase();
            return pa.localeCompare(pb);
          });
        let accessType = '';
        try {
          const locRes = await fetch(API_LOCATIONS + '/code/' + encodeURIComponent(selected));
          if (locRes.ok) {
            const locData = await locRes.json();
            accessType = (locData.success && locData.data && locData.data.accessType) ? locData.data.accessType : '';
          }
        } catch (e) {}
        const printDate = new Date().toLocaleString();
        const reportData = {
          locationCode: selected,
          printDate,
          products: records.map(r => ({
            productCode: r.productCode || r.product_code,
            barcode: r.barcode || null,
            quantityCurrent: r.quantityCurrent != null ? r.quantityCurrent : r.quantity_current
          }))
        };
        if (typeof JsBarcode === 'undefined' || typeof QRCode === 'undefined') {
          alert('Barcode/QR libraries not loaded. Refresh the page and try again.');
          return;
        }
        const tempId = 'printTemp_' + Date.now();
        const temp = document.createElement('div');
        temp.id = tempId;
        temp.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
        document.body.appendChild(temp);
        const barcodeOpts = { format: 'CODE128', width: 1.5, height: 52, displayValue: true };
        const barcodeSvgs = [];
        for (let i = 0; i < records.length; i++) {
          const code = String(
            records[i].barcode != null && String(records[i].barcode).trim() !== ''
              ? records[i].barcode
              : (records[i].productCode != null ? records[i].productCode : records[i].product_code || '')
          );
          const svg = document.createElement('svg');
          svg.setAttribute('class', 'report-barcode');
          svg.id = 'bc' + i;
          temp.appendChild(svg);
          try {
            JsBarcode('#bc' + i, code, barcodeOpts);
            barcodeSvgs.push(svg.outerHTML);
          } catch (e) {
            barcodeSvgs.push('');
          }
          temp.removeChild(svg);
        }
        const qrPayload = {
          locationCode: selected,
          printDate,
          itemCount: records.length,
          barcodes: records.map(r => (
            r.barcode != null && String(r.barcode).trim() !== ''
              ? String(r.barcode).trim()
              : String(r.productCode != null ? r.productCode : r.product_code || '')
          ))
        };
        const qrText = JSON.stringify(qrPayload);
        const qrDiv = document.createElement('div');
        temp.appendChild(qrDiv);
        let qrDataUrl = '';
        try {
          new QRCode(qrDiv, { text: qrText, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
        } catch (e) {}
        const finishReport = () => {
          try {
            const canvas = qrDiv.querySelector('canvas');
            if (canvas) qrDataUrl = canvas.toDataURL('image/png');
            if (!qrDataUrl) {
              const img = qrDiv.querySelector('img');
              if (img && img.src) qrDataUrl = img.src;
            }
          } catch (e2) {}
          document.body.removeChild(temp);
          const rowsHtml = records.map((r, i) => {
            const pc = escapeHtml(String(r.productCode != null ? r.productCode : r.product_code || ''));
            const qc = r.quantityCurrent != null ? r.quantityCurrent : (r.quantity_current ?? 0);
            const barcodeHtml = barcodeSvgs[i] || '<span>-</span>';
            return `<tr>
              <td><div class="report-product-code">${pc}</div></td>
              <td>${qc}</td>
            </tr>
            <tr>
              <td colspan="2"><div class="report-barcode-wrapper">${barcodeHtml}</div></td>
            </tr>`;
          }).join('');
        const qrImgHtml = qrDataUrl ? '<img src="' + qrDataUrl.replace(/"/g, '&quot;') + '" alt="QR Code" width="180" height="180" />' : '<span>QR not generated</span>';
        const w = window.open('', '_blank', 'width=800,height=700');
        if (!w) {
          alert('Allow popups to print.');
          return;
        }
        w.document.write(`
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report - ${escapeHtml(selected)}</title>
<style>
  body{font-family:sans-serif;padding:20px;font-size:14px;}
  .report-header{text-align:center;margin-bottom:20px;border-bottom:1px solid #ccc;padding-bottom:10px;}
  table{width:100%;border-collapse:collapse;margin-bottom:30px;}
  th,td{border:1px solid #ddd;padding:10px;text-align:left;}
  th{background:#f5f5f5;font-size:32px;font-weight:bold;text-align:center;}
  th:nth-child(1){width:80%;}
  th:nth-child(2){width:20%;}
  td{font-size:20px;}
  .report-product-code{font-size:72px;font-weight:bold;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
  .report-barcode-wrapper{margin-top:4px;max-width:100%;overflow:hidden;}
  .report-barcode{display:block;max-width:100%;height:auto;}
  td:nth-child(2){font-size:72px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
  .report-footer{margin-top:30px;padding-top:15px;border-top:1px solid #ccc;font-size:30px;}
  .report-footer .row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;}
  .report-location-code{font-size:40px;font-weight:bold;}
</style>
</head><body>
<div class="report-header"></div>
<table>
  <thead><tr><th>Barcode (Product)</th><th>QTY Current</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div class="report-footer">
  <div class="row">
    <div>
      <strong>Print date:</strong> ${escapeHtml(printDate)}<br>
      <strong>Location code: <span class="report-location-code">${escapeHtml(selected)}</span></strong><br>
      <strong>Access type: ${escapeHtml(accessType || '-')}</strong>
    </div>
    <div>${qrImgHtml}</div>
  </div>
</div>
</body></html>
        `);
        w.document.close();
        w.focus();
        setTimeout(function() { w.print(); }, 800);
        };
        const waitForQr = (attemptsLeft, cb) => {
          const canvas = qrDiv.querySelector('canvas');
          const img = qrDiv.querySelector('img');
          if (canvas || (img && img.src)) {
            cb();
            return;
          }
          if (attemptsLeft <= 0) {
            cb();
            return;
          }
          setTimeout(() => waitForQr(attemptsLeft - 1, cb), 100);
        };
        waitForQr(15, finishReport);
      } catch (e) {
        console.error(e);
        alert('Error loading report data.');
      }
    });
  }
  if (printModal) printModal.addEventListener('click', (e) => { if (e.target === printModal) closePrintModal(); });

  recordModal.addEventListener('click', (e) => { if (e.target === recordModal) closeRecordModal(); });
  editQuantityCurrentModal.addEventListener('click', (e) => { if (e.target === editQuantityCurrentModal) closeEditQuantityCurrentModal(); });

  (async () => {
    await Promise.all([loadLocations(), loadProducts(), loadSituations()]);
    fillFilterSituation();
    renderTable();
  })();
});
