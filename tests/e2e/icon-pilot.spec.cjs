const { test, expect } = require('@playwright/test');

const professionSidebarEntries = [
  ['swordsman', '劍術士', '◇'],
  ['greatsword-warrior', '大劍戰士', '◆'],
  ['warrior', '戰士', '⬡'],
  ['archer', '弓手', '⌁'],
  ['thief', '盜賊', '◈'],
  ['fighter', '格鬥家', '✊'],
  ['dual-blades', '雙刀客', '⚔']
];

const professionSidebarImageSelector = '.sidebar .nav-link[data-route^="profession/"] > span[aria-hidden="true"] > .official-icon--sidebar > img[data-official-icon]';

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

async function expectProfessionSidebarDimensions(page, label) {
  const layouts = [];
  for (const [id, name, fallback] of professionSidebarEntries) {
    const link = page.locator(`.sidebar .nav-link[data-route="profession/${id}"]`);
    await expect(link.locator(':scope > b')).toHaveText(name);
    const layout = await link.evaluate((element, { professionId, fallbackText }) => {
      const carrier = element.querySelector(':scope > span[aria-hidden="true"]');
      const wrapper = carrier.querySelector(':scope > .official-icon--sidebar');
      const icon = wrapper.querySelector(`img[data-official-icon="${professionId}"]`);
      const labelNode = element.querySelector(':scope > b');
      const linkRect = element.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const labelRect = labelNode.getBoundingClientRect();
      const wrapperStyle = getComputedStyle(wrapper);
      const iconStyle = getComputedStyle(icon);

      const reference = element.cloneNode(true);
      const referenceHost = reference.querySelector(':scope > span[aria-hidden="true"]');
      referenceHost.classList.remove('official-icon-source--profession-sidebar');
      referenceHost.removeAttribute('data-official-icon-host');
      referenceHost.removeAttribute('data-official-icon-fallback');
      referenceHost.replaceChildren(fallbackText);
      reference.style.position = 'fixed';
      reference.style.inset = '0 auto auto -10000px';
      reference.style.inlineSize = `${linkRect.width}px`;
      reference.style.visibility = 'hidden';
      element.closest('.sidebar').append(reference);
      const fallbackHeight = reference.getBoundingClientRect().height;
      reference.remove();

      return {
        rowHeight: linkRect.height,
        fallbackHeight,
        labelLeft: labelRect.left,
        labelFits: labelNode.scrollWidth <= labelNode.clientWidth + 1,
        linkFits: element.scrollWidth <= element.clientWidth + 1,
        wrapperWidth: wrapperRect.width,
        wrapperHeight: wrapperRect.height,
        imageWidth: iconRect.width,
        imageHeight: iconRect.height,
        carrierVisibility: getComputedStyle(carrier).visibility,
        wrapperVisibility: wrapperStyle.visibility,
        wrapperOverflow: wrapperStyle.overflow,
        wrapperPadding: [wrapperStyle.paddingTop, wrapperStyle.paddingRight, wrapperStyle.paddingBottom, wrapperStyle.paddingLeft],
        wrapperMargin: [wrapperStyle.marginTop, wrapperStyle.marginRight, wrapperStyle.marginBottom, wrapperStyle.marginLeft],
        wrapperBorder: [wrapperStyle.borderTopWidth, wrapperStyle.borderRightWidth, wrapperStyle.borderBottomWidth, wrapperStyle.borderLeftWidth],
        wrapperBorderRadius: wrapperStyle.borderRadius,
        wrapperBackground: wrapperStyle.backgroundColor,
        wrapperShadow: wrapperStyle.boxShadow,
        wrapperFlex: [wrapperStyle.flexGrow, wrapperStyle.flexShrink, wrapperStyle.flexBasis],
        wrapperVerticalAlign: wrapperStyle.verticalAlign,
        imageMaxSize: [iconStyle.maxInlineSize, iconStyle.maxBlockSize],
        imageFit: iconStyle.objectFit,
        imagePosition: iconStyle.objectPosition
      };
    }, { professionId: id, fallbackText: fallback });

    expect(Math.abs(layout.rowHeight - layout.fallbackHeight), `${label} ${name} 列高`).toBeLessThanOrEqual(1);
    expect(layout.labelFits, `${label} ${name} 文字不得截斷`).toBe(true);
    expect(layout.linkFits, `${label} ${name} nav-link 不得水平溢位`).toBe(true);
    expect(layout.wrapperWidth, `${label} ${name} wrapper width`).toBeGreaterThan(27.5);
    expect(layout.wrapperWidth, `${label} ${name} wrapper width`).toBeLessThanOrEqual(28);
    expect(layout.wrapperHeight, `${label} ${name} wrapper height`).toBeGreaterThan(27.5);
    expect(layout.wrapperHeight, `${label} ${name} wrapper height`).toBeLessThanOrEqual(28);
    expect(layout.imageWidth, `${label} ${name} image width`).toBeLessThanOrEqual(24);
    expect(layout.imageHeight, `${label} ${name} image height`).toBeLessThanOrEqual(24);
    expect(layout.carrierVisibility).toBe('hidden');
    expect(layout.wrapperVisibility).toBe('visible');
    expect(layout.wrapperOverflow).toBe('hidden');
    expect(layout.wrapperPadding).toEqual(['2px', '2px', '2px', '2px']);
    expect(layout.wrapperMargin).toEqual(['0px', '0px', '0px', '0px']);
    expect(layout.wrapperBorder).toEqual(['0px', '0px', '0px', '0px']);
    expect(layout.wrapperBorderRadius).toBe('0px');
    expect(layout.wrapperBackground).toBe('rgba(0, 0, 0, 0)');
    expect(layout.wrapperShadow).toBe('none');
    expect(layout.wrapperFlex).toEqual(['0', '0', '28px']);
    expect(layout.wrapperVerticalAlign).toBe('middle');
    expect(layout.imageMaxSize).toEqual(['24px', '24px']);
    expect(layout.imageFit).toBe('contain');
    expect(layout.imagePosition).toBe('50% 50%');
    layouts.push(layout);
  }

  const leftEdges = layouts.map(layout => layout.labelLeft);
  expect(Math.max(...leftEdges) - Math.min(...leftEdges), `${label} 七列文字左緣`).toBeLessThanOrEqual(1);
  const sidebarWidths = await page.locator('#sidebar').evaluate(sidebar => ({
    scrollWidth: sidebar.scrollWidth,
    clientWidth: sidebar.clientWidth
  }));
  expect(sidebarWidths.scrollWidth, `${label} sidebar 水平溢位`).toBeLessThanOrEqual(sidebarWidths.clientWidth + 1);
  return layouts;
}

