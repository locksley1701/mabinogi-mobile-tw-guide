const { test, expect } = require('@playwright/test');

const jobs = [
  {
    id: 'mage', name: '魔法師', icon: 'assets/icons/professions/mage.png',
    skills: [['冰晶匕首', 'mage-ice-dagger'], ['雷電', 'mage-lightning'], ['魔力風暴', 'mage-mana-storm'], ['流星打擊', 'mage-meteor-strike'], ['念動力', 'mage-telekinesis'], ['無限魔力', 'mage-infinite-mana'], ['冥想', 'mage-meditation'], ['元素和諧', 'mage-elemental-harmony'], ['戰鬥熟練：技巧', 'mage-combat-mastery-technique'], ['元素大師', 'mage-elemental-master'], ['奧術力量', 'mage-arcane-power']]
  },
  {
    id: 'flame-mage', name: '火焰術士', icon: 'assets/icons/professions/flame-mage.png',
    skills: [['火焰風暴', 'flame-mage-fire-storm'], ['烈焰火炮', 'flame-mage-flame-cannon'], ['閃燃', 'flame-mage-flash-over'], ['爆炸', 'flame-mage-ignite'], ['疾火連彈', 'flame-mage-rapid-fire'], ['煉獄', 'flame-mage-inferno'], ['燃燒之魂', 'flame-mage-burning-soul'], ['熾焰', 'flame-mage-blazing-flame'], ['戰鬥熟練：技巧', 'flame-mage-combat-mastery-technique'], ['火花', 'flame-mage-spark'], ['過熱', 'flame-mage-overheat']]
  },
  {
    id: 'frost-mage', name: '冰霜術士', icon: 'assets/icons/professions/frost-mage.png',
    skills: [['水晶之刃', 'frost-mage-crystal-edge'], ['冰封領域', 'frost-mage-freezing-field'], ['霜凍法球', 'frost-mage-frozen-orb'], ['冰棘', 'frost-mage-ice-spike'], ['冰川裂刃', 'frost-mage-split-slash'], ['絕對零度', 'frost-mage-absolute-zero'], ['冬之帷幕', 'frost-mage-winter-veil'], ['冰錐印記', 'frost-mage-icicle-mark'], ['戰鬥熟練：守護', 'frost-mage-combat-mastery-guard'], ['紛飛的冰霜', 'frost-mage-fluttering-frost'], ['刺骨寒氣', 'frost-mage-piercing-chill']]
  }
];

