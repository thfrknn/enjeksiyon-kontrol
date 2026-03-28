// ================================================================
// ENJEKSİYON KONTROL — Google Apps Script v8
// Her giriş yeni satır, 2 enjeksiyon desteği
// Sütunlar:
// A=KayıtZamanı B=VardiyaTarih C=AdSoyad D=Vardiya E=ÖlçümNo F=EnjSayısı G=ÖlçümSaati
// H=Enj1No I=Enj1Kasa J=Enj1Çevrim K=Enj1Ağırlık L=Enj1SayaçBaş M=Enj1SayaçBit N=Enj1Üretim O=Enj1Fire
// P=Enj2No Q=Enj2Kasa R=Enj2Çevrim S=Enj2Ağırlık T=Enj2SayaçBaş U=Enj2SayaçBit V=Enj2Üretim W=Enj2Fire
// X=Onay
//
// Ayarlar sekmesi:
// A=Operatörler  B=Kasa Ebatları  C=Şifreler  D=Üretim Limiti (D2'de tek değer)  E=Kullanıcı ID'leri
// ================================================================

function doGet(e) {
  const cb = e.parameter.callback;

  if (e.parameter.action === 'getLists') {
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const ayarlar = ss.getSheetByName('Ayarlar');
    if (!ayarlar) return jsonp(cb, { error: 'Ayarlar sekmesi bulunamadı' });

    const opCol    = ayarlar.getRange('A2:A50').getValues().flat().filter(v => v !== '');
    const kasaCol  = ayarlar.getRange('B2:B50').getValues().flat().filter(v => v !== '');
    // getDisplayValues: hücrede görünen metni alır → başındaki sıfırları korur
    const sifreCol = ayarlar.getRange('C2:C50').getDisplayValues().flat();
    const idCol    = ayarlar.getRange('E2:E50').getDisplayValues().flat();

    // ID → { name, sifre } eşlemesi (E sütunu A ile aynı sırada)
    const kullanicilar = {};
    opCol.forEach((ad, i) => {
      const sifre = sifreCol[i];
      const id    = String(idCol[i] || '').trim();
      if (ad && id) kullanicilar[id] = { name: String(ad), sifre: String(sifre || '') };
    });

    // Üretim limiti D2'den (tek bir sayı)
    const uretimLimiti = Number(ayarlar.getRange('D2').getValue()) || 0;

    return jsonp(cb, { kasaEbatlari: kasaCol, kullanicilar, uretimLimiti });
  }

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
    // 24 sütun oku: M=Enj1SayaçBit(idx12), U=Enj2SayaçBit(idx20)
    const vals = sheet.getRange(2, 1, lastRow - 1, 21).getValues();

    let olcumNo = 1, enj1 = null, kasa1 = null, enj2 = null, kasa2 = null, enjSayisi = 1;
    let sayacBit1 = null, sayacBit2 = null;

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
        // M=idx12 Enj1SayaçBit, U=idx20 Enj2SayaçBit
        const b1 = parseInt(vals[i][12]); if(!isNaN(b1)) sayacBit1 = b1;
        const b2 = parseInt(vals[i][20]); if(!isNaN(b2)) sayacBit2 = b2;
      }
    }

    return jsonp(cb, { olcumNo, enj1, kasa1, enj2, kasa2, enjSayisi, sayacBit1, sayacBit2 });
  }

  if (e.parameter.action === 'getLastCounter') {
    const enjNo = e.parameter.enj_no;
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Veriler');
    if (!sheet || sheet.getLastRow() < 2) return jsonp(cb, { sayacBit: null });
    const lastRow = sheet.getLastRow();
    // H=idx7 Enj1No, M=idx12 Enj1SayaçBit, P=idx15 Enj2No, U=idx20 Enj2SayaçBit
    const vals = sheet.getRange(2, 1, lastRow - 1, 21).getValues();
    let sayacBit = null;
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][7]).trim() === String(enjNo).trim()) {
        const b = parseInt(vals[i][12]); if (!isNaN(b)) sayacBit = b;
      }
      if (String(vals[i][15]).trim() === String(enjNo).trim()) {
        const b = parseInt(vals[i][20]); if (!isNaN(b)) sayacBit = b;
      }
    }
    return jsonp(cb, { sayacBit });
  }

  return jsonp(cb, { error: 'Geçersiz istek' });
}

function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    let sheet   = ss.getSheetByName('Veriler');
    if (!sheet) sheet = ss.insertSheet('Veriler');
    if (sheet.getLastRow() === 0) yazBaslik(sheet);

    const vardiyaTarih = vardiyaBaslangicTarih(data.tarih, data.olcum_saat, data.vardiya);
    const enjSayisi    = data.enjSayisi || 1;

    // 2. enjeksiyon yoksa "00" yaz
    const enj2No   = enjSayisi === 2 ? data.enj2_no   : '00';
    const kasa2    = enjSayisi === 2 ? data.kasa2      : '00';
    const cevrim2  = enjSayisi === 2 ? data.cevrim2    : '00';
    const agirlik2 = enjSayisi === 2 ? data.agirlik2   : '00';
    const bas2     = enjSayisi === 2 ? data.sayac_bas2 : '00';
    const bit2     = enjSayisi === 2 ? data.sayac_bit2 : '00';
    const uretim2  = enjSayisi === 2 ? data.uretim2    : '00';
    const fire2    = enjSayisi === 2 ? data.fire2      : '00';

    sheet.appendRow([
      new Date().toLocaleString('tr-TR'), // A
      vardiyaTarih,                        // B
      data.adsoyad,                        // C
      data.vardiya,                        // D
      data.olcumNo,                        // E
      enjSayisi,                           // F
      data.olcum_saat,                     // G
      // Enjeksiyon 1
      data.enj1_no,                        // H
      data.kasa1,                          // I
      data.cevrim1,                        // J
      data.agirlik1,                       // K
      data.sayac_bas1,                     // L
      data.sayac_bit1,                     // M
      data.uretim1,                        // N
      data.fire1,                          // O
      // Enjeksiyon 2
      enj2No,                              // P
      kasa2,                               // Q
      cevrim2,                             // R
      agirlik2,                            // S
      bas2,                                // T
      bit2,                                // U
      uretim2,                             // V
      fire2,                               // W
      // Onay
      data.olcumNo === 3 ? (data.onaylandi ? 'ONAYLANDI' : 'BEKLİYOR') : '' // X
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'ok', olcum: data.olcumNo }))
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

function jsonp(callback, obj) {
  const body = callback
    ? callback + '(' + JSON.stringify(obj) + ')'
    : JSON.stringify(obj);
  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
