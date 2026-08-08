const { test, expect } = require('@playwright/test');

const professionSidebarEntries = [
  ['swordsman', '劍術士', '◇'],
  ['greatsword-warrior', '大劍戰士', '◆'],
  ['warrior', '戰士', '⬡'],
  ['archer', '弓手', '⌁'],
  ['longbowman', '長弓兵', '⌁'],
  ['crossbowman', '弩手', '⌁'],
  ['thief', '盜賊', '◈'],
  ['fighter', '格鬥家', '✊'],
  ['dual-blades', '雙刀客', '⚔'],
  ['mage', '魔法師', '✧'],
  ['flame-mage', '火焰術士', '◆'],
  ['frost-mage', '冰霜術士', '❄']
];

const professionSidebarGroups = [
  ['warrior', ['warrior', 'greatsword-warrior', 'swordsman']],
  ['archer', ['archer', 'crossbowman', 'longbowman']],
  ['thief', ['thief', 'fighter', 'dual-blades']],
  ['mage', ['mage', 'flame-mage', 'frost-mage']]
];

const professionSeriesEntries = [
  ['series-warrior', 'warrior', '見習戰士系', '⚔'],
  ['series-archer', 'archer', '見習弓手系', '⌁'],
  ['series-thief', 'thief', '見習盜賊系', '◈'],
  ['series-mage', 'mage', '見習魔法師系', '✧', 'assets/icons/professions/mage.png']
];

const professionSidebarImageSelector = '.sidebar .nav-link[data-route^="profession/"] > span[aria-hidden="true"] > .official-icon--sidebar > img[data-official-icon]';
const professionSidebarImageSelectorForGroup = groupId => `.sidebar [data-profession-nav-group="${groupId}"] .nav-link[data-route^="profession/"] > span[aria-hidden="true"] > .official-icon--sidebar > img[data-official-icon]`;
const professionSeriesImageSelector = '.sidebar [data-profession-series-host] > .official-icon--profession-series > img[data-official-icon]';

function normalizeDomRectPixels(value) {
  return Math.round(value * 1000) / 1000;
}

async function waitForSidebarLayoutStable(page) {
  const result = await page.locator('#sidebar').evaluate(async sidebar => {
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const parseTime = value => {
      const trimmed = value.trim();
      return trimmed.endsWith('ms')
        ? Number.parseFloat(trimmed)
        : Number.parseFloat(trimmed) * 1000;
    };
    const style = getComputedStyle(sidebar);
    const properties = style.transitionProperty.split(',').map(value => value.trim());
    const durations = style.transitionDuration.split(',').map(parseTime);
    const delays = style.transitionDelay.split(',').map(parseTime);
    const transformTransitions = properties.map((property, index) => ({
      property,
      duration: durations[index % durations.length] || 0,
      delay: delays[index % delays.length] || 0
    })).filter(item => item.property === 'transform' || item.property === 'all');
    const transitionMs = Math.max(0, ...transformTransitions.map(item => item.duration + item.delay));
    const waitsForTransform = style.transform !== 'none' && transitionMs > 0;

    if (waitsForTransform) {
      await new Promise(resolve => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(fallbackTimer);
          sidebar.removeEventListener('transitionend', onTransitionEnd);
          resolve();
        };
        const onTransitionEnd = event => {
          if (event.target === sidebar && event.propertyName === 'transform') finish();
        };
        const fallbackTimer = setTimeout(finish, transitionMs + 100);
        sidebar.addEventListener('transitionend', onTransitionEnd);
      });
    }

    await nextFrame();
    await nextFrame();
    const readRect = () => {
      const rect = sidebar.getBoundingClientRect();
      return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
    };
    const isClose = (first, second) => ['x', 'y', 'width', 'height']
      .every(key => Math.abs(first[key] - second[key]) <= 0.001);
    let previous = readRect();
    let stableSamples = 1;
    for (let frame = 0; frame < 60; frame += 1) {
      await nextFrame();
      const current = readRect();
      stableSamples = isClose(previous, current) ? stableSamples + 1 : 1;
      if (stableSamples >= 2) {
        return {
          transform: style.transform,
          transitionProperty: style.transitionProperty,
          transitionDuration: style.transitionDuration,
          transitionDelay: style.transitionDelay,
          transitionMs,
          rect: current
        };
      }
      previous = current;
    }
    throw new Error(`sidebar layout 未在 60 frames 內穩定：${JSON.stringify(previous)}`);
  });
  expect(result.rect.width, 'sidebar 穩定後需保有寬度').toBeGreaterThan(0);
  return result;
}

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

