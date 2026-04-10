// js/atama-kontrol.js
// Meydancı atama varsa: makineyi otomatik seç, text display göster, sayacı çek.
// Atama yoksa: tüm butonlar serbest, hiçbir kısıtlama yok.

(function () {
  'use strict';

  var AK = {
    atananMakineler: {},   // { "101": ["Enjeksiyon 3"] }
    kullaniciId:     null,
    oncekiAtama:     null,
    pollTimer:       null,
    bildirimVerildi: false,
    initialized:     false,
    lockedMachines:  [null, null],  // [enj1, enj2] — atama tarafından kilitlenmiş
  };

  // ── Yardımcı: JSONP çağrısı ────────────────────────
  function jsonpCall(params, cb) {
    var cbName = '_ak_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    var sc;
    window[cbName] = function (data) {
      delete window[cbName];
      if (sc && sc.parentNode) sc.parentNode.removeChild(sc);
      cb(data);
    };
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k] || '');
    }).join('&');
    sc = document.createElement('script');
    sc.src = (typeof SCRIPT_URL !== 'undefined' ? SCRIPT_URL : '') + '?' + qs + '&callback=' + cbName;
    sc.onerror = function () { delete window[cbName]; };
    document.head.appendChild(sc);
  }

  function getCurrentUserId() {
    var el = document.getElementById('kullanici_id');
    return el ? (el.value || '').trim() : '';
  }

  // ── Makineyi kilitle: text display göster, sayaç çek ──
  function lockMachineDisplay(n, makineNo) {
    var secEl   = document.getElementById('enj' + n + '-sec');
    var roEl    = document.getElementById('enj' + n + '-ro');
    var roVal   = document.getElementById('enj' + n + '-ro-val');
    var noInp   = document.getElementById('enj' + n + '_no');
    var titleEl = document.getElementById('olcum-enj' + n + '-title');

    if (!secEl || !roEl) return;

    // Buton grid'i gizle, text display göster
    secEl.style.display = 'none';
    roEl.style.display  = 'block';
    if (roVal)   roVal.textContent  = makineNo;
    if (noInp)   noInp.value        = makineNo;
    if (titleEl) titleEl.textContent = makineNo + ' — Ölçümler';

    AK.lockedMachines[n - 1] = makineNo;

    // Kasa: atananKasalar'dan otomatik doldur
    var kasaAtandi  = (typeof atananKasalar !== 'undefined') ? (atananKasalar[makineNo] || null) : null;
    var kasaSecEl   = document.getElementById('kasa' + n + '-sec');
    var kasaRoEl    = document.getElementById('kasa' + n + '-ro');
    var kasaRoVal   = document.getElementById('kasa' + n + '-ro-val');
    var kasaSel     = document.getElementById('kasa' + n);

    if (kasaAtandi) {
      if (kasaSecEl) kasaSecEl.style.display = 'none';
      if (kasaRoEl)  kasaRoEl.style.display  = 'block';
      if (kasaRoVal) kasaRoVal.textContent   = kasaAtandi;
      if (kasaSel)   kasaSel.value           = kasaAtandi;
    } else {
      if (kasaSecEl) kasaSecEl.style.display = 'block';
      if (kasaRoEl)  kasaRoEl.style.display  = 'none';
    }

    // Son sayaç değerini sunucudan çek
    if (typeof fetchLastCounter === 'function') {
      fetchLastCounter(n, makineNo);
    }

    // Fire geçmişini yükle
    if (typeof loadAccumulatedFire === 'function') {
      loadAccumulatedFire(n, makineNo);
    }
  }

  // ── Makine kilidini aç: buton grid'e dön ──────────
  function unlockMachineDisplay(n) {
    var lockedMachine = AK.lockedMachines[n - 1];
    AK.lockedMachines[n - 1] = null;

    var secEl = document.getElementById('enj' + n + '-sec');
    var roEl  = document.getElementById('enj' + n + '-ro');
    if (secEl) secEl.style.display = 'block';
    if (roEl)  roEl.style.display  = 'none';

    var kasaSecEl = document.getElementById('kasa' + n + '-sec');
    var kasaRoEl  = document.getElementById('kasa' + n + '-ro');
    if (kasaSecEl) kasaSecEl.style.display = 'block';
    if (kasaRoEl)  kasaRoEl.style.display  = 'none';

    // Eğer makine atama tarafından kilitlenmişse değerleri temizle
    var noInp = document.getElementById('enj' + n + '_no');
    if (noInp && lockedMachine && noInp.value === lockedMachine) {
      noInp.value = '';
      var titleEl = document.getElementById('olcum-enj' + n + '-title');
      if (titleEl) titleEl.textContent = 'Ölçümler';
      var grid = document.getElementById('enj' + n + '-grid');
      if (grid) grid.querySelectorAll('.enj-gbtn').forEach(function (b) {
        b.classList.remove('sel');
      });
    }
  }

  // ── Ana kısıtlama uygulayıcı ──────────────────────
  function applyGridRestriction() {
    var uid   = AK.kullaniciId || getCurrentUserId();
    if (!uid) return;

    var atanan = AK.atananMakineler[uid] || [];

    if (!atanan.length) {
      // Atama yok → tüm butonlar serbest
      unlockMachineDisplay(1);
      unlockMachineDisplay(2);
      hideAtamaBanner();
      return;
    }

    // Atama var → banner göster, makineleri kilitle
    showAtamaBanner(atanan);
    lockMachineDisplay(1, atanan[0]);

    if (atanan.length >= 2) {
      lockMachineDisplay(2, atanan[1]);
    }
  }

  // ── Banner ────────────────────────────────────────
  function showAtamaBanner(atananlar) {
    var banner = document.getElementById('atama-kontrol-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'atama-kontrol-banner';
      banner.style.cssText = [
        'background:#dcfce7', 'border:2px solid #86efac', 'border-radius:12px',
        'padding:10px 14px', 'margin:8px 14px', 'display:flex',
        'align-items:center', 'gap:8px', 'font-size:13px', 'font-weight:700',
        'color:#15803d'
      ].join(';');
      var page2 = document.getElementById('page-2');
      if (page2) {
        var first = page2.querySelector('.section');
        if (first) page2.insertBefore(banner, first);
        else page2.insertBefore(banner, page2.firstChild);
      }
    }
    banner.innerHTML = '🏭 Atandığınız makine: <strong>' + atananlar.join(', ') + '</strong>';
  }

  function hideAtamaBanner() {
    var banner = document.getElementById('atama-kontrol-banner');
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
  }

  // ── Makine Durumlarını Sorgula ─────────────────────
  function pollMachineStatuses() {
    var uid = AK.kullaniciId || getCurrentUserId();
    if (!uid) return;

    jsonpCall({ action: 'getMachineStatuses' }, function (data) {
      if (!data || data.error) return;

      // atananlar: { "Enjeksiyon 3": { operatorId: "101", ... } } → { "101": ["Enjeksiyon 3"] }
      var yeniAtanma = {};
      var atananlar  = data.atananlar || {};
      Object.keys(atananlar).forEach(function (makine) {
        var opId = String(atananlar[makine].operatorId || '').trim();
        if (!opId) return;
        if (!yeniAtanma[opId]) yeniAtanma[opId] = [];
        yeniAtanma[opId].push(makine);
      });

      AK.atananMakineler = yeniAtanma;

      var benimAtamalar = yeniAtanma[uid] || [];
      var oncekiStr     = JSON.stringify(AK.oncekiAtama || []);
      var yeniStr       = JSON.stringify(benimAtamalar);

      if (AK.oncekiAtama !== null && oncekiStr !== yeniStr) {
        if (benimAtamalar.length === 0) {
          showTransferAlert('⚠️ Makine atamanız kaldırıldı.');
        } else {
          showTransferAlert('🔄 Makine atamanız: ' + benimAtamalar.join(', '));
        }
        AK.bildirimVerildi = true;
      }

      AK.oncekiAtama = benimAtamalar.slice();
      applyGridRestriction();

      // Arıza kontrolü
      checkMachineBreakdown(data.statuses || {}, benimAtamalar);
    });
  }

  // ── Makine Arıza ──────────────────────────────────
  function checkMachineBreakdown(statuses, atananlar) {
    if (!atananlar.length) return;
    atananlar.forEach(function (makine) {
      var s = statuses[makine];
      if (s && s.durum === 'Arızalı' && !AK.bildirimVerildi) {
        showTransferAlert('⚠️ ' + makine + ' arızalandı! Meydancıya başvurun.');
        AK.bildirimVerildi = true;
      }
    });
  }

  // ── Uyarı Kutusu ─────────────────────────────────
  function showTransferAlert(msg) {
    var existing = document.getElementById('atama-alert');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var box = document.createElement('div');
    box.id  = 'atama-alert';
    box.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
      'background:#fef2f2', 'border-bottom:3px solid #dc2626',
      'padding:14px 16px', 'font-size:14px', 'font-weight:800',
      'color:#dc2626', 'text-align:center', 'box-shadow:0 4px 12px rgba(0,0,0,.15)',
      'cursor:pointer'
    ].join(';');
    box.textContent = msg + '  ✕';
    box.onclick = function () {
      if (box.parentNode) box.parentNode.removeChild(box);
      AK.bildirimVerildi = false;
    };
    document.body.insertBefore(box, document.body.firstChild);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 10000);
  }

  // ── Başlatma ──────────────────────────────────────
  function init() {
    if (AK.initialized) return;

    var observer = new MutationObserver(function () {
      var page2 = document.getElementById('page-2');
      if (page2 && (page2.classList.contains('active') || page2.style.display !== 'none')) {
        var uid = getCurrentUserId();
        if (uid && uid !== AK.kullaniciId) {
          AK.kullaniciId     = uid;
          AK.oncekiAtama     = null;
          AK.bildirimVerildi = false;
          AK.lockedMachines  = [null, null];
          pollMachineStatuses();
          if (AK.pollTimer) clearInterval(AK.pollTimer);
          AK.pollTimer = setInterval(pollMachineStatuses, 30000);
        }
        if (uid) applyGridRestriction();
      }
    });

    observer.observe(document.body, {
      attributes:    true,
      subtree:       true,
      attributeFilter: ['class', 'style']
    });

    var idEl = document.getElementById('kullanici_id');
    if (idEl) {
      idEl.addEventListener('change', function () {
        AK.kullaniciId     = this.value.trim();
        AK.oncekiAtama     = null;
        AK.bildirimVerildi = false;
        AK.atananMakineler = {};
        AK.lockedMachines  = [null, null];
        unlockMachineDisplay(1);
        unlockMachineDisplay(2);
        hideAtamaBanner();
        if (AK.pollTimer) { clearInterval(AK.pollTimer); AK.pollTimer = null; }
      });
    }

    AK.initialized = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

})();
