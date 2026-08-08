const { test, expect } = require('@playwright/test');

const professions = [
  {
    id: 'mage',
    active: ['冰晶匕首', '雷電', '魔力風暴', '流星打擊', '念動力', '無限魔力'],
    passive: ['冥想', '元素和諧', '戰鬥熟練：技巧', '元素大師', '奧術力量'],
    ultimate: '無限魔力',
    ultimateTags: ['絕招', '生存', '輔助'],
    icon: 'mage-elemental-harmony'
  },
  {
    id: 'flame-mage',
    active: ['火焰風暴', '烈焰火炮', '閃燃', '爆炸', '疾火連彈', '煉獄'],
    passive: ['燃燒之魂', '熾焰', '戰鬥熟練：技巧', '火花', '過熱'],
    ultimate: '煉獄',
    ultimateTags: ['絕招', '連擊', '元素', '輔助'],
    icon: 'flame-mage-blazing-flame'
  },
  {
    id: 'frost-mage',
    active: ['水晶之刃', '冰封領域', '霜凍法球', '冰棘', '冰川裂刃', '絕對零度'],
    passive: ['冬之帷幕', '冰錐印記', '戰鬥熟練：守護', '紛飛的冰霜', '刺骨寒氣'],
    ultimate: '絕對零度',
    ultimateTags: ['絕招', '元素', '生存', '召喚'],
    icon: 'frost-mage-combat-mastery-guard'
  }
];

async function openRoute(page, route) {
  await page.goto(`/#/${route}`);
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  await expect(page.locator('#workspace')).not.toContainText('資料載入失敗');
}

async function expectLoadedIcon(image) {
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('naturalWidth', 256);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fanatio-tour-v2', 'done');
    localStorage.setItem('fanatio-reading-size', 'comfortable');
  });
});

test('Issue #57 三職完整技能樹維持分組、順序、Lv 解鎖與正式標籤', async ({ page }) => {
  for (const profession of professions) {
    await openRoute(page, `profession/${profession.id}`);
    const sections = page.locator('.profession-skill-section');
    await expect(sections).toHaveCount(2);
    await expect(sections.nth(0).locator('.profession-skill')).toHaveCount(6);
    await expect(sections.nth(1).locator('.profession-skill')).toHaveCount(5);
    expect(await sections.nth(0).locator('.profession-skill__identity strong').allTextContents()).toEqual(profession.active);
    expect(await sections.nth(1).locator('.profession-skill__identity strong').allTextContents()).toEqual(profession.passive);

    const ultimate = page.locator('.profession-skill', { has: page.locator('strong', { hasText: profession.ultimate }) });
    for (const tag of profession.ultimateTags) await expect(ultimate.locator('.profession-skill__identity small')).toContainText(tag);
    await expect(ultimate).toContainText('Lv.20 以上');
    await expect(page.locator('#workspace')).toContainText(`${profession.id === 'mage' ? '魔法師' : profession.id === 'flame-mage' ? '火焰術士' : '冰霜術士'} Lv.15 以上`);
    await expect(page.locator('#workspace')).toContainText(`${profession.id === 'mage' ? '魔法師' : profession.id === 'flame-mage' ? '火焰術士' : '冰霜術士'} Lv.30 以上`);
    await expect(page.locator('#workspace')).toContainText(`${profession.id === 'mage' ? '魔法師' : profession.id === 'flame-mage' ? '火焰術士' : '冰霜術士'} Lv.45 以上`);
    await expect(page.locator(`.profession-skill img[data-official-icon="${profession.icon}"]`)).toHaveJSProperty('naturalWidth', 256);
  }

  await openRoute(page, 'profession/flame-mage');
  await expect(page.locator('.profession-skill', { has: page.locator('strong', { hasText: '熾焰' }) })).toContainText('噴出火流');
  await openRoute(page, 'profession/frost-mage');
  await expect(page.locator('.profession-skill', { has: page.locator('strong', { hasText: '冰錐印記' }) })).toContainText('元素');
  await expect(page.locator('.profession-skill', { has: page.locator('strong', { hasText: '刺骨寒氣' }) })).toContainText('強擊');
});

test('Issue #57 的 18 筆 manifest、17 枚實體資產、搜尋與共用契約均正確', async ({ page }) => {
  await openRoute(page, 'search');
  const [manifest, skills] = await page.evaluate(() => Promise.all([
    fetch('data/icon-pilot.json').then(response => response.json()),
    fetch('data/profession-skills.json').then(response => response.json())
  ]));
  const records = Object.values(manifest.categories).flat();
  const added = records.filter(record => /^(mage-(infinite-mana|meditation|elemental-harmony|combat-mastery-technique|elemental-master|arcane-power)|flame-mage-(inferno|burning-soul|blazing-flame|combat-mastery-technique|spark|overheat)|frost-mage-(absolute-zero|winter-veil|icicle-mark|combat-mastery-guard|fluttering-frost|piercing-chill))$/.test(record.id));
  expect(added).toHaveLength(18);
  expect(records).toHaveLength(134);
  expect(new Set(records.map(record => record.sha256)).size).toBe(131);
  expect(records.find(record => record.id === 'mage-elemental-harmony')).toMatchObject({
    icon: 'assets/icons/profession-skills/mage-elemental-harmony.png',
    sha256: '334fdd2dbe199d20d4efd31be90967614445ab21ad343bb46723d4d7020573ea'
  });
  expect(records.find(record => record.id === 'flame-mage-blazing-flame')).toMatchObject({
    icon: 'assets/icons/profession-skills/flame-mage-blazing-flame.png',
    sha256: '43b2af8c548783c24070321fd23ebcf1dd7a4429ca706a0d416a8188ff724907'
  });
  const mageTechnique = records.find(record => record.id === 'mage-combat-mastery-technique');
  const flameTechnique = records.find(record => record.id === 'flame-mage-combat-mastery-technique');
  expect(flameTechnique).toMatchObject({ sharedWith: 'mage-combat-mastery-technique', icon: mageTechnique.icon, sha256: mageTechnique.sha256 });
  expect(records.find(record => record.id === 'frost-mage-combat-mastery-guard')).not.toHaveProperty('sharedWith');
  expect(skills['frost-mage'].passive.find(skill => skill.name === '戰鬥熟練：守護')).toBeTruthy();

  const input = page.locator('#site-search');
  for (const record of added) {
    await input.fill(record.name);
    const result = page.locator(`.result-row:has(a[href="#/profession/${record.professionId}"])`, {
      has: page.getByText(record.name, { exact: true })
    });
    await expect(result).toBeVisible();
    await expectLoadedIcon(result.locator(`img[data-official-icon="${record.id}"]`));
  }
});

test('Issue #57 魔法系在桌面、918px、390px、明暗與 reduced motion 無水平溢位', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 918, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const appearance of ['light', 'dark']) {
      await openRoute(page, 'profession/frost-mage');
      await page.evaluate(value => window.FanatioThemeSystem.apply({ appearance: value, palette: 'forest', persist: false }), appearance);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const widths = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
      expect(widths[1], `${viewport.width}px ${appearance}`).toBeLessThanOrEqual(widths[0] + 1);
    }
  }
});
