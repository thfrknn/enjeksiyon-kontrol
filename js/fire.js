/* ── Fire Takip Sistemi ────────────────────────────── */

// ── LocalStorage anahtar yardımcıları ──────────────
function getFpLogKey(tarih, vard, enjNo) {
  return 'fireLog_' + tarih + '_' + vard + '_' + enjNo.replace(/\s+/g, '');
}
function getFpUnlockKey(tarih, vard, enjNo) {
  return 'fpUnlock_' + tarih + '_' + vard + '_' + enjNo.replace(/\s+/g, '');
}
function getFpLog(tarih, vard, enjNo) {
  try { var r = localStorage.getItem(getFpLogKey(tarih, vard, enjNo)); return r ? JSON.parse(r) : []; }
  catch (e) { return []; }
}
function getFpTotal(tarih, vard, enjNo) {
  return getFpLog(tarih, vard, enjNo).reduce(function(s, e) { return s + (e.amount || 0); }, 0);
}
function getFpTarih() {
  var el = document.getElementById('tarih');
  return el && el.value ? el.value : new Date().toISOString().split('T')[0];
}

/**
 * Saat bazlı fire sıfırlama dönemini döndürür.
 * Sıfırlanma saatleri: 09:15 (SABAH), 17:15 (AKSAM), 01:15 (GECE).
 * Bu saatler arasında fire birikir; geçince yeni dönem başlar.
 */
