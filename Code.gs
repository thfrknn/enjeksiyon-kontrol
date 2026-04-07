// Code.gs
// ================================================================
// ENJEKSİYON KONTROL — Google Apps Script v14
// ================================================================

// ----------------------------------------------------------------
// GİRİŞ NOKTALARI
// ----------------------------------------------------------------

function doGet(e) {
  const cb     = e.parameter.callback;
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getLists':             return getLists(cb, e);
      case 'getStatus':            return getStatus(cb, e);
      case 'getLastCounter':       return getLastCounter(cb, e);
      case 'getFireTotal':         return getFireTotal(cb, e);
      case 'logFire':              return logFire(cb, e);
      case 'exportNow':            return exportNow(cb);
      case 'runMonthlyMaintenance':return jsonp(cb, { result: monthlyBackupAndCleanup() });
      case 'submitForm':           return submitForm(cb, e);
      case 'getMonitorData':       return getMonitorData(cb);
      case 'getMachineStatuses':   return getMachineStatuses(cb, e);
      case 'saveAssignment':       return saveAssignment(cb, e);
      case 'transferMakine':       return transferMakine(cb, e);   // YENİ
      case 'logAriza':             return logAriza(cb, e);
      case 'setMachineKasa':       return setMachineKasa(cb, e);
      case 'toggleMachine':        return toggleMachine(cb, e);
      case 'getSettings':          return getSettings(cb);
      case 'saveSettings':         return saveSettings(cb, e);
      case 'getPersonel':          return getPersonel(cb);
      case 'addPersonel':          return addPersonel(cb, e);
      case 'updatePersonel':       return updatePersonel(cb, e);
      case 'changePassword':       return changePassword(cb, e);
      default:                     return jsonp(cb, { error: 'Geçersiz istek' });
    }
  } catch (err) {
    return jsonp(cb, { error: err.toString() });
  }
}

function doPost(e) {
  try {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'redirected', message: 'logFire artık GET ile yapılıyor' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ================================================================
// ACTION: getLists — Ayarlar sekmesinden konfigürasyon verilerini çek
// ================================================================

function getLists(cb, e) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const ayarlar = ss.getSheetByName('Ayarlar');
  if (!ayarlar) return jsonp(cb, { error: 'Ayarlar sekmesi bulunamadı' });

  const vals    = ayarlar.getRange('A2:F50').getValues();
  const display = ayarlar.getRange('A2:F50').getDisplayValues();

  const kullanicilar  = {};
  const kasaEbatlariS = [];
  const kasaLimitlari = {};
  let   uretimLimiti  = 0;

  const props           = PropertiesService.getScriptProperties();
  const maxFireLimit    = Number(props.getProperty('maxFireLimit'))    || Number(vals[0][5]) || 200;
  const vardiyaTolerans = Number(props.getProperty('vardiyaTolerans')) || 120;
  const otoVardiya      = props.getProperty('otoVardiya') !== 'false';

  vals.forEach((row) => {
    const kasa  = String(row[1] || '').trim();
    const limit = Number(row[3]);
    if (kasa) {
      kasaEbatlariS.push(kasa);
      if (limit > 0) {
        kasaLimitlari[kasa] = limit;
        if (!uretimLimiti) uretimLimiti = limit;
      }
    }
  });

  // Personel sheet varsa oradan oku (rol bilgisiyle birlikte)
  const personelSheet = ss.getSheetByName('Personel');
  if (personelSheet && personelSheet.getLastRow() > 1) {
    const pv = personelSheet.getRange(2, 1, personelSheet.getLastRow() - 1, 5).getValues();
    const pd = personelSheet.getRange(2, 1, personelSheet.getLastRow() - 1, 5).getDisplayValues();
    for (let i = 0; i < pv.length; i++) {
      const id    = String(pd[i][0] || '').trim();
      const ad    = String(pv[i][1] || '').trim();
      const sifre = String(pd[i][2] || '').trim();
      const durum = String(pv[i][4] || '').trim();
      // Rol: sütundan oku; boş veya belirsizse ID prefix'e göre belirle
      let rol = String(pv[i][3] || '').trim();
      if (!rol || rol === 'Operatör') {
        if      (id.charAt(0) === '1') rol = 'Meydancı';
        else if (id.charAt(0) === '3') rol = 'Yönetici';
        else                            rol = 'Operatör';
      }
      if (id && ad && durum !== 'Pasif') kullanicilar[id] = { name: ad, sifre, rol };
    }
  } else {
    // Ayarlar fallback — rol yok, Operatör varsayılan
    vals.forEach((row, i) => {
      const ad    = String(row[0] || '').trim();
      const sifre = String(display[i][2] || '').trim();
      const id    = String(display[i][4] || '').trim();
      if (ad && id) kullanicilar[id] = { name: ad, sifre, rol: 'Operatör' };
    });
  }

  const lockedMachines = getLockedMachines(ss);
  const atananKasalar  = readAtananKasalar(ss);

  // Atamalar sheet'inden operatör → makine listesini oku (mevcut vardiyaya göre)
  const atananMakineler = readAtananMakineler(ss, _getCurrentVardiya());

  return jsonp(cb, {
    kasaEbatlari: kasaEbatlariS,
    kullanicilar,
    uretimLimiti,
    kasaLimitlari,
    maxFireLimit,
    atananKasalar,
    atananMakineler,        // YENİ: { "101": ["Enjeksiyon 3"], "102": ["Enjeksiyon 7"] }
    vardiyaTolerans,
    otoVardiya,
    serverTime: new Date().getTime(),
    lockedMachines
  });
}

// ================================================================
// ACTION: getStatus — Operatörün bugünkü ölçüm durumunu sorgula
// ================================================================

function getStatus(cb, e) {
  const adsoyad     = e.parameter.adsoyad;
  const tarih       = e.parameter.tarih;
  const vardiya     = e.parameter.vardiya;
  const saat        = e.parameter.saat || '';
  const kullaniciId = e.parameter.kullanici_id || '';   // YENİ

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Veriler');
  if (!sheet || sheet.getLastRow() < 2) {
    return jsonp(cb, {
      olcumNo: 1, enj1: null, kasa1: null, enj2: null, kasa2: null, enjSayisi: 1,
      atananMakineler: kullaniciId ? readAtananMakinelerForUser(ss, kullaniciId) : []
    });
  }

  const normTarih = vardiyaBaslangicTarih(tarih, saat, vardiya);
  const vals      = sheet.getRange(2, 1, sheet.getLastRow() - 1, 24).getValues();
  const tz        = ss.getSpreadsheetTimeZone();

  let olcumNo = 1, enj1 = null, kasa1 = null, enj2 = null, kasa2 = null, enjSayisi = 1;
  let sayacBit1 = null, sayacBit2 = null;
  let fireToplam1 = 0, fireToplam2 = 0;

  for (const row of vals) {
    const rowTarih = row[1] instanceof Date
      ? Utilities.formatDate(row[1], tz, 'yyyy-MM-dd')
      : String(row[1]).trim();

    if (String(row[2]).trim() === String(adsoyad).trim() &&
        rowTarih              === String(normTarih).trim() &&
        String(row[3]).trim() === String(vardiya).trim()) {

      olcumNo   = parseInt(row[4]) + 1;
      enjSayisi = parseInt(row[5]) || 1;
      enj1  = String(row[7]);
      kasa1 = String(row[8]);
      enj2  = String(row[15]);
      kasa2 = String(row[16]);

      const b1 = parseInt(row[12]); if (!isNaN(b1)) sayacBit1 = b1;
      const b2 = parseInt(row[20]); if (!isNaN(b2)) sayacBit2 = b2;

      const f1 = parseInt(row[14]); if (!isNaN(f1)) fireToplam1 += f1;
      const f2 = parseInt(row[22]); if (!isNaN(f2)) fireToplam2 += f2;
    }
  }

  // Kullanıcının atanan makinelerini de döndür (vardiyaya göre filtrele)
  const kullaniciAtamalar = kullaniciId ? readAtananMakinelerForUser(ss, kullaniciId, vardiya) : [];

  return jsonp(cb, {
    olcumNo, enj1, kasa1, enj2, kasa2, enjSayisi,
    sayacBit1, sayacBit2, fireToplam1, fireToplam2,
    lockedMachines: getLockedMachines(ss),
    atananMakineler: kullaniciAtamalar   // YENİ
  });
}

// ================================================================
// ACTION: getLastCounter
// ================================================================

function getLastCounter(cb, e) {
  const enjNo = e.parameter.enj_no;
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Veriler');
  if (!sheet || sheet.getLastRow() < 2) return jsonp(cb, { sayacBit: null });

  const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 24).getValues();
  let sayacBit = null;

  for (const row of vals) {
    if (String(row[7]).trim() === String(enjNo).trim()) {
      const b = parseInt(row[12]);
      if (!isNaN(b)) sayacBit = b;
    }
    if (String(row[15]).trim() === String(enjNo).trim()) {
      const b = parseInt(row[20]);
      if (!isNaN(b)) sayacBit = b;
    }
  }

  let kasaAtanan = null;
  const kasaSheet = ss.getSheetByName('Makine Kasa');
  if (kasaSheet && kasaSheet.getLastRow() > 1) {
    const kv = kasaSheet.getRange(2, 1, kasaSheet.getLastRow() - 1, 2).getValues();
    for (const row of kv) {
      if (String(row[0]).trim() === String(enjNo).trim()) {
        kasaAtanan = String(row[1]).trim() || null;
        break;
      }
    }
  }

  return jsonp(cb, { sayacBit, kasaAtanan });
}

