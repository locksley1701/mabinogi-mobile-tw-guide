import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const examplesPath = path.join(root, 'docs', 'data-contract-examples.json');

const allowedStatuses = new Set([
  'tw-confirmed',
  'user-tested',
  'tw-testing',
  'kr-reference',
  'unconfirmed'
]);

const allowedAliasTargetTypes = new Set([
  'life',
  'cooking',
  'afk',
  'profession',
  'combatSkill'
]);

const allowedAliasScopes = new Set([
  'entity',
  'related-term'
]);

const allowedAliasKinds = new Set([
  'former-name',
  'other-version',
  'common-typo',
  'colloquial',
  'abbreviation'
]);

const forbiddenStateFields = new Set([
  'disabled',
  'inactive',
  'locked',
  'isLocked',
  'unavailable',
  'invalid'
]);

const privateKeyPatterns = [
  /^email$/i,
  /^phone$/i,
  /^googleAccount$/i,
  /^attachmentUrl$/i,
  /^driveUrl$/i,
  /^screenshotFile$/i,
  /^privateContact$/i
];

const privateValuePatterns = [
  /drive\.google\.com/i,
  /docs\.google\.com/i,
  /IMG_\d+\.(?:PNG|JPE?G|WEBP)/i,
  /file_[0-9a-f]{8,}/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
];

const contradictoryStatusWords = /失效|無效|未實裝/;
const errors = [];
const warnings = [];
let objectCount = 0;

function fail(location, message) {
  errors.push(`${location}: ${message}`);
}

function warn(location, message) {
  warnings.push(`${location}: ${message}`);
}

function normalizeName(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLocaleLowerCase('zh-Hant-TW')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(path.relative(root, filePath), `JSON 無法解析：${error.message}`);
    return null;
  }
}

function validateStringField(object, key, location) {
  if (!(key in object)) return;
  if (typeof object[key] !== 'string' || !object[key].trim()) {
    fail(`${location}.${key}`, '必須是非空白字串');
  }
}

function validateObject(object, location) {
  objectCount += 1;

  for (const key of Object.keys(object)) {
    if (forbiddenStateFields.has(key)) {
      fail(`${location}.${key}`, '禁止用此欄位表示玩家尚未解鎖；請改用 unlock');
    }
    if (privateKeyPatterns.some(pattern => pattern.test(key))) {
      fail(`${location}.${key}`, '公開 JSON 不得包含私人聯絡或原始附件欄位');
    }
  }

  if ('status' in object) {
    if (typeof object.status !== 'string' || !allowedStatuses.has(object.status)) {
      fail(`${location}.status`, `不允許的狀態值：${String(object.status)}`);
    }
  }

  if ('statusLabel' in object) {
    validateStringField(object, 'statusLabel', location);
    if (!('status' in object)) {
      fail(`${location}.statusLabel`, '存在 statusLabel 時必須同時提供 status');
    }
    if (typeof object.statusLabel === 'string' && contradictoryStatusWords.test(object.statusLabel)) {
      fail(`${location}.statusLabel`, '不得以失效、無效或未實裝描述已公開項目');
    }
    if (
      object.status === 'tw-confirmed' &&
      typeof object.statusLabel === 'string' &&
      /未確認|待確認|待實測/.test(object.statusLabel)
    ) {
      fail(`${location}.statusLabel`, 'tw-confirmed 不得搭配未確認或待實測文案');
    }
  }

  for (const key of ['unlock', 'detailStatus', 'contributor', 'source']) {
    validateStringField(object, key, location);
  }

  if (typeof object.unlock === 'string' && contradictoryStatusWords.test(object.unlock)) {
    fail(`${location}.unlock`, '解鎖條件不得混入資料失效或實裝狀態');
  }

  if (typeof object.detailStatus === 'string' && contradictoryStatusWords.test(object.detailStatus)) {
    fail(`${location}.detailStatus`, '待補說明不得把已存在內容描述為失效或未實裝');
  }

  if (
    object.status === 'user-tested' &&
    !object.contributor &&
    !(typeof object.source === 'string' && object.source.includes('法那提歐'))
  ) {
    warn(location, 'user-tested 建議明確提供 contributor');
  }

  if (
    !object.contributor &&
    typeof object.source === 'string' &&
    object.source.includes('法那提歐')
  ) {
    warn(location, '仍由舊 source 推導署名；後續請遷移為 contributor');
  }

  for (const [key, value] of Object.entries(object)) {
    if (typeof value === 'string') {
      for (const pattern of privateValuePatterns) {
        if (pattern.test(value)) {
          fail(`${location}.${key}`, '公開 JSON 疑似包含私人 Drive、原始截圖檔名、附件 ID 或電子郵件');
          break;
        }
      }
    }
  }
}

