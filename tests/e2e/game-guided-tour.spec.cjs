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

async function advanceToContributionStep(page) {
  const next = page.locator(`${TOUR} [data-tour-action="next"]`);
  await next.click();
  await expect(page.locator(`${TOUR} [data-tour-action="next"]`)).toBeVisible();
  await next.click();
  await expect(page.locator('[data-life-group="採集"]')).toBeVisible();
  await page.locator('[data-life-group="採集"]').click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 4／6');
  await next.click();
  await expect(page.locator('.contribution-submit, #submission-button')).toBeVisible();
  return next;
}

async function advanceToCompletion(page) {
  const next = await advanceToContributionStep(page);
  await next.click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 6／6');
  return next;
}

async function completeTour(page) {
  const next = await advanceToCompletion(page);
  await next.focus();
  await next.press('Enter');
  await expect(page.locator(TOUR)).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/quick-search-open|drawer-open|game-guided-tour-open/);
}

async function loadCompletedContribution(page, options) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-guide-tour-version', '1');
    localStorage.setItem('fanatio-guide-tour-status', 'completed');
  });
  await page.goto('/#/contribute', options);
  await expect(page.locator(TOUR)).toBeHidden();
}

async function expectTourClosedForAtLeast500ms(page) {
  await expect(page.locator(TOUR)).toBeHidden();
  await expect(page.locator('html')).not.toHaveClass(/game-guided-tour-open/);
  await page.waitForTimeout(550);
  await expect(page.locator(TOUR)).toBeHidden();
  await expect(page.locator('html')).not.toHaveClass(/game-guided-tour-open/);
}

async function pointerActivate(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('導覽控制按鈕不可定位');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  return box;
}

async function observeTourTransition(page) {
  await page.evaluate(() => {
    const shell = document.querySelector('#game-guided-tour');
    const fallback = shell.querySelector('.game-guided-tour__fallback');
    const card = shell.querySelector('.game-guided-tour__card');
    const spotlight = shell.querySelector('.game-guided-tour__spotlight');
    const snapshots = [];
    const capture = mutation => snapshots.push({
      mutation: mutation ? {
        type: mutation.type,
        attribute: mutation.attributeName || '',
        target: mutation.target === shell ? 'shell' : mutation.target === fallback ? 'fallback' : mutation.target === card ? 'card' : '',
        oldValue: mutation.oldValue
      } : null,
      progress: shell.querySelector('#game-guided-tour-progress').textContent,
      isFallback: shell.classList.contains('is-fallback'),
      fallbackHidden: fallback.hidden,
      visibleCardText: card.innerText,
      cardX: card.style.getPropertyValue('--tour-card-x'),
      cardY: card.style.getPropertyValue('--tour-card-y'),
      spotlightHidden: spotlight.hidden
    });
    capture();
    const observer = new MutationObserver(records => records.forEach(capture));
    observer.observe(shell, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true
    });
    window.__tourTransitionObserver = {observer, snapshots};
  });
}

async function readTourTransition(page) {
  return page.evaluate(() => {
    const state = window.__tourTransitionObserver;
    state.observer.disconnect();
    delete window.__tourTransitionObserver;
    return state.snapshots;
  });
}