async function readProfessionSeriesMetrics(page) {
  return page.locator('.sidebar summary[data-profession-series]').evaluateAll((summaries, entries) => summaries.map(summary => {
    const entry = entries.find(([id]) => id === summary.dataset.professionSeries);
    const host = summary.querySelector('[data-profession-series-host]');
    const wrapper = host?.querySelector('.official-icon--profession-series');
    const image = wrapper?.querySelector('img[data-official-icon]');
    const label = summary.querySelector('.profession-nav-group__label');
    const summaryRect = summary.getBoundingClientRect();
    const hostRect = host?.getBoundingClientRect();
    const wrapperRect = wrapper?.getBoundingClientRect();
    const imageRect = image?.getBoundingClientRect();
    const labelRect = label?.getBoundingClientRect();
    const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
    const imageStyle = image ? getComputedStyle(image) : null;
    return {
      id: entry?.[0],
      groupId: entry?.[1],
      name: entry?.[2],
      fallback: entry?.[3],
      summaryHeight: summaryRect.height,
      summaryFits: summary.scrollWidth <= summary.clientWidth + 1,
      labelOffset: labelRect.left - summaryRect.left,
      labelFits: label.scrollWidth <= label.clientWidth + 1,
      arrowContent: getComputedStyle(summary, '::after').content.replaceAll('"', ''),
      hostWidth: hostRect?.width ?? null,
      hostHeight: hostRect?.height ?? null,
      wrapperWidth: wrapperRect?.width ?? null,
      wrapperHeight: wrapperRect?.height ?? null,
      imageWidth: imageRect?.width ?? null,
      imageHeight: imageRect?.height ?? null,
      wrapperPadding: wrapperStyle ? [wrapperStyle.paddingTop, wrapperStyle.paddingRight, wrapperStyle.paddingBottom, wrapperStyle.paddingLeft] : null,
      wrapperBorder: wrapperStyle ? [wrapperStyle.borderTopWidth, wrapperStyle.borderRightWidth, wrapperStyle.borderBottomWidth, wrapperStyle.borderLeftWidth] : null,
      wrapperBackground: wrapperStyle?.backgroundColor ?? null,
      wrapperShadow: wrapperStyle?.boxShadow ?? null,
      wrapperFlex: wrapperStyle ? [wrapperStyle.flexGrow, wrapperStyle.flexShrink, wrapperStyle.flexBasis] : null,
      imageFit: imageStyle?.objectFit ?? null,
      imageFilter: imageStyle?.filter ?? null
    };
  }), professionSeriesEntries);
}

