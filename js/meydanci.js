/* ── Meydancı / Tekniker Paneli ─────────────────────── */

const _userId   = sessionStorage.getItem('ep_id')   || '';
const _userName = sessionStorage.getItem('ep_name') || '';

let _statuses      = {};
let _arizaTipleri  = [];
let _machineData   = {};
let _kasaEbatlari  = [];
let _atananKasalar = {};
let _atananlar     = {};   // makineNo → { operatorId, operatorAd, kasa, mod }
let _personelList  = [];   // [{ id, ad }]
let _timeOffset    = 0;

/* ================================================================
   Init
   ================================================================ */

window.onload = function () {
  if (!_userId) { window.location.href = 'index.html'; return; }

  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('user-header').textContent = 'Meydancı: ' + _userName;

  loadStatuses(false);
  setInterval(function () { loadStatuses(true); }, 60000);
};

/* ================================================================
   Veri yükleme
   ================================================================ */

function loadStatuses(silent) {
  if (!silent) {
    document.getElementById('loading').classList.add('show');
    document.getElementById('load-text').textContent = 'Yükleniyor...';
  }

  const cb = 'cbMS_' + Date.now();
  window[cb] = function (json) {
    delete window[cb];
    if (!silent) document.getElementById('loading').classList.remove('show');
    if (json.serverTime) _timeOffset = json.serverTime - Date.now();
    _statuses      = json.statuses      || {};
    _machineData   = json.machineData   || {};
    _kasaEbatlari  = json.kasaEbatlari  || [];
    _atananKasalar = json.atananKasalar || {};
    _atananlar     = json.atananlar     || {};
    _personelList  = json.personelList  || [];
    _arizaTipleri  = (json.arizaTipleri && json.arizaTipleri.length)
      ? json.arizaTipleri
      : ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Diğer'];
    renderMachines();
  };

  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?action=getMachineStatuses&callback=' + cb;
  s.onerror = function () {
    delete window[cb];
    if (!silent) document.getElementById('loading').classList.remove('show');
    if (!_arizaTipleri.length) _arizaTipleri = ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Diğer'];
    renderMachines();
    if (!silent) showMToast('Sunucu bağlantısı kurulamadı', 'err');
  };
  document.head.appendChild(s);
}

/* ================================================================
   Saat yardımcısı
   ================================================================ */

function nowTime() {
  const n = new Date(Date.now() + _timeOffset);
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

/* ================================================================
   Render
   ================================================================ */

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
      const body = document.getElementById('mcard-body-' + i);
      if (body) {
        body.style.display = 'block';
        document.getElementById('mcard-arrow-' + i).textContent = '▲';
      }
    }
  }
}

/* ================================================================
   Kart oluştur
   ================================================================ */

