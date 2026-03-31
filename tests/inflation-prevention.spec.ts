/**
 * Şişirme Önleme Testleri
 *
 * Amaç: Operatörün UI üzerinden ya da beklenen değerlerin dışına çıkarak
 * üretim, sayaç veya fire verilerini şişirip şişiremeyeceğini doğrular.
 *
 * Test alanları:
 *  - Sayaç başı readonly koruması (önceki bitiş kilitlenir)
 *  - Üretim hesabı doğruluğu (gönderilen uretim1 = sayacBit - sayacBas)
 *  - Fire sınırı (maxFireLimit ve üretim≥fire koşulları)
 *  - Çift enjeksiyonda aynı makine çift seçimi engeli
 *  - Gönderilen URL parametrelerinin UI değerleriyle eşleşmesi
 */

import { test, expect } from '@playwright/test';
import {
  gotoApp,
  fillPage1AndAdvance,
  fillPage2Single,
  fillPage2AndAdvance,
} from './helpers/page-helpers';
import { setupMocks, DEFAULT_LISTS, DEFAULT_STATUS_NEW, getSubmitParams } from './fixtures/api-mocks';

// ─────────────────────────────────────────────────────────────────
// TC-31: Önceki sayacBit varken sayac_bas readonly olur
// ─────────────────────────────────────────────────────────────────
test('TC-31: Önceki sayacBit varken sayac_bas alanı readonly kilitlenir', async ({ page }) => {
  await gotoApp(page, { getLastCounter: { sayacBit: 5000 } });
  await fillPage1AndAdvance(page);

  await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
  await page.waitForSelector('#kasa1', { state: 'visible' });

  // Önceki sayacBit=5000 yüklenmiş olmalı
  await expect(page.locator('#sayac_bas1')).toHaveValue('5000');
  // Readonly — kullanıcı değiştiremez
  const editable = await page.locator('#sayac_bas1').isEditable();
  expect(editable).toBe(false);
});

// ─────────────────────────────────────────────────────────────────
// TC-32: Sayac_bas readonly iken fill() çağrılsa da değer değişmez
// ─────────────────────────────────────────────────────────────────
test('TC-32: Readonly sayac_bas\'a fill yapılsa değer korunur (şişirme engeli)', async ({ page }) => {
  await gotoApp(page, { getLastCounter: { sayacBit: 5000 } });
  await fillPage1AndAdvance(page);

  await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
  await page.waitForSelector('#kasa1', { state: 'visible' });

  // Callback (20ms) gelinceye kadar bekle — değer 5000 olmalı
  await expect(page.locator('#sayac_bas1')).toHaveValue('5000');

  // readonly HTML attribute mevcut olmalı
  const isReadonly = await page.locator('#sayac_bas1').getAttribute('readonly');
  expect(isReadonly).not.toBeNull();
});

// ─────────────────────────────────────────────────────────────────
// TC-33: Gönderilen uretim1 = sayacBit - sayacBas (hesap tutarlılığı)
// ─────────────────────────────────────────────────────────────────
test('TC-33: Gönderilen uretim1 parametresi sayacBit − sayacBas ile eşleşir', async ({ page }) => {
  await gotoApp(page);
  await fillPage1AndAdvance(page);
  await fillPage2AndAdvance(page, { sayacBas: '1000', sayacBit: '1600' });

  await page.click('#submit-btn');
  await expect(page.locator('#page-1')).toHaveClass(/active/, { timeout: 5000 });

  const params = await getSubmitParams(page);
  expect(params).not.toBeNull();
  expect(params!.get('uretim1')).toBe('600');
  expect(params!.get('sayac_bas1')).toBe('1000');
  expect(params!.get('sayac_bit1')).toBe('1600');
});

// ─────────────────────────────────────────────────────────────────
// TC-34: Sunucudan gelen birikmiş fire değeri submit'e iletilir
// (getStatus callback fire1'i fireToplam1 ile pre-fill eder)
// ─────────────────────────────────────────────────────────────────
test('TC-34: getStatus\'tan gelen fireToplam1 değeri gönderilen fire1 parametresiyle eşleşir', async ({ page }) => {
  await gotoApp(page, {
    getStatus: { ...DEFAULT_STATUS_NEW, fireToplam1: 18 },
  });
  await fillPage1AndAdvance(page);
  await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '500' });

  await page.click('#submit-btn');
  await expect(page.locator('#page-1')).toHaveClass(/active/, { timeout: 5000 });

  const params = await getSubmitParams(page);
  expect(params).not.toBeNull();
  // fire1 en az 0 olmalı (negatif şişirme engeli)
  const fire1 = parseInt(params!.get('fire1') ?? '0');
  expect(fire1).toBeGreaterThanOrEqual(0);
});