const internalAliases = ['ExpertMage_MeteorStrike_Tier2A', 'FireMage_Flashover', 'ExpertMage_BoltMagicCombination_C1', 'FireMage_Backdraft'];
const skillAssertions = new Map([
  ['冰晶匕首', { tags: ['連擊', '元素', '干擾'], keyword: '六片旋轉的冰霜碎片', stats: [['冰霜碎片數量', '6 片']] }],
  ['雷電', { tags: ['元素', '干擾'], keyword: '觸電', stats: [] }],
  ['魔力風暴', { tags: ['生存', '輔助'], keyword: '魔力護甲', stats: [] }],
  ['流星打擊', { tags: ['強擊', '元素', '召喚'], keyword: '火焰地帶', stats: [['破防傷害', '1 格'], ['火焰地帶傷害次數', '6 次'], ['火焰地帶範圍', '5 m'], ['火焰地帶持續時間', '6 秒'], ['最大疊層數', '2']] }],
  ['念動力', { tags: ['連擊', '干擾'], keyword: '岩石碎片', stats: [['岩石碎片數量', '8 個']] }],
  ['火焰風暴', { tags: ['連擊', '元素', '干擾'], keyword: '灼熱', stats: [['攻擊次數', '10 次'], ['破防傷害', '1 格'], ['持續時間', '5 秒'], ['吸引範圍', '4 m'], ['範圍', '2 m']] }],
  ['烈焰火炮', { tags: ['元素', '干擾'], keyword: '烙印', stats: [['擊退距離', '6 m'], ['最大疊層數', '2'], ['範圍', '10 m']] }],
  ['閃燃', { tags: ['連擊', '元素'], keyword: '恢復體力', stats: [['效果觸發間隔', '2 秒'], ['範圍', '10 m']] }],
  ['爆炸', { tags: ['強擊', '連擊', '元素'], keyword: '消耗全部熱氣', stats: [['範圍', '4 m']] }],
  ['疾火連彈', { tags: ['連擊', '元素'], keyword: '三至五顆', stats: [['火焰球發射數', '3～5 顆']] }],
  ['水晶之刃', { tags: ['元素', '強擊'], keyword: '最多可重複使用三次', stats: [['可重複使用次數', '最多 3 次']] }],
  ['冰封領域', { tags: ['元素', '生存', '召喚'], keyword: '受到的傷害減少', stats: [] }],
  ['霜凍法球', { tags: ['元素', '召喚'], keyword: '生成冰霜', stats: [['持續傷害間隔', '0.5 秒']] }],
  ['冰棘', { tags: ['元素', '生存', '輔助'], keyword: '冰霜護盾', stats: [] }],
  ['冰川裂刃', { tags: ['強擊', '干擾'], keyword: '挑釁並使其凍結', stats: [['破防傷害', '1 格']] }]
  ,['無限魔力', { tags: ['絕招', '生存', '輔助'], keyword: '冷卻時間立即重置', stats: [] }]
  ,['冥想', { tags: [], keyword: '持續恢復魔力', stats: [] }]
  ,['元素和諧', { tags: [], keyword: '元素持續傷害', stats: [] }]
  ,['戰鬥熟練：技巧', { tags: [], keyword: '多重打擊傷害', stats: [] }]
  ,['元素大師', { tags: [], keyword: '持續傷害：觸電', stats: [] }]
  ,['奧術力量', { tags: [], keyword: '各效果分別套用', stats: [] }]
  ,['煉獄', { tags: ['絕招', '連擊', '元素', '輔助'], keyword: '3階段燃燒之魂', stats: [] }]
  ,['燃燒之魂', { tags: [], keyword: '儲備火焰之力', stats: [] }]
  ,['熾焰', { tags: ['連擊', '元素'], keyword: '噴出火流', stats: [] }]
  ,['火花', { tags: [], keyword: '生成大量熱氣', stats: [] }]
  ,['過熱', { tags: [], keyword: '冷卻時間會減少', stats: [] }]
  ,['絕對零度', { tags: ['絕招', '元素', '生存', '召喚'], keyword: '冰之隕石', stats: [] }]
  ,['冬之帷幕', { tags: [], keyword: '消耗1個冰霜', stats: [] }]
  ,['冰錐印記', { tags: ['元素'], keyword: '冰柱印記', stats: [] }]
  ,['戰鬥熟練：守護', { tags: [], keyword: '多重打擊傷害增加', stats: [] }]
  ,['紛飛的冰霜', { tags: [], keyword: '消耗冰霜的數量', stats: [] }]
  ,['刺骨寒氣', { tags: ['元素', '強擊'], keyword: '持續傷害：冰凍', stats: [] }]
]);

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

test.beforeEach(async ({ page }) => prepare(page));

