import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataPath = path.join(root, 'data', 'maps.json');
const errors = [];

function fail(location, message) {
  errors.push(`${location}: ${message}`);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unique(values) {
  return new Set(values).size === values.length;
}

let data;
try {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (error) {
  console.error(`data/maps.json 無法解析：${error.message}`);
  process.exit(1);
}

if (data.issue !== 14) fail('issue', '必須綁定 Issue #14');
if (data.version !== 1) fail('version', '目前只接受版本 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt || '')) fail('updatedAt', '必須是 YYYY-MM-DD');
if (!Array.isArray(data.maps) || data.maps.length < 3 || data.maps.length > 5) {
  fail('maps', 'MVP 必須包含 3～5 筆地圖或採集區資料');
}

const allowedNameTypes = new Set(['formal-map', 'verified-location-label', 'generic-area']);
const allowedStatuses = new Set(['tw-confirmed', 'user-tested', 'tw-testing', 'unconfirmed']);
const allowedConfidence = new Set(['high', 'medium', 'low']);
const seenMapIds = new Set();
const seenSpotIds = new Set();
let formalMapCount = 0;

for (const [index, map] of (data.maps || []).entries()) {
  const location = `maps[${index}]`;
  const requiredStrings = [
    'id', 'name', 'nameType', 'category', 'summary', 'details', 'requirements',
    'status', 'statusLabel', 'confidence', 'contributor', 'updatedAt', 'route'
  ];

  for (const key of requiredStrings) {
    if (!nonEmptyString(map[key])) fail(`${location}.${key}`, '必須是非空白字串');
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(map.id || '')) {
    fail(`${location}.id`, '必須是穩定 kebab-case 英文 ID');
  }
  if (seenMapIds.has(map.id)) fail(`${location}.id`, '地圖 ID 重複');
  seenMapIds.add(map.id);

  if (!allowedNameTypes.has(map.nameType)) fail(`${location}.nameType`, `不允許的名稱類型：${map.nameType}`);
  if (!allowedStatuses.has(map.status)) fail(`${location}.status`, `不允許的資料狀態：${map.status}`);
  if (!allowedConfidence.has(map.confidence)) fail(`${location}.confidence`, `不允許的可信度：${map.confidence}`);
  if (map.route !== `map/${map.id}`) fail(`${location}.route`, '必須等於 map/:id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(map.updatedAt || '')) fail(`${location}.updatedAt`, '必須是 YYYY-MM-DD');

  if (map.nameType === 'formal-map') formalMapCount += 1;
  if (map.nameType === 'generic-area') {
    if (map.status === 'tw-confirmed') fail(location, '區域泛稱不得標記為 tw-confirmed');
    if (!/泛稱|正式名稱待確認/.test(map.statusLabel || '')) {
      fail(`${location}.statusLabel`, '區域泛稱必須明確標示非正式地圖名稱');
    }
  }

  if (!Array.isArray(map.aliases) || !map.aliases.length || !map.aliases.every(nonEmptyString)) {
    fail(`${location}.aliases`, '至少需要一個有效搜尋別名');
  } else if (!unique(map.aliases.map(alias => alias.normalize('NFKC').toLowerCase()))) {
    fail(`${location}.aliases`, '同筆資料的搜尋別名不得重複');
  }

  if (!Array.isArray(map.gatheringSpots) || !map.gatheringSpots.length) {
    fail(`${location}.gatheringSpots`, '至少需要一個採集點');
    continue;
  }

  for (const [spotIndex, spot] of map.gatheringSpots.entries()) {
    const spotLocation = `${location}.gatheringSpots[${spotIndex}]`;
    for (const key of ['id', 'label', 'note']) {
      if (!nonEmptyString(spot[key])) fail(`${spotLocation}.${key}`, '必須是非空白字串');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spot.id || '')) {
      fail(`${spotLocation}.id`, '必須是穩定 kebab-case 英文 ID');
    }
    if (seenSpotIds.has(spot.id)) fail(`${spotLocation}.id`, '採集點 ID 重複');
    seenSpotIds.add(spot.id);

    if (!Array.isArray(spot.lifeSkillIds) || !spot.lifeSkillIds.length || !spot.lifeSkillIds.every(nonEmptyString)) {
      fail(`${spotLocation}.lifeSkillIds`, '至少需要一個生活技能 ID');
    }
    if (!Array.isArray(spot.items) || !spot.items.length || !spot.items.every(nonEmptyString)) {
      fail(`${spotLocation}.items`, '至少需要一個採集物或材料名稱');
    }
  }
}

if (formalMapCount < 1) fail('maps', 'MVP 至少需要一筆來源支持的正式地圖名稱');

const serialized = JSON.stringify(data);
for (const forbidden of ['drive.google.com', 'docs.google.com', '韓版位置', '示範地圖']) {
  if (serialized.includes(forbidden)) fail('data/maps.json', `不得包含：${forbidden}`);
}

if (errors.length) {
  console.error(`地圖資料契約驗證失敗，共 ${errors.length} 項：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const spotCount = data.maps.reduce((total, map) => total + map.gatheringSpots.length, 0);
console.log(`地圖資料契約通過：${data.maps.length} 筆地圖／區域、${spotCount} 個採集點。`);