// ================================================================
// ACTION: getFireTotal
// ================================================================

function getFireTotal(cb, e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Fire Log');
  if (!sheet || sheet.getLastRow() < 2) return jsonp(cb, { total: 0 });

  const enjNo   = String(e.parameter.enj_no   || '').trim();
  const tarih   = String(e.parameter.tarih    || '').trim();
  const vardiya = String(e.parameter.vardiya  || '').trim();

  const tz   = ss.getSpreadsheetTimeZone();
  const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  let total  = 0;

  for (const row of vals) {
    const storedTarih = row[1] instanceof Date
      ? Utilities.formatDate(row[1], tz, 'yyyy-MM-dd')
      : String(row[1]).trim();
    if (storedTarih === tarih &&
        String(row[4]).trim() === vardiya &&
        String(row[5]).trim() === enjNo) {
      total += Number(row[6]) || 0;
    }
  }

  return jsonp(cb, { total });
}

// ================================================================
// ACTION: logFire
// ================================================================

function logFire(cb, e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let logSheet = ss.getSheetByName('Fire Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('Fire Log');
    logSheet.appendRow(['Kayıt Zamanı', 'Vardiya Tarihi', 'Kullanıcı ID', 'Ad Soyad', 'Vardiya', 'Makine No', 'Eklenen Fire', 'Ölçüm Saati']);
    const header = logSheet.getRange('A1:H1');
    header.setFontWeight('bold').setBackground('#ea580c').setFontColor('#ffffff');
    logSheet.setFrozenRows(1);
    [160, 0, 0, 140, 0, 140, 0, 0].forEach((w, i) => { if (w) logSheet.setColumnWidth(i + 1, w); });
  }

  const fireTarih   = e.parameter.tarih          || new Date().toISOString().split('T')[0];
  const fireSaat    = e.parameter.olcum_saat     || '';
  const fireVardiya = e.parameter.vardiya        || '';
  const makineNo    = e.parameter.makine_no      || '';
  const kulId       = e.parameter.kullanici_id   || '';
  const adSoyad     = e.parameter.adsoyad        || '';
  const miktar      = Number(e.parameter.fire_miktari) || 0;

  const vardiyaTarih = (fireTarih && fireVardiya)
    ? vardiyaBaslangicTarih(fireTarih, fireSaat, fireVardiya)
    : fireTarih;

  logSheet.appendRow([
    new Date().toLocaleString('tr-TR'),
    vardiyaTarih, kulId, adSoyad, fireVardiya, makineNo, miktar, fireSaat
  ]);

  return jsonp(cb, { result: 'ok', miktar, makine: makineNo });
}

// ================================================================
// ACTION: exportNow
// ================================================================

function exportNow(cb) {
  try {
    dailyExport();
    return jsonp(cb, { result: 'ok' });
  } catch (ex) {
    return jsonp(cb, { result: 'error', message: String(ex) });
  }
}

// ================================================================
// ACTION: submitForm — Ana ölçüm formunu kaydet
// ================================================================

function submitForm(cb, e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Veriler');
  if (!sheet) sheet = ss.insertSheet('Veriler');
  if (sheet.getLastRow() === 0) yazBaslik(sheet);

  const enjSayisi   = parseInt(e.parameter.enjSayisi) || 1;
  const tarih       = e.parameter.tarih       || '';
  const saat        = e.parameter.olcum_saat  || '';
  const vardiya     = e.parameter.vardiya     || '';
  const close       = e.parameter.close === 'true';
  const olcumNo     = parseInt(e.parameter.olcumNo) || 1;
  const onaylandi   = e.parameter.onaylandi === 'true';
  const adSoyad     = e.parameter.adsoyad || '';
  const submitToken = String(e.parameter.submitToken || '').trim();

  // ── Duplicate token kontrolü ───────────────────────
  // Aynı token daha önce kaydedildiyse tekrar kaydetme, başarı dön
  if (submitToken) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const checkStart = Math.max(2, lastRow - 499);
      const tokenCol   = sheet.getRange(checkStart, 25, lastRow - checkStart + 1, 1).getValues();
      for (let i = 0; i < tokenCol.length; i++) {
        if (String(tokenCol[i][0]).trim() === submitToken) {
          return jsonp(cb, { result: 'ok', olcum: olcumNo, duplicate: true });
        }
      }
    }
  }

  const vardiyaTarih = vardiyaBaslangicTarih(tarih, saat, vardiya);

  const enj2No   = enjSayisi === 2 ? (e.parameter.enj2_no    || '') : '00';
  const kasa2    = enjSayisi === 2 ? (e.parameter.kasa2       || '') : '00';
  const cevrim2  = enjSayisi === 2 ? (close ? '0' : (e.parameter.cevrim2    || '')) : '00';
  const agirlik2 = enjSayisi === 2 ? (e.parameter.agirlik2   || '') : '00';
  const bas2     = enjSayisi === 2 ? (e.parameter.sayac_bas2 || '') : '00';
  const bit2     = enjSayisi === 2 ? (e.parameter.sayac_bit2 || '') : '00';
  const uretim2  = enjSayisi === 2 ? (e.parameter.uretim2    || '') : '00';
  const fire2    = enjSayisi === 2 ? (e.parameter.fire2      || '0') : '00';

  sheet.appendRow([
    new Date().toLocaleString('tr-TR'),
    vardiyaTarih,
    adSoyad,
    vardiya,
    olcumNo,
    enjSayisi,
    saat,
    e.parameter.enj1_no    || '',
    e.parameter.kasa1      || '',
    close ? '0' : (e.parameter.cevrim1    || ''),
    e.parameter.agirlik1   || '',
    e.parameter.sayac_bas1 || '',
    e.parameter.sayac_bit1 || '',
    e.parameter.uretim1    || '',
    e.parameter.fire1      || '0',
    enj2No, kasa2, cevrim2, agirlik2, bas2, bit2, uretim2, fire2,
    olcumNo === 3 ? (onaylandi ? 'ONAYLANDI' : 'BEKLİYOR') : '',
    submitToken
  ]);

  // Canlı izleme güncelle
  updateCanliIzleme(
    e.parameter.enj1_no, e.parameter.kasa1,
    close ? '0' : e.parameter.cevrim1, e.parameter.agirlik1,
    e.parameter.sayac_bas1, e.parameter.sayac_bit1,
    e.parameter.uretim1, e.parameter.fire1,
    vardiyaTarih, vardiya, adSoyad
  );
  if (enjSayisi === 2) {
    updateCanliIzleme(
      e.parameter.enj2_no, e.parameter.kasa2,
      cevrim2, e.parameter.agirlik2,
      e.parameter.sayac_bas2, e.parameter.sayac_bit2,
      e.parameter.uretim2, e.parameter.fire2,
      vardiyaTarih, vardiya, adSoyad
    );
  }

  // Günlük özet güncelle
  appendOrUpdateGunlukOzet(ss, {
    tarih: vardiyaTarih, vardiya, saat, adsoyad: adSoyad,
    makineNo: e.parameter.enj1_no || '', kasa: e.parameter.kasa1 || '',
    cevrim:   close ? '0' : (e.parameter.cevrim1 || ''),
    agirlik:  e.parameter.agirlik1 || '',
    sayacBas: e.parameter.sayac_bas1 || '0', sayacBit: e.parameter.sayac_bit1 || '0',
    fire:     e.parameter.fire1 || '0',
  });
  if (enjSayisi === 2) {
    appendOrUpdateGunlukOzet(ss, {
      tarih: vardiyaTarih, vardiya, saat, adsoyad: adSoyad,
      makineNo: enj2No, kasa: kasa2, cevrim: cevrim2, agirlik: agirlik2,
      sayacBas: bas2, sayacBit: bit2, fire: fire2,
    });
  }

  // Makine kilitleme
  if (close) {
    lockMachine(ss, e.parameter.enj1_no, vardiyaTarih, vardiya, adSoyad);
    if (enjSayisi === 2) {
      lockMachine(ss, e.parameter.enj2_no, vardiyaTarih, vardiya, adSoyad);
    }
  }

  // Üretim kaydı
  appendUretimKaydi(ss, {
    tarih: vardiyaTarih, vardiya, saat, adsoyad: adSoyad, olcumNo,
    makineNo: e.parameter.enj1_no || '', kasa: e.parameter.kasa1 || '',
    cevrim:   close ? '0' : (e.parameter.cevrim1 || ''),
    agirlik:  e.parameter.agirlik1 || '',
    sayacBas: e.parameter.sayac_bas1 || '', sayacBit: e.parameter.sayac_bit1 || '',
    uretim:   e.parameter.uretim1 || '', fire: e.parameter.fire1 || '0',
  });
  if (enjSayisi === 2) {
    appendUretimKaydi(ss, {
      tarih: vardiyaTarih, vardiya, saat, adsoyad: adSoyad, olcumNo,
      makineNo: enj2No, kasa: kasa2, cevrim: cevrim2, agirlik: agirlik2,
      sayacBas: bas2, sayacBit: bit2, uretim: uretim2, fire: fire2,
    });
  }

  return jsonp(cb, { result: 'ok', olcum: olcumNo });
}

