import { Page, expect } from '@playwright/test';
import { setupMocks } from '../fixtures/api-mocks';

export type { } from '../fixtures/api-mocks';

export async function gotoApp(page: Page, overrides = {}) {
  await setupMocks(page, overrides);
  // First load — page initializes with whatever is in localStorage
  await page.goto('/index.html');
  // Clear localStorage via evaluate (runs in live page, NOT as an init script,
  // so subsequent page.reload() calls in tests will NOT clear it again)
  await page.evaluate(() => localStorage.clear());
  // Reload so this test starts clean
  await page.reload();
  // Wait until getLists JSONP mock has populated and shown the operator select
  await page.waitForSelector('#adsoyad', { state: 'visible', timeout: 8000 });
}

export interface Page1Opts {
  operator?: string;
  password?: string;
  vardiya?: 'SABAH' | 'AKSAM' | 'GECE';
  hatirla?: boolean;
}

export async function fillPage1(page: Page, opts: Page1Opts = {}) {
  const { operator = 'Ali Veli', password = '1234', vardiya = 'SABAH', hatirla = false } = opts;

  await page.selectOption('#adsoyad', { label: operator });
  await page.waitForSelector('#sifre-field', { state: 'visible' });
  await page.fill('#sifre', password);

  if (hatirla) {
    await page.check('#hatirla');
  }

  const vardiyaId = { SABAH: 'v-sabah', AKSAM: 'v-aksam', GECE: 'v-gece' }[vardiya];
  await page.click(`#${vardiyaId}`);
}

export async function fillPage1AndAdvance(page: Page, opts: Page1Opts = {}) {
  await fillPage1(page, opts);
  await page.click('button:has-text("İleri")');
  await expect(page.locator('#page-2')).toHaveClass(/active/);
}

export interface Page2Opts {
  enjBtn?: string;
  kasa?: string;
  cevrim?: string;
  agirlik?: string;
  sayacBas?: string;
  sayacBit?: string;
}

export async function fillPage2Single(page: Page, opts: Page2Opts = {}) {
  const {
    enjBtn = 'Enj 1',
    kasa = '400x600',
    cevrim = '30',
    agirlik = '250',
    sayacBas = '1000',
    sayacBit = '1500',
  } = opts;

  // exact: true prevents matching Enj 10, 11, 12 when enjBtn is 'Enj 1'
  await page.locator('#enj1-grid').getByRole('button', { name: enjBtn, exact: true }).click();
  await page.waitForSelector('#kasa1', { state: 'visible' });
  await page.selectOption('#kasa1', { label: kasa });

  await page.fill('#cevrim1', cevrim);
  await page.fill('#agirlik1', agirlik);

  const basEditable = await page.locator('#sayac_bas1').isEditable();
  if (basEditable) {
    await page.fill('#sayac_bas1', sayacBas);
  }
  await page.fill('#sayac_bit1', sayacBit);
}

export async function fillPage2AndAdvance(page: Page, opts: Page2Opts = {}) {
  await fillPage2Single(page, opts);
  await page.click('button:has-text("Özet")');
  await expect(page.locator('#page-3')).toHaveClass(/active/);
}
