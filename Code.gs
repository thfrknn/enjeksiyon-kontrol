// ================================================================
// ENJEKSİYON KONTROL — Google Apps Script v12 (Fire Log Entegreli)
// CORS düzeltmesi: logFire artık doGet üzerinden JSONP ile çalışır.
// doPost'ta Content-Type başlığı sorunu nedeniyle no-cors istekler
// Google Apps Script'e ulaşamıyordu. Tüm okuma+yazma doGet'te.
// ================================================================

function doGet(e) {
  const cb = e.parameter.callback;

  // ============================================================
  // getLists: Ayarlar sekmesinden konfigürasyon verilerini çek
  // ============================================================
  if (e.parameter.action === 'getLists') {
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const ayarlar = ss.getSheetByName('Ayarlar');
    if (!ayarlar) return jsonp(cb, { error: 'Ayarlar sekmesi bulunamadı' });

    // Tek aralık ile oku — satır silinince indeks kayması olmaz
    const vals    = ayarlar.getRange('A2:F50').getValues();
    const display = ayarlar.getRange('A2:F50').getDisplayValues();

    const kullanicilar  = {};
    const kasaEbatlariS = [];
    const kasaLimitlari = {};
    let   uretimLimiti  = 0;
    const maxFireLimit  = Number(vals[0][5]) || 200;  // F2

    vals.forEach((row, i) => {
      const ad    = String(row[0] || '').trim();
      const kasa  = String(row[1] || '').trim();
      const sifre = String(display[i][2] || '').trim();
      const limit = Number(row[3]);
      const id    = String(display[i][4] || '').trim();
      if (ad && id) kullanicilar[id] = { name: ad, sifre };
      if (kasa) {
        kasaEbatlariS.push(kasa);
        if (limit > 0) {
          kasaLimitlari[kasa] = limit;
          if (!uretimLimiti) uretimLimiti = limit;
        }
      }
    });

    // Kilitli makineleri al
    const lockedMachines = getLockedMachines(ss);

    // Makine bazlı atanan kasaları da gönder
    const atananKasalar = {};
    const kasaSheetL = ss.getSheetByName('Makine Kasa');
    if (kasaSheetL && kasaSheetL.getLastRow() > 1) {
      const kv = kasaSheetL.getRange(2, 1, kasaSheetL.getLastRow() - 1, 2).getValues();
      for (const row of kv) {
        const m = String(row[0]).trim();
        const k = String(row[1]).trim();
        if (m && k) atananKasalar[m] = k;
      }
    }

    return jsonp(cb, {
      kasaEbatlari: kasaEbatlariS,
      kullanicilar,
      uretimLimiti,
      kasaLimitlari,
      maxFireLimit,
      atananKasalar,
      serverTime: new Date().getTime(),
      lockedMachines
    });
  }

  // ============================================================
  // getStatus: Operatörün bugünkü ölçüm durumunu sorgula
  // ============================================================
  if (e.parameter.action === 'getStatus') {
    const adsoyad = e.parameter.adsoyad;
    const tarih   = e.parameter.tarih;
    const vardiya = e.parameter.vardiya;
    const saat    = e.parameter.saat || '';

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Veriler');
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonp(cb, { olcumNo: 1, enj1: null, kasa1: null, enj2: null, kasa2: null, enjSayisi: 1 });
    }

    const normTarih = vardiyaBaslangicTarih(tarih, saat, vardiya);
    const lastRow   = sheet.getLastRow();
    const vals = sheet.getRange(2, 1, lastRow - 1, 24).getValues();
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    let olcumNo = 1, enj1 = null, kasa1 = null, enj2 = null, kasa2 = null, enjSayisi = 1;
    let sayacBit1 = null, sayacBit2 = null;
    let fireToplam1 = 0, fireToplam2 = 0;

    for (let i = 0; i < vals.length; i++) {
      const rowTarih = vals[i][1] instanceof Date
        ? Utilities.formatDate(vals[i][1], tz, 'yyyy-MM-dd')
        : String(vals[i][1]).trim();
      if (String(vals[i][2]).trim() === String(adsoyad).trim() &&
          rowTarih === String(normTarih).trim() &&
          String(vals[i][3]).trim() === String(vardiya).trim()) {
        olcumNo   = parseInt(vals[i][4]) + 1;
        enjSayisi = parseInt(vals[i][5]) || 1;
        enj1  = String(vals[i][7]);
        kasa1 = String(vals[i][8]);
        enj2  = String(vals[i][15]);
        kasa2 = String(vals[i][16]);

        const b1 = parseInt(vals[i][12]); if (!isNaN(b1)) sayacBit1 = b1;
        const b2 = parseInt(vals[i][20]); if (!isNaN(b2)) sayacBit2 = b2;

        const f1 = parseInt(vals[i][14]); if (!isNaN(f1)) fireToplam1 += f1;
        const f2 = parseInt(vals[i][22]); if (!isNaN(f2)) fireToplam2 += f2;
      }
    }
    const lockedMachines = getLockedMachines(ss);
    return jsonp(cb, { olcumNo, enj1, kasa1, enj2, kasa2, enjSayisi, sayacBit1, sayacBit2, fireToplam1, fireToplam2, lockedMachines });
  }
  if (e.parameter.action === 'getLastCounter') {
    const enjNo = e.parameter.enj_no;
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Veriler');
    if (!sheet || sheet.getLastRow() < 2) return jsonp(cb, { sayacBit: null });

    const lastRow = sheet.getLastRow();
    const vals = sheet.getRange(2, 1, lastRow - 1, 24).getValues();
    let sayacBit = null;

    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][7]).trim() === String(enjNo).trim()) {
        const b = parseInt(vals[i][12]);
        if (!isNaN(b)) sayacBit = b;
      }
      if (String(vals[i][15]).trim() === String(enjNo).trim()) {
        const b = parseInt(vals[i][20]);
        if (!isNaN(b)) sayacBit = b;
      }
    }

    // "Makine Kasa" sekmesinden meydancının atadığı kasayı da döndür
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

  // ============================================================
  // getFireTotal: Belirli makine+tarih+vardiya için sunucu toplamını döndür
  // ============================================================
  if (e.parameter.action === 'getFireTotal') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Fire Log');
    if (!sheet || sheet.getLastRow() < 2) return jsonp(cb, { total: 0 });

    const enjNo   = String(e.parameter.enj_no  || '').trim();
    const tarih   = String(e.parameter.tarih   || '').trim();
    const vardiya = String(e.parameter.vardiya || '').trim();

    const tz = ss.getSpreadsheetTimeZone();
    const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    let total = 0;
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

  // ============================================================
  // logFire: Anlık fire kaydını JSONP (GET) üzerinden yap
  // ============================================================
  // NEDEN GET?: fetch() mode:'no-cors' + Content-Type:application/json
  // kombinasyonu tarayıcıda "preflighted" isteğe dönüşür.
  // Google Apps Script OPTIONS isteğine yanıt vermediğinden
  // doPost hiç tetiklenmiyor. JSONP/GET bu sorunu tamamen ortadan kaldırır.
  if (e.parameter.action === 'logFire') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let logSheet = ss.getSheetByName('Fire Log');
    if (!logSheet) {
      logSheet = ss.insertSheet('Fire Log');
      logSheet.appendRow(['Kayıt Zamanı', 'Vardiya Tarihi', 'Kullanıcı ID', 'Ad Soyad', 'Vardiya', 'Makine No', 'Eklenen Fire', 'Ölçüm Saati']);
      const header = logSheet.getRange('A1:H1');
      header.setFontWeight('bold').setBackground('#ea580c').setFontColor('#ffffff');
      logSheet.setFrozenRows(1);
      logSheet.setColumnWidth(1, 160);
      logSheet.setColumnWidth(4, 140);
      logSheet.setColumnWidth(6, 140);
    }

    const fireTarih   = e.parameter.tarih        || new Date().toISOString().split('T')[0];
    const fireSaat    = e.parameter.olcum_saat   || '';
    const fireVardiya = e.parameter.vardiya       || '';
    const makineNo    = e.parameter.makine_no     || '';
    const kulId       = e.parameter.kullanici_id  || '';
    const adSoyad     = e.parameter.adsoyad       || '';
    const miktar      = Number(e.parameter.fire_miktari) || 0;

    const vardiyaTarih = (fireTarih && fireVardiya)
      ? vardiyaBaslangicTarih(fireTarih, fireSaat, fireVardiya)
      : fireTarih;

    logSheet.appendRow([
      new Date().toLocaleString('tr-TR'),
      vardiyaTarih,
      kulId,
      adSoyad,
      fireVardiya,
      makineNo,
      miktar,
      fireSaat
    ]);

    return jsonp(cb, { result: 'ok', miktar: miktar, makine: makineNo });
  }

  // ============================================================
  // exportNow: Anlık Google Drive yedeği al
  // ============================================================
  if (e.parameter.action === 'exportNow') {
    try {
      dailyExport();
      return jsonp(cb, { result: 'ok' });
    } catch (ex) {
      return jsonp(cb, { result: 'error', message: String(ex) });
    }
  }

  // ============================================================
  // submitForm: Ana ölçüm formunu JSONP (GET) üzerinden kaydet
  // ============================================================
  if (e.parameter.action === 'submitForm') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Veriler');
    if (!sheet) sheet = ss.insertSheet('Veriler');
    if (sheet.getLastRow() === 0) yazBaslik(sheet);

    const enjSayisi = parseInt(e.parameter.enjSayisi) || 1;
    const tarih     = e.parameter.tarih    || '';
    const saat      = e.parameter.olcum_saat || '';
    const vardiya   = e.parameter.vardiya   || '';
    const close     = e.parameter.close === 'true'; // Makine kapatma bayrağı

    const vardiyaTarih = vardiyaBaslangicTarih(tarih, saat, vardiya);

    const enj2No   = enjSayisi === 2 ? (e.parameter.enj2_no   || '') : '00';
    const kasa2    = enjSayisi === 2 ? (e.parameter.kasa2      || '') : '00';
    const cevrim2  = enjSayisi === 2 ? (close ? '0' : (e.parameter.cevrim2    || '')) : '00';
    const agirlik2 = enjSayisi === 2 ? (e.parameter.agirlik2   || '') : '00';
    const bas2     = enjSayisi === 2 ? (e.parameter.sayac_bas2 || '') : '00';
    const bit2     = enjSayisi === 2 ? (e.parameter.sayac_bit2 || '') : '00';
    const uretim2  = enjSayisi === 2 ? (e.parameter.uretim2    || '') : '00';
    const fire2    = enjSayisi === 2 ? (e.parameter.fire2      || '0') : '00';
    const olcumNo  = parseInt(e.parameter.olcumNo) || 1;
    const onaylandi = e.parameter.onaylandi === 'true';

    sheet.appendRow([
      new Date().toLocaleString('tr-TR'), // A - Kayıt Zamanı
      vardiyaTarih,                        // B - Vardiya Tarihi
      e.parameter.adsoyad    || '',        // C - Ad Soyad
      vardiya,                             // D - Vardiya
      olcumNo,                             // E - Ölçüm No
      enjSayisi,                           // F - Enj Sayısı
      saat,                                // G - Ölçüm Saati

      // Enjeksiyon 1
      e.parameter.enj1_no    || '',        // H
      e.parameter.kasa1      || '',        // I
      close ? '0' : (e.parameter.cevrim1    || ''),        // J - Çevrim (kapalıysa 0)
      e.parameter.agirlik1   || '',        // K
      e.parameter.sayac_bas1 || '',        // L
      e.parameter.sayac_bit1 || '',        // M
      e.parameter.uretim1    || '',        // N
      e.parameter.fire1      || '0',       // O - Kümülatif Fire

      // Enjeksiyon 2
      enj2No,   // P
      kasa2,    // Q
      cevrim2,  // R
      agirlik2, // S
      bas2,     // T
      bit2,     // U
      uretim2,  // V
      fire2,    // W - Kümülatif Fire

      // Onay
      olcumNo === 3 ? (onaylandi ? 'ONAYLANDI' : 'BEKLİYOR') : '' // X
    ]);

    // Canlı İzleme güncelle (sütun-bazlı, max 5 log, vardiya bazlı sıfırlama)
    const adSoyad = e.parameter.adsoyad || '';
    updateCanliIzleme(e.parameter.enj1_no, e.parameter.kasa1, close ? '0' : e.parameter.cevrim1, e.parameter.agirlik1, e.parameter.sayac_bas1 + '→' + e.parameter.sayac_bit1, e.parameter.uretim1, e.parameter.fire1, vardiyaTarih, vardiya, adSoyad);
    if (enjSayisi === 2) {
      updateCanliIzleme(e.parameter.enj2_no, e.parameter.kasa2, cevrim2, e.parameter.agirlik2, e.parameter.sayac_bas2 + '→' + e.parameter.sayac_bit2, e.parameter.uretim2, e.parameter.fire2, vardiyaTarih, vardiya, adSoyad);
    }

    // Makine kapatma işlemi
    if (close) {
      lockMachine(ss, e.parameter.enj1_no, vardiyaTarih, vardiya, adSoyad);
      if (enjSayisi === 2) {
        lockMachine(ss, e.parameter.enj2_no, vardiyaTarih, vardiya, adSoyad);
      }
    }

    // Üretim Kaydı: normalize edilmiş, makine başına bir satır
    appendUretimKaydi(ss, {
      tarih: vardiyaTarih, vardiya, saat,
      adsoyad: e.parameter.adsoyad || '', olcumNo,
      makineNo: e.parameter.enj1_no || '', kasa: e.parameter.kasa1 || '',
      cevrim: close ? '0' : (e.parameter.cevrim1 || ''),
      agirlik: e.parameter.agirlik1 || '',
      sayacBas: e.parameter.sayac_bas1 || '', sayacBit: e.parameter.sayac_bit1 || '',
      uretim: e.parameter.uretim1 || '', fire: e.parameter.fire1 || '0',
    });
    if (enjSayisi === 2) {
      appendUretimKaydi(ss, {
        tarih: vardiyaTarih, vardiya, saat,
        adsoyad: e.parameter.adsoyad || '', olcumNo,
        makineNo: enj2No, kasa: kasa2,
        cevrim: cevrim2, agirlik: agirlik2,
        sayacBas: bas2, sayacBit: bit2,
        uretim: uretim2, fire: fire2,
      });
    }

    return jsonp(cb, { result: 'ok', olcum: olcumNo });
  }

  // ============================================================
  // getMonitorData: Yönetici izleme sayfası için kapsamlı veri
  // ============================================================
  if (e.parameter.action === 'getMonitorData') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1) Makine durumları
    const statuses = {};
    for (let i = 1; i <= 12; i++) statuses['Enjeksiyon ' + i] = { durum: 'Aktif', sonAriza: null };
    const durSheet = ss.getSheetByName('Makine Durumları');
    if (durSheet && durSheet.getLastRow() > 1) {
      const dv = durSheet.getRange(2, 1, durSheet.getLastRow() - 1, 5).getValues();
      for (const row of dv) {
        const m = String(row[0]).trim();
        if (!statuses[m]) continue;
        statuses[m].durum          = String(row[1]).trim();
        statuses[m].sonGuncelleme  = String(row[2]).trim();
        if (statuses[m].durum === 'Arızalı') {
          statuses[m].sonAriza = { tip: String(row[4]).trim(), sorun: String(row[3]).trim() };
        }
      }
    }

    // 2) Canlı İzleme verisi — düz 12 satır (son 24s)
    const canliData = {};
    const canliSheet = ss.getSheetByName('Canlı İzleme');
    for (let i = 1; i <= 12; i++) {
      const makineNo = 'Enjeksiyon ' + i;
      if (!canliSheet || canliSheet.getLastRow() < i + 1) { canliData[makineNo] = {}; continue; }
      const row = canliSheet.getRange(i + 1, 1, 1, 9).getValues()[0];
      canliData[makineNo] = {
        operatör: String(row[1] || '').trim(),
        tarih:    String(row[2] || '').trim(),
        kasa:     String(row[3] || '').trim(),
        cevrim:   String(row[4] || '').trim(),
        agirlik:  String(row[5] || '').trim(),
        uretim:   String(row[6] || '').trim(),
        fire:     String(row[7] || '').trim(),
        vardiya:  String(row[8] || '').trim(),
        saat:     String(row[2] || '').trim(),
      };
    }

    // 3) Atanan kasa ebatları
    const kasalar = {};
    const kasaSheet = ss.getSheetByName('Makine Kasa');
    if (kasaSheet && kasaSheet.getLastRow() > 1) {
      const kv = kasaSheet.getRange(2, 1, kasaSheet.getLastRow() - 1, 2).getValues();
      for (const row of kv) {
        const m = String(row[0]).trim(), k = String(row[1]).trim();
        if (m && k) kasalar[m] = k;
      }
    }

    // 4) Arıza Log — son 100 kayıt, en yeni önce
    const arizaLog = [];
    const arizaSheet = ss.getSheetByName('Arıza Log');
    if (arizaSheet && arizaSheet.getLastRow() > 1) {
      const lastRow  = arizaSheet.getLastRow();
      const startRow = Math.max(2, lastRow - 99);
      const av = arizaSheet.getRange(startRow, 1, lastRow - startRow + 1, 10).getValues();
      const tz = ss.getSpreadsheetTimeZone();
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

    // 5) Üretim geçmişi — Veriler sekmesinden son 200 kayıt
    const uretimGecmisi = [];
    const verilerSheet = ss.getSheetByName('Veriler');
    if (verilerSheet && verilerSheet.getLastRow() > 1) {
      const lastRow  = verilerSheet.getLastRow();
      const startRow = Math.max(2, lastRow - 199);
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

    // 6) Özet
    const aktif   = Object.values(statuses).filter(s => s.durum === 'Aktif').length;
    const arizali = Object.values(statuses).filter(s => s.durum !== 'Aktif').length;

    // 7) İndirme / yedekleme bilgisi
    const ssId = ss.getId();
    const _gid = name => { const sh = ss.getSheetByName(name); return sh ? sh.getSheetId() : null; };
    const sheetGids = {
      veriler:     _gid('Veriler'),
      uretimKaydi: _gid('Üretim Kaydı'),
      arizaLog:    _gid('Arıza Log'),
    };

    // Son Drive yedek tarihi (Properties'te tutulur)
    const sonYedek = PropertiesService.getScriptProperties().getProperty('lastExport') || '';

    return jsonp(cb, {
      statuses, canliData, kasalar, arizaLog, uretimGecmisi,
      ozet: { aktif, arizali },
      ssId, sheetGids, sonYedek,
      serverTime: new Date().getTime(),
    });
  }

  // ============================================================
  // getMachineStatuses: 12 makinenin anlık durumunu ve arıza
  // tiplerini döndürür. Meydancı sayfası bu action'ı kullanır.
  // ============================================================
  if (e.parameter.action === 'getMachineStatuses') {
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const ayarlar = ss.getSheetByName('Ayarlar');

    // Arıza tipleri: Ayarlar G sütunundan, yoksa varsayılan
    let arizaTipleri = [];
    if (ayarlar) {
      arizaTipleri = ayarlar.getRange('G2:G20').getValues().flat()
        .map(v => String(v).trim()).filter(v => v);
    }
    if (!arizaTipleri.length) {
      arizaTipleri = ['Makine Kaynaklı', 'Kalıp Kaynaklı', 'Diğer'];
    }

    // 12 makinenin durumu
    const statuses = {};
    for (let i = 1; i <= 12; i++) {
      statuses['Enjeksiyon ' + i] = { durum: 'Aktif', sonAriza: null };
    }

    const durSheet = ss.getSheetByName('Makine Durumları');
    if (durSheet && durSheet.getLastRow() > 1) {
      const vals = durSheet.getRange(2, 1, durSheet.getLastRow() - 1, 5).getValues();
      for (const row of vals) {
        const makine = String(row[0]).trim();
        const durum  = String(row[1]).trim();
        const sorun  = String(row[3]).trim();
        const tip    = String(row[4]).trim();
        if (statuses[makine]) {
          statuses[makine].durum = durum;
          if (durum === 'Arızalı') {
            statuses[makine].sonAriza = { tip, sorun };
          }
        }
      }
    }

    // Canlı İzleme'den son makine verilerini oku (kasa, çevrim, operatör)
    const canliSheet = ss.getSheetByName('Canlı İzleme');
    const machineData = {};
    if (canliSheet && canliSheet.getLastRow() >= 2) {
      for (let i = 1; i <= 12; i++) {
        const makineNo = 'Enjeksiyon ' + i;
        if (canliSheet.getLastRow() < i + 1) continue;
        const row  = canliSheet.getRange(i + 1, 1, 1, 9).getValues()[0];
        const opAd = String(row[1] || '').trim();
        if (!opAd) continue;
        machineData[makineNo] = {
          tarih:    String(row[2] || '').trim(),
          operatör: opAd,
          kasa:     String(row[3] || '').trim(),
          cevrim:   String(row[4] || '').trim(),
          agirlik:  String(row[5] || '').trim(),
          uretim:   String(row[6] || '').trim(),
          fire:     String(row[7] || '').trim(),
          saat:     String(row[2] || '').trim(),
        };
      }
    }

    // Atanan kasa ebatları ("Makine Kasa" sekmesinden)
    const atananKasalar = {};
    const kasaSheet = ss.getSheetByName('Makine Kasa');
    if (kasaSheet && kasaSheet.getLastRow() > 1) {
      const kv = kasaSheet.getRange(2, 1, kasaSheet.getLastRow() - 1, 2).getValues();
      for (const row of kv) {
        const m = String(row[0]).trim();
        const k = String(row[1]).trim();
        if (m && k) atananKasalar[m] = k;
      }
    }

    // Kasa ebatları listesi (Ayarlar B sütunu)
    const kasaEbatlari = ayarlar
      ? ayarlar.getRange('B2:B50').getValues().flat().map(v => String(v).trim()).filter(v => v)
      : [];

    return jsonp(cb, { statuses, arizaTipleri, machineData, kasaEbatlari, atananKasalar, serverTime: new Date().getTime() });
  }

  // ============================================================
  // logAriza: Arıza kaydını "Arıza Log" sekmesine yazar ve
  // makine durumunu günceller.
  // ============================================================
  if (e.parameter.action === 'logAriza') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let arizaSheet = ss.getSheetByName('Arıza Log');
    if (!arizaSheet) {
      arizaSheet = ss.insertSheet('Arıza Log');
      arizaSheet.appendRow([
        'Kayıt Zamanı','Tekniker ID','Tekniker Ad','Makine No',
        'Arıza Tipi','Sorun','Çözüm','Başlangıç Saati','Bitiş Saati','Durum'
      ]);
      const h = arizaSheet.getRange('A1:J1');
      h.setFontWeight('bold').setBackground('#dc2626').setFontColor('#ffffff');
      arizaSheet.setFrozenRows(1);
      [1,160,120,130,130,200,200,110,110,90].forEach((w,i) => {
        if (i > 0) arizaSheet.setColumnWidth(i, w);
      });
    }

    const makineNo    = e.parameter.makine_no    || '';
    const arizaTipi   = e.parameter.ariza_tipi   || '';
    const sorun       = e.parameter.sorun        || '';
    const cozum       = e.parameter.cozum        || '';
    const autoNow  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
    const basSaat  = e.parameter.bas_saat || autoNow;
    const bitSaat  = e.parameter.bit_saat || '';
    const teknikerId  = e.parameter.tekniker_id  || '';
    const teknikerAd  = e.parameter.tekniker_ad  || '';
    const yeniDurum   = bitSaat ? 'Aktif' : 'Arızalı';

    arizaSheet.appendRow([
      new Date().toLocaleString('tr-TR'),
      teknikerId, teknikerAd, makineNo,
      arizaTipi, sorun, cozum, basSaat, bitSaat,
      yeniDurum === 'Aktif' ? 'Kapalı (Çözüldü)' : 'Açık'
    ]);

    setMachineDurum(ss, makineNo, yeniDurum, arizaTipi, sorun);

    return jsonp(cb, { result: 'ok' });
  }

  // ============================================================
  // setMachineKasa: Makineye kasa ebatı atar ("Makine Kasa" sekmesi)
  // ============================================================
  if (e.parameter.action === 'setMachineKasa') {
    const ss       = SpreadsheetApp.getActiveSpreadsheet();
    const makineNo = e.parameter.makine_no || '';
    const kasa     = e.parameter.kasa      || '';
    const tekniker = e.parameter.tekniker  || '';

    let sheet = ss.getSheetByName('Makine Kasa');
    if (!sheet) {
      sheet = ss.insertSheet('Makine Kasa');
      sheet.appendRow(['Makine No', 'Kasa Ebatı', 'Son Güncelleme', 'Güncelleyen']);
      const h = sheet.getRange('A1:D1');
      h.setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      [120, 120, 140, 140].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
    }

    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        if (String(vals[i][0]).trim() === makineNo) {
          sheet.getRange(i + 2, 2, 1, 3).setValues([[kasa, now, tekniker]]);
          return jsonp(cb, { result: 'ok' });
        }
      }
    }
    sheet.appendRow([makineNo, kasa, now, tekniker]);
    return jsonp(cb, { result: 'ok' });
  }

  // ============================================================
  // toggleMachine: Makineyi manuel olarak Aktif/Arızalı yapar.
  // ============================================================
  if (e.parameter.action === 'toggleMachine') {
    const ss       = SpreadsheetApp.getActiveSpreadsheet();
    const makineNo = e.parameter.makine_no  || '';
    const durum    = e.parameter.durum      || 'Aktif';
    const neden    = e.parameter.neden      || '';
    const tekId    = e.parameter.tekniker_id || '';
    const tekAd    = e.parameter.tekniker_ad || '';

    setMachineDurum(ss, makineNo, durum, neden, '');

    // Kapama/açma olayını Arıza Log'a kaydet
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

  return jsonp(cb, { error: 'Geçersiz istek' });
}