async function expectProfessionSeriesDimensions(page, label) {
  await waitForSidebarLayoutStable(page);
  await waitForIcons(page, professionSeriesImageSelector, 4);
  const layouts = await readProfessionSeriesMetrics(page);
  expect(layouts.map(layout => layout.id)).toEqual(professionSeriesEntries.map(([id]) => id));
  for (const layout of layouts) {
    expect(normalizeDomRectPixels(layout.hostWidth), `${label} ${layout.name} host width`).toBe(28);
    expect(normalizeDomRectPixels(layout.hostHeight), `${label} ${layout.name} host height`).toBe(28);
    expect(normalizeDomRectPixels(layout.wrapperWidth), `${label} ${layout.name} wrapper width`).toBe(28);
    expect(normalizeDomRectPixels(layout.wrapperHeight), `${label} ${layout.name} wrapper height`).toBe(28);
    expect(normalizeDomRectPixels(layout.imageWidth), `${label} ${layout.name} image width`).toBeLessThanOrEqual(24);
    expect(normalizeDomRectPixels(layout.imageHeight), `${label} ${layout.name} image height`).toBeLessThanOrEqual(24);
    expect(layout.wrapperPadding, `${label} ${layout.name} wrapper padding`).toEqual(['2px', '2px', '2px', '2px']);
    expect(layout.wrapperBorder, `${label} ${layout.name} wrapper border`).toEqual(['0px', '0px', '0px', '0px']);
    expect(layout.wrapperBackground, `${label} ${layout.name} wrapper background`).toBe('rgba(0, 0, 0, 0)');
    expect(layout.wrapperShadow, `${label} ${layout.name} wrapper shadow`).toBe('none');
    expect(layout.wrapperFlex, `${label} ${layout.name} wrapper flex`).toEqual(['0', '0', '28px']);
    expect(layout.imageFit, `${label} ${layout.name} image fit`).toBe('contain');
    expect(layout.imageFilter, `${label} ${layout.name} image filter`).toBe('none');
    expect(layout.summaryHeight, `${label} ${layout.name} summary height`).toBeGreaterThanOrEqual(45);
    expect(layout.summaryFits, `${label} ${layout.name} summary 不得擠壓箭頭`).toBe(true);
    expect(layout.labelFits, `${label} ${layout.name} 文字不得截斷`).toBe(true);
    expect(layout.arrowContent, `${label} ${layout.name} disclosure arrow`).toBe('⌄');
  }
  const labelOffsets = layouts.map(layout => layout.labelOffset);
  expect(Math.max(...labelOffsets) - Math.min(...labelOffsets), `${label} 系列文字左緣`).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page, `${label} 系列 summary`);
  return layouts;
}

async function openProfessionSidebarGroup(page, groupId) {
  const group = page.locator(`[data-profession-nav-group="${groupId}"]`);
  if (!(await group.evaluate(element => element.open))) await group.locator('summary').click();
  await expect(group).toHaveAttribute('open', '');
  await waitForSidebarLayoutStable(page);
  return group;
}

