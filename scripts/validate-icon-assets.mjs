import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = join(root, 'data', 'icon-pilot.json');
const lifeCategoriesPath = join(root, 'data', 'life-skill-categories.json');
const contractPath = join(root, 'ICON_ASSET_CONTRACT.md');
const privateFragments = [
  'blob', 'bundle', 'segment', 'private', 'raw-screenshot',
  'client-extraction', 'officialiconlibrary', 'appdata'
];
const forbiddenExtensions = new Set(['.blob', '.bundle', '.unity3d', '.assetbundle']);

function fail(message) {
  throw new Error(`ICON_ASSET_VALIDATION_FAILED: ${message}`);
}

function walk(directory) {
  const output = [];
  for (const name of readdirSync(directory)) {
    const full = join(directory, name);
    const stat = statSync(full);
    if (stat.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

function pngInfo(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) fail('檔案不是有效 PNG');
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') fail('PNG 缺少 IHDR');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer.readUInt8(25);
  const hasAlpha = colorType === 4 || colorType === 6;
  return { width, height, colorType, hasAlpha };
}

if (!existsSync(manifestPath)) fail('缺少 data/icon-pilot.json');
if (!existsSync(lifeCategoriesPath)) fail('缺少 data/life-skill-categories.json');
if (!existsSync(contractPath)) fail('缺少 ICON_ASSET_CONTRACT.md');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const lifeCategories = JSON.parse(readFileSync(lifeCategoriesPath, 'utf8'));
const categories = manifest.categories || {};
const expectedCounts = {
  lifeSkills: 20,
  professions: 4,
  professionSkills: 6,
  cooking: 4
};

const all = [];
for (const [category, count] of Object.entries(expectedCounts)) {
  const items = categories[category];
  if (!Array.isArray(items)) fail(`缺少分類 ${category}`);
  if (items.length !== count) fail(`${category} 數量為 ${items.length}，預期 ${count}`);
  all.push(...items.map(item => ({ ...item, category })));
}
if (all.length !== 34) fail(`總數為 ${all.length}，預期 34`);

const lifeCategoryIds = new Set(lifeCategories.map(item => item.id));
if (lifeCategoryIds.size !== 20) fail(`生活技能分類穩定 ID 數量為 ${lifeCategoryIds.size}，預期 20`);
const lifeIconIds = new Set(categories.lifeSkills.map(item => item.id));
if (lifeIconIds.size !== 20) fail(`生活技能圖標穩定 ID 數量為 ${lifeIconIds.size}，預期 20`);
for (const id of lifeCategoryIds) {
  if (!lifeIconIds.has(id)) fail(`生活技能缺少正式圖標：${id}`);
}
for (const id of lifeIconIds) {
  if (!lifeCategoryIds.has(id)) fail(`生活技能圖標未對應正式分類：${id}`);
}

const ids = new Set();
const paths = new Set();
const hashes = new Set();
for (const item of all) {
  if (!item.approved) fail(`${item.id} 尚未核准`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) fail(`${item.id} 不是穩定 kebab-case ID`);
  if (ids.has(item.id)) fail(`重複 ID：${item.id}`);
  ids.add(item.id);

  if (!/^assets\/icons\/(life-skills|professions|profession-skills|cooking)\/[a-z0-9-]+\.png$/.test(item.icon)) {
    fail(`${item.id} 的 icon 路徑不符合契約：${item.icon}`);
  }
  if (paths.has(item.icon)) fail(`不同 ID 共用同一路徑：${item.icon}`);
  paths.add(item.icon);

  const full = join(root, ...item.icon.split('/'));
  if (!existsSync(full)) fail(`資產不存在：${item.icon}`);
  const buffer = readFileSync(full);
  const actualHash = createHash('sha256').update(buffer).digest('hex');
  if (actualHash !== item.sha256) fail(`${item.id} SHA256 不符`);
  if (hashes.has(actualHash)) fail(`未宣告的重複像素／檔案 SHA：${item.id}`);
  hashes.add(actualHash);

  const info = pngInfo(buffer);
  if (info.width !== item.width || info.height !== item.height) {
    fail(`${item.id} 尺寸 ${info.width}x${info.height}，契約為 ${item.width}x${item.height}`);
  }
  if (!info.hasAlpha) fail(`${item.id} PNG 沒有 alpha 通道（color type ${info.colorType}）`);
}

for (const full of walk(root)) {
  const rel = relative(root, full).split(sep).join('/').toLowerCase();
  const extension = extname(full).toLowerCase();
  if (forbiddenExtensions.has(extension)) fail(`repository 含禁止格式：${rel}`);
  if (rel.startsWith('assets/icons/') && privateFragments.some(fragment => rel.includes(fragment))) {
    fail(`公開圖標路徑疑似包含私人／原始素材：${rel}`);
  }
}

const index = readFileSync(join(root, 'index.html'), 'utf8');
for (const required of ['icon-pilot.css', 'icon-pilot.js']) {
  if (!index.includes(required)) fail(`index.html 尚未載入 ${required}`);
}

console.log(
  `ICON_ASSET_VALIDATION_PASS: ${all.length} assets, ${hashes.size} unique SHA256 hashes, ` +
  `${categories.lifeSkills.length}/${lifeCategoryIds.size} life-skill categories covered`
);
