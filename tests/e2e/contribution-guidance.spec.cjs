const { test, expect } = require('@playwright/test');

const PUBLIC_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe7N39rzuXWOParDuLuWF2tEFhbBoFx_JxfZjVqVEftFfq89g/viewform';
const CATEGORY_ENTRY_ID = 'entry.1463634779';
const NAME_ENTRY_ID = 'entry.486577760';
const CONTEXT_STORAGE_KEY = 'fanatio-contribution-context-v1';

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

async function waitForContributionFlow(page) {
  const flow = page.locator('[data-contribution-flow]');
  await expect(flow).toBeVisible();
  return flow;
}

async function readFormUrl(link) {
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  return new URL(href);
}

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('裝備、任務與活動空狀態均提供帶來源分類的安全投稿導引', async ({ page }) => {
  const routes = [
    ['equipment', 'equipment', '裝備'],
    ['quests', 'quests', '任務'],
    ['events', 'events', '活動']
  ];

  for (const [route, context, label] of routes) {
    await page.goto(`/#/${route}`);
    const guidance = await waitForModuleGuidance(page, context);
    const link = guidance.locator('a');
    await expect(guidance).toContainText(`台版${label}情報`);
    await expect(guidance).toContainText('投稿不會立即公開');
    await expect(guidance).toContainText('法那提歐核對');
    await expect(guidance).toContainText('請勿提交真實姓名');
    await expect(link).toHaveAttribute('href', '#/contribute');
    await expect(link).toHaveAttribute('data-contribution-category', label);
    await expect(link).toHaveAttribute('data-contribution-route', route);
    await expectNoHorizontalOverflow(page, `${label}投稿導引`);
  }
});

test('待補詳情保存公開來源情境，重新整理仍保留並可清除', async ({ page }) => {
  await page.goto('/#/equipment/test-sword');
  const guidance = await waitForModuleGuidance(page, 'equipment');
  await expect(page.locator('.content-module-route-id code')).toHaveText('test-sword');
  await guidance.locator('a').click();
  await expect(page).toHaveURL(/#\/contribute$/);
  await waitForContributionFlow(page);

  const summary = page.locator('[data-contribution-context-summary]');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('正在補充：裝備');
  await expect(summary).toContainText('裝備');
  await expect(summary).toContainText('查詢代碼');
  await expect(summary).toContainText('test-sword');
  await expect(summary.locator('a')).toHaveAttribute('href', '#/equipment/test-sword');
  await expect(summary).toContainText('不會保存姓名、帳號、聯絡方式或表單回覆');

  const stored = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), CONTEXT_STORAGE_KEY);
  expect(Object.keys(stored).sort()).toEqual([
    'category',
    'contextLabel',
    'item',
    'itemKind',
    'savedAt',
    'sourceRoute',
    'version'
  ]);
  expect(stored.category).toBe('裝備');
  expect(stored.sourceRoute).toBe('equipment/test-sword');
  expect(stored.item).toBe('test-sword');
  expect(stored.itemKind).toBe('query-code');

  const formLink = page.locator('.contribution-submit');
  await expect(formLink).toHaveAttribute('data-form-prefill', 'on');
  const formUrl = await readFormUrl(formLink);
  expect(`${formUrl.origin}${formUrl.pathname}`).toBe(PUBLIC_FORM_URL);
  expect(formUrl.searchParams.get('usp')).toBe('pp_url');
  expect(formUrl.searchParams.get(CATEGORY_ENTRY_ID)).toBe('裝備');
  expect(formUrl.searchParams.has(NAME_ENTRY_ID)).toBe(false);

  await page.reload();
  await waitForContributionFlow(page);
  await expect(page.locator('[data-contribution-context-summary]')).toContainText('test-sword');
  await expect(page.locator('.contribution-submit')).toHaveAttribute('data-form-prefill', 'on');

  await page.locator('[data-clear-contribution-context]').click();
  await expect(page.locator('[data-contribution-context-summary]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), CONTEXT_STORAGE_KEY)).toBeNull();
  await expect(page.locator('.contribution-submit')).toHaveAttribute('href', PUBLIC_FORM_URL);
  await expect(page.locator('.contribution-submit')).toHaveAttribute('data-form-prefill', 'off');
  await expectNoHorizontalOverflow(page, '裝備投稿來源情境');
});

test('離開投稿頁後自動清除來源情境', async ({ page }) => {
  await page.goto('/#/quest/sample-quest');
  const guidance = await waitForModuleGuidance(page, 'quests');
  await guidance.locator('a').click();
  await waitForContributionFlow(page);
  await expect(page.locator('[data-contribution-context-summary]')).toContainText('sample-quest');

  await page.locator('[data-contribution-context-summary] a').click();
  await expect(page).toHaveURL(/#\/quest\/sample-quest$/);
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), CONTEXT_STORAGE_KEY)).toBeNull();
});

test('未編纂職業卡片保存職業名稱並接到投稿頁', async ({ page }) => {
  await page.goto('/#/professions');
  await expect(page.locator('h1')).toHaveText('職業總覽');

  const guidance = page.locator('[data-guidance-context="professions"]');
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText('台版職業技能情報');

  const pending = page.locator('.profession-card.is-contribution-entry');
  await expect(pending).toHaveCount(6);
  await expect(pending.first()).toHaveAttribute('href', '#/contribute');
  await expect(pending.first()).not.toHaveAttribute('aria-disabled', 'true');
  await expect(pending.first()).toHaveAttribute('aria-label', /提供.+台版職業技能情報/);
  await expect(page.locator('.profession-card[href="#/profession/swordsman"]')).toBeVisible();
  for (const id of ['longbowman', 'crossbowman', 'thief', 'fighter', 'dual-blades']) {
    await expect(page.locator(`.profession-card[href="#/profession/${id}"]`)).toBeVisible();
  }
  await expectNoHorizontalOverflow(page, '職業投稿導引');

  const professionName = (await pending.first().locator('strong').textContent()).trim();
  await pending.first().click();
  await expect(page).toHaveURL(/#\/contribute$/);
  await waitForContributionFlow(page);

  const summary = page.locator('[data-contribution-context-summary]');
  await expect(summary).toContainText('正在補充：職業技能');
  await expect(summary).toContainText('職業／技能');
  await expect(summary).toContainText(`項目：${professionName}`);
  await expect(summary.locator('a')).toHaveAttribute('href', '#/professions');

  const formLink = page.locator('.contribution-submit');
  await expect(formLink).toHaveAttribute('data-form-prefill', 'on');
  const formUrl = await readFormUrl(formLink);
  expect(formUrl.searchParams.get('usp')).toBe('pp_url');
  expect(formUrl.searchParams.get(CATEGORY_ENTRY_ID)).toBe('職業／技能');
  expect(formUrl.searchParams.get(NAME_ENTRY_ID)).toBe(professionName);
});

test('直接開啟投稿頁維持通用流程且不套用來源預填參數', async ({ page }) => {
  await page.goto('/#/contribute');
  await waitForContributionFlow(page);

  await expect(page.locator('[data-contribution-context-summary]')).toHaveCount(0);
  const formLink = page.locator('.contribution-submit');
  await expect(formLink).toHaveAttribute('href', PUBLIC_FORM_URL);
  await expect(formLink).toHaveAttribute('data-form-prefill', 'off');
  expect(await formLink.getAttribute('href')).not.toContain('usp=pp_url');
  await expect(page.locator('#workspace')).toContainText('投稿不會立即公開');
});
