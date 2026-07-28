const { test, expect } = require('@playwright/test');

const appearances = ['system', 'light', 'dark'];
const palettes = ['forest', 'moonlight', 'hearth', 'amethyst', 'contrast'];
const sampleRoutes = [
  ['home', '手札總覽'],
  ['search', '快速查詢'],
  ['cooking', '料理手札'],
  ['profession/swordsman', '劍術士']
];

async function prepareCleanTheme(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.removeItem('fanatio-appearance');
    localStorage.removeItem('fanatio-palette');
    localStorage.removeItem('fanatio-theme');
  });
}

async function waitForGuide(page) {
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
}

async function openSettings(page) {
  await page.locator('#top-theme-toggle').click();
  await expect(page.locator('#theme-settings')).toBeVisible();
}

async function selectTheme(page, appearance, palette) {
  if (await page.locator('#theme-settings').isHidden()) await openSettings(page);
  await page.locator(`[data-appearance-choice="${appearance}"]`).click();
  await page.locator(`[data-palette-choice="${palette}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance);
  await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
  await expect(page.locator(`[data-appearance-choice="${appearance}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`[data-palette-choice="${palette}"]`)).toHaveAttribute('aria-pressed', 'true');
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
  await prepareCleanTheme(page);
});

test('主題面板提供 3 種外觀與 5 種配色', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);
  await openSettings(page);

  await expect(page.locator('[data-appearance-choice]')).toHaveCount(appearances.length);
  await expect(page.locator('[data-palette-choice]')).toHaveCount(palettes.length);
  await expect(page.locator('.theme-settings__card')).toHaveAttribute('role', 'dialog');
  await expect(page.locator('.theme-settings__card')).toHaveAttribute('aria-modal', 'true');

  for (const palette of palettes) {
    await page.locator(`[data-palette-choice="${palette}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
    await expectNoHorizontalOverflow(page, `設定面板 ${palette}`);
  }

  await page.locator('.theme-settings__footer [data-theme-close]').click();
  await expect(page.locator('#theme-settings')).toBeHidden();
  await expect(page.locator('#top-theme-toggle')).toBeFocused();
});

test('跟隨系統會即時回應裝置亮暗變更', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#/home');
  await waitForGuide(page);
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('fanatio-appearance'))).toBe('system');
});

test('15 種外觀與配色組合都具有可讀語意色', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);
  await openSettings(page);

  for (const appearance of appearances) {
    for (const palette of palettes) {
      await selectTheme(page, appearance, palette);
      const values = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          ink: style.getPropertyValue('--ink-900').trim(),
          surface: style.getPropertyValue('--surface-solid').trim(),
          sidebar: style.getPropertyValue('--sidebar').trim(),
          sidebarText: style.getPropertyValue('--sidebar-text').trim(),
          line: style.getPropertyValue('--line').trim(),
          resolved: document.documentElement.dataset.theme
        };
      });
      expect(values.ink).not.toBe('');
      expect(values.surface).not.toBe('');
      expect(values.sidebar).not.toBe('');
      expect(values.sidebarText).not.toBe('');
      expect(values.line).not.toBe('');
      expect(values.ink).not.toBe(values.surface);
      expect(values.sidebar).not.toBe(values.sidebarText);
      expect(['light', 'dark']).toContain(values.resolved);
    }
  }
});

test('五套配色在主要 route 上維持可讀且無水平溢位', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  for (const palette of palettes) {
    await page.evaluate(paletteId => {
      ThemeSystem.apply({appearance: 'light', palette: paletteId, persist: true});
    }, palette);

    for (const [route, title] of sampleRoutes) {
      await page.goto(`/#/${route}`);
      await waitForGuide(page);
      await expect(page.locator('#page-title')).toHaveText(title);
      await expect(page.locator('#workspace')).toBeVisible();
      await expectNoHorizontalOverflow(page, `${palette} ${route}`);
    }
  }
});

test('五大人物素質色不因配色主題改變', async ({ page }) => {
  await page.goto('/#/cooking');
  await waitForGuide(page);

  const snapshots = [];
  for (const palette of palettes) {
    await page.evaluate(paletteId => {
      ThemeSystem.apply({appearance: 'light', palette: paletteId, persist: false});
    }, palette);
    snapshots.push(await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return [
        '--attribute-strength',
        '--attribute-dexterity',
        '--attribute-intelligence',
        '--attribute-will',
        '--attribute-luck'
      ].map(name => style.getPropertyValue(name).trim());
    }));
  }

  const first = snapshots[0];
  expect(new Set(first).size).toBe(5);
  for (const snapshot of snapshots) expect(snapshot).toEqual(first);
  await expect(page.locator('.attribute-token').first()).toBeVisible();
});

test('主題偏好會保存並跨 route 共用', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);
  await openSettings(page);
  await selectTheme(page, 'dark', 'hearth');
  await page.locator('.theme-settings__footer [data-theme-close]').click();

  for (const [route] of sampleRoutes) {
    await page.goto(`/#/${route}`);
    await waitForGuide(page);
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'hearth');
  }

  expect(await page.evaluate(() => ({
    appearance: localStorage.getItem('fanatio-appearance'),
    palette: localStorage.getItem('fanatio-palette')
  }))).toEqual({appearance: 'dark', palette: 'hearth'});
});
