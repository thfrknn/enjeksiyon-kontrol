/* ── Denetleyici Paneli ───────────────────────────────── */

var _session       = JSON.parse(localStorage.getItem('denetleyici_session') || 'null');
var _records       = [];
var _deleteRow     = null;
var _isEditMode    = false;
var _kasaEbatlari  = [];
var _uretimLimiti  = 2700;

/* ================================================================
   Init
   ================================================================ */

window.onload = function () {
  if (!_session || !_session.id) {
    window.location.href = 'index.html';
    return;
  }
  // Şifre yoksa localStorage'dan dene
  if (!_session.sifre) {
    var kayitliSifre = localStorage.getItem('sifre_' + _session.id);
    if (kayitliSifre) _session.sifre = kayitliSifre;
  }

  document.getElementById('header-user').textContent = 'Denetleyici: ' + _session.ad;
  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Varsayılan tarih aralığı: bugün
  var today = new Date().toISOString().split('T')[0];
  document.getElementById('bas-tarih').value = today;
  document.getElementById('bit-tarih').value = today;

  // Kasa listesi ve üretim limitini yükle
  loadLists();
};

function loadLists() {
  var cb = 'cbDenLists_' + Date.now();
  window[cb] = function (json) {
    delete window[cb];
    removeScript('jsonp-den-lists');
    _kasaEbatlari = json.kasaEbatlari || [];
    _uretimLimiti = parseInt(json.uretimLimiti) || 2700;
    fillKasaDropdowns();
  };
  var s = document.createElement('script');
  s.id  = 'jsonp-den-lists';
  s.src = SCRIPT_URL + '?action=getLists&callback=' + cb;
  s.onerror = function () { delete window[cb]; };
  document.head.appendChild(s);
}

function fillKasaDropdowns() {
  ['edit-enj1-kasa', 'edit-enj2-kasa'].forEach(function (id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">— Seçin —</option>';
    _kasaEbatlari.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = k;
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  });
}

/* ================================================================
   Veri Yükleme
   ================================================================ */