// ================================================================
// ACTION: getMonitorData — Yönetici izleme sayfası
// ================================================================

function getMonitorData(cb) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const statuses = buildMachineStatuses(ss);
  const canliData = buildCanliData(ss);

  const kasalar = {};
  const kasaSheet = ss.getSheetByName('Makine Kasa');
  if (kasaSheet && kasaSheet.getLastRow() > 1) {
    kasaSheet.getRange(2, 1, kasaSheet.getLastRow() - 1, 2).getValues().forEach(row => {
      const m = String(row[0]).trim(), k = String(row[1]).trim();
      if (m && k) kasalar[m] = k;
    });
  }

  const arizaLog = [];
  const arizaSheet = ss.getSheetByName('Arıza Log');
  if (arizaSheet && arizaSheet.getLastRow() > 1) {
    const lastRow  = arizaSheet.getLastRow();
    const startRow = Math.max(2, lastRow - 99);
    const tz = ss.getSpreadsheetTimeZone();
    const av = arizaSheet.getRange(startRow, 1, lastRow - startRow + 1, 10).getValues();
    for (let i = av.length - 1; i >= 0; i--) {
      const r = av[i];
      arizaLog.push({
        zaman:      String(r[0]).trim(),
        teknikerId: String(r[1]).trim(),
        teknikerAd: String(r[2]).trim(),
        makine:     String(r[3]).trim(),
        tip:        String(r[4]).trim(),
        sorun:      String(r[5]).trim(),
        cozum:      String(r[6]).trim(),
        basSaat:    r[7] instanceof Date ? Utilities.formatDate(r[7], tz, 'HH:mm') : String(r[7] || '').trim(),
        bitSaat:    r[8] instanceof Date ? Utilities.formatDate(r[8], tz, 'HH:mm') : String(r[8] || '').trim(),
        durum:      String(r[9]).trim(),
      });
    }
  }

  const uretimGecmisi = [];
  const verilerSheet = ss.getSheetByName('Veriler');
  if (verilerSheet && verilerSheet.getLastRow() > 1) {
    const lastRow  = verilerSheet.getLastRow();
    const startRow = Math.max(2, lastRow - 499);
    const tz = ss.getSpreadsheetTimeZone();
    const vv = verilerSheet.getRange(startRow, 1, lastRow - startRow + 1, 24).getValues();
    for (let i = vv.length - 1; i >= 0; i--) {
      const r = vv[i];
      const tarih = r[1] instanceof Date
        ? Utilities.formatDate(r[1], tz, 'yyyy-MM-dd')
        : String(r[1]).trim();
      uretimGecmisi.push({
        tarih,
        adsoyad:   String(r[2]).trim(),
        vardiya:   String(r[3]).trim(),
        olcumNo:   Number(r[4]) || 0,
        saat:      String(r[6]).trim(),
        enj1:      String(r[7]).trim(),
        kasa1:     String(r[8]).trim(),
        cevrim1:   Number(r[9])  || 0,
        sayacBas1: Number(r[11]) || 0,
        sayacBit1: Number(r[12]) || 0,
        uretim1:   Number(r[13]) || 0,
        fire1:     Number(r[14]) || 0,
        enj2:      String(r[15]).trim(),
        cevrim2:   Number(r[17]) || 0,
        sayacBas2: Number(r[19]) || 0,
        sayacBit2: Number(r[20]) || 0,
        uretim2:   Number(r[21]) || 0,
        fire2:     Number(r[22]) || 0,
      });
    }
  }

  const aktif   = Object.values(statuses).filter(s => s.durum === 'Aktif').length;
  const arizali = Object.values(statuses).filter(s => s.durum !== 'Aktif').length;
  const ssId    = ss.getId();
  const _gid    = name => { const sh = ss.getSheetByName(name); return sh ? sh.getSheetId() : null; };
  const sheetGids = {
    veriler:     _gid('Veriler'),
    uretimKaydi: _gid('Üretim Kaydı'),
    arizaLog:    _gid('Arıza Log'),
  };
  const sonYedek = PropertiesService.getScriptProperties().getProperty('lastExport') || '';

  return jsonp(cb, {
    statuses, canliData, kasalar, arizaLog, uretimGecmisi,
    ozet: { aktif, arizali },
    ssId, sheetGids, sonYedek,
    serverTime: new Date().getTime(),
  });
}

// ================================================================
// ACTION: getMachineStatuses — Meydancı paneli için
// ================================================================

function getMachineStatuses(cb, e) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const ayarlar = ss.getSheetByName('Ayarlar');
  const curVardiya = String((e && e.parameter && e.parameter.vardiya) || '').trim() || _getCurrentVardiya();

  let arizaTipleri = [];
  if (ayarlar) {
    arizaTipleri = ayarlar.getRange('G2:G20').getValues().flat().map(v => String(v).trim()).filter(v => v);
  }
  if (!arizaTipleri.length) arizaTipleri = ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Planlı Bakım', 'Temizlik', 'Diğer'];

  const statuses    = buildMachineStatuses(ss);
  const machineData = buildCanliDataForMachineStatus(ss);
  const atananKasalar = readAtananKasalar(ss);

  const atananlar  = {};
  const atamaSheet = ss.getSheetByName('Atamalar');
  if (atamaSheet && atamaSheet.getLastRow() > 1) {
    atamaSheet.getRange(2, 1, atamaSheet.getLastRow() - 1, 7).getValues().forEach(row => {
      const makine     = String(row[0]).trim();
      const rowVardiya = String(row[1]).trim();
      if (!makine) return;
      // Sadece mevcut vardiyaya ait atamaları göster (boş vardiya = eski veri, görmezden gel)
      if (rowVardiya !== curVardiya) return;
      atananlar[makine] = {
        operatorId: String(row[2]).trim(),
        operatorAd: String(row[3]).trim(),
        kasa:       String(row[4]).trim(),
        mod:        String(row[5]).trim()
      };
    });
  }

  const kasaEbatlari = ayarlar
    ? ayarlar.getRange('B2:B50').getValues().flat().map(v => String(v).trim()).filter(v => v)
    : [];

  const personelList = [];
  const pSheet = ss.getSheetByName('Personel');
  if (pSheet && pSheet.getLastRow() > 1) {
    pSheet.getRange(2, 1, pSheet.getLastRow() - 1, 5).getValues().forEach(row => {
      const durum = String(row[4] || '').trim();
      const rol   = String(row[3] || '').trim();
      // Sadece aktif operatörleri listele (meydancı ve yöneticiyi değil)
      if (durum !== 'Pasif' && rol !== 'Meydancı' && rol !== 'Yönetici') {
        personelList.push({ id: String(row[0]).trim(), ad: String(row[1]).trim(), rol });
      }
    });
  }

  return jsonp(cb, {
    statuses, arizaTipleri, machineData, kasaEbatlari,
    atananKasalar, atananlar, personelList,
    vardiya: curVardiya,
    serverTime: new Date().getTime()
  });
}

// ================================================================
// ACTION: saveAssignment — Makineye operatör ve kasa ata
// ================================================================

function saveAssignment(cb, e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Atamalar');
  if (!sheet) {
    sheet = ss.insertSheet('Atamalar');
    sheet.appendRow(['Makine No', 'Vardiya', 'Operatör ID', 'Operatör Adı', 'Kasa Ebatı', 'Çalışma Modu', 'Son Güncelleme']);
    sheet.getRange('A1:G1').setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    [120, 80, 100, 140, 120, 100, 140].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  }

  const makineNo   = String(e.parameter.makine_no   || '').trim();
  const vardiya    = String(e.parameter.vardiya      || _getCurrentVardiya()).trim();
  const operatorId = String(e.parameter.operator_id || '').trim();
  const operatorAd = String(e.parameter.operator_ad || '').trim();
  const kasa       = String(e.parameter.kasa        || '').trim();
  const mod        = String(e.parameter.mod         || 'Tek').trim();
  const simdi      = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');

  const rowData = [makineNo, vardiya, operatorId, operatorAd, kasa, mod, simdi];

  // Atamalar sheet'ini güncelle (aynı makine + vardiya kombinasyonu varsa üzerine yaz)
  const data = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === makineNo && String(data[i][1]).trim() === vardiya) {
      targetRow = i + 1; break;
    }
  }
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, 7).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  // YENİ: Kasa varsa Makine Kasa sheet'ini de güncelle
  if (kasa) {
    _updateMakineKasa(ss, makineNo, kasa, operatorAd || 'Meydancı');
  }

  return jsonp(cb, { result: 'ok' });
}

// ================================================================
// ACTION: transferMakine — YENİ: Operatörü bir makineden diğerine taşı
// ================================================================

