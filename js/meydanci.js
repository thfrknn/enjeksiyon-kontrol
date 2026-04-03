/* ── Meydancı / Tekniker Paneli ─────────────────────── */

const _userId   = sessionStorage.getItem('ep_id')   || '';
const _userName = sessionStorage.getItem('ep_name') || '';

let _statuses      = {};
let _arizaTipleri  = [];
let _machineData   = {};
let _kasaEbatlari  = [];
let _atananKasalar = {};
let _timeOffset    = 0;

/* ---------- Init ---------- */

window.onload = function() {
  if (!_userId) { window.location.href = 'index.html'; return; }

  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  document.getElementById('user-header').textContent = 'Meydancı: ' + _userName;

  loadStatuses(false);                                         // İlk açılış — loading göster
  setInterval(function() { loadStatuses(true); }, 60000);     // Arka plan — sessiz
};

/* ---------- Veri yükleme ---------- */

function loadStatuses(silent) {
  if (!silent) {
    document.getElementById('loading').classList.add('show');
    document.getElementById('load-text').textContent = 'Yükleniyor...';
  }

  const cb = 'cbMS_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    if (!silent) document.getElementById('loading').classList.remove('show');
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
    if (!silent) document.getElementById('loading').classList.remove('show');
    if (!_arizaTipleri.length) _arizaTipleri = ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Diğer'];
    renderMachines();
    if (!silent) showMToast('Sunucu bağlantısı kurulamadı', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Saat ---------- */

function nowTime() {
  const n = new Date(Date.now() + _timeOffset);
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

/* ---------- Render ---------- */

function renderMachines() {
  const container = document.getElementById('machines-container');

  // Açık kartları koru
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

/* ---------- Kart oluştur ---------- */

function buildCard(n, makineNo, status) {
  const durum     = status.durum || 'Aktif';
  const isAktif   = durum === 'Aktif';
  const isArizali = durum === 'Arızalı';
  const isKapali  = !isAktif;  // Arızalı veya Kapalı

  const div     = document.createElement('div');
  div.className = 'mcard' + (isKapali ? ' mcard-red' : '');
  div.id        = 'mcard-' + n;

  // Canlı metrik chip'leri (aktif makinede kapanmış bar)
  const md = _machineData[makineNo];
  let infoLine = '';
  if (isKapali && status.sonAriza) {
    const t = status.sonAriza.tip || '';
    const s = status.sonAriza.sorun ? ': ' + status.sonAriza.sorun.substring(0, 40) + (status.sonAriza.sorun.length > 40 ? '…' : '') : '';
    infoLine = `<div class="mcard-info-row mcard-info-red">⚠️ ${t}${s}</div>`;
  } else if (md) {
    const chips = [];
    const kg = _atananKasalar[makineNo] || (md && md.kasa) || '';
    if (kg)             chips.push(`<span class="mchip">📦 ${kg}</span>`);
    if (md.cevrim)      chips.push(`<span class="mchip">⏱ ${md.cevrim} sn</span>`);
    if (md.operatör)    chips.push(`<span class="mchip">👤 ${md.operatör.split(' ')[0]}</span>`);
    if (chips.length)   infoLine = `<div class="mcard-info-row">${chips.join('')}</div>`;
  }

  // Badge renk ve metni
  let badgeCls = 'mbadge-green', badgeTxt = '✅ Aktif';
  if (isArizali)              { badgeCls = 'mbadge-red';    badgeTxt = '⚠️ Arızalı'; }
  else if (durum === 'Kapalı') { badgeCls = 'mbadge-orange'; badgeTxt = '🔒 Kapalı'; }

  // Kasa bölümü (ortak)
  const kasaOptions = _kasaEbatlari.map(k =>
    `<option value="${k}"${_atananKasalar[makineNo] === k ? ' selected' : ''}>${k}</option>`
  ).join('');
  const kasaMevcut = _atananKasalar[makineNo]
    ? `<div style="font-size:13px;font-weight:700;color:var(--success);margin-bottom:10px">Mevcut: <strong>${_atananKasalar[makineNo]}</strong></div>`
    : `<div style="font-size:12px;color:var(--text2);margin-bottom:10px">Henüz atanmadı</div>`;

  // Arıza tipi radyoları
  const arizaTipRadios = _arizaTipleri.map((tip, i) =>
    `<label class="rad-lbl">
       <input type="radio" name="tip-${n}" value="${tip}"${i === 0 ? ' checked' : ''}> ${tip}
     </label>`
  ).join('');

  /* ── Aktif makine formu ── */
  const aktifForm = `
    <!-- Kapatma nedeni -->
    <div class="mcard-section">
      <div class="mcard-sec-title" style="color:#b91c1c">🔴 Makineyi Kapat</div>

      <div class="field">
        <label>Kapatma Nedeni</label>
        <div class="rad-group" id="neden-grp-${n}">
          <label class="rad-lbl">
            <input type="radio" name="neden-${n}" value="Arıza" onchange="onNedenChange(${n})" checked> Arıza
          </label>
          <label class="rad-lbl">
            <input type="radio" name="neden-${n}" value="Temizlik" onchange="onNedenChange(${n})"> Temizlik
          </label>
          <label class="rad-lbl">
            <input type="radio" name="neden-${n}" value="Planlı Bakım" onchange="onNedenChange(${n})"> Planlı Bakım
          </label>
          <label class="rad-lbl">
            <input type="radio" name="neden-${n}" value="Diğer" onchange="onNedenChange(${n})"> Diğer
          </label>
        </div>
      </div>

      <!-- Arıza formu — sadece "Arıza" seçilince görünür -->
      <div id="ariza-form-${n}">
        <div class="field">
          <label>Arıza Tipi</label>
          <div class="rad-group">${arizaTipRadios}</div>
        </div>
        <div class="field">
          <label>Sorun Tanımı <span class="req">*</span></label>
          <textarea id="sorun-${n}" rows="3" class="mtextarea"
                    placeholder="Sorunu kısaca açıklayın..."></textarea>
          <div class="err-msg" id="err-sorun-${n}">Sorun tanımı gerekli</div>
        </div>
      </div>

      <button id="kapat-btn-${n}" onclick="closeMachine(${n}, '${makineNo}')"
              style="width:100%;background:#dc2626;color:white;padding:15px;border:none;border-radius:14px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:4px">
        🔴 Kapat
      </button>
    </div>
  `;

  /* ── Kapalı/Arızalı makine formu ── */
  const kapaliForm = `
    ${status.sonAriza ? `
    <div class="mcard-section" style="background:#fff5f5;border-color:#fca5a5">
      <div class="mcard-sec-title" style="color:#b91c1c">📋 Son Kayıt</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">${status.sonAriza.tip || ''}</div>
      ${status.sonAriza.sorun ? `<div style="font-size:13px;color:var(--text2)">${status.sonAriza.sorun}</div>` : ''}
    </div>` : ''}

    <!-- Makineyi aç -->
    <div class="mcard-section">
      <div class="mcard-sec-title" style="color:#15803d">🟢 Makineyi Aç</div>
      <div class="field">
        <label>Çözüm Tanımı <span style="font-size:12px;font-weight:600;color:var(--text2)">(isteğe bağlı)</span></label>
        <textarea id="cozum-${n}" rows="2" class="mtextarea"
                  placeholder="Nasıl çözüldü?..."></textarea>
      </div>
      <button id="ac-btn-${n}" onclick="openMachine(${n}, '${makineNo}')"
              style="width:100%;background:#16a34a;color:white;padding:15px;border:none;border-radius:14px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:4px">
        🟢 Makineyi Aç
      </button>
    </div>
  `;

  const quickBtn = isAktif
    ? `<button class="mq-hdr-btn mq-hdr-red"   onclick="event.stopPropagation();openQuickSheet(${n},'${makineNo}',true)"  title="Hızlı Kapat">🔴</button>`
    : `<button class="mq-hdr-btn mq-hdr-green" onclick="event.stopPropagation();openQuickSheet(${n},'${makineNo}',false)" title="Hızlı Aç">🟢</button>`;

  div.innerHTML = `
    <div class="mcard-hd" onclick="toggleCard(${n})">
      <div class="mcard-hd-inner">
        <div class="mcard-top">
          <span class="mcard-no">Enjeksiyon ${n}</span>
          <span class="mbadge ${badgeCls}">${badgeTxt}</span>
        </div>
        ${infoLine}
      </div>
      ${quickBtn}
      <span class="mcard-arrow" id="mcard-arrow-${n}">▼</span>
    </div>

    <div class="mcard-bd" id="mcard-body-${n}" style="display:none">
      ${isAktif ? aktifForm : kapaliForm}

      <!-- Kasa ebatı -->
      <div class="mcard-section">
        <div class="mcard-sec-title" style="color:var(--accent)">📦 Kasa Ebatı</div>
        ${kasaMevcut}
        <div style="display:flex;gap:8px">
          <select id="kasa-sel-${n}"
                  style="flex:1;padding:12px 14px;font-size:15px;font-family:'Nunito',sans-serif;font-weight:600;color:var(--text);background:white;border:2px solid var(--border);border-radius:12px;outline:none;-webkit-appearance:none;appearance:none">
            <option value="">— Kasa seç —</option>
            ${kasaOptions}
          </select>
          <button onclick="saveKasa(${n}, '${makineNo}')"
                  id="kasa-btn-${n}"
                  style="flex-shrink:0;padding:12px 16px;background:var(--accent);color:white;border:none;border-radius:12px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;cursor:pointer">
            Kaydet
          </button>
        </div>
      </div>
    </div>
  `;

  return div;
}

/* ---------- Kapatma nedeni değişince arıza formunu göster/gizle ---------- */

function onNedenChange(n) {
  const neden = document.querySelector(`input[name="neden-${n}"]:checked`);
  const form  = document.getElementById('ariza-form-' + n);
  if (form) form.style.display = (neden && neden.value === 'Arıza') ? 'block' : 'none';
}

/* ---------- Kart aç/kapat ---------- */

function toggleCard(n) {
  const body  = document.getElementById('mcard-body-' + n);
  const arrow = document.getElementById('mcard-arrow-' + n);
  const open  = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent  = open ? '▼' : '▲';
}

/* ---------- Makineyi kapat ---------- */

function closeMachine(n, makineNo) {
  const nedenEl = document.querySelector(`input[name="neden-${n}"]:checked`);
  const neden   = nedenEl ? nedenEl.value : 'Arıza';
  const btn     = document.getElementById('kapat-btn-' + n);

  if (neden === 'Arıza') {
    // Arıza kaydı yolu → logAriza action
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

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

    const cb = 'cbAR_' + Date.now();
    window[cb] = function(json) {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      if (json.result === 'ok') {
        if (!_statuses[makineNo]) _statuses[makineNo] = {};
        _statuses[makineNo].durum    = 'Arızalı';
        _statuses[makineNo].sonAriza = { tip, sorun };
        renderMachines();
        reopenCard(n);
        showMToast('✅ Arıza kaydedildi', 'ok');
      } else {
        showMToast('Kayıt hatası, tekrar dene', 'err');
      }
    };

    const params = new URLSearchParams({
      action: 'logAriza', makine_no: makineNo,
      ariza_tipi: tip, sorun, cozum: '',
      bas_saat: '', bit_saat: '',   // backend otomatik server saatini kullanır
      tekniker_id: _userId, tekniker_ad: _userName,
      callback: cb,
    });
    const s = document.createElement('script');
    s.src = SCRIPT_URL + '?' + params.toString();
    s.onerror = function() {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);

  } else {
    // Arıza dışı kapatma → toggleMachine action
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

    const cb = 'cbTM_' + Date.now();
    window[cb] = function(json) {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      if (json.result === 'ok') {
        if (!_statuses[makineNo]) _statuses[makineNo] = {};
        _statuses[makineNo].durum    = 'Kapalı';
        _statuses[makineNo].sonAriza = { tip: neden, sorun: '' };
        renderMachines();
        reopenCard(n);
        showMToast('🔒 Makine kapatıldı: ' + neden, 'ok');
      } else {
        showMToast('Güncelleme hatası', 'err');
      }
    };

    const s = document.createElement('script');
    s.src = SCRIPT_URL
      + '?action=toggleMachine'
      + '&makine_no='    + encodeURIComponent(makineNo)
      + '&durum=Kapalı'
      + '&neden='        + encodeURIComponent(neden)
      + '&tekniker_id='  + encodeURIComponent(_userId)
      + '&tekniker_ad='  + encodeURIComponent(_userName)
      + '&callback='     + cb;
    s.onerror = function() {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  }
}

/* ---------- Makineyi aç ---------- */

function openMachine(n, makineNo) {
  const btn   = document.getElementById('ac-btn-' + n);
  const cozum = (document.getElementById('cozum-' + n) || {}).value || '';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Açılıyor...'; }

  const prev = _statuses[makineNo] || {};
  const wasAriza = prev.durum === 'Arızalı';

  if (wasAriza && cozum) {
    // Arızalıysa logAriza ile çözüm yaz
    const cb = 'cbAR_' + Date.now();
    window[cb] = function(json) {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      if (json.result === 'ok') {
        if (!_statuses[makineNo]) _statuses[makineNo] = {};
        _statuses[makineNo].durum = 'Aktif';
        renderMachines();
        reopenCard(n);
        showMToast('✅ Makine açıldı', 'ok');
      } else {
        showMToast('Hata, tekrar dene', 'err');
      }
    };
    const params = new URLSearchParams({
      action: 'logAriza', makine_no: makineNo,
      ariza_tipi: (prev.sonAriza && prev.sonAriza.tip) || '',
      sorun: (prev.sonAriza && prev.sonAriza.sorun) || '(sonradan eklendi)',
      cozum, bas_saat: '', bit_saat: '',  // backend server saatini kullanır
      tekniker_id: _userId, tekniker_ad: _userName,
      callback: cb,
    });
    const s = document.createElement('script');
    s.src = SCRIPT_URL + '?' + params.toString();
    s.onerror = function() {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  } else {
    // Direkt toggleMachine ile aç
    const cb = 'cbTM_' + Date.now();
    window[cb] = function(json) {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      if (json.result === 'ok') {
        if (!_statuses[makineNo]) _statuses[makineNo] = {};
        _statuses[makineNo].durum = 'Aktif';
        renderMachines();
        reopenCard(n);
        showMToast('✅ Makine açıldı', 'ok');
      } else {
        showMToast('Güncelleme hatası', 'err');
      }
    };
    const s = document.createElement('script');
    s.src = SCRIPT_URL
      + '?action=toggleMachine'
      + '&makine_no='   + encodeURIComponent(makineNo)
      + '&durum=Aktif'
      + '&tekniker_id=' + encodeURIComponent(_userId)
      + '&tekniker_ad=' + encodeURIComponent(_userName)
      + '&callback='    + cb;
    s.onerror = function() {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  }
}

/* ---------- Kasa kaydet ---------- */

function saveKasa(n, makineNo) {
  const sel  = document.getElementById('kasa-sel-' + n);
  const kasa = sel ? sel.value : '';
  const btn  = document.getElementById('kasa-btn-' + n);
  if (!kasa) { showMToast('Lütfen kasa seçin', 'err'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  const cb = 'cbKS_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    if (btn) { btn.disabled = false; btn.textContent = 'Kaydet'; }
    if (json.result === 'ok') {
      _atananKasalar[makineNo] = kasa;
      renderMachines();
      reopenCard(n);
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
    if (btn) { btn.disabled = false; btn.textContent = 'Kaydet'; }
    showMToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Kart açık tut (render sonrası) ---------- */

function reopenCard(n) {
  const body = document.getElementById('mcard-body-' + n);
  if (body) {
    body.style.display = 'block';
    document.getElementById('mcard-arrow-' + n).textContent = '▲';
  }
}

/* ---------- Hızlı Aksiyon — Bottom Sheet ---------- */

function openQuickSheet(n, makineNo, isAktif) {
  const status = _statuses[makineNo] || {};
  const arizaTipRadios = _arizaTipleri.map((tip, i) =>
    `<label class="rad-lbl">
       <input type="radio" name="qs-tip-${n}" value="${tip}"${i === 0 ? ' checked' : ''}> ${tip}
     </label>`
  ).join('');

  let html;
  if (isAktif) {
    html = `
      <div style="font-size:17px;font-weight:800;color:#b91c1c;margin-bottom:16px">🔴 Enjeksiyon ${n} — Kapat</div>
      <div class="field">
        <label>Kapatma Nedeni</label>
        <div class="rad-group">
          <label class="rad-lbl"><input type="radio" name="qs-neden-${n}" value="Arıza"      onchange="onQsNedenChange(${n})" checked> Arıza</label>
          <label class="rad-lbl"><input type="radio" name="qs-neden-${n}" value="Temizlik"   onchange="onQsNedenChange(${n})"> Temizlik</label>
          <label class="rad-lbl"><input type="radio" name="qs-neden-${n}" value="Planlı Bakım" onchange="onQsNedenChange(${n})"> Planlı Bakım</label>
          <label class="rad-lbl"><input type="radio" name="qs-neden-${n}" value="Diğer"      onchange="onQsNedenChange(${n})"> Diğer</label>
        </div>
      </div>
      <div id="qs-ariza-form-${n}">
        <div class="field">
          <label>Arıza Tipi</label>
          <div class="rad-group">${arizaTipRadios}</div>
        </div>
        <div class="field">
          <label>Sorun Tanımı <span class="req">*</span></label>
          <textarea id="qs-sorun-${n}" rows="3" class="mtextarea" placeholder="Sorunu kısaca açıklayın..."></textarea>
          <div class="err-msg" id="qs-err-sorun-${n}">Sorun tanımı gerekli</div>
        </div>
      </div>
      <button id="qs-kapat-btn-${n}" onclick="qsCloseMachine(${n},'${makineNo}')"
              style="width:100%;background:#dc2626;color:white;padding:15px;border:none;border-radius:14px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:12px">
        🔴 Kapat
      </button>`;
  } else {
    const prev = status.sonAriza;
    const prevHtml = prev
      ? `<div style="background:#fff5f5;border:1.5px solid #fca5a5;border-radius:12px;padding:12px;margin-bottom:12px">
           <div style="font-size:12px;font-weight:800;color:#b91c1c;margin-bottom:4px">${prev.tip || ''}</div>
           ${prev.sorun ? `<div style="font-size:13px;color:var(--text2)">${prev.sorun}</div>` : ''}
         </div>`
      : '';
    html = `
      <div style="font-size:17px;font-weight:800;color:#15803d;margin-bottom:16px">🟢 Enjeksiyon ${n} — Aç</div>
      ${prevHtml}
      <div class="field">
        <label>Çözüm <span style="font-size:12px;font-weight:600;color:var(--text2)">(isteğe bağlı)</span></label>
        <textarea id="qs-cozum-${n}" rows="2" class="mtextarea" placeholder="Nasıl çözüldü?..."></textarea>
      </div>
      <button id="qs-ac-btn-${n}" onclick="qsOpenMachine(${n},'${makineNo}')"
              style="width:100%;background:#16a34a;color:white;padding:15px;border:none;border-radius:14px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:12px">
        🟢 Makineyi Aç
      </button>`;
  }

  document.getElementById('bsheet-content').innerHTML = html;
  document.getElementById('bsheet-overlay').style.display = 'block';
  document.getElementById('bsheet').style.display = 'block';
}

function closeQuickSheet() {
  document.getElementById('bsheet-overlay').style.display = 'none';
  document.getElementById('bsheet').style.display = 'none';
}

function onQsNedenChange(n) {
  const neden = document.querySelector(`input[name="qs-neden-${n}"]:checked`);
  const form  = document.getElementById('qs-ariza-form-' + n);
  if (form) form.style.display = (neden && neden.value === 'Arıza') ? 'block' : 'none';
}

function qsCloseMachine(n, makineNo) {
  const nedenEl = document.querySelector(`input[name="qs-neden-${n}"]:checked`);
  const neden   = nedenEl ? nedenEl.value : 'Arıza';
  const btn     = document.getElementById('qs-kapat-btn-' + n);

  if (neden === 'Arıza') {
    const sorunEl = document.getElementById('qs-sorun-' + n);
    const errEl   = document.getElementById('qs-err-sorun-' + n);
    if (!sorunEl.value.trim()) {
      sorunEl.style.borderColor = 'var(--warn)';
      errEl.classList.add('show');
      return;
    }
    sorunEl.style.borderColor = '';
    errEl.classList.remove('show');

    const tipEl = document.querySelector(`input[name="qs-tip-${n}"]:checked`);
    const tip   = tipEl ? tipEl.value : '';
    const sorun = sorunEl.value.trim();

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

    const cb = 'cbQSAR_' + Date.now();
    window[cb] = function(json) {
      delete window[cb];
      if (json.result === 'ok') {
        if (!_statuses[makineNo]) _statuses[makineNo] = {};
        _statuses[makineNo].durum    = 'Arızalı';
        _statuses[makineNo].sonAriza = { tip, sorun };
        closeQuickSheet();
        renderMachines();
        showMToast('✅ Arıza kaydedildi', 'ok');
      } else {
        if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
        showMToast('Kayıt hatası, tekrar dene', 'err');
      }
    };
    const params = new URLSearchParams({
      action: 'logAriza', makine_no: makineNo,
      ariza_tipi: tip, sorun, cozum: '',
      bas_saat: '', bit_saat: '',
      tekniker_id: _userId, tekniker_ad: _userName,
      callback: cb,
    });
    const s = document.createElement('script');
    s.src = SCRIPT_URL + '?' + params.toString();
    s.onerror = function() {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);

  } else {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

    const cb = 'cbQSTM_' + Date.now();
    window[cb] = function(json) {
      delete window[cb];
      if (json.result === 'ok') {
        if (!_statuses[makineNo]) _statuses[makineNo] = {};
        _statuses[makineNo].durum    = 'Kapalı';
        _statuses[makineNo].sonAriza = { tip: neden, sorun: '' };
        closeQuickSheet();
        renderMachines();
        showMToast('🔒 Makine kapatıldı: ' + neden, 'ok');
      } else {
        if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
        showMToast('Güncelleme hatası', 'err');
      }
    };
    const s = document.createElement('script');
    s.src = SCRIPT_URL
      + '?action=toggleMachine'
      + '&makine_no='   + encodeURIComponent(makineNo)
      + '&durum=Kapalı'
      + '&neden='       + encodeURIComponent(neden)
      + '&tekniker_id=' + encodeURIComponent(_userId)
      + '&tekniker_ad=' + encodeURIComponent(_userName)
      + '&callback='    + cb;
    s.onerror = function() {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  }
}

function qsOpenMachine(n, makineNo) {
  const btn   = document.getElementById('qs-ac-btn-' + n);
  const cozum = (document.getElementById('qs-cozum-' + n) || {}).value || '';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Açılıyor...'; }

  const prev     = _statuses[makineNo] || {};
  const wasAriza = prev.durum === 'Arızalı';

  if (wasAriza && cozum) {
    const cb = 'cbQSAC_' + Date.now();
    window[cb] = function(json) {
      delete window[cb];
      if (json.result === 'ok') {
        if (!_statuses[makineNo]) _statuses[makineNo] = {};
        _statuses[makineNo].durum = 'Aktif';
        closeQuickSheet();
        renderMachines();
        showMToast('✅ Makine açıldı', 'ok');
      } else {
        if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
        showMToast('Hata, tekrar dene', 'err');
      }
    };
    const params = new URLSearchParams({
      action: 'logAriza', makine_no: makineNo,
      ariza_tipi: (prev.sonAriza && prev.sonAriza.tip) || '',
      sorun: (prev.sonAriza && prev.sonAriza.sorun) || '(sonradan eklendi)',
      cozum, bas_saat: '', bit_saat: '',
      tekniker_id: _userId, tekniker_ad: _userName,
      callback: cb,
    });
    const s = document.createElement('script');
    s.src = SCRIPT_URL + '?' + params.toString();
    s.onerror = function() {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  } else {
    const cb = 'cbQSTM2_' + Date.now();
    window[cb] = function(json) {
      delete window[cb];
      if (json.result === 'ok') {
        if (!_statuses[makineNo]) _statuses[makineNo] = {};
        _statuses[makineNo].durum = 'Aktif';
        closeQuickSheet();
        renderMachines();
        showMToast('✅ Makine açıldı', 'ok');
      } else {
        if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
        showMToast('Güncelleme hatası', 'err');
      }
    };
    const s = document.createElement('script');
    s.src = SCRIPT_URL
      + '?action=toggleMachine'
      + '&makine_no='   + encodeURIComponent(makineNo)
      + '&durum=Aktif'
      + '&tekniker_id=' + encodeURIComponent(_userId)
      + '&tekniker_ad=' + encodeURIComponent(_userName)
      + '&callback='    + cb;
    s.onerror = function() {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  }
}

/* ---------- Toast ---------- */

function showMToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (type || 'ok') + ' show';
  setTimeout(() => t.classList.remove('show'), 3500);
}
