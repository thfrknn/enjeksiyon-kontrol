import { test, expect } from '@playwright/test';
import { gotoApp, fillPage1AndAdvance, fillPage2AndAdvance } from './helpers/page-helpers';

test.describe('Sayfa 3 — Özet ve Gönderim', () => {

  test('TC-20: Özet sayfası doğru bilgileri gösterir', async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page);
    await fillPage2AndAdvance(page, { sayacBas: '1000', sayacBit: '1500' });

    const body = page.locator('#summary-body');
    await expect(body).toContainText('Ali Veli');
    await expect(body).toContainText('Sabah');
    await expect(body).toContainText('Enjeksiyon 1');
    await expect(body).toContainText('400x600');
    // sayaç is shown as raw "1000 → 1500" (no formatting)
    await expect(body).toContainText('1000');
    await expect(body).toContainText('1500');
    // üretim = 500 formatted with Turkish locale = "500 adet"
    await expect(body).toContainText('500 adet');
  });

  test('TC-21: Üretim limiti aşılınca özette uyarı ikonu çıkar', async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page);
    // 2500 > limit(2000), causes ⚠️
    await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '2500' });

    await expect(page.locator('#summary-body')).toContainText('⚠️');
  });

  test('TC-22: Üretim limitin altında ise özette uyarı ikonu çıkmaz', async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page);
    await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '1500' });

    await expect(page.locator('#summary-body')).not.toContainText('⚠️');
  });

  test('TC-23: Üretim limiti aşılmışsa Gönder tıklandığında modal açılır', async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page);
    await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '2500' });

    await page.click('#submit-btn');
    await expect(page.locator('#limit-modal')).toBeVisible();
    // Turkish locale: 2500 → "2.500"
    await expect(page.locator('#limit-modal')).toContainText('2.500');
  });

  test('TC-24: Modal İptal tıklanınca modal kapanır ve form gönderilmez', async ({ page }) => {
    let postFired = false;
    page.on('request', req => {
      if (req.method() === 'POST') postFired = true;
    });

    await gotoApp(page);
    await fillPage1AndAdvance(page);
    await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '2500' });

    await page.click('#submit-btn');
    await expect(page.locator('#limit-modal')).toBeVisible();
    await page.click('button:has-text("İptal")');
    await expect(page.locator('#limit-modal')).toBeHidden();
    expect(postFired).toBe(false);
  });

  test('TC-25: Modal onayla tıklanınca form gönderilir ve sayfa 1e dönülür', async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page);
    await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '2500' });

    await page.click('#submit-btn');
    await expect(page.locator('#limit-modal')).toBeVisible();
    await page.click('button:has-text("Evet, Gönder")');

    await expect(page.locator('#page-1')).toHaveClass(/active/, { timeout: 5000 });
  });

  test('TC-26: Limit aşılmamışsa modal açılmadan direkt gönderilir', async ({ page }) => {
    await gotoApp(page);
    await fillPage1AndAdvance(page);
    await fillPage2AndAdvance(page, { sayacBas: '0', sayacBit: '1500' });

    await page.click('#submit-btn');

    await expect(page.locator('#limit-modal')).toBeHidden();
    await expect(page.locator('#page-1')).toHaveClass(/active/, { timeout: 5000 });
  });

});