function transferMakine(cb, e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const eskiMakine = String(e.parameter.eski_makine || '').trim();
  const yeniMakine = String(e.parameter.yeni_makine || '').trim();
  const operatorId = String(e.parameter.operator_id || '').trim();
  const operatorAd = String(e.parameter.operator_ad || '').trim();
  const kasa       = String(e.parameter.kasa        || '').trim();
  const meydanciId = String(e.parameter.meydanci_id || '').trim();
  const meydanciAd = String(e.parameter.meydanci_ad || '').trim();
  const neden      = String(e.parameter.neden       || 'Makine Transferi').trim();
  const mod        = String(e.parameter.mod         || 'Tek').trim();

  if (!eskiMakine || !yeniMakine) return jsonp(cb, { error: 'Eski ve yeni makine belirtilmeli' });

  const vardiya = String(e.parameter.vardiya || _getCurrentVardiya()).trim();

  let atamaSheet = ss.getSheetByName('Atamalar');
  if (!atamaSheet) {
    atamaSheet = ss.insertSheet('Atamalar');
    atamaSheet.appendRow(['Makine No', 'Vardiya', 'Operatör ID', 'Operatör Adı', 'Kasa Ebatı', 'Çalışma Modu', 'Son Güncelleme']);
    atamaSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    atamaSheet.setFrozenRows(1);
  }

  const simdi = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
  const data  = atamaSheet.getDataRange().getValues();

  let eskiRow = -1, yeniRow = -1;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0]).trim();
    const v = String(data[i][1]).trim();
    if (m === eskiMakine && v === vardiya) eskiRow = i + 1;
    if (m === yeniMakine && v === vardiya) yeniRow = i + 1;
  }

  // Eski makineyi boşalt (operatörü kaldır)
  if (eskiRow > 0) {
    // Col 3-7: vardiya sabit kalır, opId/opAd/mod temizlenir
    atamaSheet.getRange(eskiRow, 3, 1, 5).setValues([['', '', '', '', simdi]]);
  }

  // Yeni makineye operatörü ata
  const yeniKasa = kasa || (yeniRow > 0 ? String(data[yeniRow - 1][4] || '').trim() : '');
  if (yeniRow > 0) {
    atamaSheet.getRange(yeniRow, 1, 1, 7).setValues([[yeniMakine, vardiya, operatorId, operatorAd, yeniKasa, mod, simdi]]);
  } else {
    atamaSheet.appendRow([yeniMakine, vardiya, operatorId, operatorAd, yeniKasa, mod, simdi]);
  }

  // Kasa varsa Makine Kasa'yı da güncelle
  if (yeniKasa) _updateMakineKasa(ss, yeniMakine, yeniKasa, meydanciAd || 'Meydancı');

  // Arıza Log'a transfer kaydı ekle
  let logSheet = ss.getSheetByName('Arıza Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('Arıza Log');
    logSheet.appendRow(['Kayıt Zamanı','Tekniker ID','Tekniker Ad','Makine No','Arıza Tipi','Sorun','Çözüm','Başlangıç Saati','Bitiş Saati','Durum']);
    logSheet.getRange('A1:J1').setFontWeight('bold').setBackground('#dc2626').setFontColor('#ffffff');
    logSheet.setFrozenRows(1);
  }

  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  logSheet.appendRow([
    new Date().toLocaleString('tr-TR'),
    meydanciId, meydanciAd,
    eskiMakine,
    'Operatör Taşındı',
    operatorAd + ' → ' + yeniMakine + ' (' + neden + ')',
    '',
    nowStr, '', 'Kapalı (Çözüldü)'
  ]);

  return jsonp(cb, { result: 'ok', eskiMakine, yeniMakine, operatorAd });
}

// ================================================================
// ACTION: logAriza
// ================================================================

function logAriza(cb, e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let arizaSheet = ss.getSheetByName('Arıza Log');
  if (!arizaSheet) {
    arizaSheet = ss.insertSheet('Arıza Log');
    arizaSheet.appendRow([
      'Kayıt Zamanı','Tekniker ID','Tekniker Ad','Makine No',
      'Arıza Tipi','Sorun','Çözüm','Başlangıç Saati','Bitiş Saati','Durum'
    ]);
    arizaSheet.getRange('A1:J1').setFontWeight('bold').setBackground('#dc2626').setFontColor('#ffffff');
    arizaSheet.setFrozenRows(1);
    [160, 120, 130, 130, 200, 200, 110, 110, 90].forEach((w, i) => arizaSheet.setColumnWidth(i + 2, w));
  }

  const makineNo   = e.parameter.makine_no   || '';
  const arizaTipi  = e.parameter.ariza_tipi  || '';
  const sorun      = e.parameter.sorun       || '';
  const cozum      = e.parameter.cozum       || '';
  const autoNow    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  const basSaat    = e.parameter.bas_saat    || autoNow;
  const bitSaat    = e.parameter.bit_saat    || '';
  const teknikerId = e.parameter.tekniker_id || '';
  const teknikerAd = e.parameter.tekniker_ad || '';
  const yeniDurum  = bitSaat ? 'Aktif' : 'Arızalı';

  arizaSheet.appendRow([
    new Date().toLocaleString('tr-TR'),
    teknikerId, teknikerAd, makineNo,
    arizaTipi, sorun, cozum, basSaat, bitSaat,
    yeniDurum === 'Aktif' ? 'Kapalı (Çözüldü)' : 'Açık'
  ]);

  setMachineDurum(ss, makineNo, yeniDurum, arizaTipi, sorun);

  return jsonp(cb, { result: 'ok' });
}

// ================================================================
// ACTION: setMachineKasa
// ================================================================

function setMachineKasa(cb, e) {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const makineNo = e.parameter.makine_no || '';
  const kasa     = e.parameter.kasa      || '';
  const tekniker = e.parameter.tekniker  || '';

  _updateMakineKasa(ss, makineNo, kasa, tekniker);
  return jsonp(cb, { result: 'ok' });
}

// ================================================================
// ACTION: toggleMachine
// ================================================================

function toggleMachine(cb, e) {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const makineNo = e.parameter.makine_no   || '';
  const durum    = e.parameter.durum       || 'Aktif';
  const neden    = e.parameter.neden       || '';
  const tekId    = e.parameter.tekniker_id || '';
  const tekAd    = e.parameter.tekniker_ad || '';

  setMachineDurum(ss, makineNo, durum, neden, '');

  let logSheet = ss.getSheetByName('Arıza Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('Arıza Log');
    logSheet.appendRow(['Kayıt Zamanı','Tekniker ID','Tekniker Ad','Makine No','Arıza Tipi','Sorun','Çözüm','Başlangıç Saati','Bitiş Saati','Durum']);
    logSheet.getRange('A1:J1').setFontWeight('bold').setBackground('#dc2626').setFontColor('#ffffff');
    logSheet.setFrozenRows(1);
  }

  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  if (durum === 'Kapalı') {
    logSheet.appendRow([new Date().toLocaleString('tr-TR'), tekId, tekAd, makineNo, neden, neden, '', nowStr, '', 'Açık']);
  } else if (durum === 'Aktif') {
    logSheet.appendRow([new Date().toLocaleString('tr-TR'), tekId, tekAd, makineNo, 'Makine Açıldı', '', '', '', nowStr, 'Kapalı (Çözüldü)']);
  }

  return jsonp(cb, { result: 'ok', makine: makineNo, durum });
}

// ================================================================
// ACTION: getSettings
// ================================================================

function getSettings(cb) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const props   = PropertiesService.getScriptProperties();
  const ayarlar = ss.getSheetByName('Ayarlar');

  const vardiyaTolerans = Number(props.getProperty('vardiyaTolerans')) || 120;
  const otoVardiya      = props.getProperty('otoVardiya') !== 'false';
  const yedeklemeSaat   = Number(props.getProperty('yedeklemeSaat')) || 9;

  let maxFireLimit = Number(props.getProperty('maxFireLimit')) || 0;
  if (!maxFireLimit && ayarlar) {
    maxFireLimit = Number(ayarlar.getRange('F2').getValue()) || 200;
  }

  let arizaTipleri = [];
  if (ayarlar) {
    arizaTipleri = ayarlar.getRange('G2:G20').getValues().flat().map(v => String(v).trim()).filter(v => v);
  }
  if (!arizaTipleri.length) {
    arizaTipleri = ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Planlı Bakım', 'Temizlik', 'Diğer'];
  }

  let kasaMinMax = {};
  const kasaMinMaxStr = props.getProperty('kasaMinMax');
  if (kasaMinMaxStr) {
    try { kasaMinMax = JSON.parse(kasaMinMaxStr); } catch(ex) {}
  }

  return jsonp(cb, { vardiyaTolerans, otoVardiya, yedeklemeSaat, maxFireLimit, arizaTipleri, kasaMinMax, serverTime: new Date().getTime() });
}

// ================================================================
// ACTION: saveSettings
// ================================================================

