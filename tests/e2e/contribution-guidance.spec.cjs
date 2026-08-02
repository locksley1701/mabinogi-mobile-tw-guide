const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-reading-size', 'comfortable');
    localStorage.setItem('fanatio-palette', 'forest');
    localStorage.setItem('fanatio-appearance', 'light');
  });
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

async function waitForModuleGuidance(page, context) {
  await page.waitForFunction(() => Boolean(window.FanatioContentModules?.loaded));
  const guidance = page.locator(`[data-guidance-context="${context}"]`);
  await expect(guidance).toBeVisible();
  return guidance;
}

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('裝備、任務與活動空狀態均提供安全投稿導引', async ({ page }) => {
  const routes = [
    ['equipment', 'equipment', '裝備'],
    ['quests', 'quests', '任務'],
    ['events', 'events', '活動']
  ];

  for (const [route, context, label] of routes) {
    await page.goto(`/#/${route}`);
    const guidance = await waitForModuleGuidance(page, context);
    await expect(guidance).toContainText(`台版${label}情報`);
    await expect(guidance).toContainText('投稿不會立即公開');
    await expect(guidance).toContainText('法那提歐核對');
    await expect(guidance).toContainText('請勿提交真實姓名');
    await expect(guidance.locator('a')).toHaveAttribute('href', '#/contribute');
    await expectNoHorizontalOverflow(page, `${label}投稿導引`);
  }
});

test('待補詳情 route 保留請求資訊並接到投稿說明頁', async ({ page }) => {
  await page.goto('/#/equipment/test-sword');
  const guidance = await waitForModuleGuidance(page, 'equipment');
  await expect(page.locator('.content-module-route-id code')).toHaveText('test-sword');
  await guidance.locator('a').click();
  await expect(page).toHaveURL(/#\/contribute$/);
  await expect(page.locator('[data-contribution-flow]')).toBeVisible();
  await expect(page.locator('#workspace')).toContainText('投稿不會立即公開');
});

test('未編纂職業卡片改為可操作的投稿入口', async ({ page }) => {
  await page.goto('/#/professions');
  await expect(page.locator('h1')).toHaveText('職業總覽');

  const guidance = page.locator('[data-guidance-context="professions"]');
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText('台版職業技能情報');

  const pending = page.locator('.profession-card.is-contribution-entry');
  await expect(pending).toHaveCount(14);
  await expect(pending.first()).toHaveAttribute('href', '#/contribute');
  await expect(pending.first()).not.toHaveAttribute('aria-disabled', 'true');
  await expect(pending.first()).toHaveAttribute('aria-label', /提供.+台版職業技能情報/);
  await expect(page.locator('.profession-card[href="#/profession/swordsman"]')).toBeVisible();
  await expectNoHorizontalOverflow(page, '職業投稿導引');

  await pending.first().click();
  await expect(page).toHaveURL(/#\/contribute$/);
  await expect(page.locator('[data-contribution-flow]')).toBeVisible();
});
