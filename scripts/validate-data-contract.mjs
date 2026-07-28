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
  if (!Array.isArray(data)) return;
  const seen = new Set();
  data.forEach((alias, index) => {
    const location = `${fileName}[${index}]`;
    if (!alias || typeof alias !== 'object') return;
    for (const key of ['other', 'tw']) validateStringField(alias, key, location);
    if (typeof alias.other === 'string' && typeof alias.tw === 'string') {
      const other = alias.other.trim().toLocaleLowerCase('zh-Hant-TW');
      const tw = alias.tw.trim().toLocaleLowerCase('zh-Hant-TW');
      if (other === tw) fail(location, '別名與台版正式名稱不得相同');
      const pair = `${other}=>${tw}`;
      if (seen.has(pair)) fail(location, '重複的別名對照');
      seen.add(pair);
    }
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
