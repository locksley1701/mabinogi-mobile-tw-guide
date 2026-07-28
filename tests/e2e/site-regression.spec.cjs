const { test, expect } = require('@playwright/test');

const routes = [
  ['home', '手札總覽'],
  ['search', '快速查詢'],
  ['life', '生活技能'],
  ['cooking', '料理手札'],
  ['afk', '掛機技巧'],
  ['professions', '職業總覽'],
  ['profession/swordsman', '劍術士'],
  ['profession/greatsword-warrior', '大劍戰士'],
  ['profession/warrior', '戰士'],
  ['profession/archer', '弓手'],
  ['updates', '手札增補紀錄'],
  ['contribute', '愛爾琳情報櫃台']
];

async function preparePage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    if (!localStorage.getItem('fanatio-theme')) {
      localStorage.setItem('fanatio-theme', 'light');
    }
  });
}

async function waitForGuide(page) {
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
}

async function gotoRoute(page, route, expectedTitle) {
  await page.goto(`/#/${route}`);
  await waitForGuide(page);
  await expect(page.locator('#page-title')).toHaveText(expectedTitle);
}

async function expectNoHorizontalOverflow(page, route) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(widths.html, `${route}: html 不得產生水平捲動`).toBeLessThanOrEqual(widths.client + 1);
  expect(widths.body, `${route}: body 不得產生水平捲動`).toBeLessThanOrEqual(widths.client + 1);
}

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('所有既有 route 可直接開啟、標記目前章節且無水平溢位', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  for (const [route, title] of routes) {
    await test.step(route, async () => {
      await gotoRoute(page, route, title);
      const nav = page.locator(`.nav-link[data-route="${route}"]`);
      await expect(nav).toHaveAttribute('aria-current', 'page');
      await expectNoHorizontalOverflow(page, route);
    });
  }

  expect(pageErrors, `頁面執行錯誤：${pageErrors.join(' | ')}`).toEqual([]);
});

test('未知 route 安全回退到首頁內容', async ({ page }) => {
  await page.goto('/#/route-does-not-exist');
  await waitForGuide(page);
  await expect(page.locator('#page-title')).toHaveText('手札總覽');
  await expect(page.locator('.hero-panel')).toBeVisible();
  await expect(page.locator('.nav-link[aria-current="page"]')).toHaveCount(0);
});

