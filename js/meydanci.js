/* ── Meydancı / Tekniker Paneli ─────────────────────── */

const _userId   = sessionStorage.getItem('ep_id')   || '';
const _userName = sessionStorage.getItem('ep_name') || '';

let _statuses     = {};
let _arizaTipleri = [];
let _machineData  = {};
let _kasaEbatlari = [];   // Ayarlar B sütunundan gelen kasa listesi
let _atananKasalar = {};  // Makine → atanan kasa
let _timeOffset   = 0;

/* ---------- Init ---------- */

window.onload = function() {
  if (!_userId) { window.location.href = 'index.html'; return; }

  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  document.getElementById('user-header').textContent = 'Tekniker: ' + _userName;

  loadStatuses();
  setInterval(loadStatuses, 60000);
};

/* ---------- Sunucudan makine durumları ---------- */

function loadStatuses() {
  document.getElementById('loading').classList.add('show');
  document.getElementById('load-text').textContent = 'Yükleniyor...';

  const cb = 'cbMS_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    if (json.serverTime) _timeOffset = json.serverTime - Date.now();
    _statuses      = json.statuses      || {};
    _machineData   = json.machineData   || {};
    _kasaEbatlari  = json.kasaEbatlari  || [];
    _atananKasalar = json.atananKasalar || {};
    _arizaTipleri  = (json.arizaTipleri && json.arizaTipleri.length)
      ? json.arizaTipleri
      : ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Diğer'];
    renderMachines();
  };

  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?action=getMachineStatuses&callback=' + cb;
  s.onerror = function() {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    if (!_arizaTipleri.length) _arizaTipleri = ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Diğer'];
    renderMachines();
    showMToast('Sunucu bağlantısı kurulamadı', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Saat yardımcısı ---------- */

function nowTime() {
  const n = new Date(Date.now() + _timeOffset);
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

/* ---------- Kart render ---------- */

function renderMachines() {
  const container = document.getElementById('machines-container');

  // Açık kartları kaydet
  const openCards = new Set();
  for (let i = 1; i <= 12; i++) {
    const b = document.getElementById('mcard-body-' + i);
    if (b && b.style.display !== 'none') openCards.add(i);
  }

  container.innerHTML = '';
  for (let i = 1; i <= 12; i++) {
    const makineNo = 'Enjeksiyon ' + i;
    const status   = _statuses[makineNo] || { durum: 'Aktif', sonAriza: null };
    container.appendChild(buildCard(i, makineNo, status));
    if (openCards.has(i)) {
      document.getElementById('mcard-body-' + i).style.display = 'block';
      document.getElementById('mcard-arrow-' + i).textContent  = '▲';
    }
  }
}

function buildCard(n, makineNo, status) {
  const isArizali = status.durum === 'Arızalı';
  const div       = document.createElement('div');
  div.className   = 'mcard' + (isArizali ? ' mcard-red' : '');
  div.id          = 'mcard-' + n;

  const radios = _arizaTipleri.map((tip, i) =>
    `<label class="rad-lbl">
       <input type="radio" name="tip-${n}" value="${tip}"${i === 0 ? ' checked' : ''}> ${tip}
     </label>`
  ).join('');

  // Canlı İzleme'den gelen son metrikler
  const md = _machineData[makineNo];

  // Kapalı bar — 2. satır içeriği
  let infoLine = '';
  if (isArizali && status.sonAriza) {
    const arizaText = status.sonAriza.tip
      + (status.sonAriza.sorun ? ': ' + status.sonAriza.sorun.substring(0, 40)
          + (status.sonAriza.sorun.length > 40 ? '…' : '') : '');
    infoLine = `<div class="mcard-info-row mcard-info-red">⚠️ ${arizaText}</div>`;
  } else if (md) {
    const chips = [];
    const kasaGoster = _atananKasalar[makineNo] || (md && md.kasa) || '';
    if (kasaGoster) chips.push(`<span class="mchip">📦 ${kasaGoster}</span>`);
    if (md && md.cevrim)   chips.push(`<span class="mchip">⏱ ${md.cevrim} sn</span>`);
    if (md && md.operatör) chips.push(`<span class="mchip">👤 ${md.operatör.split(' ')[0]}</span>`);
    if (chips.length) infoLine = `<div class="mcard-info-row">${chips.join('')}</div>`;
  }

  div.innerHTML = `
    <div class="mcard-hd" onclick="toggleCard(${n})">
      <div class="mcard-hd-inner">
        <div class="mcard-top">
          <span class="mcard-no">Enjeksiyon ${n}</span>
          <span class="mbadge ${isArizali ? 'mbadge-red' : 'mbadge-green'}">
            ${isArizali ? '⚠️ Arızalı' : '✅ Aktif'}
          </span>
        </div>
        ${infoLine}
      </div>
      <span class="mcard-arrow" id="mcard-arrow-${n}">▼</span>
    </div>

    <div class="mcard-bd" id="mcard-body-${n}" style="display:none">

      <!-- Makine aç/kapat -->
      <button class="m-toggle-btn ${isArizali ? 'mtbtn-green' : 'mtbtn-red'}"
              id="toggle-btn-${n}"
              onclick="doToggle(${n}, '${makineNo}')">
        ${isArizali ? '🟢 Makineyi Aç' : '🔴 Makineyi Kapat'}
      </button>

      <!-- Arıza formu -->
      <div class="mcard-section">
        <div class="mcard-sec-title">⚠️ Arıza Kaydı Oluştur</div>

        <div class="field">
          <label>Arıza Tipi</label>
          <div class="rad-group">${radios}</div>
        </div>

        <div class="field">
          <label>Sorun Tanımı <span class="req">*</span></label>
          <textarea id="sorun-${n}" rows="3" class="mtextarea"
                    placeholder="Sorunu kısaca açıklayın..."></textarea>
          <div class="err-msg" id="err-sorun-${n}">Sorun tanımı gerekli</div>
        </div>

        <div class="field">
          <label>Çözüm Tanımı</label>
          <textarea id="cozum-${n}" rows="2" class="mtextarea"
                    placeholder="Çözüm (isteğe bağlı)..."></textarea>
        </div>

        <div class="row2">
          <div class="field">
            <label>Başlangıç Saati</label>
            <input type="time" id="bas-${n}" value="${nowTime()}">
          </div>
          <div class="field">
            <label>Bitiş Saati</label>
            <input type="time" id="bit-${n}">
          </div>
        </div>

        <button class="btn" onclick="submitAriza(${n}, '${makineNo}')"
                style="width:100%;background:#dc2626;color:white;padding:15px;border:none;border-radius:14px;font-size:16px;font-weight:800;font-family:'Nunito',sans-serif;cursor:pointer">
          💾 Arıza Kaydet
        </button>
      </div>

      <!-- Kasa ebatı tanımla -->
      <div class="mcard-section">
        <div class="mcard-sec-title" style="color:var(--accent)">📦 Kasa Ebatı Tanımla</div>
        ${_atananKasalar[makineNo]
          ? `<div style="font-size:13px;font-weight:700;color:var(--success);margin-bottom:10px">
               Mevcut: <strong>${_atananKasalar[makineNo]}</strong>
             </div>`
          : `<div style="font-size:12px;color:var(--text2);margin-bottom:10px">Henüz atanmadı</div>`
        }
        <div style="display:flex;gap:8px;align-items:stretch">
          <select id="kasa-sel-${n}"
                  style="flex:1;padding:12px 14px;font-size:15px;font-family:'Nunito',sans-serif;font-weight:600;color:var(--text);background:white;border:2px solid var(--border);border-radius:12px;outline:none;-webkit-appearance:none;appearance:none">
            <option value="">— Kasa seç —</option>
            ${_kasaEbatlari.map(k =>
              `<option value="${k}"${_atananKasalar[makineNo] === k ? ' selected' : ''}>${k}</option>`
            ).join('')}
          </select>
          <button onclick="saveKasa(${n}, '${makineNo}')"
                  style="flex-shrink:0;padding:12px 16px;background:var(--accent);color:white;border:none;border-radius:12px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;cursor:pointer">
            Kaydet
          </button>
        </div>
      </div>

    </div>
  `;

  return div;
}

/* ---------- Kart aç/kapat ---------- */

function toggleCard(n) {
  const body  = document.getElementById('mcard-body-' + n);
  const arrow = document.getElementById('mcard-arrow-' + n);
  const open  = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent  = open ? '▼' : '▲';
}

/* ---------- Makine durum toggle ---------- */

function doToggle(n, makineNo) {
  const isArizali = (_statuses[makineNo] || {}).durum === 'Arızalı';
  const newDurum  = isArizali ? 'Aktif' : 'Arızalı';

  document.getElementById('loading').classList.add('show');
  document.getElementById('load-text').textContent = 'Güncelleniyor...';

  const cb = 'cbTM_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    if (json.result === 'ok') {
      if (!_statuses[makineNo]) _statuses[makineNo] = {};
      _statuses[makineNo].durum = newDurum;
      renderMachines();
      // Kartı tekrar aç
      const body = document.getElementById('mcard-body-' + n);
      if (body) {
        body.style.display = 'block';
        document.getElementById('mcard-arrow-' + n).textContent = '▲';
      }
      showMToast(newDurum === 'Aktif' ? '✅ Makine açıldı' : '🔴 Makine kapatıldı', 'ok');
    } else {
      showMToast('Güncelleme hatası', 'err');
    }
  };

  const s = document.createElement('script');
  s.src = SCRIPT_URL
    + '?action=toggleMachine'
    + '&makine_no=' + encodeURIComponent(makineNo)
    + '&durum='     + encodeURIComponent(newDurum)
    + '&callback='  + cb;
  s.onerror = function() {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    showMToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Arıza kaydet ---------- */

function submitAriza(n, makineNo) {
  const sorunEl = document.getElementById('sorun-' + n);
  const errEl   = document.getElementById('err-sorun-' + n);

  if (!sorunEl.value.trim()) {
    sorunEl.style.borderColor = 'var(--warn)';
    errEl.classList.add('show');
    sorunEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  sorunEl.style.borderColor = '';
  errEl.classList.remove('show');

  const tipEl = document.querySelector(`input[name="tip-${n}"]:checked`);
  const tip   = tipEl ? tipEl.value : '';
  const sorun = sorunEl.value.trim();
  const cozum = document.getElementById('cozum-' + n).value.trim();
  const bas   = document.getElementById('bas-' + n).value || '';
  const bit   = document.getElementById('bit-' + n).value || '';

  document.getElementById('loading').classList.add('show');
  document.getElementById('load-text').textContent = 'Kaydediliyor...';

  const cb = 'cbAR_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    if (json.result === 'ok') {
      if (!_statuses[makineNo]) _statuses[makineNo] = {};
      _statuses[makineNo].durum    = bit ? 'Aktif' : 'Arızalı';
      _statuses[makineNo].sonAriza = { tip, sorun };
      renderMachines();
      // Kartı tekrar aç
      const body = document.getElementById('mcard-body-' + n);
      if (body) {
        body.style.display = 'block';
        document.getElementById('mcard-arrow-' + n).textContent = '▲';
      }
      showMToast('✅ Arıza kaydedildi', 'ok');
    } else {
      showMToast('Kayıt hatası, tekrar dene', 'err');
    }
  };

  const params = new URLSearchParams({
    action:      'logAriza',
    makine_no:   makineNo,
    ariza_tipi:  tip,
    sorun,
    cozum,
    bas_saat:    bas,
    bit_saat:    bit,
    tekniker_id: _userId,
    tekniker_ad: _userName,
    callback:    cb,
  });

  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?' + params.toString();
  s.onerror = function() {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    showMToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Kasa kaydet ---------- */

function saveKasa(n, makineNo) {
  const sel  = document.getElementById('kasa-sel-' + n);
  const kasa = sel ? sel.value : '';
  if (!kasa) { showMToast('Lütfen kasa seçin', 'err'); return; }

  document.getElementById('loading').classList.add('show');
  document.getElementById('load-text').textContent = 'Kaydediliyor...';

  const cb = 'cbKS_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    if (json.result === 'ok') {
      _atananKasalar[makineNo] = kasa;
      renderMachines();
      // Kartı tekrar aç
      const body = document.getElementById('mcard-body-' + n);
      if (body) {
        body.style.display = 'block';
        document.getElementById('mcard-arrow-' + n).textContent = '▲';
      }
      showMToast('✅ Kasa atandı: ' + kasa, 'ok');
    } else {
      showMToast('Kayıt hatası', 'err');
    }
  };

  const s = document.createElement('script');
  s.src = SCRIPT_URL
    + '?action=setMachineKasa'
    + '&makine_no=' + encodeURIComponent(makineNo)
    + '&kasa='      + encodeURIComponent(kasa)
    + '&tekniker='  + encodeURIComponent(_userName)
    + '&callback='  + cb;
  s.onerror = function() {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    showMToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Toast ---------- */

function showMToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (type || 'ok') + ' show';
  setTimeout(() => t.classList.remove('show'), 3500);
}