function expectTransitionWithoutFallback(records, fromProgress, toProgress, {expectCardCoordinates = false} = {}) {
  expect(records.length).toBeGreaterThan(0);
  const fallbackStates = records.filter(record => record.isFallback || !record.fallbackHidden);
  expect(fallbackStates).toHaveLength(0);
  expect(records.some(record => record.mutation?.target === 'shell' && record.mutation.attribute === 'class' && record.mutation.oldValue?.includes('is-fallback'))).toBe(false);
  expect(records.some(record => record.visibleCardText.includes('目前頁面的目標暫時無法定位') || record.visibleCardText.includes('可按下一步繼續導覽'))).toBe(false);
  if (expectCardCoordinates) expect(records.every(record => record.cardX && record.cardY)).toBe(true);
  const progress = [...new Set([fromProgress, ...records.map(record => record.progress)])];
  expect(progress).toEqual([fromProgress, toProgress]);
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
  await expect(page.locator('#quick-search-panel')).toBeHidden();
  await expect(page.locator('#top-search-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('body')).not.toHaveClass(/quick-search-open|game-guided-tour-open/);
  await page.reload();
  await expect(page.locator(TOUR)).toBeHidden();
  await page.locator('#top-tour-button').click();
  await waitForTour(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fanatio-guide-tour-status'))).toBe('skipped');
});

test('投稿頁頂部重播只有一個 session，略過或 Escape 一次即可完全退出', async ({ page }) => {
  await loadCompletedContribution(page);
  const trigger = page.locator('#top-tour-button');
  await trigger.click();
  await waitForTour(page);
  await expect(page.locator(TOUR)).toHaveCount(1);
  await expect(page.locator(`${TOUR} [role="dialog"]:visible`)).toHaveCount(1);
  await page.locator(`${TOUR} [data-tour-action="skip"]`).click();
  await expectTourClosedForAtLeast500ms(page);
  await expect(page.locator('#quick-search-panel')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/drawer-open|quick-search-open/);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await waitForTour(page);
  await page.keyboard.press('Escape');
  await expectTourClosedForAtLeast500ms(page);
  await expect(trigger).toBeFocused();
});

test('導覽卡 pointerdown 不會關閉搜尋或讓略過按鈕在 click 前移位', async ({ page }) => {
  await loadCompletedContribution(page);
  await page.locator('#top-tour-button').click();
  await waitForTour(page);
  const skip = page.locator(`${TOUR} [data-tour-action="skip"]`);
  const card = page.locator(`${TOUR} .game-guided-tour__card`);
  const before = await card.boundingBox();
  await pointerActivate(page, skip);
  await expect(page.locator('#quick-search-panel')).toBeVisible();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 1／6');
  await expect(page.locator('.game-guided-tour__fallback')).toBeHidden();
  expect(await card.boundingBox()).toEqual(before);
  await page.mouse.up();
  await expectTourClosedForAtLeast500ms(page);
  await expect(page.locator('#quick-search-panel')).toBeHidden();
});

test('導覽卡下一步的真實 pointer 序列只前進一次且不經 fallback', async ({ page }) => {
  await loadCompletedContribution(page);
  await page.locator('#top-tour-button').click();
  await waitForTour(page);
  const next = page.locator(`${TOUR} [data-tour-action="next"]`);
  const card = page.locator(`${TOUR} .game-guided-tour__card`);
  const before = await card.boundingBox();
  await pointerActivate(page, next);
  await expect(page.locator('#quick-search-panel')).toBeVisible();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 1／6');
  await expect(page.locator('.game-guided-tour__fallback')).toBeHidden();
  expect(await card.boundingBox()).toEqual(before);
  await page.mouse.up();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 2／6');
  await expect(page.locator('.game-guided-tour__fallback')).toBeHidden();
});

test('步驟切換 guard 不會在所有 lifecycle transition 中閃現 fallback', async ({ page }, testInfo) => {
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  const next = page.locator(`${TOUR} [data-tour-action="next"]`);

  await observeTourTransition(page);
  await pointerActivate(page, next);
  await page.mouse.up();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 2／6');
  await expect(page.locator('.nav-link[data-route="life"]')).toBeVisible();
  if (testInfo.project.name === 'mobile-chrome') {
    await expect(page.locator('body')).toHaveClass(/drawer-open/);
    await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'false');
    expect(await page.locator('#sidebar').evaluate(element => element.inert)).toBe(false);
  }
  const expectCardCoordinates = testInfo.project.name !== 'mobile-chrome';
  expectTransitionWithoutFallback(await readTourTransition(page), '導覽任務 1／6', '導覽任務 2／6', {expectCardCoordinates});

  await observeTourTransition(page);
  await next.click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 3／6');
  await expect(page.locator('[data-life-group="採集"]')).toBeVisible();
  expectTransitionWithoutFallback(await readTourTransition(page), '導覽任務 2／6', '導覽任務 3／6', {expectCardCoordinates});

  await observeTourTransition(page);
  await page.locator('[data-life-group="採集"]').click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 4／6');
  await expect(page.locator('[data-life-skill="daily-gathering"]')).toBeVisible();
  expectTransitionWithoutFallback(await readTourTransition(page), '導覽任務 3／6', '導覽任務 4／6', {expectCardCoordinates});

  await observeTourTransition(page);
  await next.click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 5／6');
  await expect(page.locator('.contribution-submit, #submission-button')).toBeVisible();
  expectTransitionWithoutFallback(await readTourTransition(page), '導覽任務 4／6', '導覽任務 5／6', {expectCardCoordinates});

  await observeTourTransition(page);
  await next.click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 6／6');
  await expect(page.locator(TOUR)).toHaveClass(/is-complete/);
  await expect(page.locator('.game-guided-tour__spotlight')).toBeHidden();
  expectTransitionWithoutFallback(await readTourTransition(page), '導覽任務 5／6', '導覽任務 6／6');

  await observeTourTransition(page);
  await page.locator(`${TOUR} [data-tour-action="previous"]`).click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 5／6');
  await expect(page.locator('.contribution-submit, #submission-button')).toBeVisible();
  await expect(page.locator('.game-guided-tour__spotlight')).toBeVisible();
  expectTransitionWithoutFallback(await readTourTransition(page), '導覽任務 6／6', '導覽任務 5／6');
});

test('導覽卡上一步與 Enter／Space 控制會維持正確步驟與目標操作', async ({ page }) => {
  await loadCompletedContribution(page);
  await page.locator('#top-tour-button').click();
  await waitForTour(page);
  const next = page.locator(`${TOUR} [data-tour-action="next"]`);
  await next.press('Enter');
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 2／6');
  await page.locator(`${TOUR} [data-tour-action="previous"]`).click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 1／6');
  await next.focus();
  await next.press('Space');
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 2／6');
  await page.locator(`${TOUR} [data-tour-action="previous"]`).click();
  await expect(page.locator('#quick-search-input')).toBeVisible();
  await page.locator('#quick-search-input').fill('日常採集');
  await expect(page.locator('#quick-search-input')).toHaveValue('日常採集');
});

test('完成步驟使用乾淨的獨立狀態，往返後仍可完整結束', async ({ page }) => {
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  const next = await advanceToCompletion(page);
  const shell = page.locator(TOUR);
  const card = page.locator(`${TOUR} .game-guided-tour__card`);
  const fallback = page.locator(`${TOUR} .game-guided-tour__fallback`);
  const spotlight = page.locator(`${TOUR} .game-guided-tour__spotlight`);
  const arrow = page.locator(`${TOUR} .game-guided-tour__arrow`);

  await expect(shell).toHaveClass(/is-complete/);
  await expect(shell).not.toHaveClass(/is-fallback/);
  await expect(fallback).toBeHidden();
  await expect(spotlight).toBeHidden();
  await expect(arrow).toBeHidden();
  await expect(next).toHaveText('完成');
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 6／6');
  await expect(page.locator('#game-guided-tour-title')).toHaveText('導覽任務完成');
  expect(await card.innerText()).not.toContain('目前頁面的目標暫時無法定位');
  expect(await card.innerText()).not.toContain('可按下一步繼續導覽');

  await page.locator(`${TOUR} [data-tour-action="previous"]`).click();
  await expect(page.locator('#game-guided-tour-progress')).toHaveText('導覽任務 5／6');
  await expect(shell).not.toHaveClass(/is-complete/);
  await expect(page.locator('.contribution-submit, #submission-button')).toBeVisible();
  await expect(fallback).toBeHidden();
  await expect(spotlight).toBeVisible();
  await expect(arrow).toBeVisible();

  await next.click();
  await expect(shell).toHaveClass(/is-complete/);
  await expect(shell).not.toHaveClass(/is-fallback/);
  await expect(fallback).toBeHidden();
  await expect(spotlight).toBeHidden();
  await expect(arrow).toBeHidden();
  await next.click();
  await expectTourClosedForAtLeast500ms(page);
  await expect(shell).not.toHaveClass(/is-complete|is-fallback|has-target/);
  await expect(spotlight).toBeHidden();
  await expect(arrow).toBeHidden();
  expect(await shell.evaluate(element => {
    const cardNode = element.querySelector('.game-guided-tour__card');
    const spotlightNode = element.querySelector('.game-guided-tour__spotlight');
    const arrowNode = element.querySelector('.game-guided-tour__arrow');
    return [
      cardNode.style.getPropertyValue('--tour-card-x'),
      cardNode.style.getPropertyValue('--tour-card-y'),
      spotlightNode.style.getPropertyValue('--tour-target-x'),
      spotlightNode.style.getPropertyValue('--tour-target-y'),
      arrowNode.style.getPropertyValue('--tour-arrow-x'),
      arrowNode.style.getPropertyValue('--tour-arrow-y'),
      arrowNode.dataset.side || ''
    ];
  })).toEqual(['', '', '', '', '', '', '']);
});

test('完成按鈕可由 Space 完整結束導覽', async ({ page }) => {
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  const next = await advanceToCompletion(page);
  await next.focus();
  await next.press('Space');
  await expectTourClosedForAtLeast500ms(page);
});

test('投稿頁側欄重播不會建立第二個 session', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '手機側欄在收合狀態不可操作');
  await loadCompletedContribution(page);
  const trigger = page.locator('#tour-button');
  await trigger.click();
  await waitForTour(page);
  await expect(page.locator(TOUR)).toHaveCount(1);
  await expect(page.locator(`${TOUR} [role="dialog"]:visible`)).toHaveCount(1);
  await page.locator(`${TOUR} [data-tour-action="skip"]`).click();
  await expectTourClosedForAtLeast500ms(page);
  await expect(trigger).toBeFocused();
});

