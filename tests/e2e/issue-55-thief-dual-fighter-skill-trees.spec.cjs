const { test, expect } = require('@playwright/test');

const professions = [
  {
    id: 'thief',
    active: ['奇襲', '隱身', '毒陷阱', '螺旋匕首', '投擲炸彈', '閃擊突襲'],
    passive: ['腎上腺素', '偷襲', '戰鬥熟練：疾速', '毒擊', '毒爆']
  },
  {
    id: 'dual-blades',
    active: ['雙重新月', '滑行狂怒', '怒號疾風', '旋轉突襲', '分裂斬', '終極連擊'],
    passive: ['渴望湧現', '再充能', '戰鬥熟練：毀滅', '活力', '風之刃']
  },
  {
    id: 'fighter',
    active: ['蓄力拳', '衝擊踢', '後退步', '爆裂拳：第1擊', '空翻踢：第1擊', '極限超載'],
    passive: ['連攜攻擊', '會心一擊', '戰鬥熟練：毀滅', '急救處置', '衝擊波']
  }
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fanatio-tour-v2', 'done'));
});

test('Issue #55 三職的完整技能樹保持分組、順序、解鎖與手機可讀性', async ({ page }) => {
  for (const profession of professions) {
    await page.goto(`/#/profession/${profession.id}`);
    await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
    const sections = page.locator('.profession-skill-section');
    await expect(sections).toHaveCount(2);
    expect(await sections.nth(0).locator('.profession-skill__identity strong').allTextContents()).toEqual(profession.active);
    expect(await sections.nth(1).locator('.profession-skill__identity strong').allTextContents()).toEqual(profession.passive);
    await expect(sections.nth(0).locator('.profession-skill')).toHaveCount(6);
    await expect(sections.nth(1).locator('.profession-skill')).toHaveCount(5);
  }

  await page.goto('/#/profession/fighter');
  await expect(page.locator('.profession-skill', { has: page.locator('strong', { hasText: '衝擊踢' }) })).toContainText('螺旋上勾拳或重踏踢');
  expect(await page.locator('.profession-skill__identity strong').allTextContents()).not.toContain('重踏踢');
  await expect(page.locator('#workspace')).toContainText('格鬥家 Lv.20 以上');
  await expect(page.locator('#workspace')).toContainText('格鬥家 Lv.15 以上');
  await expect(page.locator('#workspace')).toContainText('格鬥家 Lv.30 以上');
  await expect(page.locator('#workspace')).toContainText('格鬥家 Lv.45 以上');

  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(widths[1]).toBeLessThanOrEqual(widths[0] + 1);
});

test('Issue #55 的 18 枚新圖標、兩組共用契約與搜尋均可用', async ({ page }) => {
  await page.goto('/#/search');
  await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
  const raw = await page.evaluate(() => Promise.all([
    fetch('data/icon-pilot.json').then(response => response.json()),
    fetch('data/profession-skills.json').then(response => response.json())
  ]));
  const [manifest, skills] = raw;
  const records = Object.values(manifest.categories).flat();
  const added = records.filter(record => /^(thief-(blitz-rush|adrenaline|sneak-attack|combat-mastery-swiftness|poison-attack|poison-explosion)|dual-blades-(final-hit|rising-aspirations|recharge|combat-mastery-destruction|vigor|wind-blade)|fighter-(power-max|combo-damage|finish-attack|combat-mastery-destruction|first-aid|shock-wave))$/.test(record.id));
  expect(added).toHaveLength(18);
  expect(records).toHaveLength(116);
  expect(new Set(records.map(record => record.sha256)).size).toBe(114);
  expect(records.filter(record => Object.hasOwn(record, 'sharedWith'))).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'series-mage', sharedWith: 'mage' }),
    expect.objectContaining({ id: 'fighter-combat-mastery-destruction', sharedWith: 'dual-blades-combat-mastery-destruction' })
  ]));
  expect(skills.fighter.active.find(skill => skill.name === '衝擊踢')).toBeTruthy();

  const input = page.locator('#site-search');
  for (const name of added.map(record => record.name)) {
    await input.fill(name);
    await expect(page.locator('.result-row', { hasText: name }).first()).toBeVisible();
  }
});
