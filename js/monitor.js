/* ── Yönetici İzleme Paneli ─────────────────────────── */

// PWA kalıcı oturum: sessionStorage yoksa localStorage'dan geri yükle
(function() {
  if (!sessionStorage.getItem('ep_id')) {
    try {
      var s = localStorage.getItem('yonetici_session');
      if (s) { var u = JSON.parse(s); if (u && u.id) { sessionStorage.setItem('ep_id', u.id); sessionStorage.setItem('ep_name', u.ad || ''); } }
    } catch(e) {}
  }
})();

const _mUserId   = sessionStorage.getItem('ep_id')   || '';
const _mUserName = sessionStorage.getItem('ep_name') || '';

let _mData       = null;
let _mTimeOffset = 0;
let _activeTab   = 'canli';    // 'canli' | 'ariza' | 'kapama' | 'uretim' | 'indir' | 'personel' | 'ayarlar'
let _activeVardiya = 'TUMU';   // 'TUMU' | 'SABAH' | 'AKSAM' | 'GECE'

// Personel & Ayarlar sekme durumu
let _personelData  = null;
let _personelSubTab = 'ekle';   // 'ekle' | 'duzenle' | 'sifre'
let _settingsData  = null;

// Üretim sekmesi filtre durumu
let _uretimFiltTarih   = '';      // 'yyyy-MM-dd' | ''
let _uretimFiltVardiya = 'TÜMÜ'; // 'TÜMÜ'|'SABAH'|'AKSAM'|'GECE'
let _uretimFiltEnj     = 'TÜMÜ'; // 'TÜMÜ'|'Enjeksiyon 3'|...

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
  if      (_activeTab === 'canli')    renderCanli();
  else if (_activeTab === 'ariza')    renderAriza();
  else if (_activeTab === 'kapama')   renderKapama();
  else if (_activeTab === 'uretim')   renderUretim();
  else if (_activeTab === 'indir')    renderIndir();
  else if (_activeTab === 'personel') renderPersonel();
  else if (_activeTab === 'ayarlar')  renderAyarlar();
}

/* ---------- Özet satırı ---------- */