test('三個正式魔法系 route 依固定順序顯示三十三筆技能與摘要來源說明', async ({ page }) => {
  for (const job of jobs) {
    await openRoute(page, `profession/${job.id}`);
    await expect(page.locator('#page-title')).toHaveText(job.name);
    await expect(page.locator('.profession-summary-basis')).toContainText('依已確認技能內容整理，並非官方職業介紹');
    const rows = page.locator('details.profession-skill');
    await expect(rows).toHaveCount(11);
    await expect(page.locator('.profession-skill__numeric-note')).toHaveCount(11);
    expect(await page.locator('.profession-skill__identity strong').allTextContents()).toEqual(job.skills.map(([name]) => name));
    for (const [index, [name]] of job.skills.entries()) {
      const expected = skillAssertions.get(name);
      const row = rows.nth(index);
      for (const tag of expected.tags) await expect(row.locator('.profession-skill__identity small')).toContainText(tag);
      await expect(row.locator('.profession-skill__description')).toContainText(expected.keyword);
      await expect(row.locator('dt')).toHaveCount(expected.stats.length);
      const actualStats = await row.locator('dt').evaluateAll(terms => terms.map(term => [
        term.textContent.trim(),
        term.nextElementSibling?.textContent.trim()
      ]));
      for (const [label, value] of expected.stats) {
        expect(actualStats).toContainEqual([label, value]);
      }
    }
    for (const alias of internalAliases) await expect(page.locator('#workspace')).not.toContainText(alias);
    await expect(page.locator('#workspace')).not.toContainText(/\$[!#(]/);
  }
});

test('魔法系職業與技能圖標可在總覽、hero、技能列與搜尋載入', async ({ page }) => {
  for (const job of jobs) {
    await openRoute(page, 'professions');
    await expectLoadedIcon(page.locator(`.profession-card[href="#/profession/${job.id}"] img[data-official-icon="${job.id}"]`), job.icon);
    await openRoute(page, `profession/${job.id}`);
    await expectLoadedIcon(page.locator(`.profession-hero img[data-official-icon="${job.id}"]`), job.icon);
    for (const [, skillId] of job.skills) {
      const iconPath = skillId === 'flame-mage-combat-mastery-technique'
        ? 'assets/icons/profession-skills/mage-combat-mastery-technique.png'
        : `assets/icons/profession-skills/${skillId}.png`;
      await expectLoadedIcon(page.locator(`.profession-skill img[data-official-icon="${skillId}"]`), iconPath);
    }
  }

  await openRoute(page, 'search');
  const input = page.locator('#site-search');
  await input.fill('魔法師');
  await expectLoadedIcon(page.locator('.result-row', { hasText: '魔法師' }).first().locator('img[data-official-icon="mage"]'), 'assets/icons/professions/mage.png');
  await input.fill('冰川裂刃');
  await expectLoadedIcon(page.locator('.result-row', { hasText: '冰川裂刃' }).first().locator('img[data-official-icon="frost-mage-split-slash"]'), 'assets/icons/profession-skills/frost-mage-split-slash.png');
});

test('mage 與 series-mage 依公開契約共用單一正式 PNG，內部別名不進公開資料或搜尋', async ({ page }) => {
  await openRoute(page, 'home');
  const raw = await page.evaluate(async () => Promise.all([
    fetch('data/professions.json').then(response => response.text()),
    fetch('data/profession-skills.json').then(response => response.text()),
    fetch('data/icon-pilot.json').then(response => response.text()),
    fetch('data/changelog.json').then(response => response.text())
  ]));
  const manifest = JSON.parse(raw[2]);
  const records = Object.values(manifest.categories).flat();
  const seriesMage = manifest.categories.professionSeries.find(item => item.id === 'series-mage');
  const mage = manifest.categories.professions.find(item => item.id === 'mage');
  const declaredShares = records.filter(item => Object.hasOwn(item, 'sharedWith'));
  expect(records).toHaveLength(134);
  expect(declaredShares).toHaveLength(3);
  expect(new Set(records.map(item => item.sha256)).size).toBe(records.length - declaredShares.length);
  expect(seriesMage).toMatchObject({
    name: '見習魔法師系',
    icon: 'assets/icons/professions/mage.png',
    sharedWith: 'mage'
  });
  expect(seriesMage.sha256).toBe(mage.sha256);
  for (const alias of internalAliases) {
    expect(raw.join('\n')).not.toContain(alias);
    await expect(page.locator('body')).not.toContainText(alias);
  }

  const series = page.locator('[data-profession-series-host="series-mage"] img[data-official-icon="series-mage"]');
  await expectLoadedIcon(series, 'assets/icons/professions/mage.png');
  await expect(page.locator('[data-profession-nav-group="mage"]')).not.toHaveAttribute('open', '');
  await page.evaluate(() => { window.FanatioIconPilot.patch(); window.FanatioIconPilot.patch(); });
  await expect(page.locator('[data-profession-series-host="series-mage"] img[data-official-icon="series-mage"]')).toHaveCount(1);

  await openRoute(page, 'search');
  const input = page.locator('#site-search');
  for (const alias of internalAliases) {
    await input.fill(alias);
    await expect(page.locator('.result-row')).toHaveCount(0);
  }
});

test('390×844 抽屜可選魔法師，重新開啟時維持魔法師系展開', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', '固定 viewport 案例只需執行一次');
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, 'home');
  await page.locator('#menu-button').click();
  const mageGroup = page.locator('[data-profession-nav-group="mage"]');
  await mageGroup.locator('summary').click();
  await expect(mageGroup).toHaveAttribute('open', '');
  await expect(page.locator('[data-route="profession/mage"]')).toBeVisible();
  await page.locator('[data-route="profession/mage"]').click();
  await expect(page).toHaveURL(/#\/profession\/mage$/);
  await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
  await page.locator('#menu-button').click();
  await expect(mageGroup).toHaveAttribute('open', '');
  await expect(page.locator('[data-route="profession/mage"]')).toHaveClass(/is-active/);
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(noOverflow).toBe(true);
});
