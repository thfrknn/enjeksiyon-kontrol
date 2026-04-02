/* ── Tüm Sunucu İletişimi (JSONP) ──────────────────── */

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
      maxFireLimit  = parseInt(json.maxFireLimit)  || 50;

      var idEl = document.getElementById('kullanici_id');
      if (idEl) idEl.dataset.ready = '1';

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
 * Değer bulunursa sayaç başlama alanını salt-okunur yapar.
 */
function fetchLastCounter(n, enjNo) {
  var bas = document.getElementById('sayac_bas' + n);
  bas.value = '';
  setBasEditable(n);
  calcUretim(n);

  var cb = 'cbLC' + n + '_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('lcs' + n)?.remove();
    if (json.sayacBit !== null && json.sayacBit !== undefined) {
      bas.value = json.sayacBit;
      setBasReadonly(n);
      calcUretim(n);
    }
    if (json.kasaAtanan) {
      var kasaSel = document.getElementById('kasa' + n);
      if (kasaSel) {
        kasaSel.value = json.kasaAtanan;
        calcUretim(n);
      }
      showKasaAtandiBox(n, json.kasaAtanan);
    } else {
      hideKasaAtandiBox(n);
    }
  };

  var s = document.createElement('script');
  s.id  = 'lcs' + n;
  s.src = SCRIPT_URL + '?action=getLastCounter&enj_no=' + encodeURIComponent(enjNo) + '&callback=' + cb;
  s.onerror = function() { delete window[cb]; };
  document.head.appendChild(s);
}

/**
 * Operatörün bu vardiyada daha önce ölçüm yapıp yapmadığını sorgular.
 * Varsa enjeksiyon/kasa bilgisini kilitler ve sayaç başlangıcını doldurur.
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

    olcumNo     = json.olcumNo || 1;
    enj1Kilitli = olcumNo > 1 && !!json.enj1;
    enj2Kilitli = olcumNo > 1 && !!json.enj2 && json.enj2 !== '00';

    if (enj1Kilitli) {
      enjSayisi = json.enjSayisi || 1;
      setEnjSayisi(enjSayisi);
    }
    showStatusBox(json);
    showEnjSection(json);

    if (enj1Kilitli && json.sayacBit1 != null) {
      document.getElementById('sayac_bas1').value = json.sayacBit1;
      setBasReadonly(1); calcUretim(1);
    }
    if (enj2Kilitli && json.sayacBit2 != null) {
      document.getElementById('sayac_bas2').value = json.sayacBit2;
      setBasReadonly(2); calcUretim(2);
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
function submitForm(onaylandi) {
  var sb = document.getElementById('submit-btn');
  var ob = document.getElementById('onay-btn');
  document.getElementById('load-text').textContent = 'Kaydediliyor...';
  document.getElementById('loading').classList.add('show');
  if (sb) sb.disabled = true;
  if (ob) ob.disabled = true;

  var data = getData();
  data.onaylandi = onaylandi;

  return new Promise(function(resolve) {
    var cb       = 'cbSubmit_' + Date.now();
    var timerOut = setTimeout(function() {
      delete window[cb];
      document.getElementById('loading').classList.remove('show');
      if (sb) sb.disabled = false;
      if (ob) ob.disabled = false;
      showToast('❌ Bağlantı zaman aşımı, tekrar dene', 'err');
      resolve();
    }, 15000);

    window[cb] = function(json) {
      clearTimeout(timerOut);
      delete window[cb];
      document.getElementById('jsonp-submit')?.remove();

      if (json && json.result === 'ok') {
        if (olcumNo === 3 && onaylandi) clearFireLogs();
        clearDraft();
        document.getElementById('loading').classList.remove('show');
        var msgs = { 1: '✅ Ölçümünüz kaydedildi! İyi Günler', 2: '✅ 2. ölçüm kaydedildi!', 3: '✅ Vardiya tamamlandı!' };
        showToast(msgs[olcumNo] || '✅ Kaydedildi!', 'ok');
        setTimeout(resetForm, 2200);
      } else {
        document.getElementById('loading').classList.remove('show');
        if (sb) sb.disabled = false;
        if (ob) ob.disabled = false;
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
      olcumNo:    data.olcumNo   || 1,
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
      onaylandi:  onaylandi ? 'true' : 'false',
    });

    var s = document.createElement('script');
    s.id  = 'jsonp-submit';
    s.src = SCRIPT_URL + '?' + params.toString();
    s.onerror = function() {
      clearTimeout(timerOut);
      delete window[cb];
      document.getElementById('loading').classList.remove('show');
      if (sb) sb.disabled = false;
      if (ob) ob.disabled = false;
      showToast('❌ Bağlantı hatası, tekrar dene', 'err');
      resolve();
    };
    document.head.appendChild(s);
  });
}
