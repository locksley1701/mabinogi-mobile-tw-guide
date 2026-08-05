const { test, expect } = require('@playwright/test');

const jobs = [
  {
    id: 'thief', name: '盜賊', professionIcon: 'assets/icons/professions/thief.png',
    skills: [
      ['奇襲', 'thief-back-stab', 'assets/icons/profession-skills/thief-back-stab.png'],
      ['隱身', 'thief-hide', 'assets/icons/profession-skills/thief-hide.png'],
      ['毒陷阱', 'thief-poison-trap', 'assets/icons/profession-skills/thief-poison-trap.png'],
      ['螺旋匕首', 'thief-screw-dagger', 'assets/icons/profession-skills/thief-screw-dagger.png'],
      ['投擲炸彈', 'thief-throwing-bomb', 'assets/icons/profession-skills/thief-throwing-bomb.png']
    ]
  },
  {
    id: 'fighter', name: '格鬥家', professionIcon: 'assets/icons/professions/fighter.png',
    skills: [
      ['後退步', 'fighter-back-step', 'assets/icons/profession-skills/fighter-back-step.png'],
      ['爆裂拳：第1擊', 'fighter-burst-punch-1', 'assets/icons/profession-skills/fighter-burst-punch-1.png'],
      ['蓄力拳', 'fighter-charging-fist', 'assets/icons/profession-skills/fighter-charging-fist.png'],
      ['空翻踢：第1擊', 'fighter-somersault-1', 'assets/icons/profession-skills/fighter-somersault-1.png'],
      ['重踏踢', 'fighter-stomp-kick', 'assets/icons/profession-skills/fighter-stomp-kick.png']
    ]
  },
  {
    id: 'dual-blades', name: '雙刀客', professionIcon: 'assets/icons/professions/dual-blades.png',
    skills: [
      ['雙重新月', 'dual-blades-double-crescent', 'assets/icons/profession-skills/dual-blades-double-crescent.png'],
      ['滑行狂怒', 'dual-blades-gliding-fury', 'assets/icons/profession-skills/dual-blades-gliding-fury.png'],
      ['怒號疾風', 'dual-blades-howling-gale', 'assets/icons/profession-skills/dual-blades-howling-gale.png'],
      ['旋轉突襲', 'dual-blades-hurricane-dance', 'assets/icons/profession-skills/dual-blades-hurricane-dance.png'],
      ['分裂斬', 'dual-blades-outer-slash', 'assets/icons/profession-skills/dual-blades-outer-slash.png']
    ]
  }
];

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-reading-size', 'comfortable');
    localStorage.setItem('fanatio-palette', 'forest');
    localStorage.setItem('fanatio-appearance', 'light');
  });
}

async function openRoute(page, route) {
  await page.goto(`/#/${route}`);
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
}

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

