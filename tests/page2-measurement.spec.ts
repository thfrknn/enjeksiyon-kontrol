import { test, expect } from '@playwright/test';
import { gotoApp, fillPage1AndAdvance, fillPage2Single } from './helpers/page-helpers';

test.describe('Sayfa 2 — Ölçüm Girişi', () => {

  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page);
  });

  test('TC-10: Enjeksiyon seçilmeden özete geçilemez', async ({ page }) => {
    await page.click('button:has-text("Özet")');
    await expect(page.locator('#enj1-grid')).toHaveClass(/error/);
    await expect(page.locator('#err-enj1')).toHaveClass(/show/);
    await expect(page.locator('#page-2')).toHaveClass(/active/);
  });

  test('TC-11: Kasa seçilmeden özete geçilemez', async ({ page }) => {
    await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
    await page.waitForSelector('#kasa1', { state: 'visible' });
    // kasa seçmeden geç
    await page.click('button:has-text("Özet")');
    await expect(page.locator('#err-kasa1')).toHaveClass(/show/);
  });

  test('TC-12: Sayaç bitiş, başlangıçtan küçükse hata verir', async ({ page }) => {
    await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
    await page.waitForSelector('#kasa1', { state: 'visible' });
    await page.selectOption('#kasa1', { label: '400x600' });
    await page.fill('#cevrim1', '30');
    await page.fill('#agirlik1', '250');
    await page.fill('#sayac_bas1', '2000');
    await page.fill('#sayac_bit1', '1999');
    await page.click('button:has-text("Özet")');
    await expect(page.locator('#err-bit1')).toHaveClass(/show/);
    await expect(page.locator('#err-bit1')).toContainText('Bitiş < Başlama');
  });

  test('TC-13: Üretim 4000\'i aşarsa özete geçilemez', async ({ page }) => {
    await page.locator('#enj1-grid').getByRole('button', { name: 'Enj 1', exact: true }).click();
    await page.waitForSelector('#kasa1', { state: 'visible' });
    await page.selectOption('#kasa1', { label: '400x600' });
    await page.fill('#cevrim1', '30');
    await page.fill('#agirlik1', '250');
    await page.fill('#sayac_bas1', '0');
    await page.fill('#sayac_bit1', '4001');
    await page.click('button:has-text("Özet")');
    await expect(page.locator('#err-bit1')).toHaveClass(/show/);
    await expect(page.locator('#err-bit1')).toContainText('4000');
  });

  test('TC-14: Üretim 4000 üzerinde ise hesap kutusu turuncu renk alır ve uyarı gösterir', async ({ page }) => {
    await page.fill('#sayac_bas1', '0');
    await page.fill('#sayac_bit1', '4001');
    // Browser normalizes hex to rgb — orange #ea580c = rgb(234, 88, 12)
    await expect(page.locator('#uretim-box1')).toHaveCSS('border-color', 'rgb(234, 88, 12)');
    await expect(page.locator('#result-val1')).toContainText('⚠️');
  });

  test('TC-15: Üretim limiti (2000) aşılınca limit uyarısı görünür', async ({ page }) => {
    await page.fill('#sayac_bas1', '0');
    await page.fill('#sayac_bit1', '2500');
    await expect(page.locator('#limit-warn1')).toBeVisible();
  });

  test('TC-16: Üretim limitin altında ise uyarı gizlenir', async ({ page }) => {
    await page.fill('#sayac_bas1', '0');
    await page.fill('#sayac_bit1', '1500');
    await expect(page.locator('#limit-warn1')).toBeHidden();
  });

  test('TC-17: Fire, üretimden fazla girilince otomatik kısıtlanır', async ({ page }) => {
    await page.fill('#sayac_bas1', '0');
    await page.fill('#sayac_bit1', '100');
    await page.fill('#fire1', '150');
    // clampFire(1) runs on input and clamps value to max (100)
    const fireVal = await page.locator('#fire1').inputValue();
    expect(parseInt(fireVal)).toBeLessThanOrEqual(100);
  });

  test('TC-18: Çift enjeksiyon seçilince 2. bölümler görünür', async ({ page }) => {
    await page.click('button:has-text("Çift")');
    await expect(page.locator('#enj2-section')).toBeVisible();
    await expect(page.locator('#olcum-enj2-section')).toBeVisible();
  });

  test('TC-19: Çift modda 2. enjeksiyon seçilmeden özete geçilemez', async ({ page }) => {
    await page.click('button:has-text("Çift")');
    // ENJ1 tamamen doldur
    await fillPage2Single(page);
    // ENJ2 boş bırak, özete tıkla
    await page.click('button:has-text("Özet")');
    await expect(page.locator('#err-enj2')).toHaveClass(/show/);
    await expect(page.locator('#page-2')).toHaveClass(/active/);
  });

});
