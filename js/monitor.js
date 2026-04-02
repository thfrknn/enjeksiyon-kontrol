/* ── Yönetici İzleme Paneli ─────────────────────────── */

const _mUserId   = sessionStorage.getItem('ep_id')   || '';
const _mUserName = sessionStorage.getItem('ep_name') || '';

let _mData       = null;
let _mTimeOffset = 0;
let _activeTab   = 'canli';    // 'canli' | 'ariza' | 'kapama' | 'uretim'
let _activeVardiya = 'TUMU';   // 'TUMU' | 'SABAH' | 'AKSAM' | 'GECE'

/* ---------- Init ---------- */

window.onload = function() {
  if (!_mUserId) { window.location.href = 'index.html'; return; }

  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  document.getElementById('user-header').textContent = 'Yönetici: ' + _mUserName;

  loadData(false);
  setInterval(function() { loadData(true); }, 60000);
};

/* ---------- Veri yükleme ---------- */

function loadData(silent) {
  if (!silent) {
    document.getElementById('loading').classList.add('show');
    document.getElementById('load-text').textContent = 'Yükleniyor...';
  }

  const cb = 'cbMon_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    if (!silent) document.getElementById('loading').classList.remove('show');
    if (json.serverTime) _mTimeOffset = json.serverTime - Date.now();
    _mData = json;
    render();
  };

  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?action=getMonitorData&callback=' + cb;
  s.onerror = function() {
    delete window[cb];
    if (!silent) document.getElementById('loading').classList.remove('show');
    showMonToast('Sunucu bağlantısı kurulamadı', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Ana render ---------- */

function render() {
  if (!_mData) return;
  renderOzet();
  if      (_activeTab === 'canli')  renderCanli();
  else if (_activeTab === 'ariza')  renderAriza();
  else if (_activeTab === 'kapama') renderKapama();
  else if (_activeTab === 'uretim') renderUretim();
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

/* ---------- Kapatma geçmişi ---------- */

function renderKapama() {
  const log = (_mData.arizaLog || []).filter(r => {
    const arızaTipleri = ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Diğer', 'Makine Açıldı'];
    return !arızaTipleri.includes(r.tip);  // Arıza dışı: Temizlik, Planlı Bakım, Diğer, Makine Açıldı
  });

  // Arıza log'u türe göre: arıza olmayan kayıtlar (Temizlik/Bakım/Diğer + Makine Açıldı)
  const kapLog = (_mData.arizaLog || []).filter(r => {
    const arizaTipleri = ['Makine Kaynaklı', 'Kalıp Kaynaklı'];
    return !arizaTipleri.includes(r.tip);
  });

  if (!kapLog.length) {
    document.getElementById('main-content').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text2);font-weight:700">Kapatma kaydı bulunamadı</div>';
    return;
  }

  const rows = kapLog.map(r => {
    const isAcildi  = r.tip === 'Makine Açıldı';
    const iconColor = isAcildi ? '#16a34a' : '#c2410c';
    const icon      = isAcildi ? '🟢' : '🔒';
    return `
      <div class="ariza-row">
        <div class="ariza-row-top">
          <span class="ariza-makine">${r.makine}</span>
          <span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:20px;background:${isAcildi ? '#dcfce7' : '#fff7ed'};color:${iconColor}">${icon} ${r.tip}</span>
          <span class="ariza-zaman">${r.zaman}</span>
        </div>
        ${r.sorun && r.sorun !== r.tip ? `<div class="ariza-sorun">${r.sorun}</div>` : ''}
        <div class="ariza-saat">
          ${r.basSaat ? `🕐 ${r.basSaat}` : ''}
          ${r.bitSaat ? ` → ${r.bitSaat}` : ''}
          ${r.teknikerAd ? ` · ${r.teknikerAd}` : ''}
        </div>
      </div>`;
  }).join('');

  document.getElementById('main-content').innerHTML = `<div style="padding:0 16px 40px">${rows}</div>`;
}

/* ---------- Üretim geçmişi ---------- */

function renderUretim() {
  const rows = _mData.uretimGecmisi || [];

  if (!rows.length) {
    document.getElementById('main-content').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text2);font-weight:700">Üretim kaydı bulunamadı</div>';
    return;
  }

  // Yalnızca son ölçümü al (max olcumNo per operatör+gün+vardiya+enj)
  const keyMap = {};
  for (const r of rows) {
    const k = r.tarih + '_' + r.vardiya + '_' + r.adsoyad + '_' + r.enj1;
    if (!keyMap[k] || r.olcumNo > keyMap[k].olcumNo) keyMap[k] = r;
  }
  const son = Object.values(keyMap);

  // Gün+vardiya bazlı grupla
  const groups = {};
  for (const r of son) {
    const gk = r.tarih + '_' + r.vardiya;
    if (!groups[gk]) groups[gk] = { tarih: r.tarih, vardiya: r.vardiya, operatorler: [], uretim: 0, fire: 0 };
    const g = groups[gk];
    g.uretim += r.uretim1 + r.uretim2;
    g.fire   += r.fire1   + r.fire2;
    if (!g.operatorler.includes(r.adsoyad)) g.operatorler.push(r.adsoyad);
  }

  const sorted = Object.values(groups).sort((a, b) => {
    if (b.tarih !== a.tarih) return b.tarih.localeCompare(a.tarih);
    const vOrder = { SABAH: 0, AKSAM: 1, GECE: 2 };
    return (vOrder[a.vardiya] ?? 9) - (vOrder[b.vardiya] ?? 9);
  });

  const vardiyaIcon = { SABAH: '☀️', AKSAM: '🌆', GECE: '🌙' };

  let lastDate = '';
  let html = '<div style="padding:0 16px 40px">';
  for (const g of sorted) {
    const d = new Date(g.tarih);
    const displayDate = d.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });
    if (g.tarih !== lastDate) {
      html += `<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin:16px 0 8px;padding-left:2px">${displayDate}</div>`;
      lastDate = g.tarih;
    }
    html += `
      <div class="ariza-row" style="margin-bottom:8px">
        <div class="ariza-row-top">
          <span style="font-size:15px;font-weight:800">${vardiyaIcon[g.vardiya] || ''} ${g.vardiya}</span>
          <span style="font-size:11px;font-weight:700;color:var(--text2);margin-left:auto">${g.operatorler.length} operatör</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:#16a34a">${g.uretim.toLocaleString('tr-TR')}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#15803d;margin-top:2px">Üretim</div>
          </div>
          <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:#dc2626">${g.fire}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#dc2626;margin-top:2px">Fire</div>
          </div>
        </div>
        ${g.operatorler.length ? `<div style="font-size:11px;color:var(--text2);margin-top:8px;font-weight:600">👤 ${g.operatorler.join(' · ')}</div>` : ''}
      </div>`;
  }
  html += '</div>';

  document.getElementById('main-content').innerHTML = html;
}

/* ---------- Tab geçişi ---------- */

function setTab(tab) {
  _activeTab = tab;
  ['canli','ariza','kapama','uretim'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('tab-active', t === tab);
  });
  // Vardiya filtresi sadece canlı sekmede
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