test('剛載入投稿頁後的快速重播連點會去重且不會在略過後復活', async ({ page }) => {
  await loadCompletedContribution(page, {waitUntil: 'domcontentloaded'});
  await page.locator('#top-tour-button').evaluate(button => {
    button.click();
    button.click();
    button.click();
  });
  await waitForTour(page);
  await expect(page.locator(TOUR)).toHaveCount(1);
  await expect(page.locator(`${TOUR} [role="dialog"]:visible`)).toHaveCount(1);
  await page.locator(`${TOUR} [data-tour-action="skip"]`).click();
  await expectTourClosedForAtLeast500ms(page);
});

test('非目標背景 click 不會觸發 route，搜尋目標仍可操作', async ({ page }) => {
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  await page.locator('[data-nav="professions"]').click({force: true});
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.locator('#quick-search-panel')).toBeVisible();
  await page.locator('#quick-search-input').fill('日常採集');
  await expect(page.locator('#quick-search-input')).toHaveValue('日常採集');
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
  await expect(page.locator('#quick-search-panel')).toBeHidden();
  await expect(page.locator('#top-search-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('body')).not.toHaveClass(/quick-search-open|game-guided-tour-open/);
  await expect(trigger).toBeFocused();
});

test('窄手機會將畫面外目標帶入 viewport，無法帶入時安全 fallback', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', '只在窄手機 viewport 驗證導覽定位');
  await page.setViewportSize({width: 320, height: 568});
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-guide-tour-version', '1');
    localStorage.setItem('fanatio-guide-tour-status', 'completed');
  });
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/#/home');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(() => window.FanatioGuidedTour.start());
  await waitForTour(page);
  await expect.poll(() => page.locator('#quick-search-input').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 4 && rect.left >= 4 && rect.bottom <= innerHeight - 4 && rect.right <= innerWidth - 4;
  })).toBe(true);
  await expect(page.locator('.game-guided-tour__spotlight')).toBeVisible();
  await page.evaluate(() => {
    const input = document.querySelector('#quick-search-input');
    input.style.position = 'fixed';
    input.style.top = '-1200px';
  });
  await expect(page.locator('.game-guided-tour__fallback')).toBeVisible();
  await expect(page.locator('.game-guided-tour__spotlight')).toBeHidden();
  await expect(page.locator('.game-guided-tour__arrow')).toBeHidden();
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

