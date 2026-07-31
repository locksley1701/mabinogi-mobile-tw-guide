const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-reading-size', 'comfortable');
    localStorage.setItem('fanatio-palette', 'forest');
    localStorage.setItem('fanatio-appearance', 'light');
  });
}

async function waitForGuide(page) {
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
  await page.waitForFunction(() => Boolean(window.FanatioThemeSystem));
}

async function applyForest(page, appearance) {
  await page.evaluate(value => {
    window.FanatioThemeSystem.apply({appearance: value, palette: 'forest', persist: false});
  }, appearance);
  await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
}

async function semanticSnapshot(page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const get = name => style.getPropertyValue(name).trim();
    return {
      page: get('--page'),
      surface: get('--surface'),
      solid: get('--surface-solid'),
      muted: get('--surface-muted'),
      ink: get('--ink-900'),
      inkSecondary: get('--ink-700'),
      line: get('--line'),
      accent: get('--forest-600'),
      gold: get('--gold-500'),
      iconBg: get('--icon-well-bg'),
      iconBorder: get('--icon-well-border'),
      iconRing: get('--icon-well-ring'),
      meta: document.querySelector('meta[name="theme-color"]')?.content || ''
    };
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

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('愛爾琳森林亮色使用晨霧、暖灰米與象牙材質層', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);
  await applyForest(page, 'light');

  const values = await semanticSnapshot(page);
  expect(values.page).toBe('#d8ddd3');
  expect(values.solid).toBe('#f5f1e6');
  expect(values.muted).toBe('#e5e8dd');
  expect(values.ink).toBe('#29332e');
  expect(values.accent).toBe('#5f816b');
  expect(values.gold).toBe('#a98442');
  expect(values.meta).toBe('#d8ddd3');
  expect(new Set([values.page, values.surface, values.solid, values.muted]).size).toBe(4);
  expect(values.iconBg).not.toBe('');
  expect(values.iconBorder).not.toBe('');
  expect(values.iconRing).not.toBe('');

  const hero = await page.locator('.hero-panel').evaluate(element => {
    const style = getComputedStyle(element);
    return {image: style.backgroundImage, border: style.borderColor, shadow: style.boxShadow};
  });
  expect(hero.image).toContain('linear-gradient');
  expect(hero.shadow).not.toBe('none');
});

test('愛爾琳森林暗色分離夜林、松木、苔石與內嵌層', async ({ page }) => {
  await page.goto('/#/profession/swordsman');
  await waitForGuide(page);
  await applyForest(page, 'dark');

  const values = await semanticSnapshot(page);
  expect(values.page).toBe('#09130f');
  expect(values.solid).toBe('#1b2c24');
  expect(values.muted).toBe('#26382f');
  expect(values.ink).toBe('#e9e2d3');
  expect(values.accent).toBe('#6f987c');
  expect(values.gold).toBe('#c4a55c');
  expect(values.meta).toBe('#09130f');
  expect(new Set([values.page, values.surface, values.solid, values.muted]).size).toBe(4);

  await page.locator('details.profession-skill').evaluateAll(items => {
    items.forEach(item => { item.open = true; });
  });
  const openStats = page.locator('details.profession-skill[open] .profession-skill__stats').first();
  await expect(openStats).toBeVisible();
  const layers = await page.evaluate(() => {
    const panel = getComputedStyle(document.querySelector('.profession-skill-section'));
    const card = getComputedStyle(document.querySelector('details.profession-skill[open]'));
    const inset = getComputedStyle(document.querySelector('details.profession-skill[open] .profession-skill__stats'));
    return {
      panelImage: panel.backgroundImage,
      card: card.backgroundColor,
      inset: inset.backgroundColor
    };
  });
  expect(layers.panelImage).toContain('linear-gradient');
  expect(layers.card).not.toBe(layers.inset);
});

test('愛爾琳森林亮暗外觀在代表頁面無水平溢位', async ({ page }) => {
  const routes = ['home', 'search', 'life', 'cooking', 'profession/swordsman'];

  for (const appearance of ['light', 'dark']) {
    for (const route of routes) {
      await page.goto(`/#/${route}`);
      await waitForGuide(page);
      await applyForest(page, appearance);
      await expectNoHorizontalOverflow(page, `${appearance} ${route}`);
    }
  }
});

test('其他四套配色的代表性色值保持不變', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  const sentinels = [
    ['moonlight', 'light', '--page', '#e3e8ee'],
    ['hearth', 'dark', '--page', '#180c0f'],
    ['amethyst', 'light', '--page', '#e8e2ea'],
    ['contrast', 'dark', '--page', '#0e1411']
  ];

  for (const [palette, appearance, variable, expected] of sentinels) {
    await page.evaluate(({paletteId, appearanceId}) => {
      window.FanatioThemeSystem.apply({appearance: appearanceId, palette: paletteId, persist: false});
    }, {paletteId: palette, appearanceId: appearance});
    const actual = await page.evaluate(name => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), variable);
    expect(actual, `${palette} ${appearance}`).toBe(expected);
  }
});