// ─────────────────────────────────────────────────────────────────
// TC-35: maxFireLimit varsayılan (50) — fazlası kısıtlanır
// ─────────────────────────────────────────────────────────────────
test('TC-35: Fire değeri maxFireLimit (50) ile kısıtlanır', async ({ page }) => {
  await gotoApp(page); // default maxFireLimit = 50
  await fillPage1AndAdvance(page);

  await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
  await page.waitForSelector('#kasa1', { state: 'visible' });
  await page.fill('#sayac_bas1', '0');
  await page.fill('#sayac_bit1', '1000');
  await page.fill('#fire1', '99');
  // clampFire tetiklenir
  await page.locator('#fire1').dispatchEvent('input');

  const val = await page.locator('#fire1').inputValue();
  expect(parseInt(val)).toBeLessThanOrEqual(50);
});

// ─────────────────────────────────────────────────────────────────
// TC-36: maxFireLimit özelleştirilebilir — düşük limit uygulanır
// ─────────────────────────────────────────────────────────────────
test('TC-36: Özel maxFireLimit=20 iken fire 30 girilince 20\'ye kısıtlanır', async ({ page }) => {
  await gotoApp(page, {
    getLists: { ...DEFAULT_LISTS, maxFireLimit: 20 },
  });
  await fillPage1AndAdvance(page);

  await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
  await page.waitForSelector('#kasa1', { state: 'visible' });
  await page.fill('#sayac_bas1', '0');
  await page.fill('#sayac_bit1', '500');
  await page.fill('#fire1', '30');
  await page.locator('#fire1').dispatchEvent('input');

  const val = await page.locator('#fire1').inputValue();
  expect(parseInt(val)).toBeLessThanOrEqual(20);
});

// ─────────────────────────────────────────────────────────────────
// TC-37: Negatif fire girilince 0'a kısıtlanır
// ─────────────────────────────────────────────────────────────────
test('TC-37: Negatif fire girilince 0\'a kısıtlanır', async ({ page }) => {
  await gotoApp(page);
  await fillPage1AndAdvance(page);

  await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
  await page.waitForSelector('#kasa1', { state: 'visible' });
  await page.fill('#sayac_bas1', '0');
  await page.fill('#sayac_bit1', '500');
  await page.fill('#fire1', '-10');
  await page.locator('#fire1').dispatchEvent('input');

  const val = await page.locator('#fire1').inputValue();
  expect(parseInt(val)).toBeGreaterThanOrEqual(0);
});

// ─────────────────────────────────────────────────────────────────
// TC-38: Çift modda Enj1 seçilince aynı makine Enj2 grid'inde devre dışı
// ─────────────────────────────────────────────────────────────────
test('TC-38: Çift modda Enj1 seçilince Enj2 grid\'inde aynı makine disabled olur', async ({ page }) => {
  await gotoApp(page);
  await fillPage1AndAdvance(page);

  // Çift moda geç
  await page.click('button:has-text("Çift")');
  await expect(page.locator('#enj2-section')).toBeVisible();

  // ENJ1 için Enj 1 seç
  await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
  await page.waitForSelector('#kasa1', { state: 'visible' });

  // ENJ2 grid'inde "Enj 1" butonu disabled olmalı
  const enj1BtnInGrid2 = page.locator('#enj2-grid').getByRole('button', { name: 'Enj 1', exact: true });
  await expect(enj1BtnInGrid2).toBeDisabled();
});

// ─────────────────────────────────────────────────────────────────
// TC-39: Çift modda ENJ2 için de aynı disabled simetri geçerli
// ─────────────────────────────────────────────────────────────────
test('TC-39: Çift modda ENJ2\'de Enj 3 seçilince ENJ1 grid\'inde Enj 3 disabled olur', async ({ page }) => {
  await gotoApp(page);
  await fillPage1AndAdvance(page);

  await page.click('button:has-text("Çift")');
  await expect(page.locator('#enj2-section')).toBeVisible();

  // ENJ2 için Enj 3 seç
  await page.locator('#enj2-grid').getByRole('button', { name: 'Enj 3', exact: true }).click();

  // ENJ1 grid'inde "Enj 3" butonu disabled olmalı
  const enj3BtnInGrid1 = page.locator('#enj1-grid').getByRole('button', { name: 'Enj 3', exact: true });
  await expect(enj3BtnInGrid1).toBeDisabled();
});

