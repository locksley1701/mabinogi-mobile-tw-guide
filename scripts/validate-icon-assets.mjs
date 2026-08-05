import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = join(root, 'data', 'icon-pilot.json');
const lifeCategoriesPath = join(root, 'data', 'life-skill-categories.json');
const professionsPath = join(root, 'data', 'professions.json');
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
if (!existsSync(professionsPath)) fail('缺少 data/professions.json');
if (!existsSync(contractPath)) fail('缺少 ICON_ASSET_CONTRACT.md');

const manifestSource = readFileSync(manifestPath, 'utf8');
const manifestSourceLower = manifestSource.toLowerCase();
if (manifestSourceLower.includes('axekick')) fail('公開圖標 manifest 含禁止的內部別名');
for (const alias of ['mountingshock', 'gustingvolt', 'slipthrough', 'spreadingvolt', 'expertmage_meteorstrike_tier2a', 'firemage_flashover']) {
  if (manifestSourceLower.includes(alias)) fail(`公開圖標 manifest 含禁止的內部別名：${alias}`);
}
if (/[a-z]:[\\/]/i.test(manifestSource)) fail('公開圖標 manifest 含 Windows 絕對路徑');
for (const fragment of ['blob', 'segment', 'bundle', 'officialiconlibrary', 'appdata']) {
  if (manifestSourceLower.includes(fragment)) fail(`公開圖標 manifest 含私人來源片段：${fragment}`);
}

const manifest = JSON.parse(manifestSource);
const lifeCategories = JSON.parse(readFileSync(lifeCategoriesPath, 'utf8'));
const professions = JSON.parse(readFileSync(professionsPath, 'utf8'));
const categories = manifest.categories || {};
const expectedCounts = {
  lifeSkills: 20,
  professionSeries: 4,
  professions: 12,
  professionSkills: 46,
  cooking: 4
};

const all = [];
for (const [category, count] of Object.entries(expectedCounts)) {
  const items = categories[category];
  if (!Array.isArray(items)) fail(`缺少分類 ${category}`);
  if (items.length !== count) fail(`${category} 數量為 ${items.length}，預期 ${count}`);
  all.push(...items.map(item => ({ ...item, category })));
}
if (all.length !== 86) fail(`總數為 ${all.length}，預期 86`);

const manifestById = new Map(all.map(item => [item.id, item]));
const sharedWithItems = all.filter(item => Object.hasOwn(item, 'sharedWith'));
if (sharedWithItems.length !== 1) fail(`sharedWith 僅允許一筆宣告，實際為 ${sharedWithItems.length} 筆`);
const sharedMageSeries = sharedWithItems[0];
if (
  !sharedMageSeries ||
  sharedMageSeries.category !== 'professionSeries' ||
  sharedMageSeries.id !== 'series-mage' ||
  sharedMageSeries.sharedWith !== 'mage'
) {
  fail('sharedWith 僅允許 professionSeries 的 series-mage 指向 mage');
}
if (sharedMageSeries.sharedWith === sharedMageSeries.id) fail('sharedWith 不得指向自身');
const sharedMageTarget = manifestById.get(sharedMageSeries.sharedWith);
if (!sharedMageTarget) fail(`sharedWith target 不存在：${sharedMageSeries.sharedWith}`);
if (Object.hasOwn(sharedMageTarget, 'sharedWith')) fail('sharedWith 不得建立雙向或循環關係');

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
  'thief', 'fighter', 'dual-blades', 'longbowman', 'crossbowman',
  'mage', 'flame-mage', 'frost-mage'
]);
const professionIds = new Set(categories.professions.map(item => item.id));
if (professionIds.size !== expectedProfessionIds.size) fail(`職業圖標穩定 ID 數量為 ${professionIds.size}，預期 ${expectedProfessionIds.size}`);
for (const id of expectedProfessionIds) {
  if (!professionIds.has(id)) fail(`職業缺少正式圖標：${id}`);
}

