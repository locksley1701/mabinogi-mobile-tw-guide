const { test, expect } = require('@playwright/test');

const readingSizes = ['standard', 'comfortable', 'large'];
const representativeRoutes = ['home', 'life', 'cooking', 'profession/swordsman'];
const allRoutes = [
  'home',
  'search',
  'life',
  'cooking',
  'afk',
  'professions',
  'profession/swordsman',
  'profession/warrior',
  'profession/greatsword-warrior',
  'profession/archer',
  'updates',
  'contribute'
];

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.removeItem('fanatio-reading-size');
  });
}

async function waitForGuide(page) {
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
  await page.waitForFunction(() => Boolean(window.FanatioReadingSystem));
}

async function openSettings(page) {
  await page.locator('#top-theme-toggle').click();
  await expect(page.locator('#theme-settings')).toBeVisible();
  await expect(page.locator('[data-reading-settings-group]')).toBeVisible();
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

test('未保存偏好時預設使用舒適閱讀尺寸', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  await expect(page.locator('html')).toHaveAttribute('data-reading-size', 'comfortable');
  const bodySize = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  expect(bodySize).toBe('17px');
});

test('外觀設定提供標準舒適放大三種尺寸', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);
  await openSettings(page);

  await expect(page.locator('[data-reading-size-choice]')).toHaveCount(3);

  const expectedSizes = {
    standard: '16px',
    comfortable: '17px',
    large: '18px'
  };

  for (const size of readingSizes) {
    await page.locator(`[data-reading-size-choice="${size}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-reading-size', size);
    await expect(page.locator(`[data-reading-size-choice="${size}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe(expectedSizes[size]);
  }
});

test('舒適模式提高職業技能說明數值與署名字級', async ({ page }) => {
  await page.goto('/#/profession/swordsman');
  await waitForGuide(page);

  const sizes = await page.evaluate(() => {
    const px = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return {
      description: px('.profession-skill__description'),
      stats: px('.profession-skill__stats'),
      attribution: px('.profession-skill__body .attribution'),
      identity: px('.profession-skill__identity strong')
    };
  });

  expect(sizes.description).toBeGreaterThanOrEqual(17);
  expect(sizes.stats).toBeGreaterThanOrEqual(15);
  expect(sizes.attribution).toBeGreaterThanOrEqual(14);
  expect(sizes.identity).toBeGreaterThanOrEqual(18);
});

test('舒適模式不再留下約十到十二像素的必要文字', async ({ page }) => {
  await page.goto('/#/cooking');
  await waitForGuide(page);
  await expect(page.locator('.cooking-card__kicker').first()).toBeVisible();
  await expect(page.locator('.sidebar-context-filter__label')).toHaveCount(1);

  const sizes = await page.evaluate(() => {
    const px = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const topbar = document.querySelector('.topbar__title');
    return {
      cookingKicker: px('.cooking-card__kicker'),
      contextualLabel: px('.sidebar-context-filter__label'),
      contextualCount: px('.sidebar-context-filter .level-nav small'),
      sidebarBrand: px('.sidebar__brand small'),
      mobileBrand: parseFloat(getComputedStyle(topbar, '::before').fontSize)
    };
  });

  for (const [name, value] of Object.entries(sizes)) {
    expect(value, `${name} 字級過小`).toBeGreaterThanOrEqual(13);
  }
});

test('閱讀尺寸偏好會保存並跨 route 共用', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);
  await openSettings(page);
  await page.locator('[data-reading-size-choice="large"]').click();
  await page.locator('.theme-settings__footer [data-theme-close]').click();

  for (const route of representativeRoutes) {
    await page.goto(`/#/${route}`);
    await waitForGuide(page);
    await expect(page.locator('html')).toHaveAttribute('data-reading-size', 'large');
  }

  expect(await page.evaluate(() => localStorage.getItem('fanatio-reading-size'))).toBe('large');
});

test('三種閱讀尺寸在全站 route 都沒有水平溢位', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  for (const size of readingSizes) {
    await page.evaluate(value => window.FanatioReadingSystem.apply(value), size);
    for (const route of allRoutes) {
      await page.goto(`/#/${route}`);
      await waitForGuide(page);
      await expectNoHorizontalOverflow(page, `${size} ${route}`);
    }
  }
});