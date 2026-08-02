const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-reading-size', 'comfortable');
    localStorage.setItem('fanatio-palette', 'forest');
    localStorage.setItem('fanatio-appearance', 'light');
  });
}

async function waitForMaps(page) {
  await page.waitForFunction(() => Boolean(window.FanatioMapData?.loaded));
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
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

test('地圖列表顯示五筆來源支持的地圖與採集區', async ({ page }) => {
  await page.goto('/#/maps');
  await waitForMaps(page);

  const workspace = page.locator('#workspace');
  await expect(workspace.locator('h1')).toHaveText('地圖與採集位置');
  await expect(workspace.locator('.map-record')).toHaveCount(5);
  await expect(workspace.locator('a[href="#/map/ice-canyon-zone-3"]')).toContainText('冰之峽谷 3 區');
  await expect(workspace.locator('.map-source-note')).toContainText('泛稱地點');
  await expect(page.locator('[data-route="maps"]')).toHaveAttribute('aria-current', 'page');
  await expectNoHorizontalOverflow(page, '地圖列表');
});

test('名稱類型篩選不會把區域泛稱冒充正式地圖', async ({ page }) => {
  await page.goto('/#/maps');
  await waitForMaps(page);

  const workspace = page.locator('#workspace');
  await workspace.locator('[data-map-type="generic-area"]').click();
  await expect(workspace.locator('.map-record')).toHaveCount(3);
  await expect(workspace.locator('.map-record')).toContainText('區域泛稱');
  await expect(workspace.locator('.map-record')).not.toContainText('冰之峽谷 3 區');

  await workspace.locator('[data-map-type="formal-map"]').click();
  await expect(workspace.locator('.map-record')).toHaveCount(1);
  await expect(workspace.locator('.map-record')).toContainText('冰之峽谷 3 區');
  await expectNoHorizontalOverflow(page, '地圖類型篩選');
});

test('冰之峽谷詳情顯示躲躲花與採集藥草關聯', async ({ page }) => {
  await page.goto('/#/map/ice-canyon-zone-3');
  await waitForMaps(page);

  const workspace = page.locator('#workspace');
  await expect(workspace.locator('h1')).toHaveText('冰之峽谷 3 區');
  await expect(workspace.locator('.map-detail-hero')).toContainText('正式地圖名稱');
  await expect(workspace.locator('.map-spots')).toContainText('躲躲花');
  await expect(workspace.locator('.map-detail-grid')).toContainText('採集藥草');
  await expect(workspace.locator('a[href="#/maps"]')).toBeVisible();
  await expectNoHorizontalOverflow(page, '冰之峽谷詳情');
});

test('區域泛稱詳情清楚標示正式名稱待確認', async ({ page }) => {
  await page.goto('/#/map/sheep-pasture-area');
  await waitForMaps(page);

  const workspace = page.locator('#workspace');
  await expect(workspace.locator('h1')).toHaveText('羊放牧地');
  await expect(workspace.locator('.map-detail-hero')).toContainText('區域泛稱');
  await expect(workspace.locator('.map-detail-hero')).toContainText('正式名稱待確認');
  await expect(workspace.locator('.map-spots')).toContainText('金羊毛');
  await expectNoHorizontalOverflow(page, '區域泛稱詳情');
});

test('快速查詢可用採集物找到地圖詳情', async ({ page }) => {
  await page.goto('/#/search');
  await waitForMaps(page);

  const workspace = page.locator('#workspace');
  await workspace.locator('#site-search').fill('躲躲花');
  await expect(workspace.locator('.result-row')).toContainText('冰之峽谷 3 區');
  await expect(workspace.locator('.result-row a[href="#/map/ice-canyon-zone-3"]')).toBeVisible();

  await workspace.locator('#site-search').fill('');
  await workspace.locator('#search-category').selectOption('map');
  await expect(workspace.locator('.result-row')).toHaveCount(6);
  await expectNoHorizontalOverflow(page, '地圖快速查詢');
});

test('未知地圖 ID 保留請求內容並提供返回入口', async ({ page }) => {
  await page.goto('/#/map/not-recorded-yet');
  await waitForMaps(page);

  const workspace = page.locator('#workspace');
  await expect(workspace.locator('.content-module-route-id code')).toHaveText('not-recorded-yet');
  await expect(workspace.locator('.content-module-empty')).toContainText('不以其他版本位置代替台版資料');
  await expect(workspace.locator('a[href="#/maps"]')).toBeVisible();
  await expectNoHorizontalOverflow(page, '未知地圖詳情');
});