const expectedProfessionSeries = new Map([
  ['series-warrior', { name: '見習戰士系', icon: 'assets/icons/profession-series/warrior.png' }],
  ['series-archer', { name: '見習弓手系', icon: 'assets/icons/profession-series/archer.png' }],
  ['series-thief', { name: '見習盜賊系', icon: 'assets/icons/profession-series/thief.png' }],
  ['series-mage', { name: '見習魔法師系', icon: 'assets/icons/professions/mage.png', sharedWith: 'mage' }]
]);
const professionSeries = categories.professionSeries;
if (professionSeries.length !== expectedProfessionSeries.size) fail(`professionSeries 數量為 ${professionSeries.length}，預期 ${expectedProfessionSeries.size}`);
for (const item of professionSeries) {
  const expected = expectedProfessionSeries.get(item.id);
  if (!expected) fail(`professionSeries 含未核准 ID：${item.id}`);
  if (item.name !== expected.name || item.icon !== expected.icon) fail(`${item.id} 公開名稱或路徑不符合契約`);
  if ((expected.sharedWith || null) !== (item.sharedWith || null)) fail(`${item.id} sharedWith 不符合公開契約`);
  if (item.width !== 256 || item.height !== 256) fail(`${item.id} 系列圖標必須宣告為 256x256`);
  if (item.sourceClass !== '台版客戶端見習職業系列圖標核准輸出') fail(`${item.id} sourceClass 不符合公開契約`);
}
const mageSeries = professionSeries.find(item => item.id === 'series-mage');
const mageProfession = categories.professions.find(item => item.id === 'mage');
if (!mageProfession || mageProfession.name !== '魔法師') fail('mage 職業圖標紀錄缺漏或名稱不正確');
if (
  !mageSeries || mageSeries.sharedWith !== 'mage' ||
  mageSeries.icon !== mageProfession.icon || mageSeries.sha256 !== mageProfession.sha256
) {
  fail('series-mage 必須明確且僅與 mage 共用公開圖標路徑與 SHA256');
}
for (const id of expectedProfessionSeries.keys()) {
  if (professions.some(item => item.id === id || item.documented && item.name === expectedProfessionSeries.get(id).name)) {
    fail(`${id} 不得計入 documented professions`);
  }
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
  ['crossbowman-spreading-bolt', { professionId: 'crossbowman', name: '擴散弩箭' }],
  ['mage-ice-dagger', { professionId: 'mage', name: '冰晶匕首' }],
  ['mage-lightning', { professionId: 'mage', name: '雷電' }],
  ['mage-mana-storm', { professionId: 'mage', name: '魔力風暴' }],
  ['mage-meteor-strike', { professionId: 'mage', name: '流星打擊' }],
  ['mage-telekinesis', { professionId: 'mage', name: '念動力' }],
  ['flame-mage-fire-storm', { professionId: 'flame-mage', name: '火焰風暴' }],
  ['flame-mage-flame-cannon', { professionId: 'flame-mage', name: '烈焰火炮' }],
  ['flame-mage-flash-over', { professionId: 'flame-mage', name: '閃燃' }],
  ['flame-mage-ignite', { professionId: 'flame-mage', name: '爆炸' }],
  ['flame-mage-rapid-fire', { professionId: 'flame-mage', name: '疾火連彈' }],
  ['frost-mage-crystal-edge', { professionId: 'frost-mage', name: '水晶之刃' }],
  ['frost-mage-freezing-field', { professionId: 'frost-mage', name: '冰封領域' }],
  ['frost-mage-frozen-orb', { professionId: 'frost-mage', name: '霜凍法球' }],
  ['frost-mage-ice-spike', { professionId: 'frost-mage', name: '冰棘' }],
  ['frost-mage-split-slash', { professionId: 'frost-mage', name: '冰川裂刃' }]
]);
const professionSkillById = new Map(categories.professionSkills.map(item => [item.id, item]));
for (const [id, binding] of [...issue9SkillBindings, ...issue10SkillBindings]) {
  const item = professionSkillById.get(id);
  if (!item) fail(`職業技能缺少正式圖標：${id}`);
  if (item.professionId !== binding.professionId) fail(`${id} professionId 應為 ${binding.professionId}`);
  if (item.name !== binding.name) fail(`${id} 正式名稱應為 ${binding.name}`);
  if (item.width !== 256 || item.height !== 256) fail(`${id} 必須宣告為 256x256`);
}
for (const id of ['thief', 'fighter', 'dual-blades', 'longbowman', 'crossbowman', 'mage', 'flame-mage', 'frost-mage']) {
  const item = categories.professions.find(entry => entry.id === id);
  if (item.width !== 256 || item.height !== 256) fail(`${id} 職業圖標必須宣告為 256x256`);
}

const ids = new Set();
const paths = new Map();
const hashes = new Map();
function isDeclaredSharedAsset(first, second) {
  const pair = new Set([first?.id, second?.id]);
  return pair.size === 2 && pair.has('series-mage') && pair.has('mage') &&
    sharedMageSeries.sharedWith === 'mage' &&
    first.icon === second.icon && first.sha256 === second.sha256;
}
for (const item of all) {
  if (!item.approved) fail(`${item.id} 尚未核准`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) fail(`${item.id} 不是穩定 kebab-case ID`);
  if (ids.has(item.id)) fail(`重複 ID：${item.id}`);
  ids.add(item.id);

  if (!/^assets\/icons\/(life-skills|profession-series|professions|profession-skills|cooking)\/[a-z0-9-]+\.png$/.test(item.icon)) {
    fail(`${item.id} 的 icon 路徑不符合契約：${item.icon}`);
  }
  const pathOwner = paths.get(item.icon);
  if (pathOwner && !isDeclaredSharedAsset(pathOwner, item)) fail(`不同 ID 共用同一路徑：${item.icon}`);
  paths.set(item.icon, item);

  const full = join(root, ...item.icon.split('/'));
  if (!existsSync(full)) fail(`資產不存在：${item.icon}`);
  const buffer = readFileSync(full);
  const actualHash = createHash('sha256').update(buffer).digest('hex');
  if (actualHash !== item.sha256) fail(`${item.id} SHA256 不符`);
  const hashOwner = hashes.get(actualHash);
  if (hashOwner && !isDeclaredSharedAsset(hashOwner, item)) fail(`未宣告的重複像素／檔案 SHA：${item.id}`);
  hashes.set(actualHash, item);

  const info = pngInfo(buffer);
  if (info.width !== item.width || info.height !== item.height) {
    fail(`${item.id} 尺寸 ${info.width}x${info.height}，契約為 ${item.width}x${item.height}`);
  }
  if (!info.hasAlpha) fail(`${item.id} PNG 沒有 alpha 通道（color type ${info.colorType}）`);
}
if (hashes.size !== all.length - 1 || paths.size !== all.length - 1) {
  fail('公開圖標必須恰有一組已宣告共用資產');
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
for (const id of expectedProfessionSeries.keys()) {
  if (!index.includes(`data-profession-series="${id}"`) || !index.includes(`data-profession-series-host="${id}"`)) {
    fail(`index.html 缺少 ${id} 穩定 series host`);
  }
}

console.log(
  `ICON_ASSET_VALIDATION_PASS: ${all.length} assets, ${hashes.size} unique SHA256 hashes, ` +
  `${categories.lifeSkills.length}/${lifeCategoryIds.size} life-skill categories covered`
);
