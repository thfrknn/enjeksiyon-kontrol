import { test, expect } from '@playwright/test';
import { gotoApp, fillPage1, fillPage1AndAdvance } from './helpers/page-helpers';
import { setupMocks } from './fixtures/api-mocks';

test.describe('Sayfa 1 — Giriş', () => {

  test('TC-01: Uygulama açılır ve operatör listesi dolar', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#adsoyad option[value="Ali Veli"]')).toBeAttached();
    await expect(page.locator('#step-1')).toHaveClass(/active/);
  });

  test('TC-02: Operatör seçilmeden ileri gidilemez', async ({ page }) => {
    await gotoApp(page);
    await page.click('button:has-text("İleri")');
    await expect(page.locator('#err-ad')).toHaveClass(/show/);
    await expect(page.locator('#page-1')).toHaveClass(/active/);
  });

  test('TC-03: Şifre boş bırakılırsa ileri gidilemez', async ({ page }) => {
    await gotoApp(page);
    await page.selectOption('#adsoyad', { label: 'Ali Veli' });
    await page.waitForSelector('#sifre-field', { state: 'visible' });
    await page.click('button:has-text("İleri")');
    await expect(page.locator('#err-sifre')).toHaveClass(/show/);
    await expect(page.locator('#page-1')).toHaveClass(/active/);
  });

  test('TC-04: Yanlış şifre girilirse ileri gidilemez', async ({ page }) => {
    await gotoApp(page);
    await page.selectOption('#adsoyad', { label: 'Ali Veli' });
    await page.waitForSelector('#sifre-field', { state: 'visible' });
    await page.fill('#sifre', '9999');
    await page.click('#v-sabah');
    await page.click('button:has-text("İleri")');
    await expect(page.locator('#err-sifre')).toHaveClass(/show/);
    await expect(page.locator('#page-1')).toHaveClass(/active/);
  });

  test('TC-05: Vardiya seçilmezse ileri gidilemez', async ({ page }) => {
    await gotoApp(page);
    await page.selectOption('#adsoyad', { label: 'Ali Veli' });
    await page.waitForSelector('#sifre-field', { state: 'visible' });
    await page.fill('#sifre', '1234');
    // Vardiya seçmeden ileri
    await page.click('button:has-text("İleri")');
    await expect(page.locator('#err-vardiya')).toHaveClass(/show/);
    await expect(page.locator('#page-1')).toHaveClass(/active/);
  });

  test('TC-06: Tüm alanlar doğru girilince sayfa 2ye geçilir', async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page);
    await expect(page.locator('#page-2')).toHaveClass(/active/);
    await expect(page.locator('#step-1')).toHaveClass(/done/);
  });

  test('TC-07: Şifremi Hatırla işaretlenince localStorage\'a kaydolur', async ({ page }) => {
    await gotoApp(page);
    await fillPage1(page, { hatirla: true });
    await page.click('button:has-text("İleri")');
    await expect(page.locator('#page-2')).toHaveClass(/active/);

    const saved = await page.evaluate(() => localStorage.getItem('sifre_Ali Veli'));
    expect(saved).toBe('1234');
  });

  test('TC-08: Kayıtlı şifre operatör seçilince otomatik dolar', async ({ page }) => {
    await setupMocks(page);
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('sifre_Ali Veli', '1234');
    });
    await page.goto('/index.html');
    await page.waitForSelector('#adsoyad', { state: 'visible' });

    await page.selectOption('#adsoyad', { label: 'Ali Veli' });
    await page.waitForSelector('#sifre-field', { state: 'visible' });

    await expect(page.locator('#sifre')).toHaveValue('1234');
    await expect(page.locator('#hatirla')).toBeChecked();
  });

  test('TC-09: Hatırla işaretsizse gönderim sonrası kayıtlı şifre silinir', async ({ page }) => {
    await setupMocks(page);
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('sifre_Ali Veli', '1234');
    });
    await page.goto('/index.html');
    await page.waitForSelector('#adsoyad', { state: 'visible' });

    await page.selectOption('#adsoyad', { label: 'Ali Veli' });
    await page.waitForSelector('#sifre-field', { state: 'visible' });
    // Hatırla'yı kaldır
    await page.uncheck('#hatirla');
    await page.fill('#sifre', '1234');
    await page.click('#v-sabah');
    await page.click('button:has-text("İleri")');
    await expect(page.locator('#page-2')).toHaveClass(/active/);

    const saved = await page.evaluate(() => localStorage.getItem('sifre_Ali Veli'));
    expect(saved).toBeNull();
  });

});