function saveSettings(cb, e) {
  const props   = PropertiesService.getScriptProperties();
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const ayarlar = ss.getSheetByName('Ayarlar');

  const {
    vardiyaTolerans: vT, otoVardiya: oV, yedeklemeSaat: yS,
    maxFireLimit: mFL, arizaTipleri: aT, kasaMinMax: kMM
  } = e.parameter;

  if (vT  !== undefined) props.setProperty('vardiyaTolerans', String(Math.max(0, Number(vT) || 120)));
  if (oV  !== undefined) props.setProperty('otoVardiya', oV === 'false' ? 'false' : 'true');

  if (mFL !== undefined) {
    props.setProperty('maxFireLimit', String(Number(mFL) || 200));
    if (ayarlar) ayarlar.getRange('F2').setValue(Number(mFL) || 200);
  }

  if (yS !== undefined) {
    const saat = Number(yS);
    if (!isNaN(saat) && saat >= 0 && saat <= 23) {
      props.setProperty('yedeklemeSaat', String(saat));
      ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dailyExport').forEach(t => ScriptApp.deleteTrigger(t));
      ScriptApp.newTrigger('dailyExport').timeBased().everyDays(1).atHour(saat).create();
    }
  }

  if (aT !== undefined && ayarlar) {
    let tipleri = [];
    try { tipleri = JSON.parse(aT); } catch(ex) {}
    ayarlar.getRange('G2:G30').clearContent();
    if (tipleri.length) {
      ayarlar.getRange(2, 7, tipleri.length, 1).setValues(tipleri.map(t => [t]));
    }
  }

  if (kMM !== undefined) {
    try { JSON.parse(kMM); props.setProperty('kasaMinMax', kMM); } catch(ex) {}
  }

  return jsonp(cb, { result: 'ok' });
}

// ================================================================
// ACTION: getPersonel / addPersonel / updatePersonel / changePassword
// ================================================================

function getPersonel(cb) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _getOrCreatePersonelSheet(ss);
  const list  = [];

  if (sheet.getLastRow() > 1) {
    const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    const disp = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues();
    for (let i = 0; i < vals.length; i++) {
      const id    = String(disp[i][0] || '').trim();
      const ad    = String(vals[i][1] || '').trim();
      const rol   = String(vals[i][3] || '').trim() || 'Operatör';
      const durum = String(vals[i][4] || '').trim() || 'Aktif';
      if (id && ad) list.push({ id, ad, rol, durum });
    }
  }

  return jsonp(cb, { personel: list, serverTime: new Date().getTime() });
}

function addPersonel(cb, e) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _getOrCreatePersonelSheet(ss);
  const ad    = String(e.parameter.ad    || '').trim();
  const sifre = String(e.parameter.sifre || '').trim();
  const rol   = String(e.parameter.rol   || 'Operatör').trim();

  if (!ad || !sifre) return jsonp(cb, { error: 'Ad ve şifre zorunlu' });

  let maxId = 100;
  if (sheet.getLastRow() > 1) {
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat().map(v => parseInt(v) || 0);
    maxId = Math.max(maxId, ...ids);
  }

  const yeniId = String(maxId + 1);
  const row    = sheet.getLastRow() + 1;
  sheet.getRange(row, 1).setNumberFormat('@').setValue(yeniId);
  sheet.getRange(row, 2).setValue(ad);
  sheet.getRange(row, 3).setNumberFormat('@').setValue(sifre);
  sheet.getRange(row, 4).setValue(rol);
  sheet.getRange(row, 5).setValue('Aktif');

  return jsonp(cb, { result: 'ok', id: yeniId });
}

function updatePersonel(cb, e) {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const sheet    = _getOrCreatePersonelSheet(ss);
  const hedefId  = String(e.parameter.hedef_id || '').trim();
  const yeniDurum = e.parameter.durum;
  const yeniRol   = e.parameter.rol;

  if (!hedefId) return jsonp(cb, { error: 'Hedef ID gerekli' });
  if (sheet.getLastRow() < 2) return jsonp(cb, { error: 'Personel bulunamadı' });

  const disp = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < disp.length; i++) {
    if (String(disp[i][0]).trim() === hedefId) {
      if (yeniDurum !== undefined) sheet.getRange(i + 2, 5).setValue(yeniDurum);
      if (yeniRol   !== undefined) sheet.getRange(i + 2, 4).setValue(yeniRol);
      return jsonp(cb, { result: 'ok' });
    }
  }

  return jsonp(cb, { error: 'Bulunamadı: ' + hedefId });
}

function changePassword(cb, e) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const sheet     = _getOrCreatePersonelSheet(ss);
  const hedefId   = String(e.parameter.hedef_id   || '').trim();
  const eskiSifre = String(e.parameter.eski_sifre || '').trim();
  const yeniSifre = String(e.parameter.yeni_sifre || '').trim();

  if (!hedefId || !yeniSifre) return jsonp(cb, { error: 'Eksik parametre' });
  if (sheet.getLastRow() < 2) return jsonp(cb, { error: 'Personel bulunamadı' });

  const disp = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getDisplayValues();
  for (let i = 0; i < disp.length; i++) {
    if (String(disp[i][0]).trim() === hedefId) {
      if (String(disp[i][2]).trim() !== eskiSifre) {
        return jsonp(cb, { error: 'Mevcut şifre hatalı' });
      }
      sheet.getRange(i + 2, 3).setNumberFormat('@').setValue(yeniSifre);
      return jsonp(cb, { result: 'ok' });
    }
  }

  return jsonp(cb, { error: 'Personel bulunamadı' });
}

// ================================================================
// YARDIMCI: Makine Durumları
// ================================================================

function buildMachineStatuses(ss) {
  const statuses = {};
  for (let i = 1; i <= 12; i++) statuses['Enjeksiyon ' + i] = { durum: 'Aktif', sonAriza: null };

  const durSheet = ss.getSheetByName('Makine Durumları');
  if (durSheet && durSheet.getLastRow() > 1) {
    durSheet.getRange(2, 1, durSheet.getLastRow() - 1, 5).getValues().forEach(row => {
      const makine = String(row[0]).trim();
      const durum  = String(row[1]).trim();
      if (!statuses[makine]) return;
      statuses[makine].durum          = durum;
      statuses[makine].sonGuncelleme  = String(row[2]).trim();
      if (durum === 'Arızalı') {
        statuses[makine].sonAriza = { tip: String(row[4]).trim(), sorun: String(row[3]).trim() };
      }
    });
  }

  return statuses;
}

// ================================================================
// YARDIMCI: Canlı İzleme verisini oku (getMonitorData için)
// ================================================================

function buildCanliData(ss) {
  const canliData  = {};
  const canliSheet = ss.getSheetByName('Canlı İzleme');
  if (!canliSheet || canliSheet.getLastRow() < 3) return canliData;

  const readRows  = Math.min(canliSheet.getLastRow(), 40);
  const allCanli  = canliSheet.getRange(1, 1, readRows, 12).getValues();
  const _BASES    = { SABAH: 2, AKSAM: 15, GECE: 28 };
  const nowMs     = new Date().getTime();

  for (let enjIdx = 1; enjIdx <= 12; enjIdx++) {
    const makineNo = 'Enjeksiyon ' + enjIdx;
    canliData[makineNo] = {};
    let bestEntry = null, bestTs = 0;

    for (const [vard, base] of Object.entries(_BASES)) {
      const ri = base + enjIdx - 1;
      if (ri >= allCanli.length) continue;
      const row      = allCanli[ri];
      const rowTarih = String(row[2] || '').trim();
      const rowSaat  = String(row[10] || '').trim();
      if (!rowTarih) continue;

      let ts = 0;
      try {
        const p = rowTarih.split('-'), hm = (rowSaat || '00:00').split(':');
        ts = new Date(+p[0], +p[1]-1, +p[2], +hm[0]||0, +hm[1]||0).getTime();
      } catch(ex) {}

      if (ts > 0 && (nowMs - ts) < 86400000 && ts > bestTs) {
        bestTs = ts;
        bestEntry = {
          operatör:     String(row[1] || '').trim(),
          tarih:        rowTarih,
          kasa:         String(row[3] || '').trim(),
          cevrim:       String(row[4] || '').trim(),
          agirlik:      String(row[5] || '').trim(),
          uretim:       String(row[8] || '').trim(),
          fire:         String(row[9] || '').trim(),
          vardiya:      vard,
          saat:         rowSaat,
          gercekCevrim: String(row[11] || '').trim(),
        };
      }
    }
    if (bestEntry) canliData[makineNo] = bestEntry;
  }

  return canliData;
}

// ================================================================
// YARDIMCI: Canlı İzleme verisini oku (getMachineStatuses için)
// ================================================================

