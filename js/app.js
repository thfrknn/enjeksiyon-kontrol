/* ── Uygulama Başlatma & Global Döngüler ────────────── */

function tickClock() {
  var n = new Date(Date.now() + _timeOffset);
  document.getElementById('olcum_saat').value =
    String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

/**
 * Eski vardiya/tarih kombinasyonlarına ait fireLog_ ve fpUnlock_
 * kayıtlarını localStorage'dan temizler.
 */
function garbageCollector() {
  var now         = new Date(Date.now() + _timeOffset);
  var currentDate = now.toISOString().split('T')[0];
  var keysToRemove = [];
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key.startsWith('fireLog_') || key.startsWith('fpUnlock_')) {
      var parts = key.split('_');
      if (parts.length >= 3) {
        var keyDate    = parts[1];
        var keyVardiya = parts[2];
        var fp         = getFirePeriod();
        if (keyDate !== fp.tarih || keyVardiya !== fp.vardiya) {
          keysToRemove.push(key);
        }
      }
    }
  }
  keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
}

window.onload = function() {
  var now = new Date();
  document.getElementById('header-date').textContent =
    now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('tarih').value = now.toISOString().split('T')[0];

  tickClock();
  setInterval(tickClock,               10000);
  setInterval(saveDraft,                5000);
  setInterval(updateVardiyaButtons,    30000);
  setInterval(updateFireLockDisplay,    1000);
  setInterval(garbageCollector,    5 * 60 * 1000);

  loadLists().then(function() {
    var synced = new Date(Date.now() + _timeOffset);
    document.getElementById('tarih').value = synced.toISOString().split('T')[0];
    tickClock();
    updateVardiyaButtons();
    checkAndShowDraft();
    garbageCollector();
  });
};

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') saveDraft();
});
window.addEventListener('pagehide', saveDraft);
