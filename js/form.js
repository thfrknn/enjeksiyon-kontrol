/* ── Form Yardımcıları, Doğrulama & Özet ───────────── */

/* ── Personel Listesi Seçici ──────────────────────── */

function openPersonelPicker() {
  var modal = document.getElementById('personel-picker-modal');
  var liste = document.getElementById('personel-liste');
  var ara   = document.getElementById('personel-ara');
  if (!modal || !liste) return;

  // Sadece operatörleri listele (1xx=meydancı, 3xx=yönetici, 4xx=denetleyici hariç)
  var ops = Object.keys(kullanicilar)
    .filter(function(id) { return id.charAt(0) === '2'; })
    .sort(function(a, b) { return kullanicilar[a].name.localeCompare(kullanicilar[b].name, 'tr'); });

  // Tüm kullanıcıları göster (bulamazlarsa başka rol de seçebilsin)
  if (!ops.length) ops = Object.keys(kullanicilar).sort(function(a, b) {
    return kullanicilar[a].name.localeCompare(kullanicilar[b].name, 'tr');
  });

  window._pickerOps = ops;
  ara.value = '';
  renderPickerList(ops);
  modal.style.display = 'flex';
  setTimeout(function() { ara.focus(); }, 100);
}

function renderPickerList(ops) {
  var liste = document.getElementById('personel-liste');
  liste.innerHTML = '';
  ops.forEach(function(id) {
    var kul = kullanicilar[id];
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'padding:12px 14px;border:2px solid var(--border);border-radius:10px;background:white;font-family:\'Nunito\',sans-serif;font-size:15px;font-weight:700;cursor:pointer;text-align:left;width:100%;color:var(--text);display:flex;justify-content:space-between;align-items:center';
    btn.innerHTML = '<span>' + kul.name + '</span><span style="font-size:12px;color:var(--text2);font-weight:600">' + id + '</span>';
    btn.onclick = function() { selectPersonelFromList(id); };
    liste.appendChild(btn);
  });
  if (!ops.length) {
    liste.innerHTML = '<div style="text-align:center;color:var(--text2);padding:20px;font-size:14px">Sonuç bulunamadı</div>';
  }
}

function filterPersonelPicker(q) {
  if (!window._pickerOps) return;
  var lower = q.toLowerCase().replace(/\s+/g, '');
  var filtered = window._pickerOps.filter(function(id) {
    var name = kullanicilar[id].name.toLowerCase().replace(/\s+/g, '');
    return name.includes(lower) || id.includes(q);
  });
  renderPickerList(filtered);
}

function selectPersonelFromList(id) {
  closePersonelPicker();
  var idEl = document.getElementById('kullanici_id');
  idEl.value = id;
  onIdChange();
}

function closePersonelPicker() {
  var modal = document.getElementById('personel-picker-modal');
  if (modal) modal.style.display = 'none';
}

function fillSelect(selId, skelId, items) {
  var sel = document.getElementById(selId);
  items.forEach(function(v) {
    var o = document.createElement('option');
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  });
  if (skelId) { var sk = document.getElementById(skelId); if (sk) sk.style.display = 'none'; }
  sel.style.display = 'block';
}

function setEnjSayisi(n) {
  enjSayisi = n;
  document.getElementById('t-1').classList.toggle('active', n === 1);
  document.getElementById('t-2').classList.toggle('active', n === 2);
  document.getElementById('enj2-section').style.display        = n === 2 ? 'block' : 'none';
  document.getElementById('olcum-enj2-section').style.display  = n === 2 ? 'block' : 'none';
  document.getElementById('enj1-title').textContent        = n === 2 ? '1. Enjeksiyon Bilgileri' : 'Enjeksiyon Bilgileri';
  document.getElementById('olcum-enj1-title').textContent  = n === 2 ? 'Enjeksiyon 1 — Ölçümler' : 'Ölçümler';
  syncEnjDisabled();
}