function buildCanliDataForMachineStatus(ss) {
  const machineData = {};
  const canliSheet  = ss.getSheetByName('Canlı İzleme');
  if (!canliSheet || canliSheet.getLastRow() < 3) return machineData;

  const readRows = Math.min(canliSheet.getLastRow(), 40);
  const allCanli = canliSheet.getRange(1, 1, readRows, 12).getValues();
  const _BASES   = { SABAH: 2, AKSAM: 15, GECE: 28 };
  const nowMs    = new Date().getTime();

  for (let i = 1; i <= 12; i++) {
    const makineNo  = 'Enjeksiyon ' + i;
    let bestEntry = null, bestTs = 0;

    for (const [vard, base] of Object.entries(_BASES)) {
      const ri = base + i - 1;
      if (ri >= allCanli.length) continue;
      const row     = allCanli[ri];
      const opAd    = String(row[1] || '').trim();
      const rowTarih = String(row[2] || '').trim();
      const rowSaat  = String(row[10] || '').trim();
      if (!opAd || !rowTarih) continue;

      let ts = 0;
      try {
        const p = rowTarih.split('-'), hm = (rowSaat || '00:00').split(':');
        ts = new Date(+p[0], +p[1]-1, +p[2], +hm[0]||0, +hm[1]||0).getTime();
      } catch(ex) {}

      if (ts > 0 && (nowMs - ts) < 86400000 && ts > bestTs) {
        bestTs = ts;
        bestEntry = {
          tarih:    rowTarih,
          operatör: opAd,
          kasa:     String(row[3] || '').trim(),
          cevrim:   String(row[4] || '').trim(),
          agirlik:  String(row[5] || '').trim(),
          uretim:   String(row[8] || '').trim(),
          fire:     String(row[9] || '').trim(),
          saat:     rowSaat,
        };
      }
    }
    if (bestEntry) machineData[makineNo] = bestEntry;
  }

  return machineData;
}

// ================================================================
// YARDIMCI: Atanan kasaları oku (Makine Kasa sheet)
// ================================================================

function readAtananKasalar(ss) {
  const atananKasalar = {};
  const kasaSheet = ss.getSheetByName('Makine Kasa');
  if (kasaSheet && kasaSheet.getLastRow() > 1) {
    kasaSheet.getRange(2, 1, kasaSheet.getLastRow() - 1, 2).getValues().forEach(row => {
      const m = String(row[0]).trim();
      const k = String(row[1]).trim();
      if (m && k) atananKasalar[m] = k;
    });
  }
  return atananKasalar;
}

// ================================================================
// YARDIMCI: YENİ — Atamalar sheet'inden operatör→makine listesi oku
// ================================================================

function readAtananMakineler(ss, vardiya) {
  // Returns: { "101": ["Enjeksiyon 3"], "102": ["Enjeksiyon 7", "Enjeksiyon 8"] }
  const result = {};
  const sheet  = ss.getSheetByName('Atamalar');
  if (!sheet || sheet.getLastRow() < 2) return result;

  const curVardiya = vardiya || _getCurrentVardiya();
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues().forEach(row => {
    const makine     = String(row[0]).trim();
    const rowVardiya = String(row[1]).trim();
    const opId       = String(row[2]).trim();  // col 3 = Operatör ID
    if (!makine || !opId) return;
    if (rowVardiya !== curVardiya) return;  // Vardiya filtresi
    if (!result[opId]) result[opId] = [];
    result[opId].push(makine);
  });

  return result;
}

// ================================================================
// YARDIMCI: YENİ — Belirli bir kullanıcının atanan makineleri
// ================================================================

function readAtananMakinelerForUser(ss, kullaniciId, vardiya) {
  // Returns: ["Enjeksiyon 3", "Enjeksiyon 7"]
  const result = [];
  const sheet  = ss.getSheetByName('Atamalar');
  if (!sheet || sheet.getLastRow() < 2) return result;

  const curVardiya = vardiya || _getCurrentVardiya();
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues().forEach(row => {
    const makine     = String(row[0]).trim();
    const rowVardiya = String(row[1]).trim();
    const opId       = String(row[2]).trim();  // col 3 = Operatör ID
    if (makine && opId === String(kullaniciId).trim() && rowVardiya === curVardiya) {
      result.push(makine);
    }
  });

  return result;
}

// ================================================================
// YARDIMCI: YENİ — Makine Kasa sheet'ini güncelle (iç kullanım)
// ================================================================

function _updateMakineKasa(ss, makineNo, kasa, tekniker) {
  let sheet = ss.getSheetByName('Makine Kasa');
  if (!sheet) {
    sheet = ss.insertSheet('Makine Kasa');
    sheet.appendRow(['Makine No', 'Kasa Ebatı', 'Son Güncelleme', 'Güncelleyen']);
    sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    [120, 120, 140, 140].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  }

  const now     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === makineNo) {
        sheet.getRange(i + 2, 2, 1, 3).setValues([[kasa, now, tekniker]]);
        return;
      }
    }
  }
  sheet.appendRow([makineNo, kasa, now, tekniker]);
}

// ================================================================
// YARDIMCI FONKSIYONLAR
// ================================================================

// Sunucu saatine göre mevcut vardiyayı döndürür
function _getCurrentVardiya() {
  const h = new Date().getHours();
  if (h >= 9 && h < 17) return 'SABAH';
  if (h >= 17 || h === 0) return 'AKSAM';
  return 'GECE';  // 01:00-08:59
}

function vardiyaBaslangicTarih(tarih, saat, vardiya) {
  if (vardiya !== 'AKSAM' || !saat) return tarih;
  const hour = parseInt(saat.split(':')[0]);
  if (hour >= 0 && hour < 2) {
    const d = new Date(tarih);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  return tarih;
}

function yazBaslik(sheet) {
  const headers = [
    'Kayıt Zamanı','Vardiya Tarihi','Ad Soyad','Vardiya','Ölçüm No','Enj Sayısı','Ölçüm Saati',
    'Enj1-No','Enj1-Kasa','Enj1-Çevrim(sn)','Enj1-Ağırlık(gr)','Enj1-SayaçBaş','Enj1-SayaçBit','Enj1-Üretim','Enj1-Fire',
    'Enj2-No','Enj2-Kasa','Enj2-Çevrim(sn)','Enj2-Ağırlık(gr)','Enj2-SayaçBaş','Enj2-SayaçBit','Enj2-Üretim','Enj2-Fire',
    'Onay'
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function jsonp(callback, obj) {
  const body = callback ? callback + '(' + JSON.stringify(obj) + ')' : JSON.stringify(obj);
  return ContentService.createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function getLockedMachines(ss) {
  const locked = {};

  const lockSheet = ss.getSheetByName('Machine Locks');
  if (lockSheet && lockSheet.getLastRow() > 1) {
    lockSheet.getRange(2, 1, lockSheet.getLastRow() - 1, 5).getValues().forEach(row => {
      if (String(row[4]).trim() === 'LOCKED') locked[String(row[0]).trim()] = true;
    });
  }

  const durSheet = ss.getSheetByName('Makine Durumları');
  if (durSheet && durSheet.getLastRow() > 1) {
    durSheet.getRange(2, 1, durSheet.getLastRow() - 1, 2).getValues().forEach(row => {
      if (String(row[1]).trim() === 'Arızalı') locked[String(row[0]).trim()] = true;
    });
  }

  return locked;
}

function setMachineDurum(ss, makineNo, durum, tip, sorun) {
  let sheet = ss.getSheetByName('Makine Durumları');
  if (!sheet) {
    sheet = ss.insertSheet('Makine Durumları');
    sheet.appendRow(['Makine No', 'Durum', 'Son Güncelleme', 'Sorun', 'Arıza Tipi']);
    sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    for (let i = 1; i <= 12; i++) sheet.appendRow(['Enjeksiyon ' + i, 'Aktif', '', '', '']);
  }

  const now     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === String(makineNo).trim()) {
        sheet.getRange(i + 2, 2, 1, 4).setValues([[durum, now, sorun || '', tip || '']]);
        return;
      }
    }
  }
  sheet.appendRow([makineNo, durum, now, sorun || '', tip || '']);
}

function lockMachine(ss, machineNo, tarih, vardiya, adSoyad) {
  let lockSheet = ss.getSheetByName('Machine Locks');
  if (!lockSheet) {
    lockSheet = ss.insertSheet('Machine Locks');
    lockSheet.appendRow(['Makine No', 'Tarih', 'Vardiya', 'Operatör', 'Durum']);
    lockSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#dc2626').setFontColor('#ffffff');
    lockSheet.setFrozenRows(1);
    [100, 100, 100, 140, 100].forEach((w, i) => lockSheet.setColumnWidth(i + 1, w));
  }

  const lastRow = lockSheet.getLastRow();
  if (lastRow > 1) {
    const vals = lockSheet.getRange(2, 1, lastRow - 1, 5).getValues();
    for (const row of vals) {
      if (String(row[0]).trim() === String(machineNo).trim()) return;
    }
  }
  lockSheet.appendRow([machineNo, tarih, vardiya, adSoyad, 'LOCKED']);
}

// ================================================================
// CANLI İZLEME
// ================================================================

var _VARDIYA_BASE = { 'SABAH': 2, 'AKSAM': 15, 'GECE': 28 };
var _VARDIYA_BG   = { 'SABAH': '#fef9c3', 'AKSAM': '#dbeafe', 'GECE': '#f3e8ff' };
var _BOLUM_BG     = { 'SABAH': '#f59e0b', 'AKSAM': '#3b82f6', 'GECE': '#7c3aed' };

function updateCanliIzleme(enjNo, kasa, cevrim, agirlik, sayacBas, sayacBit, uretim, fire, tarih, vardiya, adSoyad) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Canlı İzleme');
  if (!sheet) sheet = ss.insertSheet('Canlı İzleme');

  const h1 = String(sheet.getRange(1, 1).getValue()).trim();
  const h7 = String(sheet.getRange(1, 7).getValue()).trim();
  if (h1 !== 'Makine' || h7 !== 'Başlangıç') {
    _setupCanlıBaslik(sheet);
  }

  const m = String(enjNo).match(/(\d+)\s*$/);
  if (!m) return;
  const enjIdx = parseInt(m[1]);
  if (enjIdx < 1 || enjIdx > 12) return;

  const base = _VARDIYA_BASE[vardiya];
  if (!base) return;
  const targetRow = base + enjIdx;

  const tz      = ss.getSpreadsheetTimeZone();
  const saatStr = Utilities.formatDate(new Date(), tz, 'HH:mm');

  const existing          = sheet.getRange(targetRow, 1, 1, 12).getValues()[0];
  const existingTarih     = String(existing[2] || '').trim();
  const existingBaslangic = Number(existing[6]) || 0;

  const sameDay   = existingTarih === String(tarih).trim() && existingBaslangic > 0;
  const baslangic = sameDay ? existingBaslangic : (parseInt(sayacBas) || 0);
  const bitis     = parseInt(sayacBit) || 0;

  const uretimCalc   = Math.max(0, bitis - baslangic);
  const gercekCevrim = uretimCalc > 0 ? Math.round(28800 / uretimCalc) : '';
  const fireVal      = parseInt(fire) || 0;

  const bg    = _VARDIYA_BG[vardiya] || '#f8fafc';
  const range = sheet.getRange(targetRow, 1, 1, 12);
  range.setValues([[
    'Enjeksiyon ' + enjIdx, adSoyad || '', tarih || '', kasa || '',
    Number(cevrim) || '', Number(agirlik) || '',
    baslangic, bitis, uretimCalc, fireVal, saatStr, gercekCevrim,
  ]]);
  range.setBackground(bg).setVerticalAlignment('middle').setFontSize(10).setHorizontalAlignment('center');
  sheet.getRange(targetRow, 1).setFontWeight('bold').setHorizontalAlignment('left');
  sheet.getRange(targetRow, 2).setFontWeight('bold').setHorizontalAlignment('left');
  sheet.getRange(targetRow, 7, 1, 2).setNumberFormat('#,##0');
}

