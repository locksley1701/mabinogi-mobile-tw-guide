const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-reading-size', 'comfortable');
    localStorage.setItem('fanatio-palette', 'forest');
    localStorage.setItem('fanatio-appearance', 'light');
  });
}

async function waitForPublicRoute(page, route) {
  await page.goto(`/#/${route}`);
  await page.waitForFunction(() => {
    const workspace = document.querySelector('#workspace');
    if (!workspace || !workspace.textContent.trim()) return false;
    const text = workspace.textContent;
    return !text.includes('資料載入中')
      && !text.includes('正在翻開手札')
      && !text.includes('正在建立搜尋索引');
  });

  if (['equipment', 'quests', 'events'].includes(route) || /^(equipment|quest|event)\//.test(route)) {
    await page.waitForFunction(() => Boolean(window.FanatioContentModules?.loaded));
  }
  if (route === 'maps' || route.startsWith('map/')) {
    await page.waitForFunction(() => Boolean(window.FanatioMapData?.loaded));
  }
  if (route === 'contribute') {
    await expect(page.locator('[data-contribution-flow]')).toBeVisible();
  }

  await page.waitForTimeout(0);
}

const publicRoutes = [
  'home',
  'search',
  'life',
  'cooking',
  'afk',
  'professions',
  'profession/thief',
  'profession/fighter',
  'profession/dual-blades',
  'updates',
  'contribute',
  'equipment',
  'maps',
  'quests',
  'events',
  'equipment/not-recorded',
  'map/not-recorded',
  'quest/not-recorded',
  'event/not-recorded'
];

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('一般玩家 route 不顯示 GitHub 施工追蹤資訊', async ({ page }) => {
  for (const route of publicRoutes) {
    await waitForPublicRoute(page, route);
    const text = await page.locator('#workspace').innerText();

    expect(text, `${route}: 不得顯示 Issue 編號`).not.toMatch(/\bIssue\s*#\d+/i);
    expect(text, `${route}: 不得顯示 PR 編號`).not.toMatch(/\bPR\s*#\d+/i);
    expect(text, `${route}: 不得顯示內部施工語句`).not.toContain('下一施工');
    expect(text, `${route}: 不得顯示 branch 名稱`).not.toMatch(/\b(?:feat|fix|chore|refactor|docs|test|architecture)\/[A-Za-z0-9._/-]+\b/);
    expect(text, `${route}: 不得顯示完整 commit SHA`).not.toMatch(/\b[0-9a-f]{40}\b/i);
  }
});

test('更新紀錄頁隱藏施工編號，changelog JSON 保留追蹤依據', async ({ page }) => {
  await waitForPublicRoute(page, 'updates');

  const workspaceText = await page.locator('#workspace').innerText();
  expect(workspaceText).not.toMatch(/\bIssue\s*#\d+/i);
  expect(workspaceText).not.toMatch(/\bPR\s*#\d+/i);

  const changelog = await page.evaluate(async () => {
    const response = await fetch('data/changelog.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`data/changelog.json: ${response.status}`);
    return response.json();
  });

  expect(
    changelog.some(item => /\b(?:Issue|PR)\s*#\d+/i.test(String(item.basis || ''))),
    'repository 內的 changelog JSON 應保留 Issue／PR 追蹤依據'
  ).toBeTruthy();
});