function onIdChange() {
  var idEl      = document.getElementById('kullanici_id');
  var id        = idEl.value.trim();
  var kullanici = kullanicilar[id];
  var sf        = document.getElementById('sifre-field');
  var si        = document.getElementById('sifre');
  var hatirla   = document.getElementById('hatirla');
  var hosgeldin = document.getElementById('hosgeldin');
  var errAd     = document.getElementById('err-ad');

  if (kullanici) {
    _adSoyad = kullanici.name;
    sf.style.display    = 'block';
    hosgeldin.style.display = 'flex';
    document.getElementById('hosgeldin-text').textContent = 'Hoş Geldin, ' + kullanici.name + '!';
    idEl.classList.remove('error');
    errAd.classList.remove('show');

    var kayitliSifre = localStorage.getItem('sifre_' + id);
    if (kayitliSifre) {
      si.value       = kayitliSifre;
      hatirla.checked = true;
      // Şifre hatırlanıyorsa Devam Et butonunu öne çıkar
      document.getElementById('err-sifre').classList.remove('show');
      si.classList.remove('error');
      var nextBtn = document.querySelector('#page-1 .btn-next');
      if (nextBtn) nextBtn.focus();
    } else {
      si.value        = '';
      hatirla.checked = false;
      // Şifre alanına otomatik odaklan
      setTimeout(function() { si.focus(); }, 80);
    }
  } else {
    _adSoyad = '';
    sf.style.display    = 'none';
    hosgeldin.style.display = 'none';
    if (id.length === 3) {
      // API henüz yüklenmediyse hata gösterme
      if (idEl.dataset.ready === '1') {
        idEl.classList.add('error');
        errAd.classList.add('show');
      }
    } else {
      idEl.classList.remove('error');
      errAd.classList.remove('show');
    }
  }
  if (vardiya && kullanici) checkStatus();
}

function selectEnj(n, val, btn) {
  document.getElementById('enj' + n + '-grid').querySelectorAll('.enj-gbtn').forEach(function(b) { b.classList.remove('sel'); });
  btn.classList.add('sel');
  document.getElementById('enj' + n + '_no').value = val;
  document.getElementById('enj' + n + '-grid').classList.remove('error');
  document.getElementById('err-enj' + n).classList.remove('show');
  document.getElementById('olcum-enj' + n + '-title').textContent = val + ' — Ölçümler';
  syncEnjDisabled();

  // Meydancının atadığı kasayı hemen doldur (getLists'ten gelen veri)
  var kasaAtandi = atananKasalar[val];
  var kasaSel = document.getElementById('kasa' + n);
  if (kasaAtandi && kasaSel) {
    kasaSel.value = kasaAtandi;
    calcUretim(n);
    showKasaAtandiBox(n, kasaAtandi);
  } else {
    if (kasaSel) kasaSel.value = '';
    hideKasaAtandiBox(n);
  }

  fetchLastCounter(n, val);
  loadAccumulatedFire(n, val);
}

function syncEnjDisabled() {
  if (enjSayisi !== 2) {
    document.getElementById('enj1-grid').querySelectorAll('.enj-gbtn').forEach(function(b) { b.disabled = false; });
    document.getElementById('enj2-grid').querySelectorAll('.enj-gbtn').forEach(function(b) { b.disabled = false; });
    return;
  }
  var val1 = document.getElementById('enj1_no').value;
  var val2 = document.getElementById('enj2_no').value;
  document.getElementById('enj1-grid').querySelectorAll('.enj-gbtn').forEach(function(b) {
    b.disabled = val2 ? b.getAttribute('onclick').includes("'" + val2 + "'") : false;
  });
  document.getElementById('enj2-grid').querySelectorAll('.enj-gbtn').forEach(function(b) {
    b.disabled = val1 ? b.getAttribute('onclick').includes("'" + val1 + "'") : false;
  });
}

/**
 * Çevrim süresi otomatik ondalık formatı.
 * Operatör "1395" yazarsa → "13.95", "185" → "18.5", virgülü noktaya çevirir.
 * 1-2 basamaklı girişlere dokunmaz (tam saniye: 14, 13 vb.)
 */
function formatCevrim(el) {
  var raw = String(el.value || '').replace(/,/g, '.').trim();
  if (!raw) return;
  if (!raw.includes('.')) {
    var digits = raw.replace(/\D/g, '');
    if (digits.length === 3) {
      // "185" → "18.5"
      raw = digits.slice(0, 2) + '.' + digits.slice(2);
    } else if (digits.length >= 4) {
      // "1395" → "13.95"
      raw = digits.slice(0, -2) + '.' + digits.slice(-2);
    }
  }
  var num = parseFloat(raw);
  if (!isNaN(num) && num > 0) el.value = num;
  var n = el.id === 'cevrim2' ? 2 : 1;
  calcUretim(n);
}