function renderOzet() {
  const oz = _mData.ozet || {};
  const aktif   = oz.aktif   ?? 0;
  const arizali = oz.arizali ?? 0;

  // Canlı İzleme'den toplam — flat yapı (son 24s)
  let toplamUretim = 0, toplamFire = 0;
  const cd = _mData.canliData || {};
  for (const makine in cd) {
    const d = cd[makine];
    if (!d || !d.uretim) continue;
    if (_activeVardiya !== 'TUMU' && d.vardiya && d.vardiya !== _activeVardiya) continue;
    toplamUretim += parseInt(d.uretim) || 0;
    toplamFire   += parseInt(d.fire)   || 0;
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
  const statuses  = _mData.statuses  || {};
  const canliData = _mData.canliData || {};
  const kasalar   = _mData.kasalar   || {};

  let html = '';
  for (let i = 1; i <= 13; i++) {
    const makineNo   = 'Enjeksiyon ' + i;
    const status     = statuses[makineNo] || { durum: 'Aktif' };
    const isArizali  = status.durum === 'Arızalı';
    const kasaAtanan = kasalar[makineNo] || '';

    // Flat canlı veri (son 24s)
    const d        = canliData[makineNo] || {};
    const operatör = d.operatör || '';
    const kasa     = kasaAtanan || d.kasa || '';
    const cevrim   = d.cevrim   || '';
    const uretim   = parseInt(d.uretim) || 0;
    const fire     = parseInt(d.fire)   || 0;
    const saat     = d.saat     || '';

    // Vardiya filtresi — eşleşmeyen kartları soluk göster
    const matchesFilter = _activeVardiya === 'TUMU' || !d.vardiya || d.vardiya === _activeVardiya;
    const cardOpacity   = matchesFilter ? '1' : '0.4';

    if (isArizali) {
      const ariza = status.sonAriza || {};
      html += `
        <div class="mmon-card mmon-red" style="opacity:${cardOpacity}">
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
        <div class="mmon-card" style="opacity:${cardOpacity}">
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
              <div class="mmon-stat-lbl">Üretim (24s)</div>
            </div>
            <div class="mmon-stat">
              <div class="mmon-stat-val warn">${fire > 0 ? fire : '—'}</div>
              <div class="mmon-stat-lbl">Fire (24s)</div>
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

// ── Filtre barı render (monitor.html'deki #uretim-filter-bar'a) ──
function renderUretimFiltrebar() {
  const el = document.getElementById('uretim-filter-bar');
  if (!el) return;
  const V_ICON = { SABAH:'☀️', AKSAM:'🌆', GECE:'🌙' };
  const isAktif = _uretimFiltTarih || _uretimFiltVardiya !== 'TÜMÜ' || _uretimFiltEnj !== 'TÜMÜ';

  el.innerHTML = `
    <!-- Tarih satırı -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <span style="font-size:12px;font-weight:800;color:var(--text2)">📅</span>
      <input id="uf-tarih-inp" type="date" value="${_uretimFiltTarih}"
        onchange="uretimFiltreTarih(this.value)"
        style="border:2px solid var(--border);border-radius:10px;padding:5px 10px;
               font-size:13px;font-family:'Nunito',sans-serif;font-weight:700;color:var(--text);outline:none">
      <button onclick="uretimBugün()"
        style="padding:5px 12px;border:2px solid var(--accent);border-radius:20px;background:white;
               color:var(--accent);font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;cursor:pointer">
        Bugün</button>
      ${isAktif ? `<button onclick="uretimTemizle()"
        style="padding:5px 12px;border:2px solid #dc2626;border-radius:20px;background:white;
               color:#dc2626;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;cursor:pointer">
        ✕ Temizle</button>` : ''}
    </div>
    <!-- Vardiya satırı -->
    <div style="display:flex;gap:6px;margin-bottom:7px;flex-wrap:wrap">
      ${['TÜMÜ','SABAH','AKSAM','GECE'].map(v => {
        const act = _uretimFiltVardiya === v;
        return `<button class="uf-vbtn" data-v="${v}" onclick="uretimFiltreVardiya('${v}')"
          style="padding:5px 11px;border:2px solid ${act ? 'var(--accent)' : 'var(--border)'};
                 border-radius:20px;background:${act ? 'var(--accent)' : 'white'};
                 color:${act ? 'white' : 'var(--text2)'};font-family:'Nunito',sans-serif;
                 font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">
          ${V_ICON[v] || ''} ${v}</button>`;
      }).join('')}
    </div>
    <!-- Makine satırı -->
    <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
      <span style="font-size:11px;font-weight:800;color:var(--text2);white-space:nowrap">Makine:</span>
      ${['TÜMÜ',...[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => 'Enjeksiyon ' + n)].map(e => {
        const act = _uretimFiltEnj === e;
        const lbl = e === 'TÜMÜ' ? 'Tümü' : e.replace('Enjeksiyon ','');
        return `<button class="uf-ebtn" data-e="${e}" onclick="uretimFiltreEnj('${e}')"
          style="padding:4px 10px;border:2px solid ${act ? '#7c3aed' : 'var(--border)'};
                 border-radius:16px;background:${act ? '#7c3aed' : 'white'};
                 color:${act ? 'white' : 'var(--text2)'};font-family:'Nunito',sans-serif;
                 font-size:12px;font-weight:800;cursor:pointer">
          ${lbl}</button>`;
      }).join('')}
    </div>`;
}

// ── Filtre event handler'ları ─────────────────────────
function uretimFiltreTarih(val) {
  _uretimFiltTarih = val || '';
  renderUretimFiltrebar();
  renderUretim();
}
function uretimFiltreVardiya(v) {
  _uretimFiltVardiya = v;
  renderUretimFiltrebar();
  renderUretim();
}
function uretimFiltreEnj(v) {
  _uretimFiltEnj = v;
  renderUretimFiltrebar();
  renderUretim();
}
function uretimBugün() {
  const today = new Date();
  _uretimFiltTarih = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2,'0') + '-' +
    String(today.getDate()).padStart(2,'0');
  renderUretimFiltrebar();
  renderUretim();
}
function uretimTemizle() {
  _uretimFiltTarih   = '';
  _uretimFiltVardiya = 'TÜMÜ';
  _uretimFiltEnj     = 'TÜMÜ';
  renderUretimFiltrebar();
  renderUretim();
}

// ── Ana render ────────────────────────────────────────
function renderUretim() {
  const rows = _mData.uretimGecmisi || [];
  const V_ICON = { SABAH: '☀️', AKSAM: '🌆', GECE: '🌙' };

  // ── Veriyi grupla (tarih+vardiya+makine) ─────────
  const groups = {};
  for (const r of rows) {
    if (_uretimFiltTarih && r.tarih !== _uretimFiltTarih) continue;
    if (_uretimFiltVardiya !== 'TÜMÜ' && r.vardiya !== _uretimFiltVardiya) continue;

    const gk = r.tarih + '_' + r.vardiya;
    if (!groups[gk]) groups[gk] = { tarih: r.tarih, vardiya: r.vardiya, makineler: {} };

    const addMakine = (enjNo, kasa, cevrim, bas, bit, uretim, fire, adsoyad) => {
      if (!enjNo || enjNo === '00') return;
      if (_uretimFiltEnj !== 'TÜMÜ' && enjNo !== _uretimFiltEnj) return;
      if (!groups[gk].makineler[enjNo])
        groups[gk].makineler[enjNo] = { enjNo, kasa:'', olcumler:[], operatorler: new Set() };
      const m = groups[gk].makineler[enjNo];
      if (kasa && !m.kasa) m.kasa = kasa;
      if (adsoyad) m.operatorler.add(adsoyad);
      m.olcumler.push({ no: r.olcumNo, saat: r.saat, cevrim: cevrim||0,
                        bas: bas||0, bit: bit||0, uretim: uretim||0, fire: fire||0 });
    };
    addMakine(r.enj1, r.kasa1, r.cevrim1, r.sayacBas1, r.sayacBit1, r.uretim1, r.fire1, r.adsoyad);
    addMakine(r.enj2, '',      r.cevrim2, r.sayacBas2, r.sayacBit2, r.uretim2, r.fire2, r.adsoyad);
  }

  // ── Her makine için özet hesapla ─────────────────
  for (const gk in groups) {
    for (const enjNo in groups[gk].makineler) {
      const m = groups[gk].makineler[enjNo];
      m.olcumler.sort((a, b) => a.no - b.no);
      const first = m.olcumler[0];
      const last  = m.olcumler[m.olcumler.length - 1];
      m.olcumSayisi = m.olcumler.length;

      const sayacRange = (last.bit > 0 && first.bas > 0) ? last.bit - first.bas : 0;
      m.toplamUretim  = sayacRange > 0 ? sayacRange : m.olcumler.reduce((s,o) => s + o.uretim, 0);
      m.toplamFire    = last.fire;
      m.cevrimGirilen = last.cevrim || 0;

      // Çevrim 1 — Mesai çevrimi: 8 saatlik mesai ÷ toplam üretim
      m.cevrimMesai = m.toplamUretim > 0 ? Math.round(28800 / m.toplamUretim) : 0;

      // Çevrim 2 — Ölçüm çevrimi: (son_saat - ilk_saat) ÷ sayaç_farkı
      if (m.olcumler.length >= 2 && sayacRange > 0) {
        let t1 = _saatToSec(first.saat), t2 = _saatToSec(last.saat);
        if (t1 >= 0 && t2 >= 0) {
          if (t2 < t1) t2 += 86400;
          const sn = t2 - t1;
          if (sn > 0) m.cevrimOlcum = Math.round(sn / sayacRange);
        }
      }

      // Operatör listesi (Set → Array)
      m.operatorlerArr = [...m.operatorler];
    }
  }

  // ── Sırala ───────────────────────────────────────
  const sorted = Object.values(groups).sort((a, b) => {
    if (b.tarih !== a.tarih) return b.tarih.localeCompare(a.tarih);
    const vO = { SABAH:0, AKSAM:1, GECE:2 };
    return (vO[a.vardiya] ?? 9) - (vO[b.vardiya] ?? 9);
  });

  // ── Sonuç yoksa ──────────────────────────────────
  if (!sorted.length) {
    document.getElementById('main-content').innerHTML =
      '<div style="text-align:center;padding:48px 16px;color:var(--text2);font-weight:700">Filtreye uyan üretim kaydı bulunamadı</div>';
    return;
  }

  // ── HTML oluştur ──────────────────────────────────
  let lastDate = '';
  let bodyHtml = '<div style="padding:0 14px 60px">';

  for (const g of sorted) {
    const d = new Date(g.tarih + 'T12:00:00');
    const displayDate = d.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    if (g.tarih !== lastDate) {
      bodyHtml += `<div style="font-size:11px;font-weight:800;text-transform:uppercase;
        letter-spacing:.6px;color:var(--text2);margin:20px 0 6px;padding-left:2px">
        ${displayDate}</div>`;
      lastDate = g.tarih;
    }

    const makineler = Object.values(g.makineler).sort((a,b) => {
      const na = parseInt((a.enjNo.match(/\d+/)||['0'])[0]);
      const nb = parseInt((b.enjNo.match(/\d+/)||['0'])[0]);
      return na - nb;
    });

    const toplamU = makineler.reduce((s,m) => s + m.toplamUretim, 0);
    const toplamF = makineler.reduce((s,m) => s + m.toplamFire, 0);

    const makineHtml = makineler.map(m => {
      // Duplicate badge
      const dupBadge = m.olcumSayisi > 1
        ? `<span style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;
            border-radius:10px;padding:1px 7px;font-size:10px;font-weight:800;margin-left:6px">
            ⚠️ ${m.olcumSayisi} ölçüm</span>` : '';

      // Operatör
      const opHtml = m.operatorlerArr.length
        ? `<div style="font-size:11px;color:var(--text2);font-weight:700;margin-top:2px">
            👤 ${m.operatorlerArr.join(', ')}</div>` : '';

      // Çevrim satırları
      let cevrimHtml = '';
      if (m.cevrimGirilen > 0 || m.cevrimMesai > 0) {
        const cg = m.cevrimGirilen;

        // Mesai çevrimi (birincil — kalın)
        if (m.cevrimMesai > 0) {
          const fark   = cg > 0 ? m.cevrimMesai - cg : null;
          const pct    = fark !== null ? Math.abs(fark / cg) * 100 : null;
          const renk   = pct === null ? '#7c3aed'
                       : pct <= 10   ? '#16a34a'
                       : pct <= 30   ? '#d97706' : '#dc2626';
          const farkTxt = fark !== null
            ? `<span style="color:${renk};font-weight:800;font-size:12px"> (${fark>0?'+':''}${fark}sn)</span>` : '';
          cevrimHtml += `
            <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
              <span style="font-size:11px;font-weight:800;color:#7c3aed;white-space:nowrap">📊 Gerçek çevrim</span>
              <span style="font-size:16px;font-weight:900;color:#7c3aed">${m.cevrimMesai}sn</span>
              ${farkTxt}
              <span style="font-size:10px;color:var(--text2);font-weight:600">28.800÷${m.toplamUretim.toLocaleString('tr-TR')}</span>
            </div>`;
        }

        // Girilen çevrim (ikincil)
        if (cg > 0) {
          cevrimHtml += `<div style="font-size:11px;color:var(--text2);font-weight:700;margin-top:2px">
            ⏱ Girilen: <strong>${cg}sn</strong></div>`;
        }

        // Ölçüm çevrimi (zamana dayalı, varsa)
        if (m.cevrimOlcum > 0) {
          const fark2 = cg > 0 ? m.cevrimOlcum - cg : null;
          const r2    = fark2 !== null
            ? `<span style="color:${Math.abs(fark2/cg)*100<=10?'#16a34a':Math.abs(fark2/cg)*100<=30?'#d97706':'#dc2626'};font-weight:700"> (${fark2>0?'+':''}${fark2}sn)</span>` : '';
          cevrimHtml += `<div style="font-size:11px;color:var(--text2);font-weight:700;margin-top:1px">
            🕐 Ölçüm çevrimi: <strong>${m.cevrimOlcum}sn</strong>${r2}
            <span style="font-size:10px;font-weight:600"> (${m.olcumSayisi} ölçüm arası)</span></div>`;
        }
      }

      return `
        <div style="border:1.5px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:white">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:800;color:var(--text)">
                ${m.enjNo}
                ${m.kasa ? `<span style="font-weight:600;color:var(--text2);margin-left:5px">· ${m.kasa}</span>` : ''}
                ${dupBadge}
              </div>
              ${opHtml}
              ${cevrimHtml}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
              <div style="text-align:center">
                <div style="font-size:18px;font-weight:900;color:#16a34a">${m.toplamUretim.toLocaleString('tr-TR')}</div>
                <div style="font-size:9px;color:#15803d;font-weight:800;text-transform:uppercase">üretim</div>
              </div>
              ${m.toplamFire > 0 ? `
              <div style="text-align:center">
                <div style="font-size:16px;font-weight:800;color:#dc2626">${m.toplamFire}</div>
                <div style="font-size:9px;color:#dc2626;font-weight:800;text-transform:uppercase">fire</div>
              </div>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    bodyHtml += `
      <div style="background:white;border:1.5px solid var(--border);border-radius:14px;padding:12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:15px;font-weight:800">${V_ICON[g.vardiya]||''} ${g.vardiya}</span>
          <div style="display:flex;gap:10px">
            <span style="font-size:13px;font-weight:800;color:#16a34a">${toplamU.toLocaleString('tr-TR')} üretim</span>
            ${toplamF > 0 ? `<span style="font-size:13px;font-weight:800;color:#dc2626">${toplamF} fire</span>` : ''}
          </div>
        </div>
        ${makineHtml}
      </div>`;
  }

  bodyHtml += '</div>';
  document.getElementById('main-content').innerHTML = bodyHtml;
}

/* ---------- Tab geçişi ---------- */

function setTab(tab) {
  _activeTab = tab;
  ['canli','ariza','kapama','uretim','indir','personel','ayarlar'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('tab-active', t === tab);
  });
  // Vardiya filtresi sadece canlı sekmede
  document.getElementById('vardiya-filter').style.display = tab === 'canli' ? 'flex' : 'none';

  // Üretim filtre barı sadece üretim sekmesinde
  var ufBar = document.getElementById('uretim-filter-bar');
  if (ufBar) {
    ufBar.style.display = tab === 'uretim' ? 'block' : 'none';
    if (tab === 'uretim') renderUretimFiltrebar();
  }

  // Personel & Ayarlar sekmeleri lazy-load
  if (tab === 'personel' && !_personelData) { loadPersonel(); return; }
  if (tab === 'ayarlar'  && !_settingsData) { loadSettings();  return; }
  render();
}

function setVardiyaFilter(v) {
  _activeVardiya = v;
  ['TUMU','SABAH','AKSAM','GECE'].forEach(x => {
    document.getElementById('vf-' + x).classList.toggle('vf-active', x === v);
  });
  render();
}

/* ---------- İndir / Yedekle ---------- */

function renderIndir() {
  const ssId     = _mData.ssId      || '';
  const gids     = _mData.sheetGids || {};
  const sonYedek = _mData.sonYedek  || '';

  function excelUrl(gid) {
    if (!ssId) return '#';
    const base = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=xlsx';
    return gid != null ? base + '&gid=' + gid : base;
  }

  const sheets = [
    { label: '📋 Veriler (Ham)',       gid: gids.veriler },
    { label: '📦 Üretim Kaydı',        gid: gids.uretimKaydi },
    { label: '⚠️ Arıza Log',           gid: gids.arizaLog },
    { label: '📊 Tüm Spreadsheet',     gid: null },
  ];

  const btnStyle = 'display:block;width:100%;padding:14px 16px;margin-bottom:10px;border:2px solid var(--border);border-radius:14px;background:white;font-family:\'Nunito\',sans-serif;font-size:14px;font-weight:700;color:var(--text);text-align:left;text-decoration:none;cursor:pointer;';

  const downloadHtml = sheets.map(s => {
    const url = excelUrl(s.gid);
    return `<a href="${url}" target="_blank" style="${btnStyle}">${s.label} <span style="float:right;color:var(--text2);font-size:12px">Excel ↗</span></a>`;
  }).join('');

  document.getElementById('main-content').innerHTML = `
    <div style="padding:16px 16px 40px">

      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text2);margin-bottom:12px">Excel İndir</div>
      ${ssId ? downloadHtml : '<div style="color:var(--text2);font-size:13px;padding:10px">Spreadsheet bağlantısı yükleniyor...</div>'}

      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text2);margin:20px 0 12px">Google Drive Yedekleme</div>

      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:14px;margin-bottom:12px;font-size:13px;font-weight:600;color:#15803d">
        📁 Yedekler <strong>"Ersan Plastik Yedekleri"</strong> klasörüne kaydedilir.<br>
        ${sonYedek ? '<span style="color:var(--text2)">Son yedek: <strong>' + sonYedek + '</strong></span>' : '<span style="color:var(--text2)">Henüz yedek alınmadı.</span>'}
      </div>

      <button id="yedekle-btn" onclick="exportNow()"
              style="width:100%;padding:15px;background:#2563eb;color:white;border:none;border-radius:14px;font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:10px">
        🗂 Şimdi Drive'a Yedekle
      </button>

      <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:12px;font-size:12px;font-weight:600;color:#92400e">
        ⏰ <strong>Günlük otomatik yedek</strong> için Google Apps Script editöründe<br>
        <code style="background:#fef3c7;padding:2px 6px;border-radius:4px;font-size:11px">setupDailyExport()</code> fonksiyonunu bir kez çalıştırın.
      </div>

      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text2);margin:24px 0 12px">Ay Sonu Temizliği</div>

      <div style="background:#fff1f2;border:1.5px solid #fda4af;border-radius:14px;padding:14px;margin-bottom:12px;font-size:13px;font-weight:600;color:#9f1239">
        ⚠️ Bu işlem <strong>geri alınamaz</strong>. Son sayaçlar Devir sekmesine kaydedildikten sonra:<br>
        Veriler · Fire Log · Arıza Log · Günlük Özet · Üretim Kaydı · Makine Kilitleri · Kasa Atamaları temizlenir.<br>
        <span style="color:var(--text2);font-weight:700">Personel listesi ve Makine Durumları değişmez.</span>
      </div>

      <button onclick="openAySonuModal()"
              style="width:100%;padding:15px;background:#dc2626;color:white;border:none;border-radius:14px;font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer">
        🗑 Ay Sonu Temizliği Yap
      </button>
    </div>

    <!-- Ay Sonu Modal -->
    <div id="ay-sonu-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center">
      <div style="background:white;border-radius:20px;padding:24px;width:calc(100% - 40px);max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="font-size:18px;font-weight:800;color:#b91c1c;margin-bottom:8px">🗑 Ay Sonu Temizliği</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:16px">Devam etmek için <strong>Meydancı / Admin</strong> şifrenizi girin.</div>
        <div style="margin-bottom:10px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Kullanıcı ID</label>
          <input id="ay-sonu-id" type="text" inputmode="numeric" maxlength="6"
                 style="width:100%;box-sizing:border-box;padding:12px;border:2px solid var(--border);border-radius:10px;font-size:16px;font-family:'Nunito',sans-serif;font-weight:700" placeholder="Örn: 101">
        </div>
        <div style="margin-bottom:18px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Şifre</label>
          <input id="ay-sonu-sifre" type="password" inputmode="numeric"
                 style="width:100%;box-sizing:border-box;padding:12px;border:2px solid var(--border);border-radius:10px;font-size:16px;font-family:'Nunito',sans-serif;font-weight:700" placeholder="Şifreniz">
        </div>
        <div id="ay-sonu-err" style="display:none;color:#dc2626;font-size:13px;font-weight:700;margin-bottom:12px;padding:8px;background:#fff1f2;border-radius:8px"></div>
        <div style="display:flex;gap:10px">
          <button onclick="closeAySonuModal()"
                  style="flex:1;padding:13px;background:#f1f5f9;color:var(--text);border:none;border-radius:12px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;cursor:pointer">
            İptal
          </button>
          <button id="ay-sonu-ok-btn" onclick="doAySonuTemizlik()"
                  style="flex:1;padding:13px;background:#dc2626;color:white;border:none;border-radius:12px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;cursor:pointer">
            Temizle
          </button>
        </div>
      </div>
    </div>`;
}

function exportNow() {
  const btn = document.getElementById('yedekle-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Yedekleniyor...'; }

  const cb = 'cbExport_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('jsonp-export')?.remove();
    if (btn) { btn.disabled = false; btn.textContent = '🗂 Şimdi Drive\'a Yedekle'; }
    if (json && json.result === 'ok') {
      showMonToast('✅ Yedek Drive\'a kaydedildi!', 'ok');
      // Son yedek tarihini güncelle
      if (_mData) _mData.sonYedek = new Date().toISOString().split('T')[0];
      renderIndir();
    } else {
      showMonToast('Yedekleme hatası: ' + (json && json.message ? json.message : 'bilinmiyor'), 'err');
    }
  };
  const s = document.createElement('script');
  s.id  = 'jsonp-export';
  s.src = SCRIPT_URL + '?action=exportNow&callback=' + cb;
  s.onerror = function() {
    delete window[cb];
    if (btn) { btn.disabled = false; btn.textContent = '🗂 Şimdi Drive\'a Yedekle'; }
    showMonToast('Bağlantı hatası', 'err');
  };
  document.head.appendChild(s);
}

/* ---------- Ay Sonu Temizliği ---------- */

function openAySonuModal() {
  document.getElementById('ay-sonu-id').value    = '';
  document.getElementById('ay-sonu-sifre').value = '';
  document.getElementById('ay-sonu-err').style.display = 'none';
  const modal = document.getElementById('ay-sonu-modal');
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('ay-sonu-id').focus(), 100);
}

function closeAySonuModal() {
  document.getElementById('ay-sonu-modal').style.display = 'none';
}

function doAySonuTemizlik() {
  const adminId    = (document.getElementById('ay-sonu-id').value    || '').trim();
  const adminSifre = (document.getElementById('ay-sonu-sifre').value || '').trim();
  const errEl      = document.getElementById('ay-sonu-err');
  const btn        = document.getElementById('ay-sonu-ok-btn');

  if (!adminId || !adminSifre) {
    errEl.textContent = 'ID ve şifre zorunlu';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Temizleniyor...';
  errEl.style.display = 'none';

  const cb = 'cbAySonu_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('jsonp-ay-sonu')?.remove();
    btn.disabled = false;
    btn.textContent = 'Temizle';

    if (json && json.result === 'ok') {
      closeAySonuModal();
      showMonToast('✅ Ay sonu temizliği tamamlandı. ' + (json.devirKaydedilen || 0) + ' makine devir kaydedildi.', 'ok');
    } else {
      errEl.textContent = json && json.error ? json.error : 'Hata oluştu, tekrar dene';
      errEl.style.display = 'block';
    }
  };

  const s = document.createElement('script');
  s.id  = 'jsonp-ay-sonu';
  s.src = SCRIPT_URL
    + '?action=monthlyBackupAndCleanup'
    + '&admin_id=' + encodeURIComponent(adminId)
    + '&sifre='    + encodeURIComponent(adminSifre)
    + '&callback=' + cb;
  s.onerror = function() {
    delete window[cb];
    btn.disabled = false;
    btn.textContent = 'Temizle';
    errEl.textContent = 'Bağlantı hatası';
    errEl.style.display = 'block';
  };
  document.head.appendChild(s);
}

/* ---------- Personel Sekmesi ---------- */

function loadPersonel() {
  document.getElementById('main-content').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);font-weight:700">Yükleniyor...</div>';
  const cb = 'cbPersonel_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    _personelData = json.personel || [];
    renderPersonel();
  };
  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?action=getPersonel&callback=' + cb;
  s.onerror = function() { delete window[cb]; showMonToast('Personel yüklenemedi', 'err'); };
  document.head.appendChild(s);
}

function renderPersonel() {
  const subTabs = [
    { key: 'ekle',    label: '+ Ekle' },
    { key: 'duzenle', label: '✏️ Düzenle' },
    { key: 'sifre',   label: '🔑 Şifre' },
  ];
  const subTabHtml = subTabs.map(t =>
    `<button onclick="setPersonelSubTab('${t.key}')"
      style="padding:8px 16px;border:none;border-radius:20px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;
             background:${_personelSubTab === t.key ? 'var(--accent)' : 'var(--bg)'};
             color:${_personelSubTab === t.key ? 'white' : 'var(--text2)'}">${t.label}</button>`
  ).join('');

  let bodyHtml = '';
  if (_personelSubTab === 'ekle') {
    bodyHtml = `
      <div style="background:white;border:1.5px solid var(--border);border-radius:14px;padding:16px">
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Ad Soyad</label>
          <input id="prs-ad" type="text" placeholder="Ad Soyad"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px">
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Şifre (TC Son 4 Hane)</label>
          <input id="prs-sifre" type="text" placeholder="1234" maxlength="8"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px">
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Rol</label>
          <select id="prs-rol"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px;background:white">
            <option value="Operatör">Operatör</option>
            <option value="Meydancı">Meydancı</option>
            <option value="Yönetici">Yönetici</option>
          </select>
        </div>
        <button onclick="addPersonel()"
          style="width:100%;padding:13px;background:var(--accent);color:white;border:none;border-radius:12px;font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer">
          Kaydet
        </button>
      </div>`;
  } else if (_personelSubTab === 'duzenle') {
    const list = (_personelData || []).map(p => {
      const durumBadge = p.durum === 'Pasif'
        ? '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:#fee2e2;color:#dc2626">Pasif</span>'
        : '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:#dcfce7;color:#16a34a">Aktif</span>';
      return `
        <div style="background:white;border:1.5px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px">
            <div>
              <div style="font-size:14px;font-weight:800;color:var(--text)">${p.ad}</div>
              <div style="font-size:11px;color:var(--text2);font-weight:600">ID: ${p.id} &nbsp;·&nbsp; ${p.rol}</div>
            </div>
            ${durumBadge}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select id="rol-${p.id}" onchange="updateRol('${p.id}')"
              style="padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;background:white;cursor:pointer">
              <option value="Operatör"  ${p.rol==='Operatör'  ? 'selected':''}>Operatör</option>
              <option value="Meydancı"  ${p.rol==='Meydancı'  ? 'selected':''}>Meydancı</option>
              <option value="Yönetici"  ${p.rol==='Yönetici'  ? 'selected':''}>Yönetici</option>
            </select>
            ${p.durum === 'Aktif'
              ? `<button onclick="updateDurum('${p.id}','Pasif')"
                  style="padding:6px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;cursor:pointer">
                  Pasife Al
                 </button>`
              : `<button onclick="updateDurum('${p.id}','Aktif')"
                  style="padding:6px 12px;background:#dcfce7;color:#16a34a;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;cursor:pointer">
                  Aktif Et
                 </button>`
            }
          </div>
        </div>`;
    }).join('');
    bodyHtml = list || '<div style="text-align:center;padding:30px;color:var(--text2);font-weight:700">Personel bulunamadı</div>';
  } else if (_personelSubTab === 'sifre') {
    const opts = (_personelData || [])
      .filter(p => p.durum === 'Aktif')
      .map(p => `<option value="${p.id}">${p.ad} (${p.id})</option>`)
      .join('');
    bodyHtml = `
      <div style="background:white;border:1.5px solid var(--border);border-radius:14px;padding:16px">
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Personel</label>
          <select id="sp-id"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px;background:white">
            <option value="">Seç...</option>${opts}
          </select>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Mevcut Şifre</label>
          <input id="sp-eski" type="password" placeholder="••••"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px">
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Yeni Şifre</label>
          <input id="sp-yeni" type="password" placeholder="••••"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px">
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Yeni Şifre Tekrar</label>
          <input id="sp-yeni2" type="password" placeholder="••••"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px">
        </div>
        <button onclick="changePassword()"
          style="width:100%;padding:13px;background:var(--accent);color:white;border:none;border-radius:12px;font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer">
          Şifreyi Güncelle
        </button>
      </div>`;
  }

  document.getElementById('main-content').innerHTML = `
    <div style="padding:16px 16px 40px">
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">${subTabHtml}</div>
      ${bodyHtml}
    </div>`;
}

