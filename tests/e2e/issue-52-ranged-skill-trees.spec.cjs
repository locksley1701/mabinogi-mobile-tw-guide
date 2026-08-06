const { test, expect } = require('@playwright/test');

const jobs = [
  {
    id: 'longbowman',
    active: ['震盪射擊', '烈焰箭', '尋心者', '破殼者', '翼之穿刺', '獵龍人'],
    passive: ['狙擊術', '狩獵術', '戰鬥熟練：霸氣', '敏銳之箭', '鬥志高昂'],
    unlocks: ['長弓兵 Lv.20 以上', '長弓兵 Lv.15 以上', '長弓兵 Lv.30 以上', '長弓兵 Lv.45 以上']
  },
  {
    id: 'crossbowman',
    active: ['爆裂射擊', '狂風弩箭', '震撼爆裂', '滑步', '擴散弩箭', '地獄火'],
    passive: ['額外行動', '驅動力', '戰鬥熟練：威脅', '快速攻擊', '擴充彈匣'],
    unlocks: ['弩手 Lv.20 以上', '弩手 Lv.15 以上', '弩手 Lv.30 以上', '弩手 Lv.45 以上']
  }
];

async function prepare(page) {
  await page.addInitScript(() => localStorage.setItem('fanatio-tour-v2', 'done'));
}

function skillByName(page, name) {
  return page.locator('.profession-skill').filter({
    has: page.locator('.profession-skill__identity strong', { hasText: name })
  });
}

test.beforeEach(async ({ page }) => prepare(page));

test('Issue #52 兩職完整技能樹維持主動與被動的固定順序及解鎖資訊', async ({ page }) => {
  for (const job of jobs) {
    await page.goto(`/#/profession/${job.id}`);
    await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);

    await expect(page.locator('.profession-summary')).toContainText('11 個');
    const columns = page.locator('.profession-skill-section');
    await expect(columns).toHaveCount(2);
    await expect(columns.nth(0).locator('h2')).toHaveText('主動技能');
    await expect(columns.nth(1).locator('h2')).toHaveText('被動技能');
    expect(await columns.nth(0).locator('.profession-skill__identity strong').allTextContents()).toEqual(job.active);
    expect(await columns.nth(1).locator('.profession-skill__identity strong').allTextContents()).toEqual(job.passive);
    await expect(columns.nth(0).locator('.profession-skill')).toHaveCount(6);
    await expect(columns.nth(1).locator('.profession-skill')).toHaveCount(5);
    for (const unlock of job.unlocks) await expect(page.locator('#workspace')).toContainText(unlock);
  }

  await expect(skillByName(page, '額外行動')).toContainText('下一次裝填技能攻擊次數');
  await expect(skillByName(page, '額外行動')).toContainText('2 倍');
});

test('Issue #52 新增圖標在職業頁與搜尋結果均有一枚可載入的公開 image', async ({ page }) => {
  const iconIds = [
    'longbowman-dragon-hunter', 'longbowman-sniping', 'longbowman-hunting', 'longbowman-combat-mastery-heroism', 'longbowman-keen-arrow', 'longbowman-fighting-spirit',
    'crossbowman-hellfire', 'crossbowman-extra-action', 'crossbowman-driving-force', 'crossbowman-combat-mastery-threat', 'crossbowman-rapid-attack', 'crossbowman-expanded-magazine'
  ];

  for (const job of jobs) {
    await page.goto(`/#/profession/${job.id}`);
    await page.waitForFunction(() => document.querySelector('#workspace')?.childElementCount > 0);
    const jobIconIds = iconIds.filter(id => id.startsWith(job.id));
    for (const id of jobIconIds) {
      const image = page.locator(`.profession-skill img[data-official-icon="${id}"]`);
      await expect(image).toHaveCount(1);
      await expect.poll(() => image.evaluate(element => element.naturalWidth)).toBe(256);
    }
  }
});
