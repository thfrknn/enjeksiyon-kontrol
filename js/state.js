/* ── Global Uygulama Durumu ────────────────────────── */

var vardiya      = null;
var currentStep  = 1;
var olcumNo      = 1;
var enjSayisi    = 1;

var enj1Kilitli  = false;
var enj2Kilitli  = false;

var kullanicilar  = {};
var uretimLimiti  = 0;
var kasaLimitlari = {};
var _adSoyad      = '';
var maxFireLimit  = 50;   // Sheets'ten güncellenir

var _timeOffset   = 0;    // Sunucu-istemci saat farkı (ms)
var _t0           = 0;    // loadLists isteğinin başlama zamanı

var _fireAdjTimer    = null;
var _fireAdjInterval = null;
var _pendingFire     = null;   // Bekleyen anlık fire kaydı
var _pendingOnayladi = false;  // Limit aşımı onay modalı için