async function expectProfessionSidebarDimensions(page, label, groupId) {
  await waitForSidebarLayoutStable(page);
  const entryIds = professionSidebarGroups.find(([id]) => id === groupId)?.[1] || [];
  const entries = entryIds.map(id => professionSidebarEntries.find(([entryId]) => entryId === id));
  const links = page.locator(`[data-profession-nav-group="${groupId}"] .nav-link[data-route^="profession/"]`);
  await expect(links).toHaveCount(entries.length);
  const layouts = await links.evaluateAll((elements, entries) => {
    const entryById = new Map(entries.map(([id, name, fallback]) => [id, {name, fallback}]));
    const references = elements.map(element => {
      const professionId = element.dataset.route.split('/')[1];
      const entry = entryById.get(professionId);
      const linkRect = element.getBoundingClientRect();
      const reference = element.cloneNode(true);
      const referenceHost = reference.querySelector(':scope > span[aria-hidden="true"]');
      referenceHost.classList.remove('official-icon-source--profession-sidebar');
      referenceHost.removeAttribute('data-official-icon-host');
      referenceHost.removeAttribute('data-official-icon-fallback');
      referenceHost.replaceChildren(entry.fallback);
      reference.style.position = 'fixed';
      reference.style.inset = '0 auto auto -10000px';
      reference.style.inlineSize = `${linkRect.width}px`;
      reference.style.visibility = 'hidden';
      element.closest('.sidebar').append(reference);
      return reference;
    });

    try {
      return elements.map((element, index) => {
        const professionId = element.dataset.route.split('/')[1];
        const entry = entryById.get(professionId);
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

      return {
        id: professionId,
        name: entry.name,
        rowHeight: linkRect.height,
        fallbackHeight: references[index].getBoundingClientRect().height,
        labelOffset: labelRect.left - linkRect.left,
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
        wrapperSize: [wrapperStyle.inlineSize, wrapperStyle.blockSize],
        wrapperVerticalAlign: wrapperStyle.verticalAlign,
        imageSize: [iconStyle.inlineSize, iconStyle.blockSize],
        imageMaxSize: [iconStyle.maxInlineSize, iconStyle.maxBlockSize],
        imageFit: iconStyle.objectFit,
        imagePosition: iconStyle.objectPosition
      };
      });
    } finally {
      references.forEach(reference => reference.remove());
    }
  }, entries);

  expect(layouts.map(layout => layout.id)).toEqual(entries.map(([id]) => id));
  for (const layout of layouts) {
    const name = layout.name;
    expect(Math.abs(layout.rowHeight - layout.fallbackHeight), `${label} ${name} 列高`).toBeLessThanOrEqual(1);
    expect(layout.labelFits, `${label} ${name} 文字不得截斷`).toBe(true);
    expect(layout.linkFits, `${label} ${name} nav-link 不得水平溢位`).toBe(true);
    const wrapperWidth = normalizeDomRectPixels(layout.wrapperWidth);
    const wrapperHeight = normalizeDomRectPixels(layout.wrapperHeight);
    const imageWidth = normalizeDomRectPixels(layout.imageWidth);
    const imageHeight = normalizeDomRectPixels(layout.imageHeight);
    expect(wrapperWidth, `${label} ${name} wrapper width`).toBeGreaterThan(27.5);
    expect(wrapperWidth, `${label} ${name} wrapper width`).toBeLessThanOrEqual(28);
    expect(wrapperHeight, `${label} ${name} wrapper height`).toBeGreaterThan(27.5);
    expect(wrapperHeight, `${label} ${name} wrapper height`).toBeLessThanOrEqual(28);
    expect(imageWidth, `${label} ${name} image width`).toBeLessThanOrEqual(24);
    expect(imageHeight, `${label} ${name} image height`).toBeLessThanOrEqual(24);
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
    expect(layout.wrapperSize).toEqual(['28px', '28px']);
    expect(layout.wrapperVerticalAlign).toBe('middle');
    expect(layout.imageSize).toEqual(['24px', '24px']);
    expect(layout.imageMaxSize).toEqual(['24px', '24px']);
    expect(layout.imageFit).toBe('contain');
    expect(layout.imagePosition).toBe('50% 50%');
  }

  const labelOffsets = layouts.map(layout => layout.labelOffset);
  expect(Math.max(...labelOffsets) - Math.min(...labelOffsets), `${label} ${groupId} 文字相對左緣`).toBeLessThanOrEqual(2);
  const sidebarWidths = await page.locator('#sidebar').evaluate(sidebar => ({
    scrollWidth: sidebar.scrollWidth,
    clientWidth: sidebar.clientWidth
  }));
  expect(sidebarWidths.scrollWidth, `${label} sidebar 水平溢位`).toBeLessThanOrEqual(sidebarWidths.clientWidth + 1);
  return layouts;
}

