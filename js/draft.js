/* ── Taslak (Yarım Kalan Giriş) Yönetimi ───────────── */

function saveDraft() {
  if (!document.getElementById('kullanici_id').value) return;
  var d = {
    ts:           Date.now(),
    kullanici_id: document.getElementById('kullanici_id').value,
    adSoyad:      _adSoyad,
    vardiya:      vardiya,
    tarih:        document.getElementById('tarih').value,
    enjSayisi:    enjSayisi,
    step:         currentStep,
    olcumNo:      olcumNo,
    enj1Kilitli:  enj1Kilitli,
    enj2Kilitli:  enj2Kilitli,
    enj1_no:      document.getElementById('enj1_no').value,
    kasa1:        document.getElementById('kasa1').value,
    enj2_no:      document.getElementById('enj2_no').value,
    kasa2:        document.getElementById('kasa2').value,
    cevrim1:      document.getElementById('cevrim1').value,
    agirlik1:     document.getElementById('agirlik1').value,
    sayac_bas1:   document.getElementById('sayac_bas1').value,
    sayac_bit1:   document.getElementById('sayac_bit1').value,
    cevrim2:      document.getElementById('cevrim2').value,
    agirlik2:     document.getElementById('agirlik2').value,
    sayac_bas2:   document.getElementById('sayac_bas2').value,
    sayac_bit2:   document.getElementById('sayac_bit2').value,
  };
  try { localStorage.setItem('enj_draft', JSON.stringify(d)); } catch(e) {}
}

/**
 * Vardiya bitiş anını (ms) döndürür — draft expiry hesabı için.
 * SABAH: 17:00 | AKSAM: +1 gün 01:00 | GECE: 09:00
 */
function _draftExpiry(ts, v) {
  if (!ts || !v) return null;
  var d  = new Date(ts);
  var yr = d.getFullYear(), mo = d.getMonth(), dy = d.getDate(), hr = d.getHours();
  if (v === 'SABAH') return new Date(yr, mo, dy, 17, 0, 0).getTime();
  if (v === 'AKSAM') return new Date(yr, mo, dy + (hr >= 17 ? 1 : 0), 1, 0, 0).getTime();
  if (v === 'GECE')  return new Date(yr, mo, dy, 9, 0, 0).getTime();
  return null;
}

function checkAndShowDraft() {
  try {
    var raw = localStorage.getItem('enj_draft');
    if (!raw) return;
    var d = JSON.parse(raw);
    if (!d.kullanici_id && !d.adsoyad) return;

    // Vardiya bitiminden 15 dk sonra otomatik sil
    var expiry = _draftExpiry(d.ts, d.vardiya);
    if (expiry && (Date.now() + _timeOffset) > expiry + 15 * 60 * 1000) {
      localStorage.removeItem('enj_draft');
      return;
    }

    var displayName = d.adSoyad || d.kullanici_id || d.adsoyad;
    var mins  = Math.round((Date.now() - d.ts) / 60000);
    var zaman = mins < 1 ? 'az önce' : mins < 60 ? mins + ' dakika önce' : Math.round(mins / 60) + ' saat önce';
    var adim  = d.step === 2 ? '(Ölçüm sayfasında)' : d.step === 3 ? '(Özet sayfasında)' : '';

    document.getElementById('draft-banner-sub').textContent =
      displayName + ' — ' + (d.vardiya || '') + ' vardiyası — ' + zaman + ' ' + adim;
    document.getElementById('draft-banner').style.display = 'flex';
  } catch (e) { localStorage.removeItem('enj_draft'); }
}

function restoreDraft() {
  try {
    var d = JSON.parse(localStorage.getItem('enj_draft'));
    if (!d) return;
    document.getElementById('draft-banner').style.display = 'none';

    var idEl = document.getElementById('kullanici_id');
    idEl.value = d.kullanici_id || d.adsoyad || '';
    if (d.adSoyad) _adSoyad = d.adSoyad;
    onIdChange();
    if (d.vardiya) setVardiya(d.vardiya);
    if (d.tarih)   document.getElementById('tarih').value = d.tarih;
    setEnjSayisi(d.enjSayisi || 1);

    // Kilitleme durumunu ve ölçüm numarasını geri yükle
    if (d.olcumNo)     olcumNo     = d.olcumNo;
    if (d.enj1Kilitli) enj1Kilitli = true;
    if (d.enj2Kilitli) enj2Kilitli = true;

    ['enj1_no','kasa1','enj2_no','kasa2',
     'cevrim1','agirlik1','sayac_bas1','sayac_bit1',
     'cevrim2','agirlik2','sayac_bas2','sayac_bit2',
    ].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && d[id] !== undefined) el.value = d[id];
    });

    // Sayaç başlama kilidini geri uygula (sunucu yanıtı beklenmeden)
    if (enj1Kilitli) setBasReadonly(1);
    if (enj2Kilitli) setBasReadonly(2);

    [1, 2].forEach(function(n) {
      var val = d['enj' + n + '_no'];
      if (val) {
        document.getElementById('enj' + n + '-grid')?.querySelectorAll('.enj-gbtn').forEach(function(b) {
          if (b.getAttribute('onclick').includes("'" + val + "'")) b.classList.add('sel');
        });
        loadAccumulatedFire(n, val);
      }
    });

    calcUretim(1); calcUretim(2);
    syncEnjDisabled();
    if (d.step && d.step > 1) goStep(d.step);
    checkStatus();  // Sunucu yanıtı gelirse kilitleri taze veriye göre günceller
    showToast('Kaldığın yerden devam ediyorsun', 'ok');
  } catch (e) { clearDraft(); }
}

function clearDraft() {
  localStorage.removeItem('enj_draft');
  document.getElementById('draft-banner').style.display = 'none';
}
