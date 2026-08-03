const { test, expect } = require('@playwright/test');

const TOUR = '#game-guided-tour';

async function freshVisitor(page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('fanatio-tour-v2');
    localStorage.removeItem('fanatio-guide-tour-version');
    localStorage.removeItem('fanatio-guide-tour-status');
  });
}

async function waitForTour(page) {
  await expect(page.locator(TOUR)).toBeVisible();
  await expect(page.locator('#quick-search-input')).toBeVisible();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 1／6');
}

async function completeTour(page) {
  const next = page.locator(`${TOUR} [data-tour-action="next"]`);
  await next.click();
  await expect(page.locator(`${TOUR} [data-tour-action="next"]`)).toBeVisible();
  await next.click();
  await expect(page.locator('[data-life-group="採集"]')).toBeVisible();
  await page.locator('[data-life-group="採集"]').click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 4／6');
  await next.click();
  await expect(page.locator('.contribution-submit, #submission-button')).toBeVisible();
  await next.click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 6／6');
  await next.click();
  await expect(page.locator(TOUR)).toBeHidden();
}

test('全新訪客會自動開始，完成後不再自動顯示且搜尋目標可操作', async ({ page }) => {
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  await page.locator('#quick-search-input').fill('日常採集');
  await expect(page.locator('#quick-search-input')).toHaveValue('日常採集');
  await completeTour(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fanatio-guide-tour-status'))).toBe('completed');
  await page.reload();
  await expect(page.locator(TOUR)).toBeHidden();
});

test('略過會保存，公開入口可重新觀看', async ({ page }) => {
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  await page.locator(`${TOUR} [data-tour-action="skip"]`).click();
  await expect(page.locator(TOUR)).toBeHidden();
  await page.reload();
  await expect(page.locator(TOUR)).toBeHidden();
  await page.locator('#top-tour-button').click();
  await waitForTour(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fanatio-guide-tour-status'))).toBe('skipped');
});

test('分類操作會互動前進，並在 hash route 間延續', async ({ page }) => {
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  const next = page.locator(`${TOUR} [data-tour-action="next"]`);
  await next.click();
  await next.click();
  await expect(page).toHaveURL(/#\/life$/);
  await expect(page.locator('[data-life-group="採集"]')).toBeVisible();
  await page.locator('[data-life-group="採集"]').click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 4／6');
  await expect(page.locator('[data-life-skill="daily-gathering"]')).toBeVisible();
});

test('缺少目標時顯示安全替代說明並仍可繼續', async ({ page }) => {
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  await page.evaluate(() => document.querySelector('#quick-search-input')?.remove());
  await expect(page.locator('.game-guided-tour__fallback')).toBeVisible();
  await page.locator(`${TOUR} [data-tour-action="next"]`).click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 2／6');
});

test('Escape、Tab、Shift+Tab 與焦點恢復可安全操作', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-guide-tour-version', '1');
    localStorage.setItem('fanatio-guide-tour-status', 'completed');
  });
  await page.goto('/#/home');
  const trigger = page.locator('#top-tour-button');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await waitForTour(page);
  await page.keyboard.press('Tab');
  await expect(page.locator('#quick-search-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator(`${TOUR} [data-tour-action="next"]`)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator(TOUR)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('減少動態效果時使用靜態聚光且不產生水平溢位', async ({ page }) => {
  await freshVisitor(page);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/#/home');
  await waitForTour(page);
  const state = await page.locator('.game-guided-tour__spotlight').evaluate(element => ({
    animation: getComputedStyle(element).animationName,
    htmlWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(state.animation).toBe('none');
  expect(state.htmlWidth).toBeLessThanOrEqual(state.clientWidth + 1);
  expect(state.bodyWidth).toBeLessThanOrEqual(state.clientWidth + 1);
});

test('localStorage 不可用時仍能載入與手動開啟導覽', async ({ page }) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Object.defineProperty(Storage.prototype, method, {configurable: true, value() { throw new DOMException('blocked', 'SecurityError'); }});
    }
  });
  await page.goto('/#/home');
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
  await expect(page.locator(TOUR)).toBeVisible();
  await page.locator(`${TOUR} [data-tour-action="skip"]`).click();
  await page.locator('#top-tour-button').click();
  await expect(page.locator(TOUR)).toBeVisible();
});

test('手機版安全開啟抽屜並聚焦真實生活技能入口', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', '只在手機 viewport 驗證抽屜導覽');
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  await page.locator(`${TOUR} [data-tour-action="next"]`).click();
  await expect(page.locator('body')).toHaveClass(/drawer-open/);
  await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'false');
  expect(await page.locator('#sidebar').evaluate(element => element.inert)).toBe(false);
  await expect(page.locator('.nav-link[data-route="life"]')).toBeVisible();
  await expect(page.locator('.game-guided-tour__spotlight')).toBeVisible();
});
