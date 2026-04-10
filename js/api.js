/* ── Tüm Sunucu İletişimi (JSONP) ──────────────────── */

// Her form gönderiminde benzersiz token üretir (duplicate önleme)
function _genToken() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 8);
}

// Aktif gönderim döngüsünün token'ı — hata/timeout retry'larında aynı kalır,
// sadece başarılı gönderim sonrası sıfırlanır.
var _pendingToken = null;

/**
 * Ayarlar sekmesinden kasa ebatlarını, kullanıcıları ve limitleri çeker.
 * Sunucu zamanını okuyarak _timeOffset senkronizasyonu yapar.
 */
function loadLists() {
  return new Promise(function(resolve) {
    _t0 = Date.now();
    var cb = 'cbLists_' + Date.now();

    window[cb] = function(json) {
      delete window[cb];
      document.getElementById('jsonp-s')?.remove();

      if (json.serverTime) {
        var latency = (Date.now() - _t0) / 2;
        _timeOffset = json.serverTime - (_t0 + latency);
      }

      kullanicilar  = json.kullanicilar  || {};
      uretimLimiti  = parseInt(json.uretimLimiti)  || 0;
      kasaLimitlari = json.kasaLimitlari || {};
      kasaMinMax    = json.kasaMinMax    || {};
      maxFireLimit  = parseInt(json.maxFireLimit)  || 50;
      atananKasalar = json.atananKasalar || {};

      // Vardiya tolerans ayarları
      window.__otoVardiya      = json.otoVardiya !== false;
      window.__vardiyaTolerans = Number(json.vardiyaTolerans) || 120;

      var idEl = document.getElementById('kullanici_id');
      if (idEl) {
        idEl.dataset.ready = '1';
        // API geldikten sonra zaten yazılmış ID'yi yeniden doğrula
        if (idEl.value.trim().length === 3) onIdChange();
      }

      // Personel listesi yüklendiyse "Listeden seçin" butonunu göster
      var listBtn = document.getElementById('listeden-sec-btn');
      if (listBtn && Object.keys(kullanicilar).length > 0) listBtn.style.display = 'inline-block';

      // Şifre alanı: doğru şifre girilince "Devam Et" butonuna odaklan
      var sifreEl = document.getElementById('sifre');
      if (sifreEl && !sifreEl.dataset.listenerAdded) {
        sifreEl.dataset.listenerAdded = '1';
        sifreEl.addEventListener('input', function() {
          var currentId  = (document.getElementById('kullanici_id') || {}).value;
          var kullanici  = kullanicilar[currentId ? currentId.trim() : ''];
          if (kullanici && this.value === String(kullanici.sifre || '')) {
            var nextBtn = document.querySelector('#page-1 .btn-next');
            if (nextBtn) nextBtn.focus();
          }
        });
      }

      var ebatlar = json.kasaEbatlari || [];
      fillSelect('kasa1', 'skel-kasa1', ebatlar);
      document.getElementById('kasa1').addEventListener('change', function() { calcUretim(1); });

      var sel2 = document.getElementById('kasa2');
      ebatlar.forEach(function(v) {
        var o = document.createElement('option');
        o.value = v; o.textContent = v;
        sel2.appendChild(o);
      });
      sel2.addEventListener('change', function() { calcUretim(2); });

      resolve();
    };

    var s = document.createElement('script');
    s.id  = 'jsonp-s';
    s.src = SCRIPT_URL + '?action=getLists&callback=' + cb;
    s.onerror = function() { resolve(); showToast('Bağlantı hatası', 'err'); };
    document.head.appendChild(s);
  });
}

/**
 * Seçilen makine için en son sayaç bitiş değerini çeker.
 * iOS PWA güvenilirliği için 3 deneme + artan gecikme.
 */
function fetchLastCounter(n, enjNo, _attempt) {
  var attempt = _attempt || 1;
  var MAX_ATTEMPTS = 3;
  var bas = document.getElementById('sayac_bas' + n);

  if (attempt === 1) {
    bas.value = '';
    setBasEditable(n);
    calcUretim(n);
  }

  // Önceki isteği temizle
  document.getElementById('lcs' + n)?.remove();

  var cb = 'cbLC' + n + '_' + Date.now();
  var timeoutMs = attempt * 4000;  // 4s, 8s, 12s

  var _t = setTimeout(function() {
    delete window[cb];
    document.getElementById('lcs' + n)?.remove();
    if (attempt < MAX_ATTEMPTS) {
      fetchLastCounter(n, enjNo, attempt + 1);
    } else {
      setBasEditable(n);
      showToast('Sayaç otomatik alınamadı, manuel girin', 'warn');
    }
  }, timeoutMs);

  window[cb] = function(json) {
    clearTimeout(_t);
    delete window[cb];
    document.getElementById('lcs' + n)?.remove();
    if (json.sayacBit !== null && json.sayacBit !== undefined) {
      bas.value = json.sayacBit;
      setBasReadonly(n);
      calcUretim(n);
    }
    if (json.kasaAtanan) {
      var kasaSel = document.getElementById('kasa' + n);
      if (kasaSel) { kasaSel.value = json.kasaAtanan; calcUretim(n); }
      showKasaAtandiBox(n, json.kasaAtanan);
    } else {
      hideKasaAtandiBox(n);
    }
  };

  var s = document.createElement('script');
  s.id  = 'lcs' + n;
  // Cache-bust ile her denemede taze istek
  s.src = SCRIPT_URL + '?action=getLastCounter&enj_no=' + encodeURIComponent(enjNo)
        + '&callback=' + cb + '&_r=' + Date.now();
  s.onerror = function() {
    clearTimeout(_t);
    delete window[cb];
    if (attempt < MAX_ATTEMPTS) {
      setTimeout(function() { fetchLastCounter(n, enjNo, attempt + 1); }, 400 * attempt);
    } else {
      setBasEditable(n);
    }
  };
  // iOS PWA: dokunuş olayından bağımsız olarak script yüklensin
  setTimeout(function() { document.body.appendChild(s); }, 10 + (attempt - 1) * 200);
}

