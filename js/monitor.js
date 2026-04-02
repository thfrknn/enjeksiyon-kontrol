/* ── Yönetici İzleme Paneli ─────────────────────────── */

const _mUserId   = sessionStorage.getItem('ep_id')   || '';
const _mUserName = sessionStorage.getItem('ep_name') || '';

let _mData       = null;
let _mTimeOffset = 0;
let _activeTab   = 'canli';    // 'canli' | 'ariza'
let _activeVardiya = 'TUMU';   // 'TUMU' | 'SABAH' | 'AKSAM' | 'GECE'

/* ---------- Init ---------- */

window.onload = function() {
  if (!_mUserId) { window.location.href = 'index.html'; return; }

  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  document.getElementById('user-header').textContent = 'Yönetici: ' + _mUserName;

  loadData();
  setInterval(loadData, 60000);
};

/* ---------- Veri yükleme ---------- */

function loadData() {
  document.getElementById('loading').classList.add('show');
  document.getElementById('load-text').textContent = 'Yükleniyor...';

  const cb = 'cbMon_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    if (json.serverTime) _mTimeOffset = json.serverTime - Date.now();
    _mData = json;
    render();
  };

  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?action=getMonitorData&callback=' + cb;
  s.onerror = function() {
    delete window[cb];
    document.getElementById('loading').classList.remove('show');
    showMonToast('Sunucu bağlantısı kurulamadı', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Ana render ---------- */

function render() {
  if (!_mData) return;
  renderOzet();
  if (_activeTab === 'canli') renderCanli();
  else                        renderAriza();
}

/* ---------- Özet satırı ---------- */

function renderOzet() {
  const oz = _mData.ozet || {};
  const aktif   = oz.aktif   ?? 0;
  const arizali = oz.arizali ?? 0;

  // Tüm vardiyaların toplamını canliData'dan hesapla
  let toplamUretim = 0, toplamFire = 0;
  const cd = _mData.canliData || {};
  const vardiyalar = _activeVardiya === 'TUMU' ? ['SABAH','AKSAM','GECE'] : [_activeVardiya];
  for (const makine in cd) {
    for (const v of vardiyalar) {
      const d = cd[makine][v];
      if (d && d.uretim) toplamUretim += parseInt(d.uretim) || 0;
      if (d && d.fire)   toplamFire   += parseInt(d.fire)   || 0;
    }
  }

  document.getElementById('ozet-row').innerHTML = `
    <div class="ostat-card">
      <div class="ostat-val green">${aktif}</div>
      <div class="ostat-lbl">Aktif Makine</div>
    </div>
    <div class="ostat-card">
      <div class="ostat-val red">${arizali}</div>
      <div class="ostat-lbl">Arızalı</div>
    </div>
    <div class="ostat-card">
      <div class="ostat-val">${toplamUretim.toLocaleString('tr-TR')}</div>
      <div class="ostat-lbl">Toplam Üretim</div>
    </div>
    <div class="ostat-card">
      <div class="ostat-val warn">${toplamFire}</div>
      <div class="ostat-lbl">Toplam Fire</div>
    </div>
  `;
}

/* ---------- Canlı izleme grid ---------- */

function renderCanli() {
  const statuses  = _mData.statuses   || {};
  const canliData = _mData.canliData  || {};
  const kasalar   = _mData.kasalar    || {};
  const vardiyalar = _activeVardiya === 'TUMU' ? ['SABAH','AKSAM','GECE'] : [_activeVardiya];

  let html = '';
  for (let i = 1; i <= 12; i++) {
    const makineNo  = 'Enjeksiyon ' + i;
    const status    = statuses[makineNo]  || { durum: 'Aktif' };
    const isArizali = status.durum === 'Arızalı';
    const kasaAtanan = kasalar[makineNo] || '';

    // Seçili vardiyaların verilerini birleştir
    let operatör = '', kasa = kasaAtanan, cevrim = '', uretim = 0, fire = 0, saat = '';
    for (const v of vardiyalar) {
      const d = (canliData[makineNo] || {})[v] || {};
      if (d.operatör) operatör = d.operatör;
      if (!kasa && d.kasa) kasa = d.kasa;
      if (d.cevrim) cevrim = d.cevrim;
      uretim += parseInt(d.uretim) || 0;
      fire   += parseInt(d.fire)   || 0;
      if (d.saat) saat = d.saat;
    }

    if (isArizali) {
      const ariza = status.sonAriza || {};
      html += `
        <div class="mmon-card mmon-red">
          <div class="mmon-header">
            <span class="mmon-no">Enj ${i}</span>
            <span class="mmon-badge red">⚠️ Arızalı</span>
          </div>
          <div class="mmon-ariza-tip">${ariza.tip || ''}</div>
          <div class="mmon-ariza-sorun">${ariza.sorun || '—'}</div>
          ${status.sonGuncelleme ? `<div class="mmon-footer">🕐 ${status.sonGuncelleme}</div>` : ''}
        </div>`;
    } else {
      html += `
        <div class="mmon-card">
          <div class="mmon-header">
            <span class="mmon-no">Enj ${i}</span>
            <span class="mmon-badge green">✅ Aktif</span>
          </div>
          ${operatör ? `<div class="mmon-row">👤 <span>${operatör}</span></div>` : ''}
          ${kasa     ? `<div class="mmon-row">📦 <span>${kasa}</span></div>` : ''}
          ${cevrim   ? `<div class="mmon-row">⏱ <span>${cevrim} sn</span></div>` : ''}
          <div class="mmon-stats">
            <div class="mmon-stat">
              <div class="mmon-stat-val">${uretim > 0 ? uretim.toLocaleString('tr-TR') : '—'}</div>
              <div class="mmon-stat-lbl">Üretim</div>
            </div>
            <div class="mmon-stat">
              <div class="mmon-stat-val warn">${fire > 0 ? fire : '—'}</div>
              <div class="mmon-stat-lbl">Fire</div>
            </div>
          </div>
          ${saat ? `<div class="mmon-footer">🕐 ${saat}</div>` : ''}
        </div>`;
    }
  }

  document.getElementById('main-content').innerHTML = `<div class="mmon-grid">${html}</div>`;
}

/* ---------- Arıza kayıtları ---------- */

function renderAriza() {
  const log = _mData.arizaLog || [];

  if (!log.length) {
    document.getElementById('main-content').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text2);font-weight:700">Arıza kaydı bulunamadı</div>';
    return;
  }

  const rows = log.map(r => {
    const durumBadge = r.durum && r.durum.includes('Çözüldü')
      ? '<span class="mmon-badge green" style="font-size:10px">✅ Çözüldü</span>'
      : '<span class="mmon-badge red" style="font-size:10px">⚠️ Açık</span>';
    return `
      <div class="ariza-row">
        <div class="ariza-row-top">
          <span class="ariza-makine">${r.makine}</span>
          ${durumBadge}
          <span class="ariza-zaman">${r.zaman}</span>
        </div>
        <div class="ariza-tip">${r.tip}</div>
        <div class="ariza-sorun">${r.sorun || '—'}</div>
        ${r.cozum ? `<div class="ariza-cozum">✅ ${r.cozum}</div>` : ''}
        <div class="ariza-saat">
          ${r.basSaat ? `Başlangıç: ${r.basSaat}` : ''}
          ${r.bitSaat ? ` · Bitiş: ${r.bitSaat}` : ''}
          ${r.teknikerAd ? ` · ${r.teknikerAd}` : ''}
        </div>
      </div>`;
  }).join('');

  document.getElementById('main-content').innerHTML = `<div style="padding:0 16px 40px">${rows}</div>`;
}

/* ---------- Tab geçişi ---------- */

function setTab(tab) {
  _activeTab = tab;
  document.getElementById('tab-canli').classList.toggle('tab-active', tab === 'canli');
  document.getElementById('tab-ariza').classList.toggle('tab-active', tab === 'ariza');

  // Vardiya filtresi sadece canlı sekmede görünür
  document.getElementById('vardiya-filter').style.display = tab === 'canli' ? 'flex' : 'none';
  render();
}

function setVardiyaFilter(v) {
  _activeVardiya = v;
  ['TUMU','SABAH','AKSAM','GECE'].forEach(x => {
    document.getElementById('vf-' + x).classList.toggle('vf-active', x === v);
  });
  render();
}

/* ---------- Toast ---------- */

function showMonToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (type || 'ok') + ' show';
  setTimeout(() => t.classList.remove('show'), 3500);
}