function buildCard(n, makineNo, status) {
  const durum     = status.durum || 'Aktif';
  const isAktif   = durum === 'Aktif';
  const isArizali = durum === 'Arızalı';
  const isKapali  = !isAktif;

  // Atama bilgileri
  const atama        = _atananlar[makineNo] || null;
  const atamaOpId    = atama ? String(atama.operatorId || '').trim() : '';
  const atamaOpAd    = atama ? String(atama.operatorAd || '').trim() : '';
  const atamaKasa    = atama ? String(atama.kasa || '').trim() : '';
  const atamaMod     = atama ? String(atama.mod  || '').trim() : '';

  // Operatörsüz aktif makine?
  const isOperatorsuz = isAktif && !atamaOpId;

  // Meydancının kendisi bu makineye atanmış mı?
  const isSelfAssigned = isAktif && atamaOpId === String(_userId).trim();

  const div     = document.createElement('div');
  div.id        = 'mcard-' + n;

  // Kart rengi
  let cardClass = 'mcard';
  if (isKapali)       cardClass += ' mcard-red';
  else if (isOperatorsuz) cardClass += ' mcard-orange';
  div.className = cardClass;

  // ── Info satırı (kapalı bar) ──────────────────────────
  const md = _machineData[makineNo];
  let infoLine = '';

  if (isKapali && status.sonAriza) {
    const t = status.sonAriza.tip || '';
    const s = status.sonAriza.sorun
      ? ': ' + status.sonAriza.sorun.substring(0, 40) + (status.sonAriza.sorun.length > 40 ? '…' : '')
      : '';
    infoLine = `<div class="mcard-info-row mcard-info-red">⚠️ ${t}${s}</div>`;
  } else if (isOperatorsuz) {
    infoLine = `<div class="mcard-info-row"><span class="mchip mchip-orange">👤 Operatör atanmadı</span></div>`;
  } else {
    const chips = [];
    const kg = atamaKasa || _atananKasalar[makineNo] || (md && md.kasa) || '';
    if (kg)          chips.push(`<span class="mchip">📦 ${kg}</span>`);
    if (atamaMod)    chips.push(`<span class="mchip">${atamaMod === 'cift' ? '2️⃣ Çift' : '1️⃣ Tek'}</span>`);
    if (atamaOpAd)   chips.push(`<span class="mchip">👤 ${atamaOpAd.split(' ')[0]}</span>`);
    else if (md && md.operatör) chips.push(`<span class="mchip">👤 ${md.operatör.split(' ')[0]}</span>`);
    if (md && md.cevrim) chips.push(`<span class="mchip">⏱ ${md.cevrim} sn</span>`);
    if (chips.length) infoLine = `<div class="mcard-info-row">${chips.join('')}</div>`;
  }

  // ── Badge ────────────────────────────────────────────
  let badgeCls = 'mbadge-green', badgeTxt = '✅ Aktif';
  if (isArizali)                { badgeCls = 'mbadge-red';    badgeTxt = '⚠️ Arızalı'; }
  else if (durum === 'Kapalı')  { badgeCls = 'mbadge-orange'; badgeTxt = '🔒 Kapalı'; }
  else if (isOperatorsuz)       { badgeCls = 'mbadge-yellow'; badgeTxt = '👤 Atamasız'; }

  // ── Hızlı aksiyon butonu ────────────────────────────
  const quickBtn = isAktif
    ? `<button class="mq-hdr-btn mq-hdr-red"   onclick="event.stopPropagation();openQuickSheet(${n},'${makineNo}',true)"  title="Hızlı Kapat">🔴</button>`
    : `<button class="mq-hdr-btn mq-hdr-green" onclick="event.stopPropagation();openQuickSheet(${n},'${makineNo}',false)" title="Hızlı Aç">🟢</button>`;

  // ── Kasa dropdown ────────────────────────────────────
  const kasaOptions = _kasaEbatlari.map(k => {
    const sel = (atamaKasa === k || _atananKasalar[makineNo] === k) ? ' selected' : '';
    return `<option value="${k}"${sel}>${k}</option>`;
  }).join('');

  const kasaMevcut = atamaKasa
    ? `<div style="font-size:13px;font-weight:700;color:var(--success);margin-bottom:10px">Mevcut: <strong>${atamaKasa}</strong></div>`
    : ((_atananKasalar[makineNo])
        ? `<div style="font-size:13px;font-weight:700;color:var(--success);margin-bottom:10px">Mevcut: <strong>${_atananKasalar[makineNo]}</strong></div>`
        : `<div style="font-size:12px;color:var(--text2);margin-bottom:10px">Henüz atanmadı</div>`);

  // ── Personel dropdown ────────────────────────────────
  const personelOptions = _personelList.map(p => {
    const sel = atamaOpId === String(p.id) ? ' selected' : '';
    return `<option value="${p.id}" data-ad="${p.ad}"${sel}>${p.ad}</option>`;
  }).join('');

  // ── Çalışma modu seçimi ──────────────────────────────
  const modTekSel  = atamaMod !== 'cift' ? ' checked' : '';
  const modCiftSel = atamaMod === 'cift' ? ' checked' : '';

  // ── Veri giriş butonu (meydancı kendine atandıysa) ───
  const selfEntryBtn = isSelfAssigned ? `
    <button onclick="goToDataEntry('${makineNo}', '${atamaKasa}', '${atamaMod}')"
            style="width:100%;background:var(--accent);color:white;padding:14px;border:none;border-radius:14px;
                   font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer;margin-top:14px;
                   display:flex;align-items:center;justify-content:center;gap:8px">
      📋 Veri Girişi Yap
    </button>` : '';

  // ── Arıza tipi radyoları ─────────────────────────────
  const arizaTipRadios = _arizaTipleri.map((tip, i) =>
    `<label class="rad-lbl">
       <input type="radio" name="tip-${n}" value="${tip}"${i === 0 ? ' checked' : ''}> ${tip}
     </label>`
  ).join('');

  // ── Aktif makine gövdesi ─────────────────────────────
  const aktifForm = `
    <!-- Operatör Atama -->
    <div class="mcard-section" id="atama-sec-${n}">
      <div class="mcard-sec-title" style="color:var(--accent)">👤 Operatör Ataması</div>

      <div class="field" style="margin-bottom:10px">
        <label style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:6px;display:block">Operatör</label>
        <select id="op-sel-${n}"
                style="width:100%;padding:12px 14px;font-size:15px;font-family:'Nunito',sans-serif;
                       font-weight:600;color:var(--text);background:white;border:2px solid var(--border);
                       border-radius:12px;outline:none;-webkit-appearance:none;appearance:none">
          <option value="">— Operatör seç —</option>
          ${personelOptions}
        </select>
      </div>

      <div class="field" style="margin-bottom:10px">
        <label style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:6px;display:block">Kasa Ebatı</label>
        <select id="atama-kasa-sel-${n}"
                style="width:100%;padding:12px 14px;font-size:15px;font-family:'Nunito',sans-serif;
                       font-weight:600;color:var(--text);background:white;border:2px solid var(--border);
                       border-radius:12px;outline:none;-webkit-appearance:none;appearance:none">
          <option value="">— Kasa seç —</option>
          ${kasaOptions}
        </select>
      </div>

      <div class="field" style="margin-bottom:12px">
        <label style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px;display:block">Çalışma Modu</label>
        <div style="display:flex;gap:10px">
          <label class="rad-lbl" style="flex:1;justify-content:center">
            <input type="radio" name="mod-${n}" value="tek"${modTekSel}> 1️⃣ Tek
          </label>
          <label class="rad-lbl" style="flex:1;justify-content:center">
            <input type="radio" name="mod-${n}" value="cift"${modCiftSel}> 2️⃣ Çift
          </label>
        </div>
      </div>

      <button id="atama-btn-${n}" onclick="saveAssignment(${n}, '${makineNo}')"
              style="width:100%;background:var(--accent);color:white;padding:13px;border:none;border-radius:12px;
                     font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer">
        ✅ Atamaları Kaydet
      </button>

      ${atamaOpId ? `
      <button onclick="clearAssignment(${n}, '${makineNo}')"
              style="width:100%;background:white;color:#b91c1c;padding:11px;border:2px solid #fca5a5;
                     border-radius:12px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;
                     cursor:pointer;margin-top:8px">
        🗑 Atamayı Kaldır
      </button>` : ''}

      ${selfEntryBtn}
    </div>

    <!-- Kapatma -->
    <div class="mcard-section">
      <div class="mcard-sec-title" style="color:#b91c1c">🔴 Makineyi Kapat</div>

      <div class="field">
        <label>Kapatma Nedeni</label>
        <div class="rad-group" id="neden-grp-${n}">
          <label class="rad-lbl"><input type="radio" name="neden-${n}" value="Arıza"       onchange="onNedenChange(${n})" checked> Arıza</label>
          <label class="rad-lbl"><input type="radio" name="neden-${n}" value="Temizlik"    onchange="onNedenChange(${n})"> Temizlik</label>
          <label class="rad-lbl"><input type="radio" name="neden-${n}" value="Planlı Bakım" onchange="onNedenChange(${n})"> Planlı Bakım</label>
          <label class="rad-lbl"><input type="radio" name="neden-${n}" value="Diğer"       onchange="onNedenChange(${n})"> Diğer</label>
        </div>
      </div>

      <div id="ariza-form-${n}">
        <div class="field">
          <label>Arıza Tipi</label>
          <div class="rad-group">${arizaTipRadios}</div>
        </div>
        <div class="field">
          <label>Sorun Tanımı <span class="req">*</span></label>
          <textarea id="sorun-${n}" rows="3" class="mtextarea" placeholder="Sorunu kısaca açıklayın..."></textarea>
          <div class="err-msg" id="err-sorun-${n}">Sorun tanımı gerekli</div>
        </div>
      </div>

      <button id="kapat-btn-${n}" onclick="closeMachine(${n}, '${makineNo}')"
              style="width:100%;background:#dc2626;color:white;padding:15px;border:none;border-radius:14px;
                     font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:4px">
        🔴 Kapat
      </button>
    </div>
  `;

  // ── Kapalı/Arızalı makine gövdesi ───────────────────
  const kapaliForm = `
    ${status.sonAriza ? `
    <div class="mcard-section" style="background:#fff5f5;border-color:#fca5a5">
      <div class="mcard-sec-title" style="color:#b91c1c">📋 Son Kayıt</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">${status.sonAriza.tip || ''}</div>
      ${status.sonAriza.sorun ? `<div style="font-size:13px;color:var(--text2)">${status.sonAriza.sorun}</div>` : ''}
    </div>` : ''}

    <div class="mcard-section">
      <div class="mcard-sec-title" style="color:#15803d">🟢 Makineyi Aç</div>
      <div class="field">
        <label>Çözüm Tanımı <span style="font-size:12px;font-weight:600;color:var(--text2)">(isteğe bağlı)</span></label>
        <textarea id="cozum-${n}" rows="2" class="mtextarea" placeholder="Nasıl çözüldü?..."></textarea>
      </div>
      <button id="ac-btn-${n}" onclick="openMachine(${n}, '${makineNo}')"
              style="width:100%;background:#16a34a;color:white;padding:15px;border:none;border-radius:14px;
                     font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:4px">
        🟢 Makineyi Aç
      </button>
    </div>
  `;

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
    </div>
  `;

  return div;
}

/* ================================================================
   Operatör Atama — Kaydet
   ================================================================ */

function saveAssignment(n, makineNo) {
  const opSel   = document.getElementById('op-sel-' + n);
  const kasaSel = document.getElementById('atama-kasa-sel-' + n);
  const modEl   = document.querySelector(`input[name="mod-${n}"]:checked`);
  const btn     = document.getElementById('atama-btn-' + n);

  const opId = opSel ? opSel.value : '';
  const kasa = kasaSel ? kasaSel.value : '';
  const mod  = modEl ? modEl.value : 'tek';

  if (!opId)   { showMToast('Lütfen operatör seçin', 'err'); return; }
  if (!kasa)   { showMToast('Lütfen kasa seçin', 'err'); return; }

  // Seçilen operatörün adını option'dan al
  const opAd = opSel.options[opSel.selectedIndex]
    ? (opSel.options[opSel.selectedIndex].dataset.ad || opSel.options[opSel.selectedIndex].text)
    : '';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

  const cb = 'cbSA_' + Date.now();
  window[cb] = function (json) {
    delete window[cb];
    if (btn) { btn.disabled = false; btn.textContent = '✅ Atamaları Kaydet'; }
    if (json.result === 'ok') {
      // Kasa tablosunu da güncelle
      _atananKasalar[makineNo] = kasa;
      _atananlar[makineNo]     = { operatorId: opId, operatorAd: opAd, kasa, mod };
      renderMachines();
      reopenCard(n);
      showMToast('✅ Atama kaydedildi: ' + opAd, 'ok');

      // Kasa kaydını da sunucuya yaz
      saveKasaSilent(makineNo, kasa);
    } else {
      showMToast('Kayıt hatası, tekrar dene', 'err');
    }
  };

  const params = new URLSearchParams({
    action:       'saveAssignment',
    makine_no:    makineNo,
    operator_id:  opId,
    operator_ad:  opAd,
    kasa:         kasa,
    mod:          mod,
    callback:     cb,
  });
  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?' + params.toString();
  s.onerror = function () {
    delete window[cb];
    if (btn) { btn.disabled = false; btn.textContent = '✅ Atamaları Kaydet'; }
    showMToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ================================================================
   Operatör Atama — Kaldır
   ================================================================ */

function clearAssignment(n, makineNo) {
  if (!confirm('Bu makinenin ataması kaldırılsın mı?')) return;

  const cb = 'cbCA_' + Date.now();
  window[cb] = function (json) {
    delete window[cb];
    if (json.result === 'ok') {
      delete _atananlar[makineNo];
      renderMachines();
      reopenCard(n);
      showMToast('🗑 Atama kaldırıldı', 'ok');
    } else {
      showMToast('Hata, tekrar dene', 'err');
    }
  };

  // Boş operatör göndererek atamayı temizle
  const params = new URLSearchParams({
    action:      'saveAssignment',
    makine_no:   makineNo,
    operator_id: '',
    operator_ad: '',
    kasa:        '',
    mod:         '',
    callback:    cb,
  });
  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?' + params.toString();
  s.onerror = function () {
    delete window[cb];
    showMToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ================================================================
   Kasa — Sessiz kaydet (atama ile birlikte)
   ================================================================ */

function saveKasaSilent(makineNo, kasa) {
  const cb = 'cbKSS_' + Date.now();
  window[cb] = function () { delete window[cb]; };
  const s = document.createElement('script');
  s.src = SCRIPT_URL
    + '?action=setMachineKasa'
    + '&makine_no=' + encodeURIComponent(makineNo)
    + '&kasa='      + encodeURIComponent(kasa)
    + '&tekniker='  + encodeURIComponent(_userName)
    + '&callback='  + cb;
  s.onerror = function () { delete window[cb]; };
  document.head.appendChild(s);
}

/* ================================================================
   Veri girişine yönlendir (meydancı kendine atandıysa)
   ================================================================ */

function goToDataEntry(makineNo, kasa, mod) {
  // Operatör bilgilerini sessionStorage'a yaz (operatör sayfası bunları okur)
  sessionStorage.setItem('ep_target_machine', makineNo);
  sessionStorage.setItem('ep_target_kasa',    kasa);
  sessionStorage.setItem('ep_target_mod',     mod);
  window.location.href = 'operatör.html';
}

/* ================================================================
   Kapatma nedeni değişince arıza formunu göster/gizle
   ================================================================ */

function onNedenChange(n) {
  const neden = document.querySelector(`input[name="neden-${n}"]:checked`);
  const form  = document.getElementById('ariza-form-' + n);
  if (form) form.style.display = (neden && neden.value === 'Arıza') ? 'block' : 'none';
}

/* ================================================================
   Kart aç/kapat
   ================================================================ */

function toggleCard(n) {
  const body  = document.getElementById('mcard-body-' + n);
  const arrow = document.getElementById('mcard-arrow-' + n);
  const open  = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent  = open ? '▼' : '▲';
}

function reopenCard(n) {
  const body = document.getElementById('mcard-body-' + n);
  if (body) {
    body.style.display = 'block';
    document.getElementById('mcard-arrow-' + n).textContent = '▲';
  }
}

/* ================================================================
   Makineyi Kapat
   ================================================================ */

function closeMachine(n, makineNo) {
  const nedenEl = document.querySelector(`input[name="neden-${n}"]:checked`);
  const neden   = nedenEl ? nedenEl.value : 'Arıza';
  const btn     = document.getElementById('kapat-btn-' + n);

  if (neden === 'Arıza') {
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
    window[cb] = function (json) {
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
      bas_saat: '', bit_saat: '',
      tekniker_id: _userId, tekniker_ad: _userName,
      callback: cb,
    });
    const s = document.createElement('script');
    s.src = SCRIPT_URL + '?' + params.toString();
    s.onerror = function () {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);

  } else {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

    const cb = 'cbTM_' + Date.now();
    window[cb] = function (json) {
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
      + '&makine_no='   + encodeURIComponent(makineNo)
      + '&durum=Kapalı'
      + '&neden='       + encodeURIComponent(neden)
      + '&tekniker_id=' + encodeURIComponent(_userId)
      + '&tekniker_ad=' + encodeURIComponent(_userName)
      + '&callback='    + cb;
    s.onerror = function () {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  }
}

/* ================================================================
   Makineyi Aç
   ================================================================ */

function openMachine(n, makineNo) {
  const btn   = document.getElementById('ac-btn-' + n);
  const cozum = (document.getElementById('cozum-' + n) || {}).value || '';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Açılıyor...'; }

  const prev     = _statuses[makineNo] || {};
  const wasAriza = prev.durum === 'Arızalı';

  if (wasAriza && cozum) {
    const cb = 'cbAR_' + Date.now();
    window[cb] = function (json) {
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
      cozum, bas_saat: '', bit_saat: '',
      tekniker_id: _userId, tekniker_ad: _userName,
      callback: cb,
    });
    const s = document.createElement('script');
    s.src = SCRIPT_URL + '?' + params.toString();
    s.onerror = function () {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);

  } else {
    const cb = 'cbTM2_' + Date.now();
    window[cb] = function (json) {
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
    s.onerror = function () {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  }
}

/* ================================================================
   Hızlı Aksiyon — Bottom Sheet
   ================================================================ */

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
          <label class="rad-lbl"><input type="radio" name="qs-neden-${n}" value="Arıza"       onchange="onQsNedenChange(${n})" checked> Arıza</label>
          <label class="rad-lbl"><input type="radio" name="qs-neden-${n}" value="Temizlik"    onchange="onQsNedenChange(${n})"> Temizlik</label>
          <label class="rad-lbl"><input type="radio" name="qs-neden-${n}" value="Planlı Bakım" onchange="onQsNedenChange(${n})"> Planlı Bakım</label>
          <label class="rad-lbl"><input type="radio" name="qs-neden-${n}" value="Diğer"       onchange="onQsNedenChange(${n})"> Diğer</label>
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
              style="width:100%;background:#dc2626;color:white;padding:15px;border:none;border-radius:14px;
                     font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:12px">
        🔴 Kapat
      </button>`;
  } else {
    const prev     = status.sonAriza;
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
              style="width:100%;background:#16a34a;color:white;padding:15px;border:none;border-radius:14px;
                     font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:12px">
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
    window[cb] = function (json) {
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
    s.onerror = function () {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🔴 Kapat'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);

  } else {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...'; }

    const cb = 'cbQSTM_' + Date.now();
    window[cb] = function (json) {
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
    s.onerror = function () {
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
    window[cb] = function (json) {
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
    s.onerror = function () {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);

  } else {
    const cb = 'cbQSTM2_' + Date.now();
    window[cb] = function (json) {
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
    s.onerror = function () {
      delete window[cb];
      if (btn) { btn.disabled = false; btn.textContent = '🟢 Makineyi Aç'; }
      showMToast('Bağlantı hatası', 'err');
    };
    document.head.appendChild(s);
  }
}

/* ================================================================
   Toast
   ================================================================ */

function showMToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (type || 'ok') + ' show';
  setTimeout(() => t.classList.remove('show'), 3500);
}