/**
 * Bu vardiyada son kaydın sayaç bitiş değerini çekip
 * yeni kaydın sayaç başlangıcını önceden doldurur.
 */
function checkStatus() {
  var ad    = _adSoyad;
  var tarih = document.getElementById('tarih').value;
  var saat  = document.getElementById('olcum_saat').value;
  if (!ad || !vardiya || !tarih) return;

  var cb = 'cbStatus_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('st-s')?.remove();

    if (json.sayacBit1 != null) {
      document.getElementById('sayac_bas1').value = json.sayacBit1;
      calcUretim(1);
    }
    if (json.sayacBit2 != null) {
      document.getElementById('sayac_bas2').value = json.sayacBit2;
      calcUretim(2);
    }
  };

  var s = document.createElement('script');
  s.id  = 'st-s';
  s.src = SCRIPT_URL
    + '?action=getStatus'
    + '&adsoyad='  + encodeURIComponent(ad)
    + '&tarih='    + encodeURIComponent(tarih)
    + '&vardiya='  + encodeURIComponent(vardiya)
    + '&saat='     + encodeURIComponent(saat)
    + '&callback=' + cb;
  s.onerror = function() {};
  document.head.appendChild(s);
}

/**
 * Doldurulmuş formu Google Sheets'e kaydeder.
 * JSONP GET ile iletişim kurulur (CORS sorunu olmaz).
 */
function submitForm(_retryCount) {
  _retryCount = _retryCount || 0;
  if (!_pendingToken) _pendingToken = _genToken();

  var sb = document.getElementById('submit-btn');

  // UI sadece ilk denemede kurulur; retry'larda sessizce çalışır
  if (_retryCount === 0) {
    document.getElementById('load-text').textContent = 'Kaydediliyor...';
    document.getElementById('loading').classList.add('show');
    if (sb) sb.disabled = true;
    document.getElementById('jsonp-submit')?.remove();
  }

  var data = getData();

  return new Promise(function(resolve) {
    var cb       = 'cbSubmit_' + Date.now();
    var timerOut = setTimeout(function() {
      delete window[cb];
      document.getElementById('jsonp-submit')?.remove();
      if (_retryCount < 2) {
        setTimeout(function() { submitForm(_retryCount + 1).then(resolve); }, 2000);
      } else {
        document.getElementById('loading').classList.remove('show');
        if (sb) sb.disabled = false;
        showToast('❌ Bağlantı zaman aşımı, tekrar dene', 'err');
        resolve();
      }
    }, 12000);

    window[cb] = function(json) {
      clearTimeout(timerOut);
      delete window[cb];
      document.getElementById('jsonp-submit')?.remove();

      if (json && json.result === 'ok') {
        _pendingToken = null;
        clearDraft();
        document.getElementById('loading').classList.remove('show');
        showToast('✅ Kaydedildi!', 'ok');
        setTimeout(resetForm, 2200);
      } else if (_retryCount < 2) {
        // Sessiz retry — kullanıcıya hiçbir şey gösterilmez
        setTimeout(function() { submitForm(_retryCount + 1).then(resolve); }, 2000);
        return;
      } else {
        document.getElementById('loading').classList.remove('show');
        if (sb) sb.disabled = false;
        showToast('❌ Kayıt hatası, tekrar dene', 'err');
        console.error('submitForm hatası:', json);
      }
      resolve();
    };

    var params = new URLSearchParams({
      action:     'submitForm',
      callback:   cb,
      adsoyad:    data.adsoyad    || '',
      vardiya:    data.vardiya    || '',
      enjSayisi:  data.enjSayisi || 1,
      tarih:      data.tarih     || '',
      olcum_saat: data.olcum_saat || '',
      enj1_no:    data.enj1_no   || '',
      kasa1:      data.kasa1     || '',
      cevrim1:    data.cevrim1   || '',
      agirlik1:   data.agirlik1  || '',
      sayac_bas1: data.sayac_bas1 || '',
      sayac_bit1: data.sayac_bit1 || '',
      uretim1:    data.uretim1   || 0,
      fire1:      data.fire1     || 0,
      enj2_no:    data.enj2_no   || '00',
      kasa2:      data.kasa2     || '00',
      cevrim2:    data.cevrim2   || '00',
      agirlik2:   data.agirlik2  || '00',
      sayac_bas2: data.sayac_bas2 || '00',
      sayac_bit2: data.sayac_bit2 || '00',
      uretim2:    data.uretim2   || 0,
      fire2:      data.fire2     || '00',
      submitToken: _pendingToken,
    });

    var s = document.createElement('script');
    s.id  = 'jsonp-submit';
    s.src = SCRIPT_URL + '?' + params.toString();
    s.onerror = function() {
      clearTimeout(timerOut);
      delete window[cb];
      document.getElementById('jsonp-submit')?.remove();
      if (_retryCount < 2) {
        setTimeout(function() { submitForm(_retryCount + 1).then(resolve); }, 2000);
      } else {
        document.getElementById('loading').classList.remove('show');
        if (sb) sb.disabled = false;
        showToast('❌ Bağlantı hatası, tekrar dene', 'err');
        resolve();
      }
    };
    document.head.appendChild(s);
  });
}