test('抽屜目標回到 inert 祖先時改用安全 fallback', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', '只在手機 viewport 驗證 inert 祖先');
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  await page.locator(`${TOUR} [data-tour-action="next"]`).click();
  await expect(page.locator('.nav-link[data-route="life"]')).toBeVisible();
  await page.evaluate(() => window.FanatioNavigation.closeDrawer());
  await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('#sidebar').evaluate(element => element.inert)).toBe(true);
  await expect(page.locator('.game-guided-tour__fallback')).toBeVisible();
  await expect(page.locator('.game-guided-tour__spotlight')).toBeHidden();
});

test('手機第二階段略過與 Escape 都會關閉抽屜並恢復安全狀態', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', '只在手機 viewport 驗證抽屜 cleanup');
  await freshVisitor(page);
  await page.goto('/#/home');
  await waitForTour(page);
  await page.locator(`${TOUR} [data-tour-action="next"]`).click();
  await expect(page.locator('body')).toHaveClass(/drawer-open/);
  await page.locator(`${TOUR} [data-tour-action="skip"]`).click();
  await expect(page.locator('body')).not.toHaveClass(/drawer-open|game-guided-tour-open/);
  await expect(page.locator('#menu-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('#sidebar').evaluate(element => element.inert)).toBe(true);
  await expect(page.locator('#top-tour-button')).toBeFocused();

  await page.locator('#top-tour-button').click();
  await waitForTour(page);
  await page.locator(`${TOUR} [data-tour-action="next"]`).click();
  await expect(page.locator('body')).toHaveClass(/drawer-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/drawer-open|game-guided-tour-open/);
  await expect(page.locator('#menu-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('#sidebar').evaluate(element => element.inert)).toBe(true);
  await expect(page.locator('#top-tour-button')).toBeFocused();
});
