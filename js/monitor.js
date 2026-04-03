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

function _saatToSec(s) {
  if (!s) return -1;
  const p = String(s).split(':');
  if (p.length < 2) return -1;
  return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60;
}

function renderUretim() {
  const rows = _mData.uretimGecmisi || [];

  if (!rows.length) {
    document.getElementById('main-content').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text2);font-weight:700">Üretim kaydı bulunamadı</div>';
    return;
  }

  // Tüm satırları tarih+vardiya+makine bazında grupla (tüm ölçümler birlikte)
  const groups = {};   // key = tarih_vardiya
  for (const r of rows) {
    const gk = r.tarih + '_' + r.vardiya;
    if (!groups[gk]) groups[gk] = { tarih: r.tarih, vardiya: r.vardiya, makineler: {} };

    function addMakine(enjNo, kasa, cevrim, bas, bit, uretim, fire) {
      if (!enjNo || enjNo === '00') return;
      if (!groups[gk].makineler[enjNo]) {
        groups[gk].makineler[enjNo] = { enjNo, kasa: kasa || '', olcumler: [] };
      }
      const m = groups[gk].makineler[enjNo];
      if (kasa && !m.kasa) m.kasa = kasa;
      m.olcumler.push({ no: r.olcumNo, saat: r.saat, cevrim: cevrim || 0,
                        bas: bas || 0, bit: bit || 0, uretim: uretim || 0, fire: fire || 0 });
    }
    addMakine(r.enj1, r.kasa1, r.cevrim1, r.sayacBas1, r.sayacBit1, r.uretim1, r.fire1);
    addMakine(r.enj2, '',      r.cevrim2, r.sayacBas2, r.sayacBit2, r.uretim2, r.fire2);
  }

  // Her makine için özet hesapla
  for (const gk in groups) {
    for (const enjNo in groups[gk].makineler) {
      const m = groups[gk].makineler[enjNo];
      m.olcumler.sort((a, b) => a.no - b.no);
      const last = m.olcumler[m.olcumler.length - 1];
      const first = m.olcumler[0];

      // Son ölçümün bitiş sayacı - ilk ölçümün başlangıç sayacı = gerçek toplam üretim
      const sayacRange = (last.bit > 0 && first.bas > 0) ? last.bit - first.bas : 0;
      m.toplamUretim = sayacRange > 0 ? sayacRange : m.olcumler.reduce((s, o) => s + o.uretim, 0);
      m.toplamFire   = last.fire;   // kümülatif fire zaten son ölçümde birikmiş
      m.cevrimGirilen = last.cevrim || 0;

      // Gerçek çevrim: (son_saat - ilk_saat) / sayaç_farkı
      if (m.olcumler.length >= 2 && sayacRange > 0) {
        let t1 = _saatToSec(first.saat), t2 = _saatToSec(last.saat);
        if (t1 >= 0 && t2 >= 0) {
          if (t2 < t1) t2 += 86400;   // gece yarısı geçişi
          const saniye = t2 - t1;
          if (saniye > 0) m.cevrimHesaplanan = Math.round(saniye / sayacRange);
        }
      }
    }
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
      html += `<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin:20px 0 8px;padding-left:2px">${displayDate}</div>`;
      lastDate = g.tarih;
    }

    // Toplam üretim/fire bu vardiyada
    const makineler = Object.values(g.makineler);
    const toplamU = makineler.reduce((s, m) => s + m.toplamUretim, 0);
    const toplamF = makineler.reduce((s, m) => s + m.toplamFire, 0);

    // Makine satırları
    const makineHtml = makineler
      .sort((a, b) => {
        const na = parseInt((a.enjNo.match(/\d+/) || ['0'])[0]);
        const nb = parseInt((b.enjNo.match(/\d+/) || ['0'])[0]);
        return na - nb;
      })
      .map(m => {
        let cevrimHtml = '';
        if (m.cevrimGirilen > 0) {
          const g = m.cevrimGirilen;
          const h = m.cevrimHesaplanan;
          let gercekHtml = '';
          if (h > 0) {
            const fark = h - g;
            const pct  = Math.abs(fark / g) * 100;
            const renk = pct <= 10 ? '#16a34a' : pct <= 30 ? '#d97706' : '#dc2626';
            const isaret = fark > 0 ? '+' : '';
            gercekHtml = `<span style="color:${renk};font-weight:700;font-size:12px"> → Gerçek: ${h}sn (${isaret}${fark}sn)</span>`;
          }
          cevrimHtml = `<div style="font-size:12px;color:var(--text2);margin-top:3px">⏱ Girilen: <strong>${g}sn</strong>${gercekHtml}</div>`;
        }
        return `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:800;color:var(--text)">
                ${m.enjNo}${m.kasa ? `<span style="font-weight:600;color:var(--text2);margin-left:6px">· ${m.kasa}</span>` : ''}
              </div>
              ${cevrimHtml}
            </div>
            <div style="display:flex;gap:10px;flex-shrink:0;margin-left:10px">
              <div style="text-align:center">
                <div style="font-size:15px;font-weight:800;color:#16a34a">${m.toplamUretim.toLocaleString('tr-TR')}</div>
                <div style="font-size:9px;color:#15803d;font-weight:700;text-transform:uppercase">Üretim</div>
              </div>
              ${m.toplamFire > 0 ? `
              <div style="text-align:center">
                <div style="font-size:15px;font-weight:800;color:#dc2626">${m.toplamFire}</div>
                <div style="font-size:9px;color:#dc2626;font-weight:700;text-transform:uppercase">Fire</div>
              </div>` : ''}
            </div>
          </div>`;
      }).join('');

    html += `
      <div class="ariza-row" style="margin-bottom:10px">
        <div class="ariza-row-top">
          <span style="font-size:15px;font-weight:800">${vardiyaIcon[g.vardiya] || ''} ${g.vardiya}</span>
          <div style="display:flex;gap:12px;margin-left:auto">
            <span style="font-size:13px;font-weight:800;color:#16a34a">${toplamU.toLocaleString('tr-TR')} üretim</span>
            ${toplamF > 0 ? `<span style="font-size:13px;font-weight:800;color:#dc2626">${toplamF} fire</span>` : ''}
          </div>
        </div>
        <div style="margin-top:6px">${makineHtml}</div>
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