// doPost: Eski kodla uyumluluk için bırakıldı (artık aktif kullanılmıyor)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    // logFire artık doGet/JSONP ile çalışıyor — bu kısım sadece yedek
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'redirected', message: 'logFire artık GET ile yapılıyor' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function vardiyaBaslangicTarih(tarih, saat, vardiya) {
  if (vardiya !== 'AKSAM' || !saat) return tarih;
  const hour = parseInt(saat.split(':')[0]);
  // AKSAM: 17:00-01:00. Entries at 00:xx or 01:xx are the next calendar day
  // but belong to the previous day's AKSAM shift.
  if (hour >= 0 && hour < 2) {
    const d = new Date(tarih);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  return tarih;
}

function yazBaslik(sheet) {
  const b = [
    'Kayıt Zamanı','Vardiya Tarihi','Ad Soyad','Vardiya','Ölçüm No','Enj Sayısı','Ölçüm Saati',
    'Enj1-No','Enj1-Kasa','Enj1-Çevrim(sn)','Enj1-Ağırlık(gr)','Enj1-SayaçBaş','Enj1-SayaçBit','Enj1-Üretim','Enj1-Fire',
    'Enj2-No','Enj2-Kasa','Enj2-Çevrim(sn)','Enj2-Ağırlık(gr)','Enj2-SayaçBaş','Enj2-SayaçBit','Enj2-Üretim','Enj2-Fire',
    'Onay'
  ];
  sheet.appendRow(b);
  const h = sheet.getRange(1, 1, 1, b.length);
  h.setFontWeight('bold');
  h.setBackground('#2563eb');
  h.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

// ================================================================
// CANLI İZLEME — 3 vardiya × 12 makine = 36 sabit satır
//
// Satır düzeni:
//   Satır  1     : Sütun başlıkları
//   Satır  2     : ── SABAH ──  (bölüm başlığı)
//   Satır  3–14  : SABAH  Enjeksiyon 1–12
//   Satır 15     : ── AKSAM ──
//   Satır 16–27  : AKSAM  Enjeksiyon 1–12
//   Satır 28     : ── GECE ──
//   Satır 29–40  : GECE   Enjeksiyon 1–12
//
// Sütunlar:
//   A: Makine  B: Ad Soyad  C: Tarih  D: Kasa
//   E: Çevrim(sn)  F: Ağırlık(gr)  G: Üretim  H: Fire  I: Saat
//
// Gönderim gelince ilgili vardiya+makine satırı üzerine yazılır.
// ================================================================

// Vardiya → bölüm başlangıç satırı (ilk makine satırı)
var _VARDIYA_BASE = { 'SABAH': 3, 'AKSAM': 16, 'GECE': 29 };

// Vardiya renkleri
var _VARDIYA_BG   = { 'SABAH': '#fef9c3', 'AKSAM': '#dbeafe', 'GECE': '#f3e8ff' };
var _BOLUM_BG     = { 'SABAH': '#f59e0b', 'AKSAM': '#3b82f6', 'GECE': '#7c3aed' };

function updateCanliIzleme(enjNo, kasa, cevrim, agirlik, sayac, uretim, fire, tarih, vardiya, adSoyad) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Canlı İzleme');
  if (!sheet) return;

  // Yapı: satır 1 = başlık, satırlar 2-13 = Enjeksiyon 1-12 (düz, 10 sütun)
  // Eski 36-satırlık yapı veya bozuk yapı → yeniden kur
  const h1 = String(sheet.getRange(1, 1).getValue()).trim();
  const h9 = String(sheet.getRange(1, 9).getValue()).trim();
  if (h1 !== 'Makine' || h9 !== 'Vardiya') {
    _setupCanlıBaslik(sheet);
  }

  const m = String(enjNo).match(/(\d+)\s*$/);
  if (!m) return;
  const enjIdx = parseInt(m[1]);
  if (enjIdx < 1 || enjIdx > 12) return;

  const targetRow = enjIdx + 1;   // Row 2 = Enjeksiyon 1 … Row 13 = Enjeksiyon 12
  const now = new Date();
  const tz  = ss.getSpreadsheetTimeZone();
  const saatStr = Utilities.formatDate(now, tz, 'HH:mm');

  // 24 saatlik kümülatif: sütun J (index 9) timestamp'a bak
  const existing   = sheet.getRange(targetRow, 1, 1, 10).getValues()[0];
  const lastTs     = existing[9] instanceof Date ? existing[9].getTime() : 0;
  const within24h  = lastTs > 0 && (now.getTime() - lastTs) < 86400000;

  const yeniUretim = (within24h ? (Number(existing[6]) || 0) : 0) + (parseInt(uretim) || 0);
  const yeniFire   = (within24h ? (Number(existing[7]) || 0) : 0) + (parseInt(fire)   || 0);

  const bg = _VARDIYA_BG[vardiya] || '#f8fafc';
  const range = sheet.getRange(targetRow, 1, 1, 10);
  range.setValues([[
    'Enjeksiyon ' + enjIdx,          // A
    adSoyad   || '',                  // B
    tarih + ' ' + saatStr,           // C — tarih + saat
    kasa      || '',                  // D
    cevrim    || '',                  // E
    agirlik   || '',                  // F
    yeniUretim,                       // G
    yeniFire,                         // H
    vardiya   || '',                  // I
    now,                              // J — timestamp (Date obj, 24s kontrolü için)
  ]]);
  range.setBackground(bg);
  range.setVerticalAlignment('middle');
  range.setFontSize(10);
  range.setHorizontalAlignment('center');
  sheet.getRange(targetRow, 1).setFontWeight('bold').setHorizontalAlignment('left');
  sheet.getRange(targetRow, 2).setFontWeight('bold').setHorizontalAlignment('left');
  // J sütunu (timestamp) daralt + gizle
  sheet.getRange(targetRow, 10).setNumberFormat('yyyy-MM-dd HH:mm:ss').setFontSize(8).setFontColor('#cccccc');
}

function _setupCanlıBaslik(sheet) {
  sheet.clearContents();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const COLS = 10;
  const headers = ['Makine', 'Ad Soyad', 'Tarih', 'Kasa', 'Çevrim(sn)', 'Ağırlık(gr)', 'Üretim(24s)', 'Fire(24s)', 'Vardiya', 'TS'];
  const h = sheet.getRange(1, 1, 1, COLS);
  h.setValues([headers]);
  h.setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff')
   .setHorizontalAlignment('center').setFontSize(11);
  sheet.setFrozenRows(1);

  for (let i = 1; i <= 12; i++) {
    sheet.getRange(i + 1, 1).setValue('Enjeksiyon ' + i).setFontWeight('bold');
  }

  [120, 140, 130, 100, 80, 80, 90, 70, 70, 130].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  // Timestamp sütunu (J) gizle — sadece 24s hesabı için
  sheet.hideColumns(10);

  // Artık eski _VARDIYA_BASE ve bölüm başlık satırları yok
  return;  // Aşağısı eski _setupCanlıBaslik'ten kalma — silinecek

  const COLS = 9;

  // Sütun başlıkları (Satır 1)
  const headers = ['Makine', 'Ad Soyad', 'Tarih', 'Kasa', 'Çevrim(sn)', 'Ağırlık(gr)', 'Üretim', 'Fire', 'Saat'];
  const hRange = sheet.getRange(1, 1, 1, COLS);
  hRange.setValues([headers]);
  hRange.setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff')
        .setHorizontalAlignment('center').setFontSize(11);
  sheet.setFrozenRows(1);

  // 3 vardiya bölümü
  const vardiyalar = ['SABAH', 'AKSAM', 'GECE'];
}

// ================================================================
// ÜRETİM KAYDI — normalize edilmiş, makine başına bir satır
// Sütunlar: Kayıt Zamanı | Vardiya Tarihi | Vardiya | Ölçüm Saati |
//           Ad Soyad | Ölçüm No | Makine No | Kasa |
//           Çevrim(sn) | Ağırlık(gr) | Sayaç Baş | Sayaç Bit | Üretim | Fire
// ================================================================

function appendUretimKaydi(ss, d) {
  if (!d.makineNo || d.makineNo === '00') return;
  let sheet = ss.getSheetByName('Üretim Kaydı');
  if (!sheet) {
    sheet = ss.insertSheet('Üretim Kaydı');
    _setupUretimKaydi(sheet);
  } else if (sheet.getLastRow() === 0 || String(sheet.getRange(1,1).getValue()).trim() !== 'Kayıt Zamanı') {
    _setupUretimKaydi(sheet);
  }

  sheet.appendRow([
    new Date().toLocaleString('tr-TR'),  // A - Kayıt Zamanı
    d.tarih    || '',                    // B - Vardiya Tarihi
    d.vardiya  || '',                    // C - Vardiya
    d.saat     || '',                    // D - Ölçüm Saati
    d.adsoyad  || '',                    // E - Ad Soyad
    d.olcumNo  || '',                    // F - Ölçüm No
    d.makineNo || '',                    // G - Makine No
    d.kasa     || '',                    // H - Kasa
    d.cevrim   !== undefined ? (Number(d.cevrim) || 0) : '', // I - Çevrim(sn)
    d.agirlik  !== undefined ? (Number(d.agirlik) || 0) : '', // J - Ağırlık(gr)
    d.sayacBas !== undefined ? (Number(d.sayacBas) || 0) : '', // K - Sayaç Baş
    d.sayacBit !== undefined ? (Number(d.sayacBit) || 0) : '', // L - Sayaç Bit
    d.uretim   !== undefined ? (Number(d.uretim)  || 0) : '', // M - Üretim
    d.fire     !== undefined ? (Number(d.fire)    || 0) : '', // N - Fire
  ]);
}

function _setupUretimKaydi(sheet) {
  const headers = [
    'Kayıt Zamanı', 'Vardiya Tarihi', 'Vardiya', 'Ölçüm Saati',
    'Ad Soyad', 'Ölçüm No', 'Makine No', 'Kasa',
    'Çevrim(sn)', 'Ağırlık(gr)', 'Sayaç Baş', 'Sayaç Bit', 'Üretim', 'Fire',
  ];
  const h = sheet.getRange(1, 1, 1, headers.length);
  h.setValues([headers]);
  h.setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff')
   .setHorizontalAlignment('center').setFontSize(11);
  sheet.setFrozenRows(1);
  [140, 110, 80, 90, 140, 70, 130, 100, 90, 90, 90, 90, 80, 70].forEach(function(w, i) {
    sheet.setColumnWidth(i + 1, w);
  });
  // Sayısal sütunları sayı formatla
  sheet.getRange('I:N').setNumberFormat('#,##0');
}

// ================================================================
// DRIVE YEDEKLEME
// ================================================================

/**
 * Tüm spreadsheet'i Drive'a xlsx olarak yedekler.
 * Manuel olarak çağrılabilir veya zaman tabanlı tetikleyici ile otomatik.
 */
function dailyExport() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const tz    = ss.getSpreadsheetTimeZone();
  const tarih = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const ad    = 'Ersan Plastik — ' + tarih + '.xlsx';

  const url   = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  const token = ScriptApp.getOAuthToken();
  const resp  = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() !== 200) {
    throw new Error('Export HTTP ' + resp.getResponseCode());
  }

  const blob = resp.getBlob().setName(ad);

  // "Ersan Plastik Yedekleri" klasörünü bul veya oluştur
  const folderName = 'Ersan Plastik Yedekleri';
  let folder;
  const it = DriveApp.getFoldersByName(folderName);
  folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);

  // Aynı güne ait eski yedeği sil (diske yer açmak için)
  const existingIt = folder.getFilesByName(ad);
  while (existingIt.hasNext()) existingIt.next().setTrashed(true);

  folder.createFile(blob);
  PropertiesService.getScriptProperties().setProperty('lastExport', tarih);
}