test('全域快速搜尋支援 Enter 與搜尋按鈕', async ({ page }) => {
  await gotoRoute(page, 'home', '手札總覽');

  await page.locator('#top-search-button').click();
  await expect(page.locator('#quick-search-panel')).toBeVisible();
  await expect(page.locator('#top-search-button')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#quick-search-input').fill('煎蛋');
  await page.locator('#quick-search-input').press('Enter');

  await expect(page).toHaveURL(/#\/search$/);
  await expect(page.locator('#site-search')).toHaveValue('煎蛋');
  await expect(page.locator('.result-row strong', { hasText: '煎蛋' }).first()).toBeVisible();

  await page.locator('#top-search-button').click();
  await page.locator('#quick-search-input').fill('劍術士');
  await page.locator('.quick-search-form .primary-button').click();
  await expect(page.locator('#site-search')).toHaveValue('劍術士');
  await expect(page.locator('.result-row strong', { hasText: '劍術士' }).first()).toBeVisible();
});

test('響應式側邊欄符合桌面、平板與手機模式', async ({ page }, testInfo) => {
  await gotoRoute(page, 'home', '手札總覽');
  const project = testInfo.project.name;

  if (project === 'desktop-chrome') {
    const box = await page.locator('#sidebar').boundingBox();
    expect(box.width).toBeGreaterThan(250);
    await expect(page.locator('.sidebar__brand strong')).toBeVisible();
    await expect(page.locator('#menu-button')).toBeHidden();
  } else if (project === 'tablet-chrome') {
    const box = await page.locator('#sidebar').boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(88);
    expect(box.width).toBeLessThanOrEqual(96);
    await expect(page.locator('.sidebar__brand span')).toBeHidden();
    await expect(page.locator('#menu-button')).toBeHidden();
  } else {
    await expect(page.locator('#menu-button')).toBeVisible();
    const box = await page.locator('#sidebar').boundingBox();
    expect(box.x).toBeLessThan(0);
    const brandText = await page.locator('.topbar__title').evaluate(element =>
      getComputedStyle(element, '::before').content.replaceAll('"', '')
    );
    expect(brandText).toContain('法那提歐的愛爾琳手札');
  }
});

test('手機抽屜可開啟、切換章節並自動關閉', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', '只在手機模式驗證抽屜');
  await gotoRoute(page, 'home', '手札總覽');

  await page.locator('#menu-button').click();
  await expect(page.locator('body')).toHaveClass(/drawer-open/);
  await expect(page.locator('#menu-button')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#drawer-backdrop')).toBeVisible();

  await page.locator('.nav-link[data-route="life"]').click();
  await expect(page).toHaveURL(/#\/life$/);
  await expect(page.locator('#page-title')).toHaveText('生活技能');
  await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
  await expect(page.locator('#drawer-backdrop')).toBeHidden();
});

test('料理側邊欄篩選可切換到 Lv.15 並顯示 4 筆', async ({ page }, testInfo) => {
  await gotoRoute(page, 'cooking', '料理手札');
  const filter = page.locator('#cooking-sidebar-filter');
  await expect(filter).toHaveAttribute('aria-hidden', 'false');
  await expect(filter).toHaveClass(/is-visible/);

  if (testInfo.project.name === 'mobile-chrome') {
    await page.locator('#menu-button').click();
  }

  const levelButton = page.locator('[data-cooking-level="Lv.15"]');
  await levelButton.click();
  await expect(levelButton).toHaveClass(/is-active/);
  await expect(page.locator('.cooking-card')).toHaveCount(4);

  if (testInfo.project.name === 'mobile-chrome') {
    const backdrop = page.locator('#drawer-backdrop');
    const box = await backdrop.boundingBox();
    await backdrop.click({ position: { x: box.width - 8, y: 80 } });
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
  }
});

test('職業技能可展開，解鎖條件保持正常可閱讀', async ({ page }) => {
  await gotoRoute(page, 'profession/swordsman', '劍術士');
  const skills = page.locator('details.profession-skill');
  await expect(skills).toHaveCount(11);
  await expect(page.locator('.unlock-condition')).toContainText('解鎖條件：劍術士 Lv.45 以上');

  const opacities = await page.locator('.profession-skill').evaluateAll(elements =>
    elements.map(element => Number.parseFloat(getComputedStyle(element).opacity))
  );
  for (const opacity of opacities) expect(opacity).toBeGreaterThanOrEqual(0.99);

  const secondSkill = skills.nth(1);
  if (!(await secondSkill.evaluate(element => element.open))) {
    await secondSkill.locator('summary').click();
  }
  await expect(secondSkill).toHaveAttribute('open', '');
});

test('明暗主題選擇會保存並在重新整理後恢復', async ({ page }, testInfo) => {
  await gotoRoute(page, 'home', '手札總覽');

  if (testInfo.project.name === 'mobile-chrome') {
    await page.locator('#menu-button').click();
    await page.locator('#theme-toggle').click();
  } else {
    await page.locator('#top-theme-toggle').click();
  }

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('fanatio-theme'))).toBe('dark');
  await page.reload();
  await waitForGuide(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('捲動過深後可回到頁首', async ({ page }) => {
  await gotoRoute(page, 'cooking', '料理手札');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('.back-to-top')).toBeVisible();
  await page.locator('.back-to-top').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
});

test('減少動態效果設定會取消平滑捲動', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoRoute(page, 'home', '手札總覽');
  const scrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  expect(scrollBehavior).toBe('auto');
});
