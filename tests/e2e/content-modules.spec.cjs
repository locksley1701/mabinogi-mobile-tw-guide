const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-reading-size', 'comfortable');
    localStorage.setItem('fanatio-palette', 'forest');
    localStorage.setItem('fanatio-appearance', 'light');
  });
}

async function waitForModules(page) {
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
  await page.waitForFunction(() => Boolean(window.FanatioContentModules?.loaded));
}

async function expectNoHorizontalOverflow(page, label) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(widths.html, `${label}: html 水平溢位`).toBeLessThanOrEqual(widths.client + 1);
  expect(widths.body, `${label}: body 水平溢位`).toBeLessThanOrEqual(widths.client + 1);
}

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('首頁顯示四個世界與冒險章節入口', async ({ page }) => {
  await page.goto('/#/home');
  await waitForModules(page);
  const section = page.locator('[data-content-module-portals]');
  await expect(section).toBeVisible();
  await expect(section.locator('.portal-card')).toHaveCount(4);
  for (const route of ['equipment', 'maps', 'quests', 'events']) {
    await expect(section.locator(`a[href="#/${route}"]`)).toBeVisible();
  }
  await expectNoHorizontalOverflow(page, '首頁四模組入口');
});

test('尚未實作的三個列表 route 顯示架構與自然空狀態', async ({ page }) => {
  const modules = [
    ['equipment', '裝備章節', 13],
    ['quests', '任務章節', 15],
    ['events', '活動章節', 15]
  ];

  for (const [route, title, issue] of modules) {
    await page.goto(`/#/${route}`);
    await waitForModules(page);
    await expect(page.locator('h1')).toContainText(title);
    await expect(page.locator('.content-module-empty')).toContainText('不使用韓版資料或推測數值');
    await expect(page.locator('.page-meta')).toContainText(`Issue #${issue}`);
    await expect(page.locator(`[data-route="${route}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-content-module-nav]')).toHaveAttribute('open', '');
    await expectNoHorizontalOverflow(page, route);
  }
});

test('尚未實作的詳情 route 保留請求 ID 並提供返回列表', async ({ page }) => {
  const details = [
    ['equipment/test-sword', 'equipment', 'test-sword'],
    ['quest/sample-quest', 'quests', 'sample-quest'],
    ['event/sample-event', 'events', 'sample-event']
  ];

  for (const [route, listRoute, requestedId] of details) {
    await page.goto(`/#/${route}`);
    await waitForModules(page);
    await expect(page.locator('.content-module-route-id code')).toHaveText(requestedId);
    await expect(page.locator('.content-module-empty')).toContainText('不以假資料代替正式內容');
    await expect(page.locator(`.content-module-back[href="#/${listRoute}"]`)).toBeVisible();
    await expect(page.locator(`[data-route="${listRoute}"]`)).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalOverflow(page, route);
  }
});

test('快速查詢可依四類模組篩選章節入口', async ({ page }) => {
  await page.goto('/#/search');
  await waitForModules(page);

  const select = page.locator('#search-category');
  const input = page.locator('#site-search');
  for (const value of ['equipment', 'map', 'quest', 'event']) {
    await expect(select.locator(`option[value="${value}"]`)).toHaveCount(1);
  }

  await input.fill('地圖');
  const mapResult = page.locator('.result-row').filter({
    has: page.locator('a[href="#/maps"]')
  });
  await expect(mapResult).toHaveCount(1);
  await expect(mapResult).toContainText('地圖章節');
  await expect(mapResult.locator('a[href="#/maps"]')).toBeVisible();

  await select.selectOption('event');
  await input.fill('活動');
  const eventResult = page.locator('.result-row').filter({
    has: page.locator('a[href="#/events"]')
  });
  await expect(eventResult).toHaveCount(1);
  await expect(eventResult).toContainText('活動章節');
  await expectNoHorizontalOverflow(page, '四模組搜尋');
});
