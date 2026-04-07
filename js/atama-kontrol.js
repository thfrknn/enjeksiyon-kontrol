// js/atama-kontrol.js
// Operatöre meydancının atadığı makineyi kısıtlar ve arıza bildirim yapar.
// index.html'de app.js'den SONRA yüklenmelidir.

(function () {
  'use strict';

  var AK = {
    atananMakineler: {},   // { "101": ["Enjeksiyon 3"] }
    kullaniciId:     null,
    oncekiAtama:     null, // değişiklik tespiti için
    pollTimer:       null,
    bildirimVerildi: false,
    initialized:     false,
  };

  // ── Yardımcı: JSONP çağrısı ────────────────────────
  function jsonpCall(params, cb) {
    var cbName = '_ak_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    window[cbName] = function (data) {
      delete window[cbName];
      if (sc && sc.parentNode) sc.parentNode.removeChild(sc);
      cb(data);
    };
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k] || '');
    }).join('&');
    var sc = document.createElement('script');
    sc.src = (typeof SCRIPT_URL !== 'undefined' ? SCRIPT_URL : '') + '?' + qs + '&callback=' + cbName;
    sc.onerror = function () { delete window[cbName]; };
    document.head.appendChild(sc);
  }

  // ── Kullanıcı ID'sini bul ──────────────────────────
  function getCurrentUserId() {
    var el = document.getElementById('kullanici_id');
    return el ? (el.value || '').trim() : '';
  }

  // ── Makine gridini kısıtla ─────────────────────────
  function applyGridRestriction() {
    var uid = AK.kullaniciId || getCurrentUserId();
    if (!uid) return;

    var atanan = AK.atananMakineler[uid] || [];
    if (!atanan.length) {
      // Atama yok — tüm kısıtlamaları kaldır
      clearGridRestriction();
      hideAtamaBanner();
      return;
    }

    // Atama var — banner göster
    showAtamaBanner(atanan);

    // Her iki grid için de uygula
    [1, 2].forEach(function (gridIdx) {
      var grid = document.getElementById('enj' + gridIdx + '-grid');
      if (!grid) return;

      grid.querySelectorAll('.enj-gbtn').forEach(function (btn) {
        // Butonun hangi makineye ait olduğunu metninden çıkar
        var btnText  = btn.textContent.trim();              // "Enj 3"
        var enjNum   = btnText.replace(/[^0-9]/g, '');      // "3"
        var makineNo = 'Enjeksiyon ' + enjNum;
        var isAtanan = atanan.indexOf(makineNo) !== -1;

        btn.disabled          = !isAtanan;
        btn.style.opacity     = isAtanan ? '' : '0.3';
        btn.style.cursor      = isAtanan ? '' : 'not-allowed';
        btn.style.boxShadow   = isAtanan ? '' : 'none';
        btn.title             = isAtanan ? '' : 'Bu makine size atanmadı';
      });
    });
  }

  function clearGridRestriction() {
    [1, 2].forEach(function (gridIdx) {
      var grid = document.getElementById('enj' + gridIdx + '-grid');
      if (!grid) return;
      grid.querySelectorAll('.enj-gbtn').forEach(function (btn) {
        if (!btn.classList.contains('locked')) {   // kilitli (arızalı) butonlara dokunma
          btn.disabled      = false;
          btn.style.opacity = '';
          btn.style.cursor  = '';
          btn.title         = '';
        }
      });
    });
  }

  // ── Atama Banner ──────────────────────────────────
  function showAtamaBanner(atananlar) {
    var existingBanner = document.getElementById('atama-kontrol-banner');
    if (!existingBanner) {
      existingBanner = document.createElement('div');
      existingBanner.id = 'atama-kontrol-banner';
      existingBanner.style.cssText = [
        'background:#dcfce7', 'border:2px solid #86efac', 'border-radius:12px',
        'padding:10px 14px', 'margin:8px 14px', 'display:flex',
        'align-items:center', 'gap:8px', 'font-size:13px', 'font-weight:700',
        'color:#15803d'
      ].join(';');

      // Page-2'nin başına ekle
      var page2 = document.getElementById('page-2');
      if (page2) {
        var firstSection = page2.querySelector('.section');
        if (firstSection) page2.insertBefore(existingBanner, firstSection);
        else page2.insertBefore(existingBanner, page2.firstChild);
      }
    }
    existingBanner.innerHTML = '🏭 Atandığınız makine: <strong>' + atananlar.join(', ') + '</strong>';
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

      // Atananlar'ı ters çevir: makine→op → op→[makine]
      var yeniAtanma = {};
      var atananlar  = data.atananlar || {};
      Object.keys(atananlar).forEach(function (makine) {
        var opId = String(atananlar[makine].operatorId || '').trim();
        if (!opId) return;
        if (!yeniAtanma[opId]) yeniAtanma[opId] = [];
        yeniAtanma[opId].push(makine);
      });

      AK.atananMakineler = yeniAtanma;

      // Mevcut kullanıcının ataması değişti mi?
      var benimAtamalar = yeniAtanma[uid] || [];
      var oncekiStr     = JSON.stringify(AK.oncekiAtama || []);
      var yeniStr       = JSON.stringify(benimAtamalar);

      if (AK.oncekiAtama !== null && oncekiStr !== yeniStr) {
        // Atama değişikliği algılandı
        if (benimAtamalar.length === 0) {
          showTransferAlert('⚠️ Makine atamanız kaldırıldı. Meydancıya başvurun.');
        } else {
          showTransferAlert('🔄 Makine atamanız değişti: ' + benimAtamalar.join(', '));
        }
        AK.bildirimVerildi = true;
      }

      AK.oncekiAtama = benimAtamalar.slice();
      applyGridRestriction();

      // Makine arıza kontrolü — kendi makinesinin durumunu kontrol et
      checkMachineBreakdown(data.statuses || {}, benimAtamalar);
    });
  }

  // ── Makine Arıza Bildirimi ────────────────────────
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

  // ── Transfer / Arıza Uyarısı ─────────────────────
  function showTransferAlert(msg) {
    // Önce varolan uyarıyı temizle
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

    // 10 saniye sonra otomatik kapat
    setTimeout(function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    }, 10000);
  }

  // ── Başlatma ──────────────────────────────────────
  function init() {
    if (AK.initialized) return;

    // Kullanıcı giriş yapıldığında ID'yi al
    // app.js'deki giriş akışı tamamlandıktan sonra page-2'ye geçildiğinde tetiklenir
    var observer = new MutationObserver(function () {
      var page2 = document.getElementById('page-2');
      if (page2 && (page2.classList.contains('active') || page2.style.display !== 'none')) {
        var uid = getCurrentUserId();
        if (uid && uid !== AK.kullaniciId) {
          AK.kullaniciId    = uid;
          AK.oncekiAtama    = null;
          AK.bildirimVerildi = false;
          // İlk sorgu
          pollMachineStatuses();
          // 30 saniyede bir tekrarla
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

    // Kullanıcı ID değiştiğinde de kontrol et (logout/login)
    var idEl = document.getElementById('kullanici_id');
    if (idEl) {
      idEl.addEventListener('change', function () {
        AK.kullaniciId     = this.value.trim();
        AK.oncekiAtama     = null;
        AK.bildirimVerildi = false;
        AK.atananMakineler = {};
        clearGridRestriction();
        hideAtamaBanner();
        if (AK.pollTimer) { clearInterval(AK.pollTimer); AK.pollTimer = null; }
      });
    }

    AK.initialized = true;
  }

  // DOM hazır olduğunda başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // app.js'nin yüklenmesi için kısa bir gecikme
    setTimeout(init, 500);
  }

})();
