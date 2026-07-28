const { test, expect } = require('@playwright/test');

const palettes = ['forest', 'moonlight', 'hearth', 'amethyst', 'contrast'];
const themes = ['light', 'dark'];

async function preparePage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-appearance', 'light');
    localStorage.setItem('fanatio-palette', 'forest');
    localStorage.setItem('fanatio-theme', 'light');
  });
}

async function waitForGuide(page) {
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
  await page.waitForFunction(() => document.querySelector('#sidebar')?.hasAttribute('aria-hidden') || innerWidth > 959);
}

function parseColor(value) {
  const numbers = String(value).match(/[\d.]+/g)?.map(Number) || [];
  if (numbers.length < 3) throw new Error(`無法解析顏色：${value}`);
  return numbers.slice(0, 3).map(number => number / 255);
}

function luminance(value) {
  const [red, green, blue] = parseColor(value).map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

async function resolvedThemeColors(page) {
  return page.evaluate(() => {
    const resolve = variable => {
      const probe = document.createElement('span');
      probe.style.color = `var(${variable})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    return {
      ink900: resolve('--ink-900'),
      ink700: resolve('--ink-700'),
      surface: resolve('--surface-solid'),
      sidebar: resolve('--sidebar'),
      sidebarText: resolve('--sidebar-text'),
      focus: resolve('--focus-ring')
    };
  });
}

async function openCookingFilterIfNeeded(page, projectName) {
  if (projectName === 'mobile-chrome') {
    await page.locator('#menu-button').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveClass(/drawer-open/);
  }
}

function rectanglesOverlap(first, second) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('五套配色的亮暗文字、側邊欄與焦點色符合對比基準', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  for (const palette of palettes) {
    for (const theme of themes) {
      await page.evaluate(({ palette, theme }) => {
        window.FanatioThemeSystem.apply({ appearance: theme, palette, persist: false });
      }, { palette, theme });

      const colors = await resolvedThemeColors(page);
      expect(contrastRatio(colors.ink900, colors.surface), `${palette}/${theme} 主文字`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.ink700, colors.surface), `${palette}/${theme} 內文`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.sidebarText, colors.sidebar), `${palette}/${theme} 側邊欄`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.focus, colors.surface), `${palette}/${theme} 焦點框`).toBeGreaterThanOrEqual(3);
    }
  }
});

test('鍵盤焦點在一般、暗色與柔和高對比中保持清楚', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  const combinations = [
    ['light', 'forest'],
    ['dark', 'moonlight'],
    ['light', 'contrast'],
    ['dark', 'contrast']
  ];

  for (const [appearance, palette] of combinations) {
    await page.evaluate(({ appearance, palette }) => {
      window.FanatioThemeSystem.apply({ appearance, palette, persist: false });
    }, { appearance, palette });
    await page.locator('#top-search-button').focus();
    const focusStyle = await page.locator('#top-search-button').evaluate(element => {
      const style = getComputedStyle(element);
      return {
        width: Number.parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        offset: Number.parseFloat(style.outlineOffset)
      };
    });
    expect(focusStyle.width, `${appearance}/${palette}`).toBeGreaterThanOrEqual(3);
    expect(focusStyle.style).not.toBe('none');
    expect(focusStyle.offset).toBeGreaterThanOrEqual(3);
  }
});

test('全域快速搜尋可只用鍵盤完成並以正式名稱顯示結果', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  const trigger = page.locator('#top-search-button');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#quick-search-panel')).toBeVisible();
  await expect(page.locator('#quick-search-input')).toBeFocused();

  await page.keyboard.type('無工具採集');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/search$/);
  await expect(page.locator('.result-row strong', { hasText: '日常採集' }).first()).toBeVisible();
  await expect(page.locator('.search-alias-note', { hasText: '無工具採集' }).first()).toBeVisible();
});

test('手機抽屜收起時不可聚焦，Escape 關閉後焦點回到選單', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', '只在手機模式驗證抽屜 inert');
  await page.goto('/#/home');
  await waitForGuide(page);

  const sidebar = page.locator('#sidebar');
  const menu = page.locator('#menu-button');
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  expect(await sidebar.evaluate(element => element.inert)).toBe(true);

  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
  expect(await sidebar.evaluate(element => element.inert)).toBe(false);

  await page.keyboard.press('Escape');
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  expect(await sidebar.evaluate(element => element.inert)).toBe(true);
  await expect(menu).toBeFocused();
});

test('生活技能與料理篩選具備同步 aria-pressed 並可鍵盤切換', async ({ page }, testInfo) => {
  await page.goto('/#/life');
  await waitForGuide(page);

  const all = page.locator('[data-life-group="全部"]');
  const gathering = page.locator('[data-life-group="採集"]');
  const crafting = page.locator('[data-life-group="製作"]');
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(gathering).toHaveAttribute('aria-pressed', 'false');
  await crafting.focus();
  await page.keyboard.press('Enter');
  await expect(crafting).toHaveAttribute('aria-pressed', 'true');
  await expect(all).toHaveAttribute('aria-pressed', 'false');

  const cookingSkill = page.locator('[data-life-skill="cooking"]');
  await cookingSkill.focus();
  await page.keyboard.press('Enter');
  await expect(cookingSkill).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#life-detail .detail-title')).toHaveText('料理');

  await page.goto('/#/cooking');
  await waitForGuide(page);
  await openCookingFilterIfNeeded(page, testInfo.project.name);
  const level = page.locator('[data-cooking-level="Lv.15"]');
  await level.focus();
  await page.keyboard.press('Enter');
  await expect(level).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cooking-card')).toHaveCount(4);
});

test('職業技能展開狀態同步 aria-expanded 與 aria-controls', async ({ page }) => {
  await page.goto('/#/profession/swordsman');
  await waitForGuide(page);

  const skills = page.locator('details.profession-skill');
  const firstSummary = skills.first().locator('summary');
  await expect(firstSummary).toHaveAttribute('aria-expanded', 'true');
  const firstPanel = await firstSummary.getAttribute('aria-controls');
  await expect(page.locator(`#${firstPanel}`)).toBeVisible();

  const secondSummary = skills.nth(1).locator('summary');
  await expect(secondSummary).toHaveAttribute('aria-expanded', 'false');
  await secondSummary.focus();
  await page.keyboard.press('Enter');
  await expect(secondSummary).toHaveAttribute('aria-expanded', 'true');
  const secondPanel = await secondSummary.getAttribute('aria-controls');
  await expect(page.locator(`#${secondPanel}`)).toBeVisible();
});

test('主題 modal 限制焦點、背景 inert，關閉後回到觸發按鈕', async ({ page }) => {
  await page.goto('/#/home');
  await waitForGuide(page);

  const trigger = page.locator('#top-theme-toggle');
  const panel = page.locator('#theme-settings');
  const first = page.locator('.theme-settings__close');
  const last = page.locator('.theme-settings__footer [data-theme-close]');

  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(first).toBeFocused();
  await expect.poll(() => page.locator('.app-shell').evaluate(element => element.inert)).toBe(true);

  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.locator('.app-shell').evaluate(element => element.inert)).toBe(false);
});

test('狀態、選取與人物素質具有非色彩符號', async ({ page }, testInfo) => {
  await page.goto('/#/cooking');
  await waitForGuide(page);
  await openCookingFilterIfNeeded(page, testInfo.project.name);

  const level = page.locator('[data-cooking-level="Lv.15"]');
  await level.click();
  const badge = page.locator('.status-badge').first();
  await expect(badge).not.toHaveText('');
  const badgeCue = await badge.evaluate(element => ({
    symbol: getComputedStyle(element, '::before').content,
    border: Number.parseFloat(getComputedStyle(element).borderWidth)
  }));
  expect(badgeCue.symbol).not.toBe('none');
  expect(badgeCue.symbol).not.toBe('normal');
  expect(badgeCue.border).toBeGreaterThanOrEqual(1);

  const selectedCue = await level.locator('span').evaluate(element => getComputedStyle(element, '::before').content);
  expect(selectedCue).toContain('✓');

  const shapes = await page.locator('.cooking-card').first().locator('.attribute-token').evaluateAll(elements =>
    elements.slice(0, 5).map(element => getComputedStyle(element, '::before').content)
  );
  expect(shapes).toHaveLength(5);
  expect(new Set(shapes).size).toBe(5);
});

test('狀態徽章在亮暗模式皆維持文字對比', async ({ page }) => {
  await page.goto('/#/afk');
  await waitForGuide(page);

  for (const appearance of themes) {
    await page.evaluate(appearance => {
      window.FanatioThemeSystem.apply({ appearance, palette: 'forest', persist: false });
    }, appearance);

    const samples = await page.locator('.status-badge').evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return { color: style.color, background: style.backgroundColor, text: element.textContent.trim() };
    }));
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample.text).not.toBe('');
      expect(contrastRatio(sample.color, sample.background), `${appearance} ${sample.text}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('減少動態效果會取消平滑捲動與不必要轉場', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/cooking');
  await waitForGuide(page);

  const motion = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).scrollBehavior,
    filter: getComputedStyle(document.querySelector('.sidebar-context-filter')).transitionDuration
  }));
  expect(motion.html).toBe('auto');
  const durations = motion.filter.split(',').map(value => value.trim()).map(value =>
    value.endsWith('ms') ? Number.parseFloat(value) / 1000 : Number.parseFloat(value)
  );
  expect(Math.max(...durations)).toBeLessThanOrEqual(0.001);

  await page.locator('#top-theme-toggle').click();
  const backdrop = await page.locator('.theme-settings__backdrop').evaluate(element => getComputedStyle(element).backdropFilter);
  expect(backdrop).toBe('none');
});

test('手機回到頁首按鈕具足夠尺寸且不遮蔽頁尾文字', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', '只在手機尺寸驗證安全區');
  await page.goto('/#/cooking');
  await waitForGuide(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const button = page.locator('.back-to-top');
  await expect(button).toBeVisible();
  const buttonBox = await button.boundingBox();
  const footerBox = await page.locator('.site-footer p').boundingBox();
  const viewport = page.viewportSize();
  expect(buttonBox.width).toBeGreaterThanOrEqual(44);
  expect(buttonBox.height).toBeGreaterThanOrEqual(44);
  expect(buttonBox.x).toBeGreaterThanOrEqual(0);
  expect(buttonBox.y).toBeGreaterThanOrEqual(0);
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(viewport.width);
  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(viewport.height);
  expect(rectanglesOverlap(buttonBox, footerBox)).toBe(false);
});