function walk(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${location}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    validateObject(value, location);
    for (const [key, child] of Object.entries(value)) {
      walk(child, `${location}.${key}`);
    }
  }
}

function validateAliases(data, fileName) {
  if (!Array.isArray(data)) {
    fail(fileName, '名稱別名資料必須是陣列');
    return;
  }

  const seenIds = new Set();
  const seenAliases = new Map();

  data.forEach((definition, index) => {
    const location = `${fileName}[${index}]`;
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      fail(location, '每筆名稱定義必須是物件');
      return;
    }

    for (const key of ['id', 'targetType', 'targetId', 'scope', 'canonical']) {
      validateStringField(definition, key, location);
    }

    if (typeof definition.id === 'string') {
      if (seenIds.has(definition.id)) fail(`${location}.id`, '名稱定義 ID 重複');
      seenIds.add(definition.id);
    }

    if (
      typeof definition.targetType === 'string' &&
      !allowedAliasTargetTypes.has(definition.targetType)
    ) {
      fail(`${location}.targetType`, `不允許的搜尋類型：${definition.targetType}`);
    }

    if (
      typeof definition.scope === 'string' &&
      !allowedAliasScopes.has(definition.scope)
    ) {
      fail(`${location}.scope`, `不允許的名稱範圍：${definition.scope}`);
    }

    if (!Array.isArray(definition.aliases) || !definition.aliases.length) {
      fail(`${location}.aliases`, '至少需要一個搜尋別名');
      return;
    }

    const canonical = normalizeName(definition.canonical);
    const localAliases = new Set();

    definition.aliases.forEach((alias, aliasIndex) => {
      const aliasLocation = `${location}.aliases[${aliasIndex}]`;
      if (!alias || typeof alias !== 'object' || Array.isArray(alias)) {
        fail(aliasLocation, '別名必須是物件');
        return;
      }
      for (const key of ['name', 'kind']) validateStringField(alias, key, aliasLocation);

      if (typeof alias.kind === 'string' && !allowedAliasKinds.has(alias.kind)) {
        fail(`${aliasLocation}.kind`, `不允許的別名類型：${alias.kind}`);
      }

      if (typeof alias.name === 'string') {
        const normalizedAlias = normalizeName(alias.name);
        if (normalizedAlias === canonical) {
          fail(`${aliasLocation}.name`, '別名不得與台版正式名稱相同');
        }
        if (localAliases.has(normalizedAlias)) {
          fail(`${aliasLocation}.name`, '同一正式名稱下的別名重複');
        }
        localAliases.add(normalizedAlias);

        const previousTarget = seenAliases.get(normalizedAlias);
        const currentTarget = `${definition.targetType}:${definition.targetId}`;
        if (previousTarget && previousTarget !== currentTarget) {
          fail(`${aliasLocation}.name`, `同一別名同時指向不同內容：${previousTarget}、${currentTarget}`);
        }
        seenAliases.set(normalizedAlias, currentTarget);
      }
    });
  });
}

const jsonFiles = fs.readdirSync(dataDir).filter(name => name.endsWith('.json')).sort();
for (const fileName of jsonFiles) {
  const filePath = path.join(dataDir, fileName);
  const data = readJson(filePath);
  if (data === null) continue;
  walk(data, fileName);
  if (fileName === 'names.json') validateAliases(data, fileName);
}

const examples = readJson(examplesPath);
if (examples !== null) walk(examples, 'docs/data-contract-examples.json');

if (warnings.length) {
  console.warn(`資料契約警告 ${warnings.length} 項：`);
  for (const message of warnings) console.warn(`- ${message}`);
}

if (errors.length) {
  console.error(`資料契約驗證失敗，共 ${errors.length} 項：`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`資料契約驗證通過：${jsonFiles.length} 個 data JSON、${objectCount} 個物件。`);