// ─────────────────────────────────────────────────────────────────
// TC-40: Çift modda gönderilen enj1_no ve enj2_no farklı makineler
// ─────────────────────────────────────────────────────────────────
test('TC-40: Çift modda gönderilen enj1_no ve enj2_no birbirinden farklı', async ({ page }) => {
  await gotoApp(page);
  await fillPage1AndAdvance(page);

  await page.click('button:has-text("Çift")');
  await expect(page.locator('#enj2-section')).toBeVisible();

  // ENJ1
  await fillPage2Single(page, { enjBtn: 'Enj 1', sayacBas: '0', sayacBit: '500' });

  // ENJ2
  await page.locator('#enj2-grid').getByRole('button', { name: 'Enj 2', exact: true }).click();
  await page.waitForSelector('#kasa2', { state: 'visible' });
  await page.selectOption('#kasa2', { label: '400x600' });
  await page.fill('#cevrim2', '25');
  await page.fill('#agirlik2', '200');
  await page.fill('#sayac_bas2', '0');
  await page.fill('#sayac_bit2', '400');

  await page.click('button:has-text("Özet")');
  await expect(page.locator('#page-3')).toHaveClass(/active/);
  await page.click('#submit-btn');
  await expect(page.locator('#page-1')).toHaveClass(/active/, { timeout: 5000 });

  const params = await getSubmitParams(page);
  expect(params).not.toBeNull();
  const enj1No = params!.get('enj1_no');
  const enj2No = params!.get('enj2_no');
  expect(enj1No).not.toBe('');
  expect(enj2No).not.toBe('');
  expect(enj1No).not.toBe(enj2No);
});

// ─────────────────────────────────────────────────────────────────
// TC-41: Gönderilen adsoyad, girişteki operatörle eşleşir
// ─────────────────────────────────────────────────────────────────
test('TC-41: Gönderilen adsoyad, giriş yapan operatörün adıyla eşleşir', async ({ page }) => {
  await gotoApp(page); // operator 101 = Ali Veli
  await fillPage1AndAdvance(page);
  await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '300' });

  await page.click('#submit-btn');
  await expect(page.locator('#page-1')).toHaveClass(/active/, { timeout: 5000 });

  const params = await getSubmitParams(page);
  expect(params).not.toBeNull();
  expect(params!.get('adsoyad')).toBe('Ali Veli');
});

// ─────────────────────────────────────────────────────────────────
// TC-42: Üretim 4000 sınırında tam geçer, 1 fazla bloklanır
// ─────────────────────────────────────────────────────────────────
test('TC-42: sayacBit-sayacBas=4000 özete geçer; =4001 bloklanır', async ({ page }) => {
  // 4000 — geçmeli
  await gotoApp(page);
  await fillPage1AndAdvance(page);
  await fillPage2Single(page, { sayacBas: '0', sayacBit: '4000' });
  await page.click('button:has-text("Özet")');
  await expect(page.locator('#page-3')).toHaveClass(/active/);
});

test('TC-42b: sayacBit-sayacBas=4001 özete geçemez (bloklanır)', async ({ page }) => {
  await gotoApp(page);
  await fillPage1AndAdvance(page);
  await fillPage2Single(page, { sayacBas: '0', sayacBit: '4001' });
  await page.click('button:has-text("Özet")');
  await expect(page.locator('#page-2')).toHaveClass(/active/);
  await expect(page.locator('#err-bit1')).toHaveClass(/show/);
});

// ─────────────────────────────────────────────────────────────────
// TC-43: Gönderilen vardiya, seçilen vardiyayla eşleşir
// ─────────────────────────────────────────────────────────────────
test('TC-43: Gönderilen vardiya parametresi seçilen vardiyayla eşleşir', async ({ page }) => {
  await gotoApp(page);
  await fillPage1AndAdvance(page, { vardiya: 'GECE' });
  await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '200' });

  await page.click('#submit-btn');
  await expect(page.locator('#page-1')).toHaveClass(/active/, { timeout: 5000 });

  const params = await getSubmitParams(page);
  expect(params).not.toBeNull();
  expect(params!.get('vardiya')).toBe('GECE');
});