async function readProfessionSidebarMetrics(page) {
  return page.locator('.sidebar .nav-link[data-route^="profession/"]').evaluateAll(links => links.map(link => {
    const id = link.dataset.route.split('/')[1];
    const label = link.querySelector(':scope > b');
    const wrapper = link.querySelector('.official-icon--sidebar');
    const image = wrapper?.querySelector('img[data-official-icon]');
    const linkRect = link.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const wrapperRect = wrapper?.getBoundingClientRect();
    const imageRect = image?.getBoundingClientRect();
    return {
      id,
      linkHeight: linkRect.height,
      labelLeft: labelRect.left,
      wrapperWidth: wrapperRect?.width ?? null,
      wrapperHeight: wrapperRect?.height ?? null,
      imageWidth: imageRect?.width ?? null,
      imageHeight: imageRect?.height ?? null
    };
  }));
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

test('桌面側邊欄七職業使用 manifest 官方圖標且接線保持冪等', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定使用桌面專案驗證側邊欄版面');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/home');
  await waitForGuide(page);
  await waitForIcons(page, professionSidebarImageSelector, 7);
  await expectAccessibleDecorativeImages(page, professionSidebarImageSelector);

  for (const [id, name] of professionSidebarEntries) {
    const link = page.locator(`.sidebar .nav-link[data-route="profession/${id}"]`);
    const host = link.locator(':scope > span[aria-hidden="true"]');
    const image = host.locator(`img[data-official-icon="${id}"]`);
    await expect(link).toHaveAttribute('href', `#/profession/${id}`);
    await expect(link).toHaveAttribute('data-route', `profession/${id}`);
    await expect(link.locator(':scope > b')).toHaveText(name);
    await expect(link.locator(':scope > b')).toBeVisible();
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('src', `assets/icons/professions/${id}.png`);
    await expect(host.locator(':scope > .official-icon--sidebar')).toHaveCount(1);
  }

  await page.evaluate(() => {
    window.FanatioIconPilot.patch();
    window.FanatioIconPilot.patch();
    window.FanatioThemeSystem.apply({ appearance: 'dark', palette: 'contrast', persist: false });
  });
  await expect(page.locator(professionSidebarImageSelector)).toHaveCount(7);
  for (const [id] of professionSidebarEntries) {
    await expect(page.locator(`.sidebar .nav-link[data-route="profession/${id}"] img[data-official-icon]`)).toHaveCount(1);
  }
  await expectProfessionSidebarDimensions(page, '桌面');
  await expectNoHorizontalOverflow(page, '桌面側邊欄職業圖標');
});

