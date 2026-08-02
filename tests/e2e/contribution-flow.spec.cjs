const { test, expect } = require('@playwright/test');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-reading-size', 'comfortable');
    localStorage.setItem('fanatio-palette', 'forest');
    localStorage.setItem('fanatio-appearance', 'light');
  });
}

async function openContribution(page) {
  await prepare(page);
  await page.goto('/#/contribute');
  await expect(page.locator('[data-contribution-flow]')).toBeVisible();
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
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

test('投稿頁清楚說明私人審核而非自動公開', async ({ page }) => {
  await openContribution(page);

  const workspace = page.locator('#workspace');
  await expect(workspace.locator('h1')).toHaveText('提供台版情報');
  await expect(workspace).toContainText('投稿不會立即公開');
  await expect(workspace).toContainText('私人審核');
  await expect(workspace).toContainText('只有核准後的整理資料');
  await expect(workspace.locator('.contribution-step')).toHaveCount(4);
  await expect(page.locator('[data-route="contribute"]')).toHaveAttribute('aria-current', 'page');
  await expectNoHorizontalOverflow(page, '投稿流程');
});

test('公開投稿表單已接入且只使用安全填寫網址', async ({ page }) => {
  await openContribution(page);

  const link = page.locator('.contribution-submit');
  await expect(link).toHaveText('開啟情報投稿表單');
  await expect(link).toHaveAttribute(
    'href',
    'https://docs.google.com/forms/d/e/1FAIpQLSe7N39rzuXWOParDuLuWF2tEFhbBoFx_JxfZjVqVEftFfq89g/viewform'
  );
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('.contribution-status')).toContainText('表單會在新分頁開啟');

  const publicHrefs = await page.locator('[data-contribution-flow] a').evaluateAll(anchors =>
    anchors.map(anchor => anchor.getAttribute('href') || '')
  );
  expect(publicHrefs).not.toEqual(expect.arrayContaining([
    expect.stringMatching(/spreadsheets|drive\.google\.com/)
  ]));
});

test('投稿分類、署名與審核狀態符合公開契約', async ({ page }) => {
  await openContribution(page);

  const workspace = page.locator('#workspace');
  const categories = workspace.locator('.contribution-category');
  await expect(categories).toHaveCount(9);
  await expect(workspace.locator('.contribution-category-list')).toContainText('裝備');
  await expect(workspace.locator('.contribution-category-list')).toContainText('任務');

  const categoryStyles = await categories.evaluateAll(items => items.map(item => {
    const style = getComputedStyle(item);
    const dot = getComputedStyle(item, '::before');
    return `${style.backgroundColor}|${style.borderColor}|${dot.backgroundColor}`;
  }));
  expect(new Set(categoryStyles).size, '投稿分類應具有多組可辨識語意色').toBeGreaterThanOrEqual(7);

  await expect(workspace.locator('.contribution-card').nth(1)).toContainText('匿名');
  await expect(workspace.locator('.contribution-card').nth(1)).toContainText('遊戲 ID');
  await expect(workspace.locator('.contribution-card').nth(1)).toContainText('暱稱');
  await expect(workspace.locator('.contribution-status-list span')).toHaveCount(7);
  await expectNoHorizontalOverflow(page, '投稿分類標籤');
});

test('投稿頁顯示隱私與撤回規則', async ({ page }) => {
  await openContribution(page);

  const workspace = page.locator('#workspace');
  await expect(workspace.locator('.contribution-privacy')).toContainText('真實姓名');
  await expect(workspace.locator('.contribution-privacy')).toContainText('電話');
  await expect(workspace.locator('.contribution-privacy')).toContainText('原始附件不會放進公開 repository');
  await expect(workspace.locator('.contribution-withdrawal')).toContainText('撤回');
  await expect(workspace.locator('.contribution-withdrawal')).toContainText('投稿編號');
  await expectNoHorizontalOverflow(page, '投稿隱私與撤回');
});