function setBasReadonly(n) {
  var el = document.getElementById('sayac_bas' + n);
  el.readOnly = true;                   // DOM property — iOS'ta setAttribute('readonly') unreliable
  el.style.pointerEvents = 'none';      // dokunuşu engelle (iOS PWA)
  el.style.cssText = 'font-size:18px;font-weight:800;background:var(--accent-light);border-color:var(--accent);color:var(--accent);pointer-events:none';
  document.getElementById('lbl-bas' + n).innerHTML = 'Sayaç Başlama <small style="color:var(--accent);font-size:12px;font-weight:700">(önceki kayıt)</small>';
}

function setBasEditable(n) {
  var el = document.getElementById('sayac_bas' + n);
  el.readOnly = false;                  // DOM property
  el.style.pointerEvents = 'auto';
  el.style.cssText = 'font-size:18px;font-weight:800';
  document.getElementById('lbl-bas' + n).innerHTML = 'Sayaç Başlama <span class="req">*</span>';
}

function clearSifreErr() {
  document.getElementById('err-sifre').classList.remove('show');
  document.getElementById('sifre').classList.remove('error');
}

// ── Meydancı tarafından atanan kasa bilgi kutusu ────
function showKasaAtandiBox(n, kasa) {
  var box = document.getElementById('kasa-atandi-box' + n);
  if (!box) return;
  document.getElementById('kasa-atandi-val' + n).textContent = kasa;
  box.style.display = 'flex';
}

function hideKasaAtandiBox(n) {
  var box = document.getElementById('kasa-atandi-box' + n);
  if (box) box.style.display = 'none';
}


// ── Kasa ağırlık kontrolü ───────────────────────────
function getKasaBounds(n) {
  var kasa = document.getElementById('kasa' + n).value;
  if (!kasa) return null;
  var key = kasa.trim().toLowerCase().replace(/\s+/g, '');

  // Önce sunucudan gelen dinamik limitler (kasaMinMax) → monitör Ayarlar'dan güncellenir
  var dynKeys = Object.keys(kasaMinMax || {});
  for (var di = 0; di < dynKeys.length; di++) {
    if (dynKeys[di].toLowerCase().replace(/\s+/g, '') === key) {
      var d = kasaMinMax[dynKeys[di]];
      if (d && (d.min > 0 || d.max > 0)) return d;
    }
  }

  // Fallback: statik KASA_AGIRLIK (config.js)
  var keys = Object.keys(KASA_AGIRLIK);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === key) return KASA_AGIRLIK[keys[i]];
  }
  return null;
}

function checkKasaAgirlik(n) {
  var agEl  = document.getElementById('agirlik' + n);
  var errEl = document.getElementById('err-agirlik' + n);
  var val   = parseFloat(agEl.value);
  if (!agEl.value || isNaN(val)) return false;
  var b = getKasaBounds(n);
  if (!b) return false;
  if (val < b.min) {
    agEl.classList.add('error');
    errEl.textContent = '⚠️ Çok düşük! Min: ' + b.min + 'g';
    errEl.classList.add('show');
    return true;
  }
  if (val > b.max) {
    agEl.classList.add('error');
    errEl.textContent = '⚠️ Çok yüksek! Maks: ' + b.max + 'g';
    errEl.classList.add('show');
    return true;
  }
  agEl.classList.remove('error');
  errEl.textContent = 'Gerekli';
  errEl.classList.remove('show');
  return false;
}

// ── Üretim hesabı ────────────────────────────────────
function calcUretim(n) {
  var bas = parseInt(document.getElementById('sayac_bas' + n).value);
  var bit = parseInt(document.getElementById('sayac_bit' + n).value);
  var box = document.getElementById('uretim-box' + n);
  var val = document.getElementById('result-val' + n);
  var lbl = document.getElementById('result-label' + n);
  if (!isNaN(bas) && !isNaN(bit)) {
    var f = bit - bas;
    if (f > 4000) {
      val.textContent = '⚠️ ' + f.toLocaleString('tr-TR');
      box.style.cssText = 'background:#fff7ed;border:2px solid #ea580c;border-radius:12px;padding:14px;text-align:center;margin-top:12px';
      val.style.color = '#ea580c'; lbl.style.color = '#ea580c';
    } else if (f >= 0) {
      val.textContent = f.toLocaleString('tr-TR');
      box.style.cssText = 'background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:14px;text-align:center;margin-top:12px';
      val.style.color = '#16a34a'; lbl.style.color = '#16a34a';
    } else {
      val.textContent = '⚠️ Hata';
      box.style.cssText = 'background:#fef2f2;border:2px solid #dc2626;border-radius:12px;padding:14px;text-align:center;margin-top:12px';
      val.style.color = '#dc2626'; lbl.style.color = '#dc2626';
    }
  } else {
    val.textContent = '—';
    box.style.cssText = 'background:var(--accent-light);border:2px solid var(--accent);border-radius:12px;padding:14px;text-align:center;margin-top:12px';
    val.style.color = 'var(--accent)'; lbl.style.color = 'var(--accent)';
  }
}

