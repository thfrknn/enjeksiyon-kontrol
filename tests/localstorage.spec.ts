import { test, expect } from '@playwright/test';
import { gotoApp, fillPage1, fillPage1AndAdvance } from './helpers/page-helpers';

test.describe('localStorage — Draft ve Şifre', () => {

  test('TC-27: saveDraft() çağrılınca form verileri localStorage\'a kaydolur', async ({ page }) => {
    await gotoApp(page);
    await fillPage1(page);

    await page.evaluate(() => (window as any).saveDraft());

    const raw = await page.evaluate(() => localStorage.getItem('enj_draft'));
    expect(raw).not.toBeNull();
    const draft = JSON.parse(raw!);
    expect(draft.adsoyad).toBe('Ali Veli');
    expect(draft.vardiya).toBe('SABAH');
  });

  test('TC-28: Tarayıcı yeniden açılınca draft banner görünür', async ({ page }) => {
    await gotoApp(page);
    await fillPage1(page);
    await page.evaluate(() => (window as any).saveDraft());

    // page.reload() does NOT trigger the localStorage.clear() from gotoApp
    // because gotoApp clears via evaluate (not addInitScript)
    await page.reload();
    await page.waitForSelector('#adsoyad', { state: 'visible' });

    await expect(page.locator('#draft-banner')).toBeVisible();
    await expect(page.locator('#draft-banner-sub')).toContainText('Ali Veli');
  });

  test('TC-29: "Devam Et" tıklanınca draft geri yüklenir', async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page); // goes to page 2
    await page.evaluate(() => (window as any).saveDraft()); // saves step=2

    await page.reload();
    await page.waitForSelector('#adsoyad', { state: 'visible' });
    await expect(page.locator('#draft-banner')).toBeVisible();

    await page.click('button:has-text("Devam Et")');

    // Draft restores operator, vardiya and step
    await expect(page.locator('#adsoyad')).toHaveValue('Ali Veli');
    await expect(page.locator('#v-sabah')).toHaveClass(/sel/);
    await expect(page.locator('#page-2')).toHaveClass(/active/);
  });

  test('TC-30: "Sil" tıklanınca draft temizlenir ve banner gizlenir', async ({ page }) => {
    await gotoApp(page);
    await fillPage1(page);
    await page.evaluate(() => (window as any).saveDraft());

    await page.reload();
    await page.waitForSelector('#adsoyad', { state: 'visible' });
    await expect(page.locator('#draft-banner')).toBeVisible();

    await page.click('button:has-text("Sil")');

    await expect(page.locator('#draft-banner')).toBeHidden();
    const raw = await page.evaluate(() => localStorage.getItem('enj_draft'));
    expect(raw).toBeNull();
  });

});