function _setupCanlıBaslik(sheet) {
  sheet.clearContents();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const COLS    = 12;
  const headers = ['Makine', 'Ad Soyad', 'Tarih', 'Kasa', 'Çevrim(sn)', 'Ağırlık(gr)', 'Başlangıç', 'Bitiş', 'Üretim', 'Fire', 'Saat', 'Gerçek Çevrim(sn)'];
  const h = sheet.getRange(1, 1, 1, COLS);
  h.setValues([headers]);
  h.setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff').setHorizontalAlignment('center').setFontSize(11);
  sheet.setFrozenRows(1);

  const sections = [
    { name: 'SABAH', base: 2,  bg: '#f59e0b', rowBg: '#fef9c3' },
    { name: 'AKSAM', base: 15, bg: '#3b82f6', rowBg: '#dbeafe' },
    { name: 'GECE',  base: 28, bg: '#7c3aed', rowBg: '#f3e8ff' },
  ];

  for (const sec of sections) {
    const hdrRange = sheet.getRange(sec.base, 1, 1, COLS);
    hdrRange.merge();
    hdrRange.setValue('—— ' + sec.name + ' ——');
    hdrRange.setBackground(sec.bg).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setFontSize(12);

    for (let i = 1; i <= 12; i++) {
      const r = sec.base + i;
      sheet.getRange(r, 1, 1, COLS).setBackground(sec.rowBg);
      sheet.getRange(r, 1).setValue('Enjeksiyon ' + i).setFontWeight('bold').setHorizontalAlignment('left');
    }
  }

  [120, 140, 100, 100, 75, 75, 90, 90, 70, 60, 55, 115].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.getRange('G:I').setNumberFormat('#,##0');
}

// ================================================================
// ÜRETİM KAYDI VE GÜNLÜK ÖZET
// ================================================================

function appendUretimKaydi(ss, d) {
  if (!d.makineNo || d.makineNo === '00') return;
  let sheet = ss.getSheetByName('Üretim Kaydı');
  if (!sheet) {
    sheet = ss.insertSheet('Üretim Kaydı');
    _setupUretimKaydi(sheet);
  } else if (sheet.getLastRow() === 0 || String(sheet.getRange(1, 1).getValue()).trim() !== 'Kayıt Zamanı') {
    _setupUretimKaydi(sheet);
  }

  sheet.appendRow([
    new Date().toLocaleString('tr-TR'),
    d.tarih    || '', d.vardiya  || '', d.saat     || '',
    d.adsoyad  || '', d.olcumNo  || '', d.makineNo || '', d.kasa     || '',
    d.cevrim  !== undefined ? (Number(d.cevrim)   || 0) : '',
    d.agirlik !== undefined ? (Number(d.agirlik)  || 0) : '',
    d.sayacBas !== undefined ? (Number(d.sayacBas) || 0) : '',
    d.sayacBit !== undefined ? (Number(d.sayacBit) || 0) : '',
    d.uretim  !== undefined ? (Number(d.uretim)   || 0) : '',
    d.fire    !== undefined ? (Number(d.fire)     || 0) : '',
  ]);
}

function _setupUretimKaydi(sheet) {
  const headers = ['Kayıt Zamanı', 'Vardiya Tarihi', 'Vardiya', 'Ölçüm Saati', 'Ad Soyad', 'Ölçüm No', 'Makine No', 'Kasa', 'Çevrim(sn)', 'Ağırlık(gr)', 'Sayaç Baş', 'Sayaç Bit', 'Üretim', 'Fire'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff').setHorizontalAlignment('center').setFontSize(11);
  sheet.setFrozenRows(1);
  [140, 110, 80, 90, 140, 70, 130, 100, 90, 90, 90, 90, 80, 70].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.getRange('I:N').setNumberFormat('#,##0');
}

function appendOrUpdateGunlukOzet(ss, d) {
  if (!d.makineNo || d.makineNo === '00') return;
  let sheet = ss.getSheetByName('Günlük Özet');
  if (!sheet) {
    sheet = ss.insertSheet('Günlük Özet');
    _setupGunlukOzetBaslik(sheet);
  } else if (sheet.getLastRow() === 0 || String(sheet.getRange(1, 1).getValue()).trim() !== 'Tarih') {
    _setupGunlukOzetBaslik(sheet);
  }

  const bitis      = parseInt(d.sayacBit) || 0;
  const tarihStr   = String(d.tarih    || '').trim();
  const vardiyaStr = String(d.vardiya  || '').trim();
  const makineStr  = String(d.makineNo || '').trim();

  let foundRow = -1, existingBaslangic = 0;
  if (sheet.getLastRow() > 1) {
    const keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]).trim() === tarihStr &&
          String(keys[i][1]).trim() === vardiyaStr &&
          String(keys[i][2]).trim() === makineStr) {
        foundRow = i + 2;
        existingBaslangic = Number(sheet.getRange(foundRow, 8).getValue()) || 0;
        break;
      }
    }
  }

  const baslangic    = (foundRow > 0 && existingBaslangic > 0) ? existingBaslangic : (parseInt(d.sayacBas) || 0);
  const uretimCalc   = Math.max(0, bitis - baslangic);
  const gercekCevrim = uretimCalc > 0 ? Math.round(28800 / uretimCalc) : '';
  const fireVal      = parseInt(d.fire) || 0;
  const saatStr      = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'HH:mm');

  const rowData = [
    tarihStr, vardiyaStr, makineStr, d.adsoyad || '', d.kasa || '',
    Number(d.cevrim) || '', Number(d.agirlik) || '',
    baslangic, bitis, uretimCalc, fireVal, saatStr, gercekCevrim,
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, 13).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function _setupGunlukOzetBaslik(sheet) {
  const headers = ['Tarih', 'Vardiya', 'Makine', 'Ad Soyad', 'Kasa', 'Çevrim(sn)', 'Ağırlık(gr)', 'Başlangıç', 'Bitiş', 'Üretim', 'Fire', 'Saat', 'Gerçek Çevrim(sn)'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff').setHorizontalAlignment('center').setFontSize(11);
  sheet.setFrozenRows(1);
  [100, 80, 130, 140, 100, 75, 75, 90, 90, 70, 60, 55, 115].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.getRange('H:J').setNumberFormat('#,##0');
}

// ================================================================
// PERSONEL YARDIMCISI
// ================================================================

function _getOrCreatePersonelSheet(ss) {
  let sheet = ss.getSheetByName('Personel');
  if (sheet) return sheet;

  sheet = ss.insertSheet('Personel');
  sheet.appendRow(['ID', 'Ad Soyad', 'Şifre', 'Rol', 'Durum']);
  sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.getRange('A:A').setNumberFormat('@');
  sheet.getRange('C:C').setNumberFormat('@');
  [80, 160, 100, 100, 80].forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // Mevcut Ayarlar'dan personeli aktar
  const ayarlar = ss.getSheetByName('Ayarlar');
  if (ayarlar && ayarlar.getLastRow() > 1) {
    const vals = ayarlar.getRange('A2:E50').getValues();
    const disp = ayarlar.getRange('A2:E50').getDisplayValues();
    for (let i = 0; i < vals.length; i++) {
      const ad    = String(vals[i][0] || '').trim();
      const id    = String(disp[i][4] || '').trim();
      const sifre = String(disp[i][2] || '').trim();
      if (ad && id) {
        const row = sheet.getLastRow() + 1;
        sheet.getRange(row, 1).setNumberFormat('@').setValue(id);
        sheet.getRange(row, 2).setValue(ad);
        sheet.getRange(row, 3).setNumberFormat('@').setValue(sifre);
        sheet.getRange(row, 4).setValue('Operatör');
        sheet.getRange(row, 5).setValue('Aktif');
      }
    }
  }

  return sheet;
}

// ================================================================
// YEDEKLEME
// ================================================================

function dailyExport() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const tz    = ss.getSpreadsheetTimeZone();
  const tarih = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const ad    = 'Ersan Plastik — ' + tarih + '.xlsx';
  const url   = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  const token = ScriptApp.getOAuthToken();
  const resp  = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });

  if (resp.getResponseCode() !== 200) throw new Error('Export HTTP ' + resp.getResponseCode());

  const blob = resp.getBlob().setName(ad);
  const it   = DriveApp.getFoldersByName('Ersan Plastik Yedekleri');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('Ersan Plastik Yedekleri');

  const existingIt = folder.getFilesByName(ad);
  while (existingIt.hasNext()) existingIt.next().setTrashed(true);
  folder.createFile(blob);

  PropertiesService.getScriptProperties().setProperty('lastExport', tarih);
}