function getUretim(n) {
  var bas = parseInt(document.getElementById('sayac_bas' + n).value) || 0;
  var bit = parseInt(document.getElementById('sayac_bit' + n).value) || 0;
  return Math.max(0, bit - bas);
}

// ── Sayfa navigasyonu ────────────────────────────────
function goStep(n) {
  currentStep = n;
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('page-' + n).classList.add('active');
  for (var i = 1; i <= 3; i++) {
    var el = document.getElementById('step-' + i);
    el.className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
  }
  window.scrollTo(0, 0);
}

function goNext(from) {
  if (from === 1 && !validate1()) return;
  if (from === 1) {
    var id      = document.getElementById('kullanici_id').value.trim();
    var si      = document.getElementById('sifre').value;
    var hatirla = document.getElementById('hatirla').checked;
    _adSoyad    = (kullanicilar[id] && kullanicilar[id].name) || id;
    if (hatirla && si) localStorage.setItem('sifre_' + id, si);
    else               localStorage.removeItem('sifre_' + id);

    // ID prefix her zaman önceliklidir: 1xx → meydancı, 3xx → yönetici
    if (id.charAt(0) === '1') {
      var _mSifre = si ? si.value : (localStorage.getItem('sifre_' + id) || '');
      localStorage.setItem('meydanci_session', JSON.stringify({ id: id, ad: _adSoyad, rol: 'Meydancı', sifre: _mSifre }));
      window.location.href = 'meydanci.html';
      return;
    }
    if (id.charAt(0) === '3') {
      localStorage.setItem('yonetici_session', JSON.stringify({ id: id, ad: _adSoyad }));
      window.location.href = 'monitor.html';
      return;
    }
    if (id.charAt(0) === '4') {
      var _denSifre = (document.getElementById('sifre') || {}).value || '';
      localStorage.setItem('denetleyici_session', JSON.stringify({ id: id, ad: _adSoyad, rol: 'Denetleyici', sifre: _denSifre }));
      window.location.href = 'denetleyici.html';
      return;
    }
  }
  if (from === 2 && !validate2()) return;
  if (from === 2) {
    autoSubmitPendingFires(function() {
      buildSummary();
      goStep(3);
    });
    return;
  }
  goStep(from + 1);
}

// Girilen ama "Fire Ekle" basılmadan kalan fire'ları otomatik kaydeder
function autoSubmitPendingFires(callback) {
  var pending = [];
  [1, 2].forEach(function(n) {
    if (n === 2 && enjSayisi < 2) return;
    var enjNo  = document.getElementById('enj' + n + '_no').value;
    var amount = parseInt(document.getElementById('fire' + n).value) || 0;
    if (enjNo && amount > 0 && !isFpFireLocked(enjNo)) {
      pending.push({ n: n, amount: amount, enjNo: enjNo });
    }
  });
  if (pending.length === 0) { callback(); return; }
  pending.forEach(function(fd) {
    executeInstantFire(fd.n, fd.amount, fd.enjNo);
  });
  // Kısa bekleme — executeInstantFire localStorage + UI'ı anında günceller
  setTimeout(callback, 300);
}