async function readProfessionSidebarMetrics(page, groupId) {
  return page.locator(`[data-profession-nav-group="${groupId}"] .nav-link[data-route^="profession/"]`).evaluateAll(links => links.map(link => {
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
      labelOffset: labelRect.left - linkRect.left,
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

test('職業12枚在總覽與職業頁 hero 顯示', async ({ page }) => {
  await page.goto('/#/professions');
  await waitForGuide(page);
  const selector = '.profession-card img[data-official-icon]';
  await waitForIcons(page, selector, 12);
  await expectAccessibleDecorativeImages(page, selector);

  for (const id of ['swordsman', 'warrior', 'greatsword-warrior', 'archer', 'longbowman', 'crossbowman', 'thief', 'fighter', 'dual-blades', 'mage', 'flame-mage', 'frost-mage']) {
    await page.goto(`/#/profession/${id}`);
    await waitForGuide(page);
    const hero = page.locator(`.profession-hero [data-official-icon-detail="${id}"] img[data-official-icon="${id}"]`);
    await expect(hero).toBeVisible();
    await expect(hero).toHaveJSProperty('complete', true);
  }
});

test('見習職業系列 summary 使用官方圖標並保留單一 fallback', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定使用桌面專案驗證 summary 圖標契約');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/home');
  await waitForGuide(page);
  await expect(page.locator('.sidebar summary[data-profession-series]')).toHaveCount(4);
  await waitForIcons(page, professionSeriesImageSelector, 4);
  await expectAccessibleDecorativeImages(page, professionSeriesImageSelector);

  for (const [id, groupId, name, , icon] of professionSeriesEntries) {
    const summary = page.locator(`summary[data-profession-series="${id}"]`);
    const host = summary.locator(`[data-profession-series-host="${id}"]`);
    const image = host.locator(`img[data-official-icon="${id}"]`);
    await expect(summary).toContainText(name);
    await expect(host.locator('.official-icon--profession-series')).toHaveCount(1);
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('src', icon || `assets/icons/profession-series/${groupId}.png`);
    await expect(page.locator(`[data-profession-nav-group="${groupId}"]`)).not.toHaveAttribute('open', '');
  }

  await page.evaluate(() => {
    window.FanatioIconPilot.patch();
    window.FanatioIconPilot.patch();
  });
  await expect(page.locator(professionSeriesImageSelector)).toHaveCount(4);
  const before = await expectProfessionSeriesDimensions(page, '桌面');

  for (const appearance of ['light', 'dark']) {
    await page.evaluate(value => window.FanatioThemeSystem.apply({ appearance: value, palette: 'forest', persist: false }), appearance);
    await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
    await expectProfessionSeriesDimensions(page, `${appearance} 桌面`);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectProfessionSeriesDimensions(page, 'reduced motion 桌面');

  const warriorHost = page.locator('[data-profession-series-host="series-warrior"]');
  await warriorHost.locator('img[data-official-icon="series-warrior"]').evaluate(image => image.dispatchEvent(new Event('error')));
  await expect(warriorHost.locator('img')).toHaveCount(0);
  await expect(warriorHost).toHaveText('⚔');
  await expect(page.locator(professionSeriesImageSelector)).toHaveCount(3);
  await page.locator('[data-profession-nav-group="warrior"] summary').click();
  await expect(page.locator('[data-profession-nav-group="warrior"]')).toHaveAttribute('open', '');
  const after = await readProfessionSeriesMetrics(page);
  const beforeWarrior = before.find(item => item.id === 'series-warrior');
  const afterWarrior = after.find(item => item.id === 'series-warrior');
  expect(Math.abs(afterWarrior.summaryHeight - beforeWarrior.summaryHeight), '系列 fallback 前後列高').toBeLessThanOrEqual(1);
  expect(Math.abs(afterWarrior.labelOffset - beforeWarrior.labelOffset), '系列 fallback 前後文字左緣').toBeLessThanOrEqual(1);
  for (const series of before.filter(item => item.id !== 'series-warrior')) {
    expect(after.find(item => item.id === series.id), `${series.name} 不得因單一 fallback 重排`).toEqual(series);
  }
});

test('918px 與 390x844 抽屜維持見習職業系列圖標契約', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定使用桌面專案模擬窄版抽屜');
  await page.setViewportSize({ width: 918, height: 900 });
  await page.goto('/#/home');
  await waitForGuide(page);
  await page.locator('#menu-button').click();
  await expectProfessionSeriesDimensions(page, '918px');
  const backdrop = page.locator('#drawer-backdrop');
  const backdropBox = await backdrop.boundingBox();
  await backdrop.click({ position: { x: backdropBox.width - 8, y: 80 } });
  await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await waitForGuide(page);
  await page.locator('#menu-button').click();
  await expectProfessionSeriesDimensions(page, '390x844');
});

test('桌面側邊欄十二職業使用 manifest 官方圖標且接線保持冪等', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定使用桌面專案驗證側邊欄版面');
  expect(normalizeDomRectPixels(28.0000019)).toBe(28);
  expect(normalizeDomRectPixels(29)).toBe(29);
  expect(normalizeDomRectPixels(24.0000019)).toBe(24);
  expect(normalizeDomRectPixels(25)).toBe(25);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/home');
  await waitForGuide(page);
  await expectAccessibleDecorativeImages(page, professionSidebarImageSelector);

  await expect(page.locator('[data-profession-nav-group]')).toHaveCount(4);
  for (const [id, name] of professionSidebarEntries) {
    const link = page.locator(`.sidebar .nav-link[data-route="profession/${id}"]`);
    const host = link.locator(':scope > span[aria-hidden="true"]');
    const image = host.locator(`img[data-official-icon="${id}"]`);
    await expect(link).toHaveAttribute('href', `#/profession/${id}`);
    await expect(link).toHaveAttribute('data-route', `profession/${id}`);
    await expect(link.locator(':scope > b')).toHaveText(name);
    await expect(link.locator(':scope > b')).toBeHidden();
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('src', `assets/icons/professions/${id}.png`);
    await expect(host.locator(':scope > .official-icon--sidebar')).toHaveCount(1);
  }

  await page.evaluate(() => {
    window.FanatioIconPilot.patch();
    window.FanatioIconPilot.patch();
    window.FanatioThemeSystem.apply({ appearance: 'dark', palette: 'contrast', persist: false });
  });
  await expect(page.locator(professionSidebarImageSelector)).toHaveCount(12);
  for (const [id] of professionSidebarEntries) {
    await expect(page.locator(`.sidebar .nav-link[data-route="profession/${id}"] img[data-official-icon]`)).toHaveCount(1);
  }
  for (const [groupId] of professionSidebarGroups) {
    await openProfessionSidebarGroup(page, groupId);
    await waitForIcons(page, professionSidebarImageSelectorForGroup(groupId), 3);
    await expectProfessionSidebarDimensions(page, '桌面', groupId);
  }
  await expectNoHorizontalOverflow(page, '桌面側邊欄職業圖標');
});

test('918px 抽屜維持十二職業圖標、導航與重新開啟不重複', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定使用桌面專案模擬 918px 抽屜');
  await page.setViewportSize({ width: 918, height: 900 });
  await page.goto('/#/home');
  await waitForGuide(page);
  await page.locator('#menu-button').click();
  await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'false');
  await waitForSidebarLayoutStable(page);

  for (const [id, name] of professionSidebarEntries) {
    const link = page.locator(`.sidebar .nav-link[data-route="profession/${id}"]`);
    await expect(link).toBeHidden();
    await expect(link.locator(':scope > b')).toHaveText(name);
  }
  await openProfessionSidebarGroup(page, 'thief');
  await waitForIcons(page, professionSidebarImageSelectorForGroup('thief'), 3);
  await expectProfessionSidebarDimensions(page, '918px', 'thief');
  const inactiveMetrics = await readProfessionSidebarMetrics(page, 'thief');

  await page.locator('.sidebar .nav-link[data-route="profession/thief"]').click();
  await expect(page).toHaveURL(/#\/profession\/thief$/);
  await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
  await waitForSidebarLayoutStable(page);
  await page.locator('#menu-button').click();
  await waitForSidebarLayoutStable(page);
  await expect(page.locator('.sidebar .nav-link[data-route="profession/thief"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-profession-nav-group="thief"]')).toHaveAttribute('open', '');
  await expect(page.locator(professionSidebarImageSelector)).toHaveCount(12);
  for (const [id] of professionSidebarEntries) {
    await expect(page.locator(`.sidebar .nav-link[data-route="profession/${id}"] img[data-official-icon]`)).toHaveCount(1);
  }
  await expectProfessionSidebarDimensions(page, '918px active', 'thief');
  const activeMetrics = await readProfessionSidebarMetrics(page, 'thief');
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
  await waitForSidebarLayoutStable(page);

  for (const [id, name] of professionSidebarEntries) {
    const link = page.locator(`.sidebar .nav-link[data-route="profession/${id}"]`);
    await expect(link).toBeHidden();
    await expect(link.locator(':scope > b')).toHaveText(name);
  }
  for (const [groupId] of professionSidebarGroups) {
    await openProfessionSidebarGroup(page, groupId);
    await waitForIcons(page, professionSidebarImageSelectorForGroup(groupId), 3);
    await expectProfessionSidebarDimensions(page, '390x844', groupId);
  }

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
  await openProfessionSidebarGroup(page, 'thief');
  await waitForIcons(page, professionSidebarImageSelectorForGroup('thief'), 3);
  const before = await readProfessionSidebarMetrics(page, 'thief');

  const link = page.locator('.sidebar .nav-link[data-route="profession/thief"]');
  const host = link.locator(':scope > span[aria-hidden="true"]');
  await host.locator('img[data-official-icon="thief"]').evaluate(image => {
    image.dispatchEvent(new Event('error'));
  });
  await expect(host.locator('img')).toHaveCount(0);
  await expect(host).toHaveText('◈');
  await expect(page.locator(professionSidebarImageSelector)).toHaveCount(11);
  const after = await readProfessionSidebarMetrics(page, 'thief');
  const beforeThief = before.find(item => item.id === 'thief');
  const afterThief = after.find(item => item.id === 'thief');
  expect(Math.abs(afterThief.linkHeight - beforeThief.linkHeight), 'fallback 前後列高').toBeLessThanOrEqual(1);
  expect(Math.abs(afterThief.labelOffset - beforeThief.labelOffset), 'fallback 前後文字相對左緣').toBeLessThanOrEqual(1);
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

test('94枚職業技能在十二個職業頁取代編號底盤', async ({ page }) => {
  const matrix = [
    ['swordsman', ['swordmaster-steel-wedge', 'swordmaster-detection']],
    ['warrior', ['expert-warrior-battle-cry', 'expert-warrior-blade-smash']],
    ['greatsword-warrior', ['greatsword-warrior-blockade-front']],
    ['archer', ['expert-archer-magnum-shot']],
    ['longbowman', ['longbowman-crash-shot', 'longbowman-flame-barrage', 'longbowman-heart-seeker', 'longbowman-shell-breaker', 'longbowman-wing-skewer', 'longbowman-dragon-hunter', 'longbowman-sniping', 'longbowman-hunting', 'longbowman-combat-mastery-heroism', 'longbowman-keen-arrow', 'longbowman-fighting-spirit']],
    ['crossbowman', ['crossbowman-buster-shot', 'crossbowman-gusting-bolt', 'crossbowman-shock-explosion', 'crossbowman-sliding-step', 'crossbowman-spreading-bolt', 'crossbowman-hellfire', 'crossbowman-extra-action', 'crossbowman-driving-force', 'crossbowman-combat-mastery-threat', 'crossbowman-rapid-attack', 'crossbowman-expanded-magazine']],
    ['thief', ['thief-back-stab', 'thief-hide', 'thief-poison-trap', 'thief-screw-dagger', 'thief-throwing-bomb', 'thief-blitz-rush', 'thief-adrenaline', 'thief-sneak-attack', 'thief-combat-mastery-swiftness', 'thief-poison-attack', 'thief-poison-explosion']],
    ['fighter', ['fighter-charging-fist', 'fighter-impact-kick', 'fighter-back-step', 'fighter-burst-punch-1', 'fighter-somersault-1', 'fighter-power-max', 'fighter-combo-damage', 'fighter-finish-attack', 'fighter-combat-mastery-destruction', 'fighter-first-aid', 'fighter-shock-wave']],
    ['dual-blades', ['dual-blades-double-crescent', 'dual-blades-gliding-fury', 'dual-blades-howling-gale', 'dual-blades-hurricane-dance', 'dual-blades-outer-slash', 'dual-blades-final-hit', 'dual-blades-rising-aspirations', 'dual-blades-recharge', 'dual-blades-combat-mastery-destruction', 'dual-blades-vigor', 'dual-blades-wind-blade']],
    ['mage', ['mage-ice-dagger', 'mage-lightning', 'mage-mana-storm', 'mage-meteor-strike', 'mage-telekinesis', 'mage-infinite-mana', 'mage-meditation', 'mage-elemental-harmony', 'mage-combat-mastery-technique', 'mage-elemental-master', 'mage-arcane-power']],
    ['flame-mage', ['flame-mage-fire-storm', 'flame-mage-flame-cannon', 'flame-mage-flash-over', 'flame-mage-ignite', 'flame-mage-rapid-fire', 'flame-mage-inferno', 'flame-mage-burning-soul', 'flame-mage-blazing-flame', 'flame-mage-combat-mastery-technique', 'flame-mage-spark', 'flame-mage-overheat']],
    ['frost-mage', ['frost-mage-crystal-edge', 'frost-mage-freezing-field', 'frost-mage-frozen-orb', 'frost-mage-ice-spike', 'frost-mage-split-slash', 'frost-mage-absolute-zero', 'frost-mage-winter-veil', 'frost-mage-icicle-mark', 'frost-mage-combat-mastery-guard', 'frost-mage-fluttering-frost', 'frost-mage-piercing-chill']]
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