function loadRecords() {
  var basTarih = document.getElementById('bas-tarih').value;
  var basSaat  = document.getElementById('bas-saat').value || '00:00';
  var bitTarih = document.getElementById('bit-tarih').value;
  var bitSaat  = document.getElementById('bit-saat').value || '23:59';

  if (!basTarih || !bitTarih) { showToast('Lütfen tarih aralığı girin', 'err'); return; }

  showLoading('Kayıtlar yükleniyor...');

  var cb = 'cbRec_' + Date.now();
  window[cb] = function (json) {
    delete window[cb];
    hideLoading();
    removeScript('jsonp-rec');
    if (json.error) { showToast('Hata: ' + json.error, 'err'); return; }
    _records = json.records || [];
    renderRecords();
  };

  var s = document.createElement('script');
  s.id  = 'jsonp-rec';
  s.src = SCRIPT_URL
    + '?action=getRecords'
    + '&admin_id='         + encodeURIComponent(_session.id)
    + '&sifre='            + encodeURIComponent(_session.sifre || '')
    + '&baslangic_tarih='  + encodeURIComponent(basTarih)
    + '&baslangic_saat='   + encodeURIComponent(basSaat)
    + '&bitis_tarih='      + encodeURIComponent(bitTarih)
    + '&bitis_saat='       + encodeURIComponent(bitSaat)
    + '&callback='         + cb;
  s.onerror = function () {
    delete window[cb];
    hideLoading();
    showToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

function renderRecords() {
  var tbody   = document.getElementById('records-tbody');
  var card    = document.getElementById('records-card');
  var empty   = document.getElementById('records-empty');
  var summary = document.getElementById('records-summary');

  tbody.innerHTML = '';

  if (!_records.length) {
    card.style.display    = 'none';
    empty.style.display   = 'block';
    summary.style.display = 'none';
    return;
  }

  card.style.display    = 'block';
  empty.style.display   = 'none';
  summary.style.display = 'block';
  summary.textContent   = _records.length + ' kayıt bulundu';

  _records.forEach(function (r, idx) {
    var u1   = Number(r.enj1Uretim) || 0;
    var u2   = Number(r.enj2Uretim) || 0;
    var warn = u1 > _uretimLimiti || u2 > _uretimLimiti;
    var hasEnj2 = r.enj2No && r.enj2No !== '00';

    var uretim1Cell = warn && u1 > _uretimLimiti
      ? '<td style="text-align:right;font-weight:800;color:#dc2626">⚠️ ' + fmt(u1) + '</td>'
      : '<td style="text-align:right;font-weight:800;color:var(--success)">' + fmt(u1) + '</td>';

    var uretim2Cell = hasEnj2
      ? (warn && u2 > _uretimLimiti
          ? '<td style="text-align:right;font-weight:800;color:#dc2626">⚠️ ' + fmt(u2) + '</td>'
          : '<td style="text-align:right;font-weight:800;color:var(--success)">' + fmt(u2) + '</td>')
      : '<td>—</td>';

    var tr = document.createElement('tr');
    if (warn) tr.style.background = '#fff1f2';

    tr.innerHTML =
      '<td style="color:var(--text2);font-size:11px">' + r.rowIdx + '</td>' +
      '<td style="font-size:11px;color:var(--text2)">' + (r.kayitZamani || '') + '</td>' +
      '<td>' + (r.vardiyaTarihi || '') + '</td>' +
      '<td style="font-weight:800">' + (r.adSoyad || '') + '</td>' +
      '<td><span style="background:var(--den-light);color:var(--den);border-radius:6px;padding:2px 7px;font-size:12px;font-weight:800">' + (r.vardiya || '') + '</span></td>' +
      '<td style="font-weight:700">' + (r.enj1No || '') + '</td>' +
      '<td>' + (r.enj1Kasa || '') + '</td>' +
      '<td style="text-align:right">' + fmt(r.enj1SayacBas) + '</td>' +
      '<td style="text-align:right">' + fmt(r.enj1SayacBit) + '</td>' +
      uretim1Cell +
      '<td style="text-align:right;color:#ea580c">' + fmt(r.enj1Fire) + '</td>' +
      '<td style="font-weight:700;color:var(--text2)">' + (hasEnj2 ? r.enj2No : '—') + '</td>' +
      '<td>' + (hasEnj2 ? (r.enj2Kasa || '') : '—') + '</td>' +
      '<td style="text-align:right">' + (hasEnj2 ? fmt(r.enj2SayacBas) : '—') + '</td>' +
      '<td style="text-align:right">' + (hasEnj2 ? fmt(r.enj2SayacBit) : '—') + '</td>' +
      uretim2Cell +
      '<td style="text-align:right;color:#ea580c">' + (hasEnj2 ? fmt(r.enj2Fire) : '—') + '</td>' +
      (function() {
        if (!r.onay) return '<td style="color:var(--text2);font-size:11px">—</td>';
        var isOnay = r.onay.indexOf('ONAYLANDI') === 0;
        return '<td style="white-space:nowrap"><span style="background:' + (isOnay ? '#dcfce7;color:#16a34a' : '#fef9c3;color:#92400e') + ';border-radius:5px;padding:2px 6px;font-size:11px;font-weight:800">' + (isOnay ? '✓ Onaylı' : '⏳ Bekliyor') + '</span></td>';
      })() +
      '<td style="white-space:nowrap">' +
        '<button class="action-btn edit"   onclick="openEditModal(' + idx + ')">✏️ Düzenle</button> ' +
        '<button class="action-btn delete" onclick="openDeleteModal(' + idx + ')">🗑️</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
}

function fmt(n) {
  if (n === '' || n === null || n === undefined) return '—';
  return Number(n).toLocaleString('tr-TR');
}

/* ================================================================
   Edit Modal
   ================================================================ */

function openEditModal(idx) {
  _isEditMode = true;
  var r = _records[idx];
  document.getElementById('modal-icon').textContent  = '✏️';
  document.getElementById('modal-title').textContent = 'Kayıt Düzenle — Satır ' + r.rowIdx;
  document.getElementById('save-btn').textContent    = '💾 Güncelle';

  document.getElementById('edit-row-idx').value        = r.rowIdx;
  document.getElementById('edit-vardiya-tarihi').value  = r.vardiyaTarihi || '';
  document.getElementById('edit-vardiya').value         = r.vardiya || 'SABAH';
  document.getElementById('edit-ad-soyad').value        = r.adSoyad || '';
  document.getElementById('edit-olcum-saat').value      = r.olcumSaat || '';
  document.getElementById('edit-enj-sayisi').value      = String(r.enjSayisi || 1);
  document.getElementById('edit-enj1-no').value         = r.enj1No || '';
  document.getElementById('edit-enj1-kasa').value       = r.enj1Kasa || '';
  document.getElementById('edit-enj1-cevrim').value     = r.enj1Cevrim || '';
  document.getElementById('edit-enj1-agirlik').value    = r.enj1Agirlik || '';
  document.getElementById('edit-enj1-sayac-bas').value  = r.enj1SayacBas || '';
  document.getElementById('edit-enj1-sayac-bit').value  = r.enj1SayacBit || '';
  document.getElementById('edit-enj1-fire').value       = r.enj1Fire || 0;
  document.getElementById('edit-enj2-no').value         = r.enj2No || '';
  document.getElementById('edit-enj2-kasa').value       = r.enj2Kasa || '';
  document.getElementById('edit-enj2-cevrim').value     = r.enj2Cevrim || '';
  document.getElementById('edit-enj2-agirlik').value    = r.enj2Agirlik || '';
  document.getElementById('edit-enj2-sayac-bas').value  = r.enj2SayacBas || '';
  document.getElementById('edit-enj2-sayac-bit').value  = r.enj2SayacBit || '';
  document.getElementById('edit-enj2-fire').value       = r.enj2Fire || 0;

  fillKasaDropdowns();
  // Kasa değerini dropdown'da seç
  document.getElementById('edit-enj1-kasa').value = r.enj1Kasa || '';
  document.getElementById('edit-enj2-kasa').value = r.enj2Kasa || '';

  toggleEnj2Section();
  calcPreview();
  document.getElementById('edit-modal').style.display = 'flex';
}

function openAddModal() {
  _isEditMode = false;
  document.getElementById('modal-icon').textContent  = '➕';
  document.getElementById('modal-title').textContent = 'Yeni Kayıt Ekle';
  document.getElementById('save-btn').textContent    = '➕ Ekle';

  // Clear all fields
  var ids = ['edit-row-idx','edit-vardiya-tarihi','edit-ad-soyad',
    'edit-olcum-saat',
    'edit-enj1-no','edit-enj1-kasa','edit-enj1-cevrim','edit-enj1-agirlik',
    'edit-enj1-sayac-bas','edit-enj1-sayac-bit','edit-enj1-fire',
    'edit-enj2-no','edit-enj2-kasa','edit-enj2-cevrim','edit-enj2-agirlik',
    'edit-enj2-sayac-bas','edit-enj2-sayac-bit','edit-enj2-fire'];
  ids.forEach(function(id) { document.getElementById(id).value = ''; });

  document.getElementById('edit-vardiya').value    = 'SABAH';
  document.getElementById('edit-enj-sayisi').value = '1';
  document.getElementById('edit-enj1-fire').value  = '0';
  document.getElementById('edit-enj2-fire').value  = '0';

  // Varsayılan tarih: bugün
  document.getElementById('edit-vardiya-tarihi').value =
    new Date().toISOString().split('T')[0];
  document.getElementById('edit-olcum-no').value = '1';

  toggleEnj2Section();
  calcPreview();
  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

function toggleEnj2Section() {
  var v = document.getElementById('edit-enj-sayisi').value;
  document.getElementById('enj2-section').style.display = v === '2' ? 'block' : 'none';
  calcPreview();
}

function calcPreview() {
  var bas1 = parseInt(document.getElementById('edit-enj1-sayac-bas').value) || 0;
  var bit1 = parseInt(document.getElementById('edit-enj1-sayac-bit').value) || 0;
  var u1   = Math.max(0, bit1 - bas1);
  var p1   = document.getElementById('calc-preview-1');
  if (bas1 || bit1) {
    p1.style.display = 'block';
    p1.textContent   = '→ Enj1 Üretim: ' + u1.toLocaleString('tr-TR') + ' adet';
  } else {
    p1.style.display = 'none';
  }

  if (document.getElementById('edit-enj-sayisi').value === '2') {
    var bas2 = parseInt(document.getElementById('edit-enj2-sayac-bas').value) || 0;
    var bit2 = parseInt(document.getElementById('edit-enj2-sayac-bit').value) || 0;
    var u2   = Math.max(0, bit2 - bas2);
    var p2   = document.getElementById('calc-preview-2');
    if (bas2 || bit2) {
      p2.style.display = 'block';
      p2.textContent   = '→ Enj2 Üretim: ' + u2.toLocaleString('tr-TR') + ' adet';
    } else {
      p2.style.display = 'none';
    }
  }
}

function saveRecord() {
  var btn = document.getElementById('save-btn');
  btn.disabled = true;

  var params = {
    admin_id:       _session.id,
    sifre:          _session.sifre || '',
    vardiya_tarihi: document.getElementById('edit-vardiya-tarihi').value,
    vardiya:        document.getElementById('edit-vardiya').value,
    ad_soyad:       document.getElementById('edit-ad-soyad').value.trim(),
    olcum_saat:     document.getElementById('edit-olcum-saat').value,
    enj_sayisi:     document.getElementById('edit-enj-sayisi').value,
    enj1_no:        document.getElementById('edit-enj1-no').value.trim(),
    enj1_kasa:      document.getElementById('edit-enj1-kasa').value.trim(),
    enj1_cevrim:    document.getElementById('edit-enj1-cevrim').value,
    enj1_agirlik:   document.getElementById('edit-enj1-agirlik').value,
    enj1_sayac_bas: document.getElementById('edit-enj1-sayac-bas').value,
    enj1_sayac_bit: document.getElementById('edit-enj1-sayac-bit').value,
    enj1_fire:      document.getElementById('edit-enj1-fire').value,
    enj2_no:        document.getElementById('edit-enj2-no').value.trim(),
    enj2_kasa:      document.getElementById('edit-enj2-kasa').value.trim(),
    enj2_cevrim:    document.getElementById('edit-enj2-cevrim').value,
    enj2_agirlik:   document.getElementById('edit-enj2-agirlik').value,
    enj2_sayac_bas: document.getElementById('edit-enj2-sayac-bas').value,
    enj2_sayac_bit: document.getElementById('edit-enj2-sayac-bit').value,
    enj2_fire:      document.getElementById('edit-enj2-fire').value,
  };

  if (!params.ad_soyad) { showToast('Ad Soyad gerekli', 'err'); btn.disabled = false; return; }
  if (!params.enj1_no)  { showToast('Enj1 makine no gerekli', 'err'); btn.disabled = false; return; }

  var action, scriptId;
  if (_isEditMode) {
    params.row_idx = document.getElementById('edit-row-idx').value;
    action = 'updateRecord';
    scriptId = 'jsonp-update';
  } else {
    action = 'manualAddRecord';
    scriptId = 'jsonp-add';
  }

  var qs = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');

  var cb = 'cbSave_' + Date.now();
  window[cb] = function (json) {
    delete window[cb];
    btn.disabled = false;
    removeScript(scriptId);
    if (json.error) { showToast('Hata: ' + json.error, 'err'); return; }
    closeEditModal();
    showToast(_isEditMode ? '✅ Kayıt güncellendi' : '✅ Kayıt eklendi', 'ok');
    loadRecords();
  };

  var s = document.createElement('script');
  s.id  = scriptId;
  s.src = SCRIPT_URL + '?action=' + action + '&' + qs + '&callback=' + cb;
  s.onerror = function () {
    delete window[cb];
    btn.disabled = false;
    showToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ================================================================
   Delete Modal
   ================================================================ */

function openDeleteModal(idx) {
  var r = _records[idx];
  _deleteRow = r.rowIdx;
  document.getElementById('delete-modal-body').innerHTML =
    'Satır <strong>' + r.rowIdx + '</strong> silinecek:<br>' +
    '<strong>' + (r.adSoyad || '') + '</strong> — ' +
    (r.vardiyaTarihi || '') + ' ' + (r.vardiya || '') +
    ' — ' + (r.enj1No || '');
  document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
  _deleteRow = null;
}

function confirmDelete() {
  if (!_deleteRow) return;
  closeDeleteModal();
  showLoading('Siliniyor...');

  var cb = 'cbDel_' + Date.now();
  window[cb] = function (json) {
    delete window[cb];
    hideLoading();
    removeScript('jsonp-del');
    if (json.error) { showToast('Hata: ' + json.error, 'err'); return; }
    showToast('🗑️ Kayıt silindi', 'ok');
    loadRecords();
  };

  var s = document.createElement('script');
  s.id  = 'jsonp-del';
  s.src = SCRIPT_URL
    + '?action=deleteRecord'
    + '&admin_id=' + encodeURIComponent(_session.id)
    + '&sifre='    + encodeURIComponent(_session.sifre || '')
    + '&row_idx='  + encodeURIComponent(_deleteRow)
    + '&callback=' + cb;
  s.onerror = function () {
    delete window[cb];
    hideLoading();
    showToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ================================================================
   Yardımcılar
   ================================================================ */

function cikisYap() {
  localStorage.removeItem('denetleyici_session');
  window.location.href = 'index.html';
}

function showLoading(msg) {
  var el = document.getElementById('loading');
  var tx = document.getElementById('load-text');
  if (tx) tx.textContent = msg || 'Yükleniyor...';
  if (el) el.classList.add('show');
}

function hideLoading() {
  var el = document.getElementById('loading');
  if (el) el.classList.remove('show');
}

function showToast(msg, type) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast ' + (type || 'ok');
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 3000);
}

function removeScript(id) {
  var s = document.getElementById(id);
  if (s) s.remove();
}