/**
 * Günlük otomatik yedek tetikleyici kurar (saat 07:00).
 * Google Apps Script editöründen bir kez çalıştırın.
 */
function setupDailyExport() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'dailyExport')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('dailyExport')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  Logger.log('Günlük yedek tetikleyici kuruldu: her gün 07:00');
}

function jsonp(callback, obj) {
  const body = callback ? callback + '(' + JSON.stringify(obj) + ')' : JSON.stringify(obj);
  return ContentService.createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

// ============================================================
// MACHINE LOCK FUNCTIONS
// ============================================================

function getLockedMachines(ss) {
  const locked = {};

  // Eski "Machine Locks" sekmesi
  const lockSheet = ss.getSheetByName('Machine Locks');
  if (lockSheet && lockSheet.getLastRow() > 1) {
    const vals = lockSheet.getRange(2, 1, lockSheet.getLastRow() - 1, 5).getValues();
    for (const row of vals) {
      if (String(row[4]).trim() === 'LOCKED') {
        locked[String(row[0]).trim()] = true;
      }
    }
  }

  // Yeni "Makine Durumları" sekmesi — Arızalı makineler de kilitli sayılır
  const durSheet = ss.getSheetByName('Makine Durumları');
  if (durSheet && durSheet.getLastRow() > 1) {
    const vals = durSheet.getRange(2, 1, durSheet.getLastRow() - 1, 2).getValues();
    for (const row of vals) {
      if (String(row[1]).trim() === 'Arızalı') {
        locked[String(row[0]).trim()] = true;
      }
    }
  }

  return locked;
}

// ============================================================
// setMachineDurum: Makine Durumları sekmesinde ilgili satırı
// günceller; yoksa yeni satır ekler.
// ============================================================
function setMachineDurum(ss, makineNo, durum, tip, sorun) {
  let sheet = ss.getSheetByName('Makine Durumları');
  if (!sheet) {
    sheet = ss.insertSheet('Makine Durumları');
    sheet.appendRow(['Makine No', 'Durum', 'Son Güncelleme', 'Sorun', 'Arıza Tipi']);
    const h = sheet.getRange('A1:E1');
    h.setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    for (let i = 1; i <= 12; i++) {
      sheet.appendRow(['Enjeksiyon ' + i, 'Aktif', '', '', '']);
    }
  }

  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
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
    const header = lockSheet.getRange('A1:E1');
    header.setFontWeight('bold').setBackground('#dc2626').setFontColor('#ffffff');
    lockSheet.setFrozenRows(1);
    lockSheet.setColumnWidth(1, 100);
    lockSheet.setColumnWidth(2, 100);
    lockSheet.setColumnWidth(3, 100);
    lockSheet.setColumnWidth(4, 140);
    lockSheet.setColumnWidth(5, 100);
  }

  // Önce bu makinenin mevcut durumunu kontrol et
  const lastRow = lockSheet.getLastRow();
  if (lastRow > 1) {
    const vals = lockSheet.getRange(2, 1, lastRow - 1, 5).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === String(machineNo).trim()) {
        // Zaten kilitli, güncelleme yapma
        return;
      }
    }
  }

  // Yeni kilit ekle
  lockSheet.appendRow([
    machineNo,
    tarih,
    vardiya,
    adSoyad,
    'LOCKED'
  ]);
}