async function expectLoadedIcon(image, path) {
  await expect(image).toHaveAttribute('src', path);
  await expect(image).toHaveJSProperty('complete', true);
  await expect.poll(() => image.evaluate(element => element.naturalWidth)).toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('三個可分享 route 呈現各 5 筆技能與資料限制', async ({ page }) => {
  for (const job of jobs) {
    await openRoute(page, `profession/${job.id}`);
    await expect(page.locator('#page-title')).toHaveText(job.name);
    await expect(page.locator(`.nav-link[data-route="profession/${job.id}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.profession-hero h1')).toHaveText(job.name);
    await expect(page.locator('.profession-summary-basis')).toContainText('依已確認技能內容整理，並非官方職業介紹');
    const summary = page.locator('.profession-summary');
    await expect(summary).toContainText('資料待補（尚無已核實來源）');
    const descriptionCount = summary.locator('span', { hasText: '技能說明' }).locator('xpath=following-sibling::strong[1]');
    await expect(descriptionCount).toHaveText('5 個');
    await expect(summary).not.toContainText('完整效果');
    await expect(page.locator('details.profession-skill')).toHaveCount(5);
    await expect(page.locator('.profession-skill__numeric-note')).toHaveCount(5);

    const names = await page.locator('.profession-skill__identity strong').allTextContents();
    expect(names).toEqual(job.skills.map(([name]) => name));
    const opacities = await page.locator('.profession-skill').evaluateAll(elements =>
      elements.map(element => Number.parseFloat(getComputedStyle(element).opacity))
    );
    for (const opacity of opacities) expect(opacity).toBeGreaterThanOrEqual(0.99);
    await expectNoHorizontalOverflow(page);
  }
});

test('三職業總覽、hero 與 15 筆技能載入穩定官方圖標', async ({ page }) => {
  await openRoute(page, 'professions');
  const allSkillIconIds = [];

  for (const job of jobs) {
    await openRoute(page, 'professions');
    const cardIcon = page.locator(`.profession-card[href="#/profession/${job.id}"] img[data-official-icon="${job.id}"]`);
    await expectLoadedIcon(cardIcon, job.professionIcon);

    await openRoute(page, `profession/${job.id}`);
    const heroIcon = page.locator(`.profession-hero img[data-official-icon="${job.id}"]`);
    await expectLoadedIcon(heroIcon, job.professionIcon);

    const rowIcons = page.locator('.profession-skill img[data-official-icon]');
    await expect(rowIcons).toHaveCount(5);
    for (const [name, iconId, iconPath] of job.skills) {
      const row = page.locator('.profession-skill', { has: page.locator('.profession-skill__identity strong', { hasText: name }) });
      const image = row.locator(`img[data-official-icon="${iconId}"]`);
      await expectLoadedIcon(image, iconPath);
      allSkillIconIds.push(await image.getAttribute('data-official-icon'));
    }
  }

  expect(new Set(allSkillIconIds).size).toBe(15);
});

test('格鬥家只公開已確認的組合技基礎列與重踏踢正式名稱', async ({ page }) => {
  await openRoute(page, 'profession/fighter');
  const combos = page.locator('.profession-skill__combo');
  await expect(combos).toHaveCount(2);
  await expect(combos.nth(0)).toContainText('爆裂拳第 1／3 擊（已確認的基礎技能列）');
  await expect(combos.nth(1)).toContainText('空翻踢第 1／3 擊（已確認的基礎技能列）');
  const publicSkillNames = await page.locator('.profession-skill__identity strong').allTextContents();
  expect(publicSkillNames).not.toContain('爆裂拳：第2擊');
  expect(publicSkillNames).not.toContain('空翻踢：第2擊');
  await expect(page.locator('#workspace')).toContainText('重踏踢');
  await expect(page.locator('#workspace')).not.toContainText('AxeKick');
  await expectLoadedIcon(
    page.locator('.profession-skill', { hasText: '爆裂拳：第1擊' }).locator('img[data-official-icon="fighter-burst-punch-1"]'),
    'assets/icons/profession-skills/fighter-burst-punch-1.png'
  );
  await expectLoadedIcon(
    page.locator('.profession-skill', { hasText: '空翻踢：第1擊' }).locator('img[data-official-icon="fighter-somersault-1"]'),
    'assets/icons/profession-skills/fighter-somersault-1.png'
  );
  await expectLoadedIcon(
    page.locator('.profession-skill', { hasText: '重踏踢' }).locator('img[data-official-icon="fighter-stomp-kick"]'),
    'assets/icons/profession-skills/fighter-stomp-kick.png'
  );
});

test('職業與技能可由快速查詢抵達，內部別名不進入搜尋', async ({ page }) => {
  const cases = [
    ['盜賊', '盜賊', 'profession/thief'],
    ['後退步', '後退步', 'profession/fighter'],
    ['分裂斬', '分裂斬', 'profession/dual-blades']
  ];

  await openRoute(page, 'search');
  const input = page.locator('#site-search');
  for (const [query, title, route] of cases) {
    await input.fill(query);
    const result = page.locator('.result-row', { has: page.locator('strong', { hasText: title }) }).first();
    await expect(result).toBeVisible();
    await expect(result.locator('a')).toHaveAttribute('href', `#/${route}`);
  }

  await input.fill('AxeKick');
  await expect(page.locator('.result-row')).toHaveCount(0);
  await expect(page.locator('.empty-state')).toBeVisible();
});

test('搜尋結果為三職業與 15 技能顯示正式圖標', async ({ page }) => {
  await openRoute(page, 'search');
  const input = page.locator('#site-search');

  for (const job of jobs) {
    await input.fill(job.name);
    const professionResult = page.locator('.result-row', { has: page.locator('strong', { hasText: job.name }) }).first();
    await expectLoadedIcon(professionResult.locator(`img[data-official-icon="${job.id}"]`), job.professionIcon);

    for (const [name, iconId, iconPath] of job.skills) {
      await input.fill(name);
      const result = page.locator('.result-row', { has: page.locator('strong', { hasText: name }) }).first();
      await expectLoadedIcon(result.locator(`img[data-official-icon="${iconId}"]`), iconPath);
    }
  }

  await input.fill('AxeKick');
  await expect(page.locator('.result-row')).toHaveCount(0);
  await expect(page.locator('#workspace')).not.toContainText('AxeKick');
});

test('Issue #9 技能圖標失敗時恢復編號 fallback 且不保留破圖', async ({ page }) => {
  await openRoute(page, 'profession/thief');
  const host = page.locator('.profession-skill', { hasText: '奇襲' }).locator('.profession-skill__number');
  const image = host.locator('img[data-official-icon="thief-back-stab"]');
  await expectLoadedIcon(image, 'assets/icons/profession-skills/thief-back-stab.png');
  await image.evaluate(element => { element.src = 'assets/icons/missing-issue-9-icon.png'; });
  await expect(host).not.toHaveClass(/has-official-icon/);
  await expect(host.locator('img')).toHaveCount(0);
  await expect(host).toHaveText('01');
});

test('公開 JSON 保持三職業、15 技能、route 與 changelog 契約', async ({ page }) => {
  await openRoute(page, 'home');
  const data = await page.evaluate(async () => {
    const [professions, professionSkillsRaw, iconManifestRaw, changelog] = await Promise.all([
      fetch('data/professions.json', { cache: 'no-store' }).then(response => response.json()),
      fetch('data/profession-skills.json', { cache: 'no-store' }).then(response => response.text()),
      fetch('data/icon-pilot.json', { cache: 'no-store' }).then(response => response.text()),
      fetch('data/changelog.json', { cache: 'no-store' }).then(response => response.json())
    ]);
    return {
      professions,
      professionSkillsRaw,
      professionSkills: JSON.parse(professionSkillsRaw),
      iconManifestRaw,
      iconManifest: JSON.parse(iconManifestRaw),
      changelog
    };
  });

  const added = data.professions.filter(item => jobs.some(job => job.id === item.id));
  expect(added).toHaveLength(3);
  expect(added.every(item => item.documented && item.routeSlug === item.id)).toBeTruthy();
  const skills = jobs.flatMap(job => data.professionSkills[job.id].active);
  expect(skills).toHaveLength(15);
  expect(skills.every(skill => skill.status === 'tw-confirmed' && skill.numericValuesStatus === 'pending_resolution' && skill.stats.length === 0)).toBeTruthy();
  expect(data.professionSkillsRaw).not.toContain('AxeKick');
  expect(data.iconManifestRaw).not.toContain('AxeKick');
  expect(data.iconManifestRaw).not.toMatch(/[A-Za-z]:[\\/]/);
  expect(data.iconManifestRaw).not.toMatch(/Blob|Segment|Bundle|OfficialIconLibrary|appdata/i);
  expect(data.iconManifest.categories.professions).toHaveLength(9);
  expect(data.iconManifest.categories.professionSkills).toHaveLength(31);
  const stompKick = data.professionSkills.fighter.active.find(skill => skill.name === '重踏踢');
  expect(stompKick).toMatchObject({ clientSkillId: 'StompKick', presentationMode: 'corrected_alias' });
  expect(stompKick).not.toHaveProperty('internalAlias');
  expect(stompKick).not.toHaveProperty('publicAliasPolicy');
  expect(data.changelog.some(item => item.item === '盜賊系三職業技能手札')).toBeTruthy();
});

test('既有職業頁維持技能說明語意與 route 內容', async ({ page }) => {
  await openRoute(page, 'profession/swordsman');
  await expect(page.locator('#page-title')).toHaveText('劍術士');
  await expect(page.locator('details.profession-skill')).toHaveCount(11);
  const summary = page.locator('.profession-summary');
  const descriptionCount = summary.locator('span', { hasText: '技能說明' }).locator('xpath=following-sibling::strong[1]');
  await expect(descriptionCount).toHaveText('11 個');
  await expect(summary).not.toContainText('完整效果');
  await expectNoHorizontalOverflow(page);
});

test('918px 抽屜可抵達三個新職業且頁面無水平溢位', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定寬度案例只需執行一次');
  await page.setViewportSize({ width: 918, height: 900 });
  await openRoute(page, 'professions');
  await expect(page.locator('#menu-button')).toBeVisible();

  for (const job of jobs) {
    await page.locator('#menu-button').click();
    const thiefGroup = page.locator('[data-profession-nav-group="thief"]');
    if (!(await thiefGroup.evaluate(element => element.open))) await thiefGroup.locator('summary').click();
    await expect(thiefGroup).toHaveAttribute('open', '');
    const link = page.locator(`.nav-link[data-route="profession/${job.id}"]`);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#/profession/${job.id}$`));
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
    await expectNoHorizontalOverflow(page);
  }
});

test('390×844 手機圖標不擠壓技能名稱與展開控制', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定手機 viewport 案例只需執行一次');
  await page.setViewportSize({ width: 390, height: 844 });

  for (const job of jobs) {
    await openRoute(page, `profession/${job.id}`);
    await expect(page.locator('.profession-skill img[data-official-icon]')).toHaveCount(5);
    const layout = await page.locator('.profession-skill__summary').evaluateAll(elements => elements.map(element => {
      const name = element.querySelector('.profession-skill__identity strong');
      const toggle = element.querySelector('.profession-skill__toggle');
      return {
        nameWidth: name?.getBoundingClientRect().width || 0,
        toggleWidth: toggle?.getBoundingClientRect().width || 0,
        summaryHeight: element.getBoundingClientRect().height
      };
    }));
    for (const item of layout) {
      expect(item.nameWidth).toBeGreaterThan(0);
      expect(item.toggleWidth).toBeGreaterThan(0);
      expect(item.summaryHeight).toBeGreaterThanOrEqual(46);
    }
    await expectNoHorizontalOverflow(page);
  }
});

test('亮色、暗色與 reduced motion 下技能內容皆可閱讀', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRoute(page, 'profession/fighter');

  for (const appearance of ['light', 'dark']) {
    await page.evaluate(value => {
      window.FanatioThemeSystem.apply({ appearance: value, palette: 'forest', persist: false });
    }, appearance);
    await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
    await expect(page.locator('.profession-skill__identity strong', { hasText: '重踏踢' })).toBeVisible();
    const scrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(scrollBehavior).toBe('auto');
    await expectNoHorizontalOverflow(page);
  }
});
