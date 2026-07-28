const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-appearance', 'light');
    localStorage.setItem('fanatio-palette', 'forest');
  });
}

async function waitForGuide(page) {
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
}

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('柔和高對比不使用刺眼的純黑白主表面', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  await page.locator('#top-theme-toggle').click();
  await expect(page.locator('[data-palette-choice="contrast"] strong')).toHaveText('柔和高對比');
  await expect(page.locator('[data-palette-choice="contrast"] small')).toContainText('深墨');
  await page.locator('[data-palette-choice="contrast"]').click();

  const light = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      page: style.getPropertyValue('--page').trim().toLowerCase(),
      surface: style.getPropertyValue('--surface-solid').trim().toLowerCase(),
      ink: style.getPropertyValue('--ink-900').trim().toLowerCase(),
      line: style.getPropertyValue('--line').trim().toLowerCase(),
      shadow: style.getPropertyValue('--shadow').trim().toLowerCase(),
      themeColor: document.querySelector('meta[name="theme-color"]')?.content.toLowerCase()
    };
  });

  expect(light.page).not.toBe('#ffffff');
  expect(light.surface).not.toBe('#ffffff');
  expect(light.ink).not.toBe('#000000');
  expect(light.line).not.toBe('#000000');
  expect(light.shadow).not.toBe('none');
  expect(light.themeColor).toBe('#ece9df');

  await page.locator('[data-appearance-choice="dark"]').click();
  const dark = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      page: style.getPropertyValue('--page').trim().toLowerCase(),
      surface: style.getPropertyValue('--surface-solid').trim().toLowerCase(),
      ink: style.getPropertyValue('--ink-900').trim().toLowerCase(),
      line: style.getPropertyValue('--line').trim().toLowerCase(),
      themeColor: document.querySelector('meta[name="theme-color"]')?.content.toLowerCase()
    };
  });

  expect(dark.page).not.toBe('#000000');
  expect(dark.surface).not.toBe('#000000');
  expect(dark.ink).not.toBe('#ffffff');
  expect(dark.line).not.toBe('#ffffff');
  expect(dark.themeColor).toBe('#0e1411');
});
