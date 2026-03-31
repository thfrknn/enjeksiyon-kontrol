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

    const opCol    = ayarlar.getRange('A2:A50').getValues().flat().filter(v => v !== '');
    const kasaCol  = ayarlar.getRange('B2:B50').getValues().flat().filter(v => v !== '');
    const sifreCol = ayarlar.getRange('C2:C50').getDisplayValues().flat();
    const idCol    = ayarlar.getRange('E2:E50').getDisplayValues().flat();

    const kullanicilar = {};
    opCol.forEach((ad, i) => {
      const sifre = sifreCol[i];
      const id    = String(idCol[i] || '').trim();
      if (ad && id) kullanicilar[id] = { name: String(ad), sifre: String(sifre || '') };
    });

    const uretimLimiti = Number(ayarlar.getRange('D2').getValue()) || 0;
    const maxFireLimit = Number(ayarlar.getRange('F2').getValue()) || 50;

    return jsonp(cb, {
      kasaEbatlari: kasaCol,
      kullanicilar,
      uretimLimiti,
      maxFireLimit,
      serverTime: new Date().getTime()
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

    let olcumNo = 1, enj1 = null, kasa1 = null, enj2 = null, kasa2 = null, enjSayisi = 1;
    let sayacBit1 = null, sayacBit2 = null;
    let fireToplam1 = 0, fireToplam2 = 0;

    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][2]).trim() === String(adsoyad).trim() &&
          String(vals[i][1]).trim() === String(normTarih).trim() &&
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
    return jsonp(cb, { olcumNo, enj1, kasa1, enj2, kasa2, enjSayisi, sayacBit1, sayacBit2, fireToplam1, fireToplam2 });
  }

  // ============================================================
  // getLastCounter: Makine için son sayaç bitiş değerini getir
  // ============================================================
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
    return jsonp(cb, { sayacBit });
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

    const vardiyaTarih = vardiyaBaslangicTarih(tarih, saat, vardiya);

    const enj2No   = enjSayisi === 2 ? (e.parameter.enj2_no   || '') : '00';
    const kasa2    = enjSayisi === 2 ? (e.parameter.kasa2      || '') : '00';
    const cevrim2  = enjSayisi === 2 ? (e.parameter.cevrim2    || '') : '00';
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
      e.parameter.cevrim1    || '',        // J
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
    updateCanliIzleme(e.parameter.enj1_no, e.parameter.kasa1, e.parameter.cevrim1, e.parameter.agirlik1, e.parameter.sayac_bas1 + '→' + e.parameter.sayac_bit1, e.parameter.uretim1, e.parameter.fire1, vardiyaTarih, vardiya, adSoyad);
    if (enjSayisi === 2) {
      updateCanliIzleme(e.parameter.enj2_no, e.parameter.kasa2, e.parameter.cevrim2, e.parameter.agirlik2, e.parameter.sayac_bas2 + '→' + e.parameter.sayac_bit2, e.parameter.uretim2, e.parameter.fire2, vardiyaTarih, vardiya, adSoyad);
    }

    return jsonp(cb, { result: 'ok', olcum: olcumNo });
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
  if (hour >= 0 && hour < 1) {
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Canlı İzleme');
  if (!sheet) return;

  // Yapı bozulduysa yeniden kur
  if (String(sheet.getRange(1, 1).getValue()).trim() !== 'Makine') {
    _setupCanlıBaslik(sheet);
  }

  const m = String(enjNo).match(/(\d+)\s*$/);
  if (!m) return;
  const enjIdx = parseInt(m[1]);
  if (enjIdx < 1 || enjIdx > 12) return;

  const base = _VARDIYA_BASE[vardiya];
  if (!base) return;
  const targetRow = base + (enjIdx - 1);

  const saat = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  const bg   = _VARDIYA_BG[vardiya] || '#ffffff';

  // Mevcut satırı oku — aynı tarihse Üretim+Fire biriktirilir
  // getDisplayValues kullanılır: Sheets '2026-03-31' stringini Date'e çevirir,
  // getValues() ile Date objesi gelir ve string karşılaştırması başarısız olur.
  const existing = sheet.getRange(targetRow, 1, 1, 9).getDisplayValues()[0];
  const mevcutTarih  = String(existing[2] || '').trim();
  const mevcutUretim = parseInt(existing[6]) || 0;
  const mevcutFire   = parseInt(existing[7]) || 0;

  const yeniUretim = (mevcutTarih === tarih) ? (mevcutUretim + (parseInt(uretim) || 0)) : (parseInt(uretim) || 0);
  const yeniFire   = (mevcutTarih === tarih) ? (mevcutFire   + (parseInt(fire)   || 0)) : (parseInt(fire)   || 0);

  const range = sheet.getRange(targetRow, 1, 1, 9);
  range.setValues([[
    'Enjeksiyon ' + enjIdx,
    adSoyad || '',
    tarih   || '',
    kasa    || '',
    cevrim  || '',
    agirlik || '',
    yeniUretim,
    yeniFire,
    saat
  ]]);
  range.setBackground(bg);
  range.setVerticalAlignment('middle');
  range.setFontSize(10);
  range.setHorizontalAlignment('center');
  // Makine adı ve operatör adı sola hizalı + kalın
  sheet.getRange(targetRow, 1).setFontWeight('bold').setHorizontalAlignment('left');
  sheet.getRange(targetRow, 2).setFontWeight('bold').setHorizontalAlignment('left');
}

function _setupCanlıBaslik(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

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
  vardiyalar.forEach(function(v) {
    const labelRow = _VARDIYA_BASE[v] - 1;
    const dataStart = _VARDIYA_BASE[v];
    const bgLabel = _BOLUM_BG[v];
    const bgData  = _VARDIYA_BG[v];

    // Bölüm başlık satırı (birleştirilmiş)
    const lRange = sheet.getRange(labelRow, 1, 1, COLS);
    lRange.merge();
    lRange.setValue('── ' + v + ' ──');
    lRange.setBackground(bgLabel).setFontColor('#ffffff').setFontWeight('bold')
          .setHorizontalAlignment('center').setFontSize(11);

    // 12 makine satırı — A sütununa makine adı yaz
    for (let i = 1; i <= 12; i++) {
      const r = dataStart + (i - 1);
      sheet.getRange(r, 1).setValue('Enjeksiyon ' + i)
           .setFontWeight('bold').setBackground(bgData).setHorizontalAlignment('left');
      sheet.getRange(r, 2, 1, COLS - 1).setBackground(bgData);
    }
  });

  // Tarih sütununu (C) metin formatında tut — Sheets otomatik Date'e çevirmesin
  sheet.getRange(2, 3, 40, 1).setNumberFormat('@');

  // Sütun genişlikleri
  sheet.setColumnWidth(1, 120);  // Makine
  sheet.setColumnWidth(2, 140);  // Ad Soyad
  sheet.setColumnWidth(3, 100);  // Tarih
  sheet.setColumnWidth(4, 100);  // Kasa
  sheet.setColumnWidth(5, 90);   // Çevrim(sn)
  sheet.setColumnWidth(6, 90);   // Ağırlık(gr)
  sheet.setColumnWidth(7, 80);   // Üretim
  sheet.setColumnWidth(8, 70);   // Fire
  sheet.setColumnWidth(9, 70);   // Saat
}

function jsonp(callback, obj) {
  const body = callback ? callback + '(' + JSON.stringify(obj) + ')' : JSON.stringify(obj);
  return ContentService.createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