function setPersonelSubTab(key) {
  _personelSubTab = key;
  renderPersonel();
}

function _jsonpCall(params, onOk, onErr) {
  const cb = 'cbApi_' + Date.now();
  const qs = Object.entries(params).map(([k,v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  window[cb] = function(json) {
    delete window[cb];
    if (json.error) { showMonToast(json.error, 'err'); if (onErr) onErr(json.error); }
    else { if (onOk) onOk(json); }
  };
  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?' + qs + '&callback=' + cb;
  s.onerror = function() { delete window[cb]; showMonToast('Bağlantı hatası', 'err'); if (onErr) onErr(); };
  document.head.appendChild(s);
}

function addPersonel() {
  const ad    = (document.getElementById('prs-ad')?.value || '').trim();
  const sifre = (document.getElementById('prs-sifre')?.value || '').trim();
  const rol   = document.getElementById('prs-rol')?.value || 'Operatör';
  if (!ad || !sifre) { showMonToast('Ad ve şifre zorunlu', 'err'); return; }
  _jsonpCall({ action:'addPersonel', ad, sifre, rol }, json => {
    showMonToast('✅ Personel eklendi (ID: ' + json.id + ')', 'ok');
    _personelData = null;
    loadPersonel();
  });
}

function updateDurum(id, durum) {
  _jsonpCall({ action:'updatePersonel', hedef_id: id, durum }, () => {
    showMonToast(durum === 'Pasif' ? '✅ Pasife alındı' : '✅ Aktif edildi', 'ok');
    const p = (_personelData || []).find(x => x.id === id);
    if (p) p.durum = durum;
    renderPersonel();
  });
}

function updateRol(id) {
  const rol = document.getElementById('rol-' + id)?.value;
  if (!rol) return;
  _jsonpCall({ action:'updatePersonel', hedef_id: id, rol }, () => {
    showMonToast('✅ Rol güncellendi', 'ok');
    const p = (_personelData || []).find(x => x.id === id);
    if (p) p.rol = rol;
  });
}

function changePassword() {
  const id    = document.getElementById('sp-id')?.value || '';
  const eski  = document.getElementById('sp-eski')?.value || '';
  const yeni  = document.getElementById('sp-yeni')?.value || '';
  const yeni2 = document.getElementById('sp-yeni2')?.value || '';
  if (!id) { showMonToast('Personel seçin', 'err'); return; }
  if (!eski || !yeni) { showMonToast('Tüm alanlar zorunlu', 'err'); return; }
  if (yeni !== yeni2) { showMonToast('Yeni şifreler eşleşmiyor', 'err'); return; }
  _jsonpCall({ action:'changePassword', hedef_id: id, eski_sifre: eski, yeni_sifre: yeni }, () => {
    showMonToast('✅ Şifre güncellendi', 'ok');
    document.getElementById('sp-eski').value = '';
    document.getElementById('sp-yeni').value = '';
    document.getElementById('sp-yeni2').value = '';
  });
}

/* ---------- Ayarlar Sekmesi ---------- */

function loadSettings() {
  document.getElementById('main-content').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);font-weight:700">Yükleniyor...</div>';
  const cb = 'cbSettings_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    _settingsData = json;
    renderAyarlar();
  };
  const s = document.createElement('script');
  s.src = SCRIPT_URL + '?action=getSettings&callback=' + cb;
  s.onerror = function() { delete window[cb]; showMonToast('Ayarlar yüklenemedi', 'err'); };
  document.head.appendChild(s);
}

function renderAyarlar() {
  if (!_settingsData) { loadSettings(); return; }
  const d = _settingsData;

  // Arıza tipleri listesi
  const _arizaList = (d.arizaTipleri || []);
  const arizaItemsHtml = _arizaList.map((t, i) =>
    `<div id="ariza-item-${i}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
       <input type="text" value="${t}" id="ariza-val-${i}"
         style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:'Nunito',sans-serif;font-size:13px">
       <button onclick="removeArizaTipi(${i})"
         style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px">✕</button>
     </div>`
  ).join('');

  // Kasa min/max tablosu
  const kasaDefaults = (typeof KASA_AGIRLIK !== 'undefined') ? KASA_AGIRLIK : {};
  const kasaData = Object.keys(kasaDefaults).length ? kasaDefaults : {};
  const kasaSettings = Object.assign({}, kasaData, d.kasaMinMax || {});
  const kasaRowsHtml = Object.entries(kasaSettings).map(([ebat, vals]) =>
    `<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px">
       <span style="font-size:13px;font-weight:700;color:var(--text);min-width:90px">${ebat}</span>
       <input type="number" id="kasa-min-${ebat.replace(/x/g,'-')}" value="${vals.min || ''}" placeholder="Min gr"
         style="padding:7px 8px;border:1.5px solid var(--border);border-radius:8px;font-family:'Nunito',sans-serif;font-size:13px;width:100%;box-sizing:border-box">
       <input type="number" id="kasa-max-${ebat.replace(/x/g,'-')}" value="${vals.max || ''}" placeholder="Max gr"
         style="padding:7px 8px;border:1.5px solid var(--border);border-radius:8px;font-family:'Nunito',sans-serif;font-size:13px;width:100%;box-sizing:border-box">
     </div>`
  ).join('');

  const secStyle = 'font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text2);margin:20px 0 10px';
  const cardStyle = 'background:white;border:1.5px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px';
  const lblStyle  = 'font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px';
  const inpStyle  = 'width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:\'Nunito\',sans-serif;font-size:14px';

  document.getElementById('main-content').innerHTML = `
    <div style="padding:16px 16px 40px">

      <div style="${secStyle}">Operasyon Ayarları</div>
      <div style="${cardStyle}">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--text)">Oto Vardiya</div>
            <div style="font-size:11px;color:var(--text2);font-weight:600">Saat kontrolüyle otomatik vardiya seçimi</div>
          </div>
          <label style="position:relative;display:inline-block;width:48px;height:26px;cursor:pointer">
            <input type="checkbox" id="ay-otoVardiya" ${d.otoVardiya !== false ? 'checked' : ''}
              onchange="document.getElementById('ay-tolerans-row').style.display=this.checked?'block':'none'"
              style="opacity:0;width:0;height:0">
            <span id="oto-slider" style="position:absolute;top:0;left:0;right:0;bottom:0;border-radius:26px;background:${d.otoVardiya !== false ? 'var(--accent)' : '#cbd5e1'};transition:.3s">
              <span style="position:absolute;width:20px;height:20px;border-radius:50%;background:white;top:3px;transition:.3s;left:${d.otoVardiya !== false ? '25px' : '3px'}"></span>
            </span>
          </label>
        </div>

        <div id="ay-tolerans-row" style="display:${d.otoVardiya !== false ? 'block' : 'none'};margin-bottom:14px">
          <label style="${lblStyle}">Vardiya Geçiş Toleransı (± dakika)</label>
          <input id="ay-tolerans" type="number" min="0" max="180" value="${d.vardiyaTolerans || 120}" ${inpStyle.replace('width:100%;box-sizing:border-box;', '')}>
        </div>

        <div style="margin-bottom:14px">
          <label style="${lblStyle}">Max Tek Seferlik Fire Limiti</label>
          <input id="ay-fireLimiti" type="number" min="1" value="${d.maxFireLimit || 200}" ${inpStyle.replace('width:100%;box-sizing:border-box;', '')}>
        </div>

        <div>
          <label style="${lblStyle}">Oto. Yedekleme Saati (0-23)</label>
          <input id="ay-yedekleme" type="number" min="0" max="23" value="${d.yedeklemeSaat ?? 9}" ${inpStyle.replace('width:100%;box-sizing:border-box;', '')}>
          <div style="font-size:11px;color:var(--text2);margin-top:4px;font-weight:600">⚠️ Saat değişirse trigger yeniden kurulur (birkaç sn sürebilir)</div>
        </div>

      </div>

      <div style="${secStyle}">Arıza Tipleri</div>
      <div style="${cardStyle}">
        <div id="ariza-list">${arizaItemsHtml}</div>
        <button onclick="addArizaTipi()"
          style="width:100%;padding:10px;background:var(--bg);border:1.5px dashed var(--border);border-radius:10px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;color:var(--text2);cursor:pointer;margin-top:4px">
          + Yeni Tip Ekle
        </button>
      </div>

      <div style="${secStyle}">Kasa Min/Max Ağırlıkları (gr)</div>
      <div style="${cardStyle}">
        <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:8px;margin-bottom:8px">
          <span style="font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase">Ebat</span>
          <span style="font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase">Min (gr)</span>
          <span style="font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase">Max (gr)</span>
        </div>
        ${kasaRowsHtml}
      </div>

      <button onclick="saveSettings()"
        style="width:100%;padding:15px;background:var(--accent);color:white;border:none;border-radius:14px;font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer">
        💾 Kaydet
      </button>
    </div>`;

  // Toggle slider renk güncelleme
  document.getElementById('ay-otoVardiya').addEventListener('change', function() {
    const slider = document.getElementById('oto-slider');
    slider.style.background = this.checked ? 'var(--accent)' : '#cbd5e1';
    slider.querySelector('span').style.left = this.checked ? '25px' : '3px';
  });
}

function addArizaTipi() {
  const list = document.getElementById('ariza-list');
  const i = list.children.length;
  const div = document.createElement('div');
  div.id = 'ariza-item-' + i;
  div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
  div.innerHTML = `<input type="text" id="ariza-val-${i}" placeholder="Tip adı"
    style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:'Nunito',sans-serif;font-size:13px">
    <button onclick="removeArizaTipi(${i})"
      style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px">✕</button>`;
  list.appendChild(div);
}

function removeArizaTipi(i) {
  document.getElementById('ariza-item-' + i)?.remove();
}

function saveSettings() {
  // Arıza tipleri topla
  const arizaList = document.getElementById('ariza-list');
  const arizaTipleri = [];
  if (arizaList) {
    for (const div of arizaList.children) {
      const inp = div.querySelector('input[type="text"]');
      const v = inp ? inp.value.trim() : '';
      if (v) arizaTipleri.push(v);
    }
  }

  // Kasa min/max topla
  const kasaDefaults = (typeof KASA_AGIRLIK !== 'undefined') ? KASA_AGIRLIK : {};
  const kasaMinMax = {};
  for (const ebat of Object.keys(kasaDefaults)) {
    const key = ebat.replace(/x/g, '-');
    const minEl = document.getElementById('kasa-min-' + key);
    const maxEl = document.getElementById('kasa-max-' + key);
    if (minEl && maxEl) {
      kasaMinMax[ebat] = { min: Number(minEl.value) || 0, max: Number(maxEl.value) || 0 };
    }
  }

  const params = {
    action:           'saveSettings',
    otoVardiya:       document.getElementById('ay-otoVardiya')?.checked ? 'true' : 'false',
    vardiyaTolerans:  document.getElementById('ay-tolerans')?.value   || '120',
    maxFireLimit:     document.getElementById('ay-fireLimiti')?.value || '200',
    yedeklemeSaat:    document.getElementById('ay-yedekleme')?.value  || '9',
    arizaTipleri:     JSON.stringify(arizaTipleri),
    kasaMinMax:       JSON.stringify(kasaMinMax),
  };

  _jsonpCall(params, () => {
    showMonToast('✅ Ayarlar kaydedildi', 'ok');
    // Cache'i temizle, yeniden yüklensin
    _settingsData = null;
    loadSettings();
  });
}

/* ---------- Toast ---------- */

function showMonToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (type || 'ok') + ' show';
  setTimeout(() => t.classList.remove('show'), 3500);
}
