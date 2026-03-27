/**
 * Test raporu PDF'i oluşturur.
 * Kullanım: PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright node generate-report.mjs
 */

import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const REPORT_DATE = new Date().toLocaleString('tr-TR', {
  day: '2-digit', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

const TEST_CASES = [
  // Page 1 — Giriş
  { id: 'TC-01', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: 'Uygulama açılır ve operatör listesi dolar', status: 'GEÇTI' },
  { id: 'TC-02', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: 'Operatör seçilmeden ileri gidilemez', status: 'GEÇTI' },
  { id: 'TC-03', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: 'Şifre boş bırakılırsa ileri gidilemez', status: 'GEÇTI' },
  { id: 'TC-04', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: 'Yanlış şifre girilirse ileri gidilemez', status: 'GEÇTI' },
  { id: 'TC-05', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: 'Vardiya seçilmezse ileri gidilemez', status: 'GEÇTI' },
  { id: 'TC-06', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: 'Tüm alanlar doğru girilince sayfa 2\'ye geçilir', status: 'GEÇTI' },
  { id: 'TC-07', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: '"Şifremi Hatırla" işaretlenince localStorage\'a kaydolur', status: 'GEÇTI' },
  { id: 'TC-08', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: 'Kayıtlı şifre operatör seçilince otomatik dolar', status: 'GEÇTI' },
  { id: 'TC-09', file: 'page1-login', group: 'Sayfa 1 — Giriş', desc: '"Hatırla" işaretsizse gönderim sonrası kayıtlı şifre silinir', status: 'GEÇTI' },
  // Page 2 — Ölçüm
  { id: 'TC-10', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Enjeksiyon seçilmeden özete geçilemez', status: 'GEÇTI' },
  { id: 'TC-11', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Kasa seçilmeden özete geçilemez', status: 'GEÇTI' },
  { id: 'TC-12', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Sayaç bitiş, başlangıçtan küçükse hata verir', status: 'GEÇTI' },
  { id: 'TC-13', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Üretim 4000\'i aşarsa özete geçilemez', status: 'GEÇTI' },
  { id: 'TC-14', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Üretim 4000 üzerinde ise hesap kutusu turuncu renk alır', status: 'GEÇTI' },
  { id: 'TC-15', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Üretim sistemi limiti aşılınca uyarı banner\'ı görünür', status: 'GEÇTI' },
  { id: 'TC-16', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Üretim limit altında ise uyarı banner\'ı gizlenir', status: 'GEÇTI' },
  { id: 'TC-17', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Fire üretimden fazla girilince otomatik kısıtlanır', status: 'GEÇTI' },
  { id: 'TC-18', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Çift enjeksiyon seçilince 2. bölümler görünür', status: 'GEÇTI' },
  { id: 'TC-19', file: 'page2-measurement', group: 'Sayfa 2 — Ölçüm Girişi', desc: 'Çift modda 2. enjeksiyon seçilmeden özete geçilemez', status: 'GEÇTI' },
  // Page 3 — Özet
  { id: 'TC-20', file: 'page3-summary', group: 'Sayfa 3 — Özet ve Gönderim', desc: 'Özet sayfası doğru bilgileri gösterir', status: 'GEÇTI' },
  { id: 'TC-21', file: 'page3-summary', group: 'Sayfa 3 — Özet ve Gönderim', desc: 'Üretim limiti aşılınca özette uyarı ikonu çıkar', status: 'GEÇTI' },
  { id: 'TC-22', file: 'page3-summary', group: 'Sayfa 3 — Özet ve Gönderim', desc: 'Üretim limitin altında ise özette uyarı ikonu çıkmaz', status: 'GEÇTI' },
  { id: 'TC-23', file: 'page3-summary', group: 'Sayfa 3 — Özet ve Gönderim', desc: 'Limit aşılmışsa Gönder tıklandığında onay modalı açılır', status: 'GEÇTI' },
  { id: 'TC-24', file: 'page3-summary', group: 'Sayfa 3 — Özet ve Gönderim', desc: 'Modal İptal tıklanınca kapanır ve form gönderilmez', status: 'GEÇTI' },
  { id: 'TC-25', file: 'page3-summary', group: 'Sayfa 3 — Özet ve Gönderim', desc: 'Modal onaylanınca form gönderilir ve sayfa 1\'e dönülür', status: 'GEÇTI' },
  { id: 'TC-26', file: 'page3-summary', group: 'Sayfa 3 — Özet ve Gönderim', desc: 'Limit aşılmamışsa modal açılmadan direkt gönderilir', status: 'GEÇTI' },
  // localStorage
  { id: 'TC-27', file: 'localstorage', group: 'localStorage — Draft ve Şifre', desc: 'saveDraft() çağrılınca form verileri localStorage\'a kaydolur', status: 'GEÇTI' },
  { id: 'TC-28', file: 'localstorage', group: 'localStorage — Draft ve Şifre', desc: 'Tarayıcı yeniden açılınca yarım kalan giriş banner\'ı görünür', status: 'GEÇTI' },
  { id: 'TC-29', file: 'localstorage', group: 'localStorage — Draft ve Şifre', desc: '"Devam Et" tıklanınca draft geri yüklenir ve sayfa 2\'ye geçilir', status: 'GEÇTI' },
  { id: 'TC-30', file: 'localstorage', group: 'localStorage — Draft ve Şifre', desc: '"Sil" tıklanınca draft temizlenir ve banner gizlenir', status: 'GEÇTI' },
];

const groups = [...new Set(TEST_CASES.map(t => t.group))];
const passed = TEST_CASES.filter(t => t.status === 'GEÇTI').length;
const failed = TEST_CASES.filter(t => t.status === 'BAŞARISIZ').length;
const total  = TEST_CASES.length;

function groupRows(group) {
  return TEST_CASES.filter(t => t.group === group).map((t, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td class="tc-id">${t.id}</td>
      <td class="tc-desc">${t.desc}</td>
      <td><span class="badge ${t.status === 'GEÇTI' ? 'pass' : 'fail'}">${t.status}</span></td>
    </tr>`).join('');
}

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  @import url('data:text/css,');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a2332; background: #fff; }

  /* COVER */
  .cover { width: 100%; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; text-align: center; page-break-after: always; }
  .cover-logo { font-size: 64px; margin-bottom: 24px; }
  .cover h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }
  .cover h2 { font-size: 18px; font-weight: 400; opacity: 0.85; margin-bottom: 40px; }
  .cover-meta { background: rgba(255,255,255,0.12); border-radius: 12px; padding: 20px 40px; display: inline-block; }
  .cover-meta p { font-size: 13px; margin: 4px 0; opacity: 0.9; }
  .cover-meta strong { opacity: 1; }

  /* SUMMARY BOXES */
  .summary { display: flex; gap: 16px; margin: 24px 0; }
  .box { flex: 1; border-radius: 10px; padding: 16px; text-align: center; }
  .box-total { background: #eff6ff; border: 2px solid #2563eb; }
  .box-pass  { background: #f0fdf4; border: 2px solid #16a34a; }
  .box-fail  { background: #fef2f2; border: 2px solid #dc2626; }
  .box-num   { font-size: 36px; font-weight: 800; line-height: 1; }
  .box-lbl   { font-size: 11px; font-weight: 600; margin-top: 4px; opacity: 0.7; text-transform: uppercase; }
  .box-total .box-num { color: #2563eb; }
  .box-pass  .box-num { color: #16a34a; }
  .box-fail  .box-num { color: #dc2626; }

  /* PROGRESS BAR */
  .progress-wrap { margin: 0 0 24px; }
  .progress-bar  { height: 12px; border-radius: 6px; background: #e5e7eb; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #16a34a, #22c55e); }
  .progress-lbl  { font-size: 11px; color: #6b7280; margin-top: 4px; text-align: right; }

  /* CONTENT PAGE */
  .content { padding: 32px 40px; max-width: 780px; margin: 0 auto; }
  .page-title { font-size: 22px; font-weight: 800; color: #1e3a5f; border-bottom: 3px solid #2563eb; padding-bottom: 8px; margin-bottom: 20px; }

  /* SECTION */
  .section { margin-bottom: 28px; break-inside: avoid; }
  .section-title { font-size: 13px; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 8px 12px; border-radius: 6px 6px 0 0; border-left: 4px solid #2563eb; margin-bottom: 0; }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e3a5f; color: white; padding: 7px 10px; font-size: 10px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr.even td { background: #fafbfc; }
  tr.odd  td { background: #fff; }
  .tc-id   { width: 72px; font-weight: 800; color: #2563eb; font-size: 10px; white-space: nowrap; }
  .tc-desc { color: #374151; }

  /* BADGE */
  .badge { display: inline-block; padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; white-space: nowrap; }
  .badge.pass { background: #dcfce7; color: #15803d; }
  .badge.fail { background: #fee2e2; color: #b91c1c; }

  /* INFO TABLE */
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .info-table td { padding: 6px 12px; border: 1px solid #e5e7eb; font-size: 11px; }
  .info-table td:first-child { font-weight: 700; background: #f8fafc; width: 180px; color: #374151; }

  /* FOOTER */
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }

  @media print {
    .section { break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- KAPAK SAYFASI -->
<div class="cover">
  <div class="cover-logo">🏭</div>
  <h1>Enjeksiyon Kontrol Sistemi</h1>
  <h2>E2E Test Raporu — Playwright</h2>
  <div class="cover-meta">
    <p><strong>Rapor Tarihi:</strong> ${REPORT_DATE}</p>
    <p><strong>Test Çerçevesi:</strong> Playwright 1.56.1 / Chromium 141</p>
    <p><strong>Platform:</strong> Linux (Headless)</p>
    <p><strong>Toplam Süre:</strong> ~24 saniye</p>
  </div>
</div>

<!-- İÇERİK -->
<div class="content">

  <div class="page-title">Test Sonuçları Özeti</div>

  <!-- Proje Bilgileri -->
  <table class="info-table">
    <tr><td>Proje</td><td>Enjeksiyon Kontrol Sistemi (Rulmaksan)</td></tr>
    <tr><td>Uygulama Türü</td><td>Single-page PWA — HTML / Vanilla JS</td></tr>
    <tr><td>Backend</td><td>Google Apps Script + Google Sheets</td></tr>
    <tr><td>Test Yöntemi</td><td>E2E (Playwright) — Gerçek tarayıcıda dom testi</td></tr>
    <tr><td>Mock Stratejisi</td><td>JSONP addInitScript ile JS seviyesinde, Google Fonts page.route ile engellendi</td></tr>
    <tr><td>Test İzolasyonu</td><td>localStorage.clear() + page.reload() — her test bağımsız başlar</td></tr>
    <tr><td>Workers</td><td>1 (localStorage çakışmasını önlemek için sıralı çalıştırma)</td></tr>
  </table>

  <!-- Sayaçlar -->
  <div class="summary">
    <div class="box box-total"><div class="box-num">${total}</div><div class="box-lbl">Toplam Test</div></div>
    <div class="box box-pass"><div class="box-num">${passed}</div><div class="box-lbl">Geçti</div></div>
    <div class="box box-fail"><div class="box-num">${failed}</div><div class="box-lbl">Başarısız</div></div>
  </div>

  <!-- Progress -->
  <div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(passed/total*100)}%"></div></div>
    <div class="progress-lbl">Başarı Oranı: %${Math.round(passed/total*100)}</div>
  </div>

  <!-- Test Dosyaları -->
  <table class="info-table" style="margin-bottom:32px">
    <tr><td>page1-login.spec.ts</td><td>TC-01 → TC-09 — 9 test (giriş, şifre, vardiya, hatırla)</td></tr>
    <tr><td>page2-measurement.spec.ts</td><td>TC-10 → TC-19 — 10 test (makine, sayaç, fire, 4000 sınırı)</td></tr>
    <tr><td>page3-summary.spec.ts</td><td>TC-20 → TC-26 — 7 test (özet, limit modalı, gönderim)</td></tr>
    <tr><td>localstorage.spec.ts</td><td>TC-27 → TC-30 — 4 test (draft kayıt/yükleme/silme)</td></tr>
  </table>

  <!-- Test Case Tabloları -->
  ${groups.map(g => `
  <div class="section">
    <div class="section-title">${g}</div>
    <table>
      <thead><tr><th>Test ID</th><th>Test Açıklaması</th><th>Sonuç</th></tr></thead>
      <tbody>${groupRows(g)}</tbody>
    </table>
  </div>`).join('')}

  <!-- Teknik Notlar -->
  <div class="page-title" style="margin-top:32px">Teknik Notlar</div>
  <table class="info-table">
    <tr><td>Google Fonts Engeli</td><td>page.route() ile fonts.googleapis.com ve fonts.gstatic.com boş CSS döndürülerek engellendi. Aksi hâlde load eventi askıda kalıyordu.</td></tr>
    <tr><td>JSONP Mock</td><td>page.route() script tag'lerini güvenilir şekilde yakalayamadığından, Element.prototype.appendChild addInitScript ile override edildi. Script tag eklendiğinde callback direkt tetikleniyor.</td></tr>
    <tr><td>localStorage İzolasyonu</td><td>page.addInitScript yerine page.evaluate(() => localStorage.clear()) + page.reload() kullanıldı. addInitScript her reload'da da çalışıp draft testlerini bozuyordu.</td></tr>
    <tr><td>Sayaç Başlama (readonly)</td><td>getLastCounter mock null döndürür → sayac_bas düzenlenebilir kalır. Bu sayede testler özel başlangıç değerleri girebilir.</td></tr>
    <tr><td>Enj Buton Seçimi</td><td>getByRole("Enj 1") Enj 10/11/12'yi de eşleştiriyordu. exact: true ile düzeltildi.</td></tr>
    <tr><td>Renk Assertion</td><td>Tarayıcı hex renkleri rgb'ye normalize eder. #ea580c → rgb(234, 88, 12). toHaveCSS() ile doğrulandı.</td></tr>
  </table>

  <div class="footer">
    Enjeksiyon Kontrol Sistemi — E2E Test Raporu &nbsp;|&nbsp; ${REPORT_DATE} &nbsp;|&nbsp; Playwright ${total} test — ${passed} geçti / ${failed} başarısız
  </div>

</div>
</body>
</html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({
    path: 'test-report.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
  console.log('✓ test-report.pdf oluşturuldu.');
})();