test('918px 抽屜維持七職業圖標、導航與重新開啟不重複', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定使用桌面專案模擬 918px 抽屜');
  await page.setViewportSize({ width: 918, height: 900 });
  await page.goto('/#/home');
  await waitForGuide(page);
  await page.locator('#menu-button').click();
  await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'false');
  await waitForIcons(page, professionSidebarImageSelector, 7);

  for (const [id, name] of professionSidebarEntries) {
    const link = page.locator(`.sidebar .nav-link[data-route="profession/${id}"]`);
    await expect(link).toBeVisible();
    await expect(link.locator(':scope > b')).toHaveText(name);
  }
  await expectProfessionSidebarDimensions(page, '918px');
  const inactiveMetrics = await readProfessionSidebarMetrics(page);

  await page.locator('.sidebar .nav-link[data-route="profession/thief"]').click();
  await expect(page).toHaveURL(/#\/profession\/thief$/);
  await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
  await page.locator('#menu-button').click();
  await expect(page.locator('.sidebar .nav-link[data-route="profession/thief"]')).toHaveClass(/is-active/);
  await expect(page.locator(professionSidebarImageSelector)).toHaveCount(7);
  for (const [id] of professionSidebarEntries) {
    await expect(page.locator(`.sidebar .nav-link[data-route="profession/${id}"] img[data-official-icon]`)).toHaveCount(1);
  }
  await expectProfessionSidebarDimensions(page, '918px active');
  const activeMetrics = await readProfessionSidebarMetrics(page);
  const inactiveThief = inactiveMetrics.find(item => item.id === 'thief');
  const activeThief = activeMetrics.find(item => item.id === 'thief');
  expect(Math.abs(activeThief.linkHeight - inactiveThief.linkHeight), 'active／inactive 列高').toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page, '918px 抽屜職業圖標');
});

test('390x844 手機側欄可捲到底且職業圖標不壓縮文字', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定使用桌面專案模擬 390x844 手機側欄');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await waitForGuide(page);
  await page.locator('#menu-button').click();
  await waitForIcons(page, professionSidebarImageSelector, 7);

  for (const [id, name] of professionSidebarEntries) {
    const link = page.locator(`.sidebar .nav-link[data-route="profession/${id}"]`);
    await expect(link.locator(':scope > b')).toHaveText(name);
    const labelFits = await link.locator(':scope > b').evaluate(label => label.scrollWidth <= label.clientWidth + 1);
    expect(labelFits, `${name} 不應被圖標壓縮或截斷`).toBe(true);
  }
  await expectProfessionSidebarDimensions(page, '390x844');

  const scroll = await page.locator('#sidebar').evaluate(sidebar => {
    sidebar.scrollTop = sidebar.scrollHeight;
    return {
      overflowY: getComputedStyle(sidebar).overflowY,
      hasScrollableRange: sidebar.scrollHeight > sidebar.clientHeight,
      reachedBottom: sidebar.scrollHeight - sidebar.clientHeight - sidebar.scrollTop <= 1,
      noHorizontalOverflow: sidebar.scrollWidth <= sidebar.clientWidth + 1
    };
  });
  expect(scroll).toEqual({
    overflowY: 'auto',
    hasScrollableRange: true,
    reachedBottom: true,
    noHorizontalOverflow: true
  });
  await expect(page.locator('.sidebar__footer small')).toBeVisible();
  await expectNoHorizontalOverflow(page, '390x844 手機側欄職業圖標');
});

test('側邊欄單一職業圖標失敗時只恢復該入口原符號', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定使用桌面專案驗證 sidebar fallback');
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.goto('/#/home');
  await waitForGuide(page);
  await waitForIcons(page, professionSidebarImageSelector, 7);
  const before = await readProfessionSidebarMetrics(page);

  const link = page.locator('.sidebar .nav-link[data-route="profession/thief"]');
  const host = link.locator(':scope > span[aria-hidden="true"]');
  await host.locator('img[data-official-icon="thief"]').evaluate(image => {
    image.dispatchEvent(new Event('error'));
  });
  await expect(host.locator('img')).toHaveCount(0);
  await expect(host).toHaveText('◈');
  await expect(page.locator(professionSidebarImageSelector)).toHaveCount(6);
  const after = await readProfessionSidebarMetrics(page);
  const beforeThief = before.find(item => item.id === 'thief');
  const afterThief = after.find(item => item.id === 'thief');
  expect(Math.abs(afterThief.linkHeight - beforeThief.linkHeight), 'fallback 前後列高').toBeLessThanOrEqual(1);
  expect(Math.abs(afterThief.labelLeft - beforeThief.labelLeft), 'fallback 前後文字左緣').toBeLessThanOrEqual(1);
  for (const beforeItem of before.filter(item => item.id !== 'thief')) {
    expect(after.find(item => item.id === beforeItem.id), `${beforeItem.id} 不得重新縮放或重排`).toEqual(beforeItem);
  }
  const sidebarWidths = await page.locator('#sidebar').evaluate(sidebar => ({
    scrollWidth: sidebar.scrollWidth,
    clientWidth: sidebar.clientWidth
  }));
  expect(sidebarWidths.scrollWidth).toBeLessThanOrEqual(sidebarWidths.clientWidth + 1);
  await expect(link).toHaveAttribute('href', '#/profession/thief');
  await link.click();
  await expect(page).toHaveURL(/#\/profession\/thief$/);
  expect(runtimeErrors).toEqual([]);
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
        await expect(page.locator('img[data-official-icon]:visible').first()).toBeVisible();
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
