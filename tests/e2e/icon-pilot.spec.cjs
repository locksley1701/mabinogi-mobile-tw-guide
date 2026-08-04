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
  await page.waitForFunction(() => Boolean(window.FanatioIconPilot));
}

async function waitForIcons(page, selector, count) {
  await expect(page.locator(selector)).toHaveCount(count);
  await page.waitForFunction(({ selector, count }) => {
    const images = [...document.querySelectorAll(selector)];
    return images.length === count && images.every(image => image.complete && image.naturalWidth > 0);
  }, { selector, count });
}

async function expectAccessibleDecorativeImages(page, selector) {
  const values = await page.locator(selector).evaluateAll(images => images.map(image => ({
    alt: image.getAttribute('alt'),
    hidden: image.getAttribute('aria-hidden'),
    fit: getComputedStyle(image).objectFit
  })));
  for (const value of values) {
    expect(value.alt).toBe('');
    expect(value.hidden).toBe('true');
    expect(value.fit).toBe('contain');
  }
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

test('生活技能20枚在列表與明細顯示核准圖標', async ({ page }) => {
  await page.goto('/#/life');
  await waitForGuide(page);
  const selector = '.skill-tile[data-life-skill] img[data-official-icon]';
  await waitForIcons(page, selector, 20);
  await expectAccessibleDecorativeImages(page, selector);

  const ids = [
    'daily-gathering', 'logging', 'mining', 'herbalism',
    'shearing', 'harvest', 'hoeing', 'insects', 'fishing',
    'smithing', 'woodworking', 'magic-craft', 'heavy-armor',
    'light-armor', 'cloth', 'potion', 'cooking', 'handicraft',
    'alchemy', 'part-time'
  ];

  for (const id of ids) {
    const tile = page.locator(`.skill-tile[data-life-skill="${id}"]`);
    await expect(tile.locator(`img[data-official-icon="${id}"]`)).toBeVisible();
  }

  for (const id of ['heavy-armor', 'cooking', 'alchemy', 'part-time']) {
    await page.locator(`.skill-tile[data-life-skill="${id}"]`).click();
    await expect(page.locator(`#life-detail [data-official-icon-detail="${id}"]`)).toBeVisible();
  }
});

test('職業7枚在總覽與職業頁 hero 顯示', async ({ page }) => {
  await page.goto('/#/professions');
  await waitForGuide(page);
  const selector = '.profession-card img[data-official-icon]';
  await waitForIcons(page, selector, 7);
  await expectAccessibleDecorativeImages(page, selector);

  for (const id of ['swordsman', 'warrior', 'greatsword-warrior', 'archer', 'thief', 'fighter', 'dual-blades']) {
    await page.goto(`/#/profession/${id}`);
    await waitForGuide(page);
    const hero = page.locator(`.profession-hero [data-official-icon-detail="${id}"] img[data-official-icon="${id}"]`);
    await expect(hero).toBeVisible();
    await expect(hero).toHaveJSProperty('complete', true);
  }
});

test('21枚職業技能在七個職業頁取代編號底盤', async ({ page }) => {
  const matrix = [
    ['swordsman', ['swordmaster-steel-wedge', 'swordmaster-detection']],
    ['warrior', ['expert-warrior-battle-cry', 'expert-warrior-blade-smash']],
    ['greatsword-warrior', ['greatsword-warrior-blockade-front']],
    ['archer', ['expert-archer-magnum-shot']],
    ['thief', ['thief-back-stab', 'thief-hide', 'thief-poison-trap', 'thief-screw-dagger', 'thief-throwing-bomb']],
    ['fighter', ['fighter-back-step', 'fighter-burst-punch-1', 'fighter-charging-fist', 'fighter-somersault-1', 'fighter-stomp-kick']],
    ['dual-blades', ['dual-blades-double-crescent', 'dual-blades-gliding-fury', 'dual-blades-howling-gale', 'dual-blades-hurricane-dance', 'dual-blades-outer-slash']]
  ];

  for (const [professionId, iconIds] of matrix) {
    await page.goto(`/#/profession/${professionId}`);
    await waitForGuide(page);
    for (const iconId of iconIds) {
      const image = page.locator(`.profession-skill img[data-official-icon="${iconId}"]`);
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute('alt', '');
      await expect(image).toHaveAttribute('aria-hidden', 'true');
    }
  }
});

test('料理4枚接入正式卡片並更新試點說明', async ({ page }) => {
  await page.goto('/#/cooking');
  await waitForGuide(page);
  const selector = '.cooking-card img[data-official-icon]';
  await waitForIcons(page, selector, 4);
  await expectAccessibleDecorativeImages(page, selector);
  await expect(page.locator('.cooking-notice')).toContainText('官方圖標小批次試點');

  for (const id of ['fried-egg', 'boiled-egg', 'roasted-potato', 'apple-juice']) {
    await expect(page.locator(`.cooking-card img[data-official-icon="${id}"]`)).toBeVisible();
  }
});

test('亮暗與五套配色在代表頁面保持可見且無水平溢位', async ({ page }) => {
  const palettes = ['forest', 'moonlight', 'hearth', 'amethyst', 'contrast'];
  const routes = ['life', 'professions', 'profession/swordsman', 'profession/fighter', 'cooking'];

  for (const appearance of ['light', 'dark']) {
    for (const palette of palettes) {
      for (const route of routes) {
        await page.goto(`/#/${route}`);
        await waitForGuide(page);
        await page.evaluate(({ appearance, palette }) => {
          window.FanatioThemeSystem.apply({ appearance, palette, persist: false });
          window.FanatioIconPilot.patch();
        }, { appearance, palette });
        await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
        await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
        await expect(page.locator('img[data-official-icon]').first()).toBeVisible();
        await expectNoHorizontalOverflow(page, `${appearance} ${palette} ${route}`);
      }
    }
  }
});

test('圖標載入失敗時保留既有符號 fallback', async ({ page }) => {
  await page.goto('/#/life');
  await waitForGuide(page);
  const host = page.locator('.skill-tile[data-life-skill="daily-gathering"] .skill-tile__icon');
  const image = host.locator('img[data-official-icon="daily-gathering"]');
  await expect(image).toBeVisible();
  await image.evaluate(element => { element.src = 'assets/icons/missing-pilot-icon.png'; });
  await expect(host).not.toHaveClass(/has-official-icon/);
  await expect(host).not.toHaveText('');
});
