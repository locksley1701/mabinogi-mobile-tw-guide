const { test, expect } = require('@playwright/test');

const jobs = [
  {
    id: 'longbowman',
    name: '長弓兵',
    icon: 'assets/icons/professions/longbowman.png',
    skills: [
      ['震盪射擊', 'longbowman-crash-shot', 'assets/icons/profession-skills/longbowman-crash-shot.png'],
      ['烈焰箭', 'longbowman-flame-barrage', 'assets/icons/profession-skills/longbowman-flame-barrage.png'],
      ['尋心者', 'longbowman-heart-seeker', 'assets/icons/profession-skills/longbowman-heart-seeker.png'],
      ['破殼者', 'longbowman-shell-breaker', 'assets/icons/profession-skills/longbowman-shell-breaker.png'],
      ['翼之穿刺', 'longbowman-wing-skewer', 'assets/icons/profession-skills/longbowman-wing-skewer.png'],
      ['獵龍人', 'longbowman-dragon-hunter', 'assets/icons/profession-skills/longbowman-dragon-hunter.png'],
      ['狙擊術', 'longbowman-sniping', 'assets/icons/profession-skills/longbowman-sniping.png'],
      ['狩獵術', 'longbowman-hunting', 'assets/icons/profession-skills/longbowman-hunting.png'],
      ['戰鬥熟練：霸氣', 'longbowman-combat-mastery-heroism', 'assets/icons/profession-skills/longbowman-combat-mastery-heroism.png'],
      ['敏銳之箭', 'longbowman-keen-arrow', 'assets/icons/profession-skills/longbowman-keen-arrow.png'],
      ['鬥志高昂', 'longbowman-fighting-spirit', 'assets/icons/profession-skills/longbowman-fighting-spirit.png']
    ]
  },
  {
    id: 'crossbowman',
    name: '弩手',
    icon: 'assets/icons/professions/crossbowman.png',
    skills: [
      ['爆裂射擊', 'crossbowman-buster-shot', 'assets/icons/profession-skills/crossbowman-buster-shot.png'],
      ['狂風弩箭', 'crossbowman-gusting-bolt', 'assets/icons/profession-skills/crossbowman-gusting-bolt.png'],
      ['震撼爆裂', 'crossbowman-shock-explosion', 'assets/icons/profession-skills/crossbowman-shock-explosion.png'],
      ['滑步', 'crossbowman-sliding-step', 'assets/icons/profession-skills/crossbowman-sliding-step.png'],
      ['擴散弩箭', 'crossbowman-spreading-bolt', 'assets/icons/profession-skills/crossbowman-spreading-bolt.png'],
      ['地獄火', 'crossbowman-hellfire', 'assets/icons/profession-skills/crossbowman-hellfire.png'],
      ['額外行動', 'crossbowman-extra-action', 'assets/icons/profession-skills/crossbowman-extra-action.png'],
      ['驅動力', 'crossbowman-driving-force', 'assets/icons/profession-skills/crossbowman-driving-force.png'],
      ['戰鬥熟練：威脅', 'crossbowman-combat-mastery-threat', 'assets/icons/profession-skills/crossbowman-combat-mastery-threat.png'],
      ['快速攻擊', 'crossbowman-rapid-attack', 'assets/icons/profession-skills/crossbowman-rapid-attack.png'],
      ['擴充彈匣', 'crossbowman-expanded-magazine', 'assets/icons/profession-skills/crossbowman-expanded-magazine.png']
    ]
  }
];

const internalAliases = ['MountingShock', 'GustingVolt', 'SlipThrough', 'SpreadingVolt'];

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

async function expectLoadedIcon(image, path) {
  await expect(image).toHaveAttribute('src', path);
  await expect.poll(() => image.evaluate(element => element.naturalWidth)).toBeGreaterThan(0);
}

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

function skillByName(page, name) {
  return page.locator('.profession-skill').filter({
    has: page.locator('.profession-skill__identity strong', { hasText: name })
  });
}

test.beforeEach(async ({ page }) => prepare(page));

test('兩個正式 route 顯示六項主動與五項被動技能、待核實裝備與已確認常數', async ({ page }) => {
  for (const job of jobs) {
    await openRoute(page, `profession/${job.id}`);
    await expect(page.locator('#page-title')).toHaveText(job.name);
    await expect(page.locator('.profession-hero h1')).toHaveText(job.name);
    await expect(page.locator('.profession-summary-basis')).toContainText('依已確認技能內容整理，並非官方職業介紹');
    await expect(page.locator('.profession-summary')).toContainText('資料待補（尚無已核實來源）');
    await expect(page.locator('details.profession-skill')).toHaveCount(11);
    await expect(page.locator('.profession-skill__numeric-note')).toHaveCount(11);
    expect(await page.locator('.profession-skill__identity strong').allTextContents()).toEqual(job.skills.map(([name]) => name));
    await expect(page.locator('#workspace')).not.toContainText('$4[d]');
    await expectNoHorizontalOverflow(page);
  }

  await openRoute(page, 'profession/longbowman');
  await expect(skillByName(page, '烈焰箭')).toContainText('50%');
  await expect(skillByName(page, '尋心者')).toContainText('0.75 秒');
  await expect(skillByName(page, '翼之穿刺')).toContainText('迎擊時破防傷害');

  await openRoute(page, 'profession/crossbowman');
  await expect(skillByName(page, '爆裂射擊')).toContainText('6 m');
  await expect(skillByName(page, '狂風弩箭')).toContainText('10 次');
  await expect(skillByName(page, '滑步')).toContainText('2 次');
});

