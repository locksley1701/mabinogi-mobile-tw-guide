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

const manifestSource = readFileSync(manifestPath, 'utf8');
const manifestSourceLower = manifestSource.toLowerCase();
if (manifestSourceLower.includes('axekick')) fail('公開圖標 manifest 含禁止的內部別名');
for (const alias of ['mountingshock', 'gustingvolt', 'slipthrough', 'spreadingvolt']) {
  if (manifestSourceLower.includes(alias)) fail(`公開圖標 manifest 含禁止的內部別名：${alias}`);
}
if (/[a-z]:[\\/]/i.test(manifestSource)) fail('公開圖標 manifest 含 Windows 絕對路徑');
for (const fragment of ['blob', 'segment', 'bundle', 'officialiconlibrary', 'appdata']) {
  if (manifestSourceLower.includes(fragment)) fail(`公開圖標 manifest 含私人來源片段：${fragment}`);
}

const manifest = JSON.parse(manifestSource);
const lifeCategories = JSON.parse(readFileSync(lifeCategoriesPath, 'utf8'));
const categories = manifest.categories || {};
const expectedCounts = {
  lifeSkills: 20,
  professions: 9,
  professionSkills: 31,
  cooking: 4
};

const all = [];
for (const [category, count] of Object.entries(expectedCounts)) {
  const items = categories[category];
  if (!Array.isArray(items)) fail(`缺少分類 ${category}`);
  if (items.length !== count) fail(`${category} 數量為 ${items.length}，預期 ${count}`);
  all.push(...items.map(item => ({ ...item, category })));
}
if (all.length !== 64) fail(`總數為 ${all.length}，預期 64`);

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

const expectedProfessionIds = new Set([
  'swordsman', 'warrior', 'greatsword-warrior', 'archer',
  'thief', 'fighter', 'dual-blades', 'longbowman', 'crossbowman'
]);
const professionIds = new Set(categories.professions.map(item => item.id));
if (professionIds.size !== expectedProfessionIds.size) fail(`職業圖標穩定 ID 數量為 ${professionIds.size}，預期 ${expectedProfessionIds.size}`);
for (const id of expectedProfessionIds) {
  if (!professionIds.has(id)) fail(`職業缺少正式圖標：${id}`);
}
for (const id of professionIds) {
  if (!expectedProfessionIds.has(id)) fail(`職業圖標未對應正式職業：${id}`);
}

const issue9SkillBindings = new Map([
  ['thief-back-stab', { professionId: 'thief', name: '奇襲' }],
  ['thief-hide', { professionId: 'thief', name: '隱身' }],
  ['thief-poison-trap', { professionId: 'thief', name: '毒陷阱' }],
  ['thief-screw-dagger', { professionId: 'thief', name: '螺旋匕首' }],
  ['thief-throwing-bomb', { professionId: 'thief', name: '投擲炸彈' }],
  ['fighter-back-step', { professionId: 'fighter', name: '後退步' }],
  ['fighter-burst-punch-1', { professionId: 'fighter', name: '爆裂拳：第1擊' }],
  ['fighter-charging-fist', { professionId: 'fighter', name: '蓄力拳' }],
  ['fighter-somersault-1', { professionId: 'fighter', name: '空翻踢：第1擊' }],
  ['fighter-stomp-kick', { professionId: 'fighter', name: '重踏踢' }],
  ['dual-blades-double-crescent', { professionId: 'dual-blades', name: '雙重新月' }],
  ['dual-blades-gliding-fury', { professionId: 'dual-blades', name: '滑行狂怒' }],
  ['dual-blades-howling-gale', { professionId: 'dual-blades', name: '怒號疾風' }],
  ['dual-blades-hurricane-dance', { professionId: 'dual-blades', name: '旋轉突襲' }],
  ['dual-blades-outer-slash', { professionId: 'dual-blades', name: '分裂斬' }]
]);
const issue10SkillBindings = new Map([
  ['longbowman-crash-shot', { professionId: 'longbowman', name: '震盪射擊' }],
  ['longbowman-flame-barrage', { professionId: 'longbowman', name: '烈焰箭' }],
  ['longbowman-heart-seeker', { professionId: 'longbowman', name: '尋心者' }],
  ['longbowman-shell-breaker', { professionId: 'longbowman', name: '破殼者' }],
  ['longbowman-wing-skewer', { professionId: 'longbowman', name: '翼之穿刺' }],
  ['crossbowman-buster-shot', { professionId: 'crossbowman', name: '爆裂射擊' }],
  ['crossbowman-gusting-bolt', { professionId: 'crossbowman', name: '狂風弩箭' }],
  ['crossbowman-shock-explosion', { professionId: 'crossbowman', name: '震撼爆裂' }],
  ['crossbowman-sliding-step', { professionId: 'crossbowman', name: '滑步' }],
  ['crossbowman-spreading-bolt', { professionId: 'crossbowman', name: '擴散弩箭' }]
]);
const professionSkillById = new Map(categories.professionSkills.map(item => [item.id, item]));
for (const [id, binding] of [...issue9SkillBindings, ...issue10SkillBindings]) {
  const item = professionSkillById.get(id);
  if (!item) fail(`職業技能缺少正式圖標：${id}`);
  if (item.professionId !== binding.professionId) fail(`${id} professionId 應為 ${binding.professionId}`);
  if (item.name !== binding.name) fail(`${id} 正式名稱應為 ${binding.name}`);
  if (item.width !== 256 || item.height !== 256) fail(`${id} 必須宣告為 256x256`);
}
for (const id of ['thief', 'fighter', 'dual-blades', 'longbowman', 'crossbowman']) {
  const item = categories.professions.find(entry => entry.id === id);
  if (item.width !== 256 || item.height !== 256) fail(`${id} 職業圖標必須宣告為 256x256`);
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