function setupDailyExport() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'dailyExport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyExport').timeBased().everyDays(1).atHour(7).create();
}

function monthlyBackupAndCleanup() {
  const ss           = SpreadsheetApp.getActiveSpreadsheet();
  const verilerSheet = ss.getSheetByName('Veriler');
  if (!verilerSheet || verilerSheet.getLastRow() < 2) return 'Veri Yok';

  const simdi    = new Date();
  const gecenAy  = new Date(simdi.getFullYear(), simdi.getMonth() - 1, 1);
  const ayAdlari = ['Ocak','Subat','Mart','Nisan','Mayis','Haziran','Temmuz','Agustos','Eylul','Ekim','Kasim','Aralik'];
  const dosyaAdi = gecenAy.getFullYear() + '_' + ayAdlari[gecenAy.getMonth()] + '_Enjeksiyon_Kontrol.xlsx';

  const url   = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  const token = ScriptApp.getOAuthToken();
  const resp  = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });

  if (resp.getResponseCode() === 200) {
    const it     = DriveApp.getFoldersByName('Ersan Plastik Arşivleri');
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder('Ersan Plastik Arşivleri');
    folder.createFile(resp.getBlob().setName(dosyaAdi));

    const headerRow = verilerSheet.getRange(1, 1, 1, verilerSheet.getLastColumn()).getValues()[0];
    verilerSheet.clear();
    verilerSheet.appendRow(headerRow);
    verilerSheet.getRange(1, 1, 1, headerRow.length)
      .setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
    verilerSheet.setFrozenRows(1);

    return 'Yedeklendi ve Temizlendi: ' + dosyaAdi;
  }
  return 'Hata Oluştu';
}

// ================================================================
// SİSTEM KURULUMU (Manuel Çalıştır)
// ================================================================

function gercektenTemizleVeKur() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const anaSayfalar = [
    { ad: 'Veriler',          h: ['Kayıt Zamanı','Vardiya Tarihi','Ad Soyad','Vardiya','Ölçüm No','Enj Sayısı','Ölçüm Saati','Enj1-No','Enj1-Kasa','Enj1-Çevrim(sn)','Enj1-Ağırlık(gr)','Enj1-SayaçBaş','Enj1-SayaçBit','Enj1-Üretim','Enj1-Fire','Enj2-No','Enj2-Kasa','Enj2-Çevrim(sn)','Enj2-Ağırlık(gr)','Enj2-SayaçBaş','Enj2-SayaçBit','Enj2-Üretim','Enj2-Fire','Onay'], r: '#2563eb' },
    { ad: 'Canlı İzleme',     h: [], r: '#1e3a8a' },
    { ad: 'Personel',         h: ['ID', 'Ad Soyad', 'Şifre', 'Rol', 'Durum'], r: '#2563eb' },
    { ad: 'Ayarlar',          h: ['Personel Adı', 'Kasa Ebatları', 'Şifre', 'Limit', 'ID', 'Max Fire', 'Arıza Tipleri'], r: '#4b5563' },
    { ad: 'Makine Durumları', h: ['Makine No', 'Durum', 'Son Güncelleme', 'Sorun', 'Arıza Tipi'], r: '#1e3a8a' },
    { ad: 'Arıza Log',        h: ['Kayıt Zamanı','Tekniker ID','Tekniker Ad','Makine No','Arıza Tipi','Sorun','Çözüm','Başlangıç Saati','Bitiş Saati','Durum'], r: '#dc2626' },
    { ad: 'Fire Log',         h: ['Kayıt Zamanı', 'Vardiya Tarihi', 'Kullanıcı ID', 'Ad Soyad', 'Vardiya', 'Makine No', 'Eklenen Fire', 'Ölçüm Saati'], r: '#ea580c' },
    { ad: 'Günlük Özet',      h: ['Tarih', 'Vardiya', 'Makine', 'Ad Soyad', 'Kasa', 'Çevrim(sn)', 'Ağırlık(gr)', 'Başlangıç', 'Bitiş', 'Üretim', 'Fire', 'Saat', 'Gerçek Çevrim(sn)'], r: '#0f766e' },
    { ad: 'Üretim Kaydı',     h: ['Kayıt Zamanı', 'Vardiya Tarihi', 'Vardiya', 'Ölçüm Saati', 'Ad Soyad', 'Ölçüm No', 'Makine No', 'Kasa', 'Çevrim(sn)', 'Ağırlık(gr)', 'Sayaç Baş', 'Sayaç Bit', 'Üretim', 'Fire'], r: '#0f766e' },
    { ad: 'Makine Kasa',      h: ['Makine No', 'Kasa Ebatı', 'Son Güncelleme', 'Güncelleyen'], r: '#2563eb' },
    { ad: 'Machine Locks',    h: ['Makine No', 'Tarih', 'Vardiya', 'Operatör', 'Durum'], r: '#dc2626' },
    { ad: 'Atamalar',         h: ['Makine No', 'Vardiya', 'Operatör ID', 'Operatör Adı', 'Kasa Ebatı', 'Çalışma Modu', 'Son Güncelleme'], r: '#1e3a8a' },
    { ad: 'Gecmis Arama',     h: [], r: '#0f766e' },
  ];

  const sayfaIsimleri = anaSayfalar.map(s => s.ad);

  anaSayfalar.forEach(s => {
    let sheet = ss.getSheetByName(s.ad);
    if (!sheet) {
      sheet = ss.insertSheet(s.ad);
      if (s.h.length > 0) {
        sheet.appendRow(s.h);
        sheet.getRange(1, 1, 1, s.h.length).setFontWeight('bold').setBackground(s.r).setFontColor('#ffffff');
        sheet.setFrozenRows(1);
      }
    }
  });

  ss.getSheets().forEach(sheet => {
    if (!sayfaIsimleri.includes(sheet.getName())) {
      ss.deleteSheet(sheet);
    }
  });

  const aramaSheet = ss.getSheetByName('Gecmis Arama');
  if (aramaSheet && aramaSheet.getRange('C2').getValue() === '') {
    aramaSheet.getRange('C2').setValue('Tarih Seçimi:');
    aramaSheet.getRange('C3').setValue('Vardiya (TÜMÜ):');
    aramaSheet.getRange('C4').setValue('Makine (TÜMÜ):');
    aramaSheet.getRange('A6').setFormula(
      '=IFERROR(QUERY(Veriler!A2:Y; "SELECT * WHERE A IS NOT NULL "' +
      ' & IF(C2=""; ""; " AND B = date \'" & TEXT(C2; "yyyy-mm-dd") & "\'")'  +
      ' & IF(OR(C3="TÜMÜ"; C3=""); ""; " AND D = \'" & C3 & "\'")'             +
      ' & IF(OR(C4="TÜMÜ"; C4=""); ""; " AND (H = \'" & C4 & "\' OR P = \'" & C4 & "\')")); "⚠️ Kayıt Bulunamadı")'
    );
  }

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'monthlyBackupAndCleanup')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('monthlyBackupAndCleanup').timeBased().onMonthDay(1).atHour(1).create();

  SpreadsheetApp.getUi().alert('✅ Sistem başarıyla sıfırlandı!');
}
