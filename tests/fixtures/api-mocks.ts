import { Page } from '@playwright/test';

export const DEFAULT_LISTS = {
  kasaEbatlari: ['400x600'],
  kullanicilar: { '101': { name: 'Ali Veli', sifre: '1234' } },
  uretimLimiti: 2000,
  serverTime: Date.now(),
};

export const DEFAULT_STATUS_NEW = {
  olcumNo: 1,
  enj1: null,
  kasa1: null,
  enj2: null,
  kasa2: null,
  enjSayisi: 1,
  sayacBit1: null,
  sayacBit2: null,
  fireToplam1: 0,
  fireToplam2: 0,
};

// null means "no previous record" → sayac_bas stays editable in tests
export const DEFAULT_LAST_COUNTER = { sayacBit: null };

export type MockOverrides = {
  getLists?: object;
  getStatus?: object;
  getLastCounter?: object;
};

/**
 * Intercepts JSONP calls at the JS level by overriding Element.prototype.appendChild.
 * When a <script> tag pointing to script.google.com is appended, we immediately fire
 * the callback with mock data instead of making a real network request.
 *
 * Also mocks the fetch() POST call used for form submission.
 */
export async function setupMocks(page: Page, overrides: MockOverrides = {}) {
  const lists = overrides.getLists ?? DEFAULT_LISTS;
  const status = overrides.getStatus ?? DEFAULT_STATUS_NEW;
  const lastCounter = overrides.getLastCounter ?? DEFAULT_LAST_COUNTER;

  // Block Google Fonts so page 'load' event fires immediately (no external CSS hang)
  await page.route('**/fonts.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  await page.route('**/fonts.gstatic.com/**', route =>
    route.fulfill({ status: 200, body: '' })
  );

  await page.addInitScript(({ lists, status, lastCounter }) => {
    // Override time-based vardiya check so tests work at any hour
    (window as any).__testMode = true;

    // Intercept JSONP script tag appends
    const origAppend = Element.prototype.appendChild;
    // @ts-ignore
    Element.prototype.appendChild = function(child: any) {
      if (
        child &&
        child.tagName === 'SCRIPT' &&
        typeof child.src === 'string' &&
        child.src.includes('script.google.com')
      ) {
        try {
          const url = new URL(child.src);
          const action = url.searchParams.get('action');
          const cb = url.searchParams.get('callback');
          let data: object;
          if (action === 'getLists') data = lists;
          else if (action === 'getStatus') data = status;
          else if (action === 'getLastCounter') data = lastCounter;
          else data = {};

          // Fire callback after current microtask queue clears
          if (cb) {
            setTimeout(() => {
              const fn = (window as any)[cb];
              if (fn) fn(data);
            }, 20);
          }
        } catch {
          // ignore parse errors
        }
        // Don't append — avoid real network request
        return child;
      }
      return origAppend.call(this, child);
    };

    // Mock fetch for POST (form submission)
    const origFetch = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('script.google.com')) {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return origFetch(input, init);
    };
  }, { lists, status, lastCounter });
}