test('總覽、hero、技能列與搜尋使用十二個穩定公開圖標', async ({ page }) => {
  await openRoute(page, 'professions');
  for (const job of jobs) {
    await openRoute(page, 'professions');
    await expectLoadedIcon(page.locator(`.profession-card[href="#/profession/${job.id}"] img[data-official-icon="${job.id}"]`), job.icon);
    await openRoute(page, `profession/${job.id}`);
    await expectLoadedIcon(page.locator(`.profession-hero img[data-official-icon="${job.id}"]`), job.icon);
    for (const [name, id, path] of job.skills) {
      const row = page.locator('.profession-skill', { has: page.locator('.profession-skill__identity strong', { hasText: name }) });
      await expectLoadedIcon(row.locator(`img[data-official-icon="${id}"]`), path);
    }
  }

  await openRoute(page, 'search');
  const input = page.locator('#site-search');
  for (const job of jobs) {
    await input.fill(job.name);
    await expectLoadedIcon(page.locator('.result-row', { hasText: job.name }).first().locator(`img[data-official-icon="${job.id}"]`), job.icon);
    for (const [name, id, path] of job.skills) {
      await input.fill(name);
      await expectLoadedIcon(page.locator(`.result-row img[data-official-icon="${id}"]`).first(), path);
    }
  }
});

test('內部 alias 不進入公開資料、DOM 或搜尋', async ({ page }) => {
  await openRoute(page, 'home');
  const raw = await page.evaluate(async () => Promise.all([
    fetch('data/professions.json').then(response => response.text()),
    fetch('data/profession-skills.json').then(response => response.text()),
    fetch('data/icon-pilot.json').then(response => response.text()),
    fetch('data/changelog.json').then(response => response.text())
  ]));
  for (const alias of internalAliases) {
    expect(raw.join('\n')).not.toContain(alias);
    await expect(page.locator('body')).not.toContainText(alias);
  }

  await openRoute(page, 'search');
  const input = page.locator('#site-search');
  for (const alias of internalAliases) {
    await input.fill(alias);
    await expect(page.locator('.result-row')).toHaveCount(0);
  }
});

test('390×844、亮暗主題與 reduced motion 下維持可閱讀的 ranged job 頁面', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定 viewport 案例只需執行一次');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const job of jobs) {
    await openRoute(page, `profession/${job.id}`);
    await expect(page.locator('.profession-skill img[data-official-icon]')).toHaveCount(11);
    await expectNoHorizontalOverflow(page);
  }
  for (const appearance of ['light', 'dark']) {
    await page.evaluate(value => window.FanatioThemeSystem.apply({ appearance: value, palette: 'forest', persist: false }), appearance);
    await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
    await expect(page.locator('.profession-skill__identity strong', { hasText: '擴散弩箭' })).toBeVisible();
  }
});

test('390×844 抽屜開啟後可選長弓兵，重新開啟時保持弓手系展開', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定 viewport 案例只需執行一次');
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, 'home');
  await page.locator('#menu-button').click();

  const archerGroup = page.locator('[data-profession-nav-group="archer"]');
  await expectLoadedIcon(
    archerGroup.locator('summary img[data-official-icon="series-archer"]'),
    'assets/icons/profession-series/archer.png'
  );
  await archerGroup.locator('summary').click();
  await expect(archerGroup).toHaveAttribute('open', '');
  await expect(page.locator('[data-route="profession/longbowman"]')).toBeVisible();
  await page.locator('[data-route="profession/longbowman"]').click();
  await expect(page).toHaveURL(/#\/profession\/longbowman$/);
  await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

  await page.locator('#menu-button').click();
  await expect(archerGroup).toHaveAttribute('open', '');
  await expect(page.locator('[data-route="profession/longbowman"]')).toHaveClass(/is-active/);
  const scroll = await page.locator('#sidebar').evaluate(sidebar => {
    sidebar.scrollTop = sidebar.scrollHeight;
    return sidebar.scrollHeight - sidebar.clientHeight - sidebar.scrollTop <= 1;
  });
  expect(scroll).toBe(true);
  await expectNoHorizontalOverflow(page);
});