function getFirePeriod() {
  var now = new Date(Date.now() + _timeOffset);
  var h   = now.getHours(), mn = now.getMinutes();
  var hm  = h * 60 + mn;
  var yr  = now.getFullYear(), mo = now.getMonth(), dy = now.getDate();

  function ds(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  var T_SABAH = 9  * 60 + 15;  // 09:15
  var T_AKSAM = 17 * 60 + 15;  // 17:15
  var T_GECE  = 1  * 60 + 15;  // 01:15

  if (hm >= T_SABAH && hm < T_AKSAM) {
    return { vardiya: 'SABAH', tarih: ds(yr, mo, dy) };
  } else if (hm >= T_AKSAM) {
    return { vardiya: 'AKSAM', tarih: ds(yr, mo, dy) };
  } else if (hm < T_GECE) {
    // 00:00-01:14: AKSAM dün başladı
    var prev = new Date(yr, mo, dy - 1);
    return { vardiya: 'AKSAM', tarih: ds(prev.getFullYear(), prev.getMonth(), prev.getDate()) };
  } else {
    return { vardiya: 'GECE', tarih: ds(yr, mo, dy) };
  }
}

function isFpFireLocked(enjNo) {
  if (!enjNo) return false;
  var fp = getFirePeriod();
  var t  = parseInt(localStorage.getItem(getFpUnlockKey(fp.tarih, fp.vardiya, enjNo)) || '0');
  return t > Date.now();
}

// ── Fire miktar ayarlama (butonlar) ────────────────
function adjFire(n, d) {
  var enjNo = document.getElementById('enj' + n + '_no').value;
  if (!enjNo || isFpFireLocked(enjNo)) return;
  var el  = document.getElementById('fire' + n);
  var val = Math.max(0, parseInt(el.value || 0) + d);
  el.value = Math.min(maxFireLimit, val);
  document.getElementById('err-fire' + n).classList.remove('show');
}

function startFireAdj(n, d) {
  var enjNo = document.getElementById('enj' + n + '_no').value;
  if (isFpFireLocked(enjNo)) return;
  adjFire(n, d);
  _fireAdjTimer = setTimeout(function() {
    _fireAdjInterval = setInterval(function() { adjFire(n, d); }, 80);
  }, 400);
}

function stopFireAdj() {
  clearTimeout(_fireAdjTimer);
  clearInterval(_fireAdjInterval);
  _fireAdjTimer = null;
  _fireAdjInterval = null;
}

function clampFire(n) {
  var el = document.getElementById('fire' + n);
  var v  = parseInt(el.value) || 0;
  if (v > maxFireLimit) el.value = maxFireLimit;
  if (v < 0)            el.value = 0;
  document.getElementById('err-fire' + n).classList.remove('show');
}

// ── Fire modal ──────────────────────────────────────
function promptInstantFire(n) {
  var enjNo = document.getElementById('enj' + n + '_no').value;
  if (!enjNo) {
    document.getElementById('err-fire' + n).textContent = 'Lütfen önce makine seçimi yapın!';
    document.getElementById('err-fire' + n).classList.add('show');
    return;
  }
  var miktar = parseInt(document.getElementById('fire' + n).value) || 0;
  if (miktar <= 0) {
    document.getElementById('err-fire' + n).textContent = 'Fire miktarı 0\'dan büyük olmalı!';
    document.getElementById('err-fire' + n).classList.add('show');
    return;
  }
  if (miktar > maxFireLimit) {
    document.getElementById('err-fire' + n).textContent = 'Tek seferde en fazla ' + maxFireLimit + ' fire girilebilir!';
    document.getElementById('err-fire' + n).classList.add('show');
    return;
  }
  document.getElementById('err-fire' + n).classList.remove('show');
  _pendingFire = { n: n, amount: miktar, enjNo: enjNo };
  document.getElementById('fire-modal-body').innerHTML =
    '⚠️ <strong style="font-size:18px;color:var(--warn)">' + miktar + ' adet</strong> fire ekliyorsunuz. <br><br>' +
    'Bu işlem <strong style="color:var(--text)">hemen kaydedilecek</strong> ve yönetici tablosuna işlenecektir. Onaylıyor musunuz?';
  document.getElementById('fire-modal').style.display = 'flex';
}

function closeFireModal() {
  document.getElementById('fire-modal').style.display = 'none';
  _pendingFire = null;
}

function confirmInstantFire() {
  if (!_pendingFire) return;
  var fd = _pendingFire;
  closeFireModal();
  executeInstantFire(fd.n, fd.amount, fd.enjNo);
}

// ── Fire kayıt & sunucu gönderimi ───────────────────
function executeInstantFire(n, amount, enjNo) {
  document.getElementById('load-text').textContent = 'Fire Log\'a İşleniyor...';
  document.getElementById('loading').classList.add('show');

  var fp        = getFirePeriod();
  var tarih     = fp.tarih;
  var fpVardiya = fp.vardiya;
  var saat      = document.getElementById('olcum_saat').value;

  // 1) LocalStorage'a yaz — anında UI güncellemesi için
  var log = getFpLog(tarih, fpVardiya, enjNo);
  log.push({ ts: Date.now(), amount: amount });
  try { localStorage.setItem(getFpLogKey(tarih, fpVardiya, enjNo), JSON.stringify(log)); } catch (ex) {}
  localStorage.setItem(getFpUnlockKey(tarih, fpVardiya, enjNo), String(Date.now() + 15 * 60 * 1000));

  // 2) UI güncelle, loading kapat
  document.getElementById('fire' + n).value = '0';
  loadAccumulatedFire(n, enjNo);
  document.getElementById('loading').classList.remove('show');
  showToast('✅ ' + amount + ' Fire kaydedildi!', 'ok');

  // 3) Sheets'e JSONP ile arka planda gönder
  var cb = 'cbFire_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('jsonp-fire-' + n)?.remove();
    if (json && json.result !== 'ok') console.warn('Fire log sunucuya kaydedilemedi:', json);
  };
  var params = new URLSearchParams({
    action:       'logFire',
    tarih:        tarih,
    olcum_saat:   saat,
    kullanici_id: document.getElementById('kullanici_id').value,
    adsoyad:      _adSoyad || document.getElementById('kullanici_id').value,
    vardiya:      fpVardiya || '',
    makine_no:    enjNo,
    fire_miktari: amount,
    callback:     cb,
  });
  var s = document.createElement('script');
  s.id  = 'jsonp-fire-' + n;
  s.src = SCRIPT_URL + '?' + params.toString();
  s.onerror = function() { delete window[cb]; console.warn('Fire log JSONP hatası'); };
  document.head.appendChild(s);
}