// ── Doğrulama ────────────────────────────────────────
function validate1() {
  var ok = true;
  var idEl     = document.getElementById('kullanici_id');
  var kullanici = idEl.value ? kullanicilar[idEl.value.trim()] : null;

  if (!idEl.value || !kullanici) {
    idEl.classList.add('error');
    document.getElementById('err-ad').classList.add('show');
    ok = false;
  } else {
    idEl.classList.remove('error');
    document.getElementById('err-ad').classList.remove('show');
  }

  if (kullanici) {
    var si        = document.getElementById('sifre');
    var dogruSifre = String(kullanici.sifre || '');
    if (!si.value || si.value !== dogruSifre) {
      si.classList.add('error');
      document.getElementById('err-sifre').classList.add('show');
      ok = false;
    } else {
      si.classList.remove('error');
      document.getElementById('err-sifre').classList.remove('show');
    }
  }

  // Meydancı (1xx) ve yönetici (3xx) vardiya seçmek zorunda değil
  var idForVardiya = idEl.value ? idEl.value.trim() : '';
  var isMeydanciOrYonetici = (idForVardiya.charAt(0) === '1' || idForVardiya.charAt(0) === '3');
  if (!vardiya && !isMeydanciOrYonetici) { document.getElementById('err-vardiya').classList.add('show'); ok = false; }

  if (!ok) {
    var first = document.querySelector('#page-1 .error, #page-1 .err-msg.show');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

function validate2() {
  var ok = true;

  function chk(id, errId) {
    var el = document.getElementById(id);
    if (!el.value) { el.classList.add('error'); document.getElementById(errId).classList.add('show'); ok = false; }
    else           { el.classList.remove('error'); document.getElementById(errId).classList.remove('show'); }
  }

  var e1 = document.getElementById('enj1_no');
  var g1 = document.getElementById('enj1-grid');
  if (!e1.value) { g1.classList.add('error'); document.getElementById('err-enj1').classList.add('show'); ok = false; }
  else           { g1.classList.remove('error'); document.getElementById('err-enj1').classList.remove('show'); }
  var k1 = document.getElementById('kasa1');
  if (!k1.value) { k1.classList.add('error'); document.getElementById('err-kasa1').classList.add('show'); ok = false; }
  else           { k1.classList.remove('error'); document.getElementById('err-kasa1').classList.remove('show'); }

  if (enjSayisi === 2) {
    var e2 = document.getElementById('enj2_no');
    var g2 = document.getElementById('enj2-grid');
    if (!e2.value) { g2.classList.add('error'); document.getElementById('err-enj2').classList.add('show'); ok = false; }
    else           { g2.classList.remove('error'); document.getElementById('err-enj2').classList.remove('show'); }
    var k2 = document.getElementById('kasa2');
    if (!k2.value) { k2.classList.add('error'); document.getElementById('err-kasa2').classList.add('show'); ok = false; }
    else           { k2.classList.remove('error'); document.getElementById('err-kasa2').classList.remove('show'); }
  }

  if (!ok) return false;

  chk('cevrim1', 'err-cevrim1');
  chk('agirlik1', 'err-agirlik1');
  if (document.getElementById('agirlik1').value && checkKasaAgirlik(1)) ok = false;
  chk('sayac_bas1', 'err-bas1');

  var bit1 = document.getElementById('sayac_bit1');
  var bas1 = document.getElementById('sayac_bas1');
  if (!bit1.value) {
    bit1.classList.add('error'); document.getElementById('err-bit1').textContent = 'Gerekli'; document.getElementById('err-bit1').classList.add('show'); ok = false;
  } else if (parseInt(bit1.value) < parseInt(bas1.value)) {
    bit1.classList.add('error'); document.getElementById('err-bit1').textContent = 'Bitiş < Başlama!'; document.getElementById('err-bit1').classList.add('show'); ok = false;
  } else if (parseInt(bit1.value) - parseInt(bas1.value) > 4000) {
    bit1.classList.add('error'); document.getElementById('err-bit1').textContent = "Üretim 4000'i geçemez!"; document.getElementById('err-bit1').classList.add('show'); ok = false;
  } else {
    bit1.classList.remove('error'); document.getElementById('err-bit1').classList.remove('show');
  }

  var prod1       = getUretim(1);
  var fp1         = getFirePeriod();
  var totalFire1  = getFpTotal(fp1.tarih, fp1.vardiya, document.getElementById('enj1_no').value);
  if (totalFire1 > prod1 && prod1 > 0) {
    document.getElementById('err-fire1').innerHTML = '⚠️ <b>Hata:</b> Kümülatif fire (' + totalFire1 + '), üretim miktarından (' + prod1 + ') fazla olamaz!';
    document.getElementById('err-fire1').classList.add('show');
    ok = false;
  }

  if (enjSayisi === 2) {
    chk('cevrim2', 'err-cevrim2');
    chk('agirlik2', 'err-agirlik2');
    if (document.getElementById('agirlik2').value && checkKasaAgirlik(2)) ok = false;
    chk('sayac_bas2', 'err-bas2');

    var bit2 = document.getElementById('sayac_bit2');
    var bas2 = document.getElementById('sayac_bas2');
    if (!bit2.value) {
      bit2.classList.add('error'); document.getElementById('err-bit2').textContent = 'Gerekli'; document.getElementById('err-bit2').classList.add('show'); ok = false;
    } else if (parseInt(bit2.value) < parseInt(bas2.value)) {
      bit2.classList.add('error'); document.getElementById('err-bit2').textContent = 'Bitiş < Başlama!'; document.getElementById('err-bit2').classList.add('show'); ok = false;
    } else if (parseInt(bit2.value) - parseInt(bas2.value) > 4000) {
      bit2.classList.add('error'); document.getElementById('err-bit2').textContent = "Üretim 4000'i geçemez!"; document.getElementById('err-bit2').classList.add('show'); ok = false;
    } else {
      bit2.classList.remove('error'); document.getElementById('err-bit2').classList.remove('show');
    }

    var prod2      = getUretim(2);
    var fp2        = getFirePeriod();
    var totalFire2 = getFpTotal(fp2.tarih, fp2.vardiya, document.getElementById('enj2_no').value);
    if (totalFire2 > prod2 && prod2 > 0) {
      document.getElementById('err-fire2').innerHTML = '⚠️ <b>Hata:</b> Kümülatif fire (' + totalFire2 + '), üretim miktarından (' + prod2 + ') fazla olamaz!';
      document.getElementById('err-fire2').classList.add('show');
      ok = false;
    }
  }

  if (!ok) {
    var first = document.querySelector('#page-2 .error, #page-2 .err-msg.show');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

// ── Özet sayfası ─────────────────────────────────────
function buildSummary() {
  var d  = getData();
  var vl = vardiya === 'SABAH' ? 'Sabah 09:00–17:00' : vardiya === 'AKSAM' ? 'Akşam 17:00–01:00' : 'Gece 01:00–09:00';
  var u1 = d.uretim1, u2 = d.uretim2;

  var rows = [
    ['Ad Soyad', d.adsoyad],
    ['Vardiya', vl],
    ['Ölçüm Saati', d.olcum_saat],
    { type: 'div', text: 'Enjeksiyon 1' },
    ['Enjeksiyon', d.enj1_no],
    ['Kasa', d.kasa1],
    ['Çevrim', d.cevrim1 + ' sn'],
    ['Ağırlık', d.agirlik1 + ' gr'],
    ['Sayaç', d.sayac_bas1 + ' → ' + d.sayac_bit1],
    ['Üretim', u1.toLocaleString('tr-TR') + ' adet'],
    ['Fire', d.fire1 + ' adet (Kümülatif)'],
  ];

  if (enjSayisi === 2) {
    rows = rows.concat([
      { type: 'div', text: 'Enjeksiyon 2' },
      ['Enjeksiyon', d.enj2_no],
      ['Kasa', d.kasa2],
      ['Çevrim', d.cevrim2 + ' sn'],
      ['Ağırlık', d.agirlik2 + ' gr'],
      ['Sayaç', d.sayac_bas2 + ' → ' + d.sayac_bit2],
      ['Üretim', u2.toLocaleString('tr-TR') + ' adet'],
      ['Fire', d.fire2 + ' adet (Kümülatif)'],
    ]);
  }

  var html = rows.map(function(r) {
    if (r.type === 'div') return '<div class="sdivider">' + r.text + '</div>';
    return '<div class="sitem"><span class="skey">' + r[0] + '</span><span class="sval">' + r[1] + '</span></div>';
  }).join('');

  document.getElementById('normal-ozet').style.display = 'block';
  document.getElementById('summary-body').innerHTML    = html;
}

// ── Veri toplama ─────────────────────────────────────
function getData() {
  var enj1 = document.getElementById('enj1_no').value;
  var k1   = document.getElementById('kasa1').value;
  var enj2 = document.getElementById('enj2_no').value;
  var k2   = document.getElementById('kasa2').value;
  var b1   = parseInt(document.getElementById('sayac_bas1').value) || 0;
  var e1   = parseInt(document.getElementById('sayac_bit1').value) || 0;
  var b2   = parseInt(document.getElementById('sayac_bas2').value) || 0;
  var e2   = parseInt(document.getElementById('sayac_bit2').value) || 0;

  var fpData     = getFirePeriod();
  var totalFire1 = getFpTotal(fpData.tarih, fpData.vardiya, enj1);
  var totalFire2 = enjSayisi === 2 ? getFpTotal(fpData.tarih, fpData.vardiya, enj2) : 0;

  return {
    adsoyad:    _adSoyad || document.getElementById('kullanici_id').value,
    vardiya:    vardiya,
    enjSayisi:  enjSayisi,
    tarih:      document.getElementById('tarih').value,
    olcum_saat: document.getElementById('olcum_saat').value,
    enj1_no:    enj1,    kasa1:      k1,
    cevrim1:    document.getElementById('cevrim1').value,
    agirlik1:   document.getElementById('agirlik1').value,
    sayac_bas1: b1,      sayac_bit1: e1,  uretim1: e1 - b1,
    fire1:      totalFire1,
    enj2_no:    enj2,    kasa2:      k2,
    cevrim2:    enjSayisi === 2 ? document.getElementById('cevrim2').value  : '00',
    agirlik2:   enjSayisi === 2 ? document.getElementById('agirlik2').value : '00',
    sayac_bas2: enjSayisi === 2 ? b2   : '00',
    sayac_bit2: enjSayisi === 2 ? e2   : '00',
    uretim2:    enjSayisi === 2 ? e2 - b2 : 0,
    fire2:      enjSayisi === 2 ? totalFire2 : '00',
  };
}

// ── Form sıfırlama ───────────────────────────────────
function resetForm() {
  clearDraft();
  vardiya = null; currentStep = 1; enjSayisi = 1;

  var hatirla = document.getElementById('hatirla');
  var sifreEl = document.getElementById('sifre');
  var idEl    = document.getElementById('kullanici_id');
  _adSoyad    = '';

  if (!hatirla.checked) {
    sifreEl.value = ''; idEl.value = '';
    document.getElementById('sifre-field').style.display = 'none';
    document.getElementById('hosgeldin').style.display   = 'none';
  } else {
    var id = idEl.value;
    if (id && kullanicilar[id]) _adSoyad = kullanicilar[id].name;
  }

  document.getElementById('err-sifre').classList.remove('show');
  sifreEl.classList.remove('error');

  ['enj1_no','kasa1','enj2_no','kasa2'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  [1, 2].forEach(function(n) {
    document.getElementById('enj' + n + '-grid')?.querySelectorAll('.enj-gbtn').forEach(function(b) { b.classList.remove('sel'); });
  });
  ['cevrim1','agirlik1','sayac_bas1','sayac_bit1','cevrim2','agirlik2','sayac_bas2','sayac_bit2'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });

  document.getElementById('fire1').value = 0;
  document.getElementById('fire2').value = 0;
  [1, 2].forEach(function(n) {
    var fEl = document.getElementById('fire' + n);
    if (fEl) { fEl.readOnly = false; fEl.style.background = ''; fEl.style.color = ''; }
    var ctr = document.getElementById('fire-counter' + n);
    if (ctr) ctr.querySelectorAll('.cbtn').forEach(function(b) { b.disabled = false; });
    var b = document.getElementById('fire-toplam-box' + n);
    if (b) b.style.display = 'none';
  });

  [1, 2].forEach(function(n) {
    document.getElementById('result-val' + n).textContent = '—';
    var ub = document.getElementById('uretim-box' + n);
    if (ub) ub.style.cssText = 'background:var(--accent-light);border:2px solid var(--accent);border-radius:12px;padding:14px;text-align:center;margin-top:12px';
  });

  var sb = document.getElementById('submit-btn'); if (sb) sb.disabled = false;

  ['v-sabah','v-aksam','v-gece'].forEach(function(id) { document.getElementById(id).className = 'vbtn'; });
  updateVardiyaButtons();

  document.getElementById('normal-ozet').style.display = 'block';

  setEnjSayisi(1);
  setBasEditable(1); setBasEditable(2);
  document.getElementById('tarih').value = new Date(Date.now() + _timeOffset).toISOString().split('T')[0];
  tickClock();
  goStep(1);
}

// ── Gönder ───────────────────────────────────────────
function onGonderClick() {
  submitForm();
}

// ── Toast bildirimi ──────────────────────────────────
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (type || 'ok') + ' show';
  setTimeout(function() { t.classList.remove('show'); }, 3500);
}
