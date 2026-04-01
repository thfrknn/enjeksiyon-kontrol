/* ── Vardiya Mantığı ───────────────────────────────── */

// Vardiya zaman aralıkları (dakika cinsinden)
var _VR = {
  SABAH: { s: 9  * 60, e: 17 * 60 },
  AKSAM: { s: 17 * 60, e: 1  * 60 },
  GECE:  { s: 1  * 60, e: 9  * 60 },
};

/**
 * Verilen dakikanın (0-1439), ±win dakikalık geçiş penceresinde olup olmadığını döndürür.
 * Gece yarısı sarmalarını da doğru işler.
 */
function _inWindow(m, center, win) {
  var lo = (center - win + 1440) % 1440;
  var hi = (center + win) % 1440;
  return lo <= hi ? (m >= lo && m <= hi) : (m >= lo || m <= hi);
}

/**
 * Verilen vardiya seçiminin şu an aktif olup olmadığını kontrol eder.
 *
 * Geçiş pencereleri (±15 dk):
 *   08:45-09:15 → GECE ve SABAH birlikte aktif
 *   16:45-17:15 → SABAH ve AKSAM birlikte aktif
 *   00:45-01:15 → AKSAM ve GECE birlikte aktif
 *
 * Bu pencereler dışında sadece o anın vardiyası aktiftir.
 */
function isVardiyaActive(v) {
  if (window.__testMode) return true;

  var now = new Date(Date.now() + _timeOffset);
  var m   = now.getHours() * 60 + now.getMinutes();

  // Geçiş pencereleri — her iki komşu vardiya da seçilebilir
  if (_inWindow(m, 9  * 60, 15)) return v === 'GECE'  || v === 'SABAH';
  if (_inWindow(m, 17 * 60, 15)) return v === 'SABAH' || v === 'AKSAM';
  if (_inWindow(m, 1  * 60, 15)) return v === 'AKSAM' || v === 'GECE';

  // Normal zaman — sadece aktif vardiya
  var r = _VR[v];
  return r.e < r.s ? (m >= r.s || m <= r.e) : (m >= r.s && m <= r.e);
}

/**
 * Vardiya butonlarını aktif/pasif günceller.
 * Sadece tek aktif vardiya varsa otomatik seçer.
 */
function updateVardiyaButtons() {
  ['SABAH', 'AKSAM', 'GECE'].forEach(function(v) {
    document.getElementById('v-' + v.toLowerCase()).disabled = !isVardiyaActive(v);
  });

  // Seçili vardiya artık aktif değilse temizle
  if (vardiya && !isVardiyaActive(vardiya)) {
    vardiya = null;
    ['sabah', 'aksam', 'gece'].forEach(function(x) {
      document.getElementById('v-' + x).className = 'vbtn';
    });
  }

  // Tek aktif vardiya varsa otomatik seç
  if (!vardiya) {
    var aktif = ['SABAH', 'AKSAM', 'GECE'].filter(isVardiyaActive);
    if (aktif.length === 1) setVardiya(aktif[0]);
  }
}

/**
 * Kullanıcının seçtiği vardiyayı aktif yapar.
 * Aktif değilse işlem yapmaz.
 */
function setVardiya(v) {
  if (!isVardiyaActive(v)) return;
  vardiya = v;
  ['sabah', 'aksam', 'gece'].forEach(function(x) {
    document.getElementById('v-' + x).className = 'vbtn';
  });
  document.getElementById('v-' + v.toLowerCase()).classList.add('sel-' + v.toLowerCase());
  document.getElementById('err-vardiya').classList.remove('show');
  var id = document.getElementById('kullanici_id').value;
  if (id && kullanicilar[id]) checkStatus();
}