// ── Kümülatif fire gösterimi ────────────────────────
function loadAccumulatedFire(n, enjNo) {
  if (!enjNo) return;
  var fp        = getFirePeriod();
  var tarih     = fp.tarih;
  var fpVardiya = fp.vardiya;
  var log       = getFpLog(tarih, fpVardiya, enjNo);
  var local     = log.reduce(function(s, e) { return s + (e.amount || 0); }, 0);

  var tBox     = document.getElementById('fire-toplam-box' + n);
  var tVal     = document.getElementById('fire-toplam' + n);
  var histEl   = document.getElementById('fire-history' + n);
  var histList = document.getElementById('fire-history-list' + n);

  function _render(serverTotal) {
    var total = serverTotal !== null ? serverTotal : local;
    if (total > 0) {
      if (tVal) tVal.textContent = total;
      if (tBox) tBox.style.display = 'flex';
    } else {
      if (tBox) tBox.style.display = 'none';
    }

    if (histEl && histList) {
      if (log.length > 0) {
        var running = 0;
        histList.innerHTML = log.map(function(e) {
          running += e.amount;
          var dt = new Date(e.ts);
          var hm = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
          return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">'
            + '<span style="color:var(--text2)">' + hm + '</span>'
            + '<span style="color:var(--warn);font-weight:800;">+' + e.amount + '</span>'
            + '<span style="font-size:11px;color:var(--text2)">→ ' + running + '</span></div>';
        }).join('');

        var diff = (serverTotal || 0) - local;
        if (diff > 0) {
          histList.innerHTML = '<div style="font-size:11px;color:#1e40af;background:#eff6ff;padding:5px 8px;border-radius:6px;margin-bottom:6px;">📡 Diğer cihazlardan: +' + diff + ' fire</div>' + histList.innerHTML;
        }
        histEl.style.display = 'block';
      } else if ((serverTotal || 0) > 0) {
        histList.innerHTML = '<div style="font-size:11px;color:#1e40af;background:#eff6ff;padding:5px 8px;border-radius:6px;">📡 Diğer cihazlardan: ' + serverTotal + ' fire kaydedilmiş</div>';
        histEl.style.display = 'block';
      } else {
        histEl.style.display = 'none';
      }
    }
    updateFireLockDisplay();
  }

  // Yerel veriyle anında göster
  _render(local || null);

  // Sunucudan gerçek toplamı çek
  var cb = 'cbFT' + n + '_' + Date.now();
  window[cb] = function(json) {
    delete window[cb];
    document.getElementById('ft-s' + n)?.remove();
    _render(typeof json.total === 'number' ? json.total : local);
  };
  var s = document.createElement('script');
  s.id  = 'ft-s' + n;
  s.src = SCRIPT_URL + '?action=getFireTotal'
    + '&enj_no='   + encodeURIComponent(enjNo)
    + '&tarih='    + encodeURIComponent(tarih)
    + '&vardiya='  + encodeURIComponent(fpVardiya)
    + '&callback=' + cb;
  s.onerror = function() { delete window[cb]; };
  document.head.appendChild(s);
}

// ── Fire kilit ekranı ───────────────────────────────
function updateFireLockDisplay() {
  var fp = getFirePeriod();
  [1, 2].forEach(function(n) {
    var enjNo  = document.getElementById('enj' + n + '_no').value;
    var locked = false, rem = 0;

    if (enjNo) {
      var t = parseInt(localStorage.getItem(getFpUnlockKey(fp.tarih, fp.vardiya, enjNo)) || '0');
      rem    = t - Date.now();
      locked = rem > 0;
    }

    var msg = document.getElementById('fire-lock-msg' + n);
    var ctr = document.getElementById('fire-counter' + n);
    var btn = document.getElementById('btn-fire-ekle' + n);
    var inp = document.getElementById('fire' + n);
    if (!msg) return;

    if (locked) {
      var secs = Math.ceil(rem / 1000);
      var m = Math.floor(secs / 60), s = secs % 60;
      document.getElementById('fire-lock-cd' + n).textContent = m + ':' + String(s).padStart(2, '0');
      msg.style.display = 'flex';
      if (ctr) ctr.querySelectorAll('.cbtn').forEach(function(b) { b.disabled = true; });
      if (btn) btn.disabled = true;
      if (inp) inp.disabled = true;
    } else {
      msg.style.display = 'none';
      if (ctr) ctr.querySelectorAll('.cbtn').forEach(function(b) { b.disabled = false; });
      if (btn) btn.disabled = false;
      if (inp) inp.disabled = false;
    }
  });
}

// ── Fire loglarını temizle (vardiya tamamlandığında) ─
function clearFireLogs() {
  var fp = getFirePeriod();
  var d  = getData();
  [d.enj1_no, enjSayisi >= 2 ? d.enj2_no : null].forEach(function(enjNo) {
    if (enjNo && enjNo !== '00') {
      localStorage.removeItem(getFpLogKey(fp.tarih, fp.vardiya, enjNo));
      localStorage.removeItem(getFpUnlockKey(fp.tarih, fp.vardiya, enjNo));
    }
  });
}
