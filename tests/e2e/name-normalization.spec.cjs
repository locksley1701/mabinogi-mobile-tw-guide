const { test, expect } = require('@playwright/test');

async function openSearch(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    if (!localStorage.getItem('fanatio-theme')) localStorage.setItem('fanatio-theme', 'light');
  });
  await page.goto('/#/search');
  await page.waitForFunction(() => document.querySelector('#site-search'));
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
}

async function search(page, query) {
  const input = page.locator('#site-search');
  await input.fill(query);
  await expect(input).toHaveValue(query);
}

test.beforeEach(async ({ page }) => {
  await openSearch(page);
});

test('曾用名可找到台版正式名稱', async ({ page }) => {
  await search(page, '無工具採集');
  const result = page.locator('.result-row', { has: page.locator('strong', { hasText: '日常採集' }) }).first();
  await expect(result).toBeVisible();
  await expect(result.locator('.search-alias-note')).toHaveText('由曾用名「無工具採集」找到');
});

test('常見用字差異可找到正式名稱', async ({ page }) => {
  await search(page, '煉金術');
  const result = page.locator('.result-row', { has: page.locator('strong', { hasText: '鍊金術' }) }).first();
  await expect(result).toBeVisible();
  await expect(result.locator('.search-alias-note')).toHaveText('由常見誤稱「煉金術」找到');
});

test('其他版本藥草名稱可找到相關台版攻略', async ({ page }) => {
  await search(page, '藏藏花');
  const result = page.locator('.result-row', { has: page.locator('strong', { hasText: '採集藥草' }) }).first();
  await expect(result).toBeVisible();
  await expect(result.locator('.search-alias-note')).toHaveText('由其他版本名稱「藏藏花」找到');
});

test('料理曾用名不會取代正式名稱', async ({ page }) => {
  await search(page, '攜著吃的點心');
  const result = page.locator('.result-row', { has: page.locator('strong', { hasText: '擠著吃的點心' }) }).first();
  await expect(result).toBeVisible();
  await expect(result.locator('.search-alias-note')).toHaveText('由曾用名「攜著吃的點心」找到');
});

test('近似但不同的兩道點心不會被錯誤合併', async ({ page }) => {
  await search(page, '旅行者點心');
  await expect(page.locator('.result-row strong', { hasText: '旅行者點心' })).toBeVisible();
  await expect(page.locator('.result-row strong', { hasText: '擠著吃的點心' })).toHaveCount(0);
  await expect(page.locator('.search-alias-note')).toHaveCount(0);

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
