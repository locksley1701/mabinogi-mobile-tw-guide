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
  professionSkills: 94,
  cooking: 4
};

const all = [];
for (const [category, count] of Object.entries(expectedCounts)) {
  const items = categories[category];
  if (!Array.isArray(items)) fail(`缺少分類 ${category}`);
  if (items.length !== count) fail(`${category} 數量為 ${items.length}，預期 ${count}`);
  all.push(...items.map(item => ({ ...item, category })));
}
if (all.length !== 134) fail(`總數為 ${all.length}，預期 134`);

const manifestById = new Map(all.map(item => [item.id, item]));
const sharedWithItems = all.filter(item => Object.hasOwn(item, 'sharedWith'));
if (sharedWithItems.length !== 3) fail(`sharedWith 必須有三筆宣告，實際為 ${sharedWithItems.length} 筆`);
const expectedShares = new Map([
  ['series-mage', 'mage'],
  ['fighter-combat-mastery-destruction', 'dual-blades-combat-mastery-destruction'],
  ['flame-mage-combat-mastery-technique', 'mage-combat-mastery-technique']
]);
for (const item of sharedWithItems) {
  if (expectedShares.get(item.id) !== item.sharedWith) fail(`${item.id} sharedWith 不符合公開契約`);
  if (item.sharedWith === item.id) fail('sharedWith 不得指向自身');
  const target = manifestById.get(item.sharedWith);
  if (!target) fail(`sharedWith target 不存在：${item.sharedWith}`);
  if (Object.hasOwn(target, 'sharedWith')) fail('sharedWith 不得建立雙向或循環關係');
  if (item.icon !== target.icon || item.sha256 !== target.sha256) fail(`${item.id} 必須與 sharedWith target 共用路徑與 SHA256`);
}
for (const id of expectedShares.keys()) {
  if (!sharedWithItems.some(item => item.id === id)) fail(`缺少 sharedWith 宣告：${id}`);
}

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
  ['fighter-impact-kick', { professionId: 'fighter', name: '衝擊踢' }],
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
  ['longbowman-dragon-hunter', { professionId: 'longbowman', name: '獵龍人' }],
  ['longbowman-sniping', { professionId: 'longbowman', name: '狙擊術' }],
  ['longbowman-hunting', { professionId: 'longbowman', name: '狩獵術' }],
  ['longbowman-combat-mastery-heroism', { professionId: 'longbowman', name: '戰鬥熟練：霸氣' }],
  ['longbowman-keen-arrow', { professionId: 'longbowman', name: '敏銳之箭' }],
  ['longbowman-fighting-spirit', { professionId: 'longbowman', name: '鬥志高昂' }],
  ['crossbowman-hellfire', { professionId: 'crossbowman', name: '地獄火' }],
  ['crossbowman-extra-action', { professionId: 'crossbowman', name: '額外行動' }],
  ['crossbowman-driving-force', { professionId: 'crossbowman', name: '驅動力' }],
  ['crossbowman-combat-mastery-threat', { professionId: 'crossbowman', name: '戰鬥熟練：威脅' }],
  ['crossbowman-rapid-attack', { professionId: 'crossbowman', name: '快速攻擊' }],
  ['crossbowman-expanded-magazine', { professionId: 'crossbowman', name: '擴充彈匣' }],
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
const issue55SkillBindings = new Map([
  ['thief-blitz-rush', { professionId: 'thief', name: '閃擊突襲' }],
  ['thief-adrenaline', { professionId: 'thief', name: '腎上腺素' }],
  ['thief-sneak-attack', { professionId: 'thief', name: '偷襲' }],
  ['thief-combat-mastery-swiftness', { professionId: 'thief', name: '戰鬥熟練：疾速' }],
  ['thief-poison-attack', { professionId: 'thief', name: '毒擊' }],
  ['thief-poison-explosion', { professionId: 'thief', name: '毒爆' }],
  ['dual-blades-final-hit', { professionId: 'dual-blades', name: '終極連擊' }],
  ['dual-blades-rising-aspirations', { professionId: 'dual-blades', name: '渴望湧現' }],
  ['dual-blades-recharge', { professionId: 'dual-blades', name: '再充能' }],
  ['dual-blades-combat-mastery-destruction', { professionId: 'dual-blades', name: '戰鬥熟練：毀滅' }],
  ['dual-blades-vigor', { professionId: 'dual-blades', name: '活力' }],
  ['dual-blades-wind-blade', { professionId: 'dual-blades', name: '風之刃' }],
  ['fighter-power-max', { professionId: 'fighter', name: '極限超載' }],
  ['fighter-combo-damage', { professionId: 'fighter', name: '連攜攻擊' }],
  ['fighter-finish-attack', { professionId: 'fighter', name: '會心一擊' }],
  ['fighter-combat-mastery-destruction', { professionId: 'fighter', name: '戰鬥熟練：毀滅' }],
  ['fighter-first-aid', { professionId: 'fighter', name: '急救處置' }],
  ['fighter-shock-wave', { professionId: 'fighter', name: '衝擊波' }]
]);
const issue57SkillBindings = new Map([
  ['mage-infinite-mana', { professionId: 'mage', name: '無限魔力' }],
  ['mage-meditation', { professionId: 'mage', name: '冥想' }],
  ['mage-elemental-harmony', { professionId: 'mage', name: '元素和諧' }],
  ['mage-combat-mastery-technique', { professionId: 'mage', name: '戰鬥熟練：技巧' }],
  ['mage-elemental-master', { professionId: 'mage', name: '元素大師' }],
  ['mage-arcane-power', { professionId: 'mage', name: '奧術力量' }],
  ['flame-mage-inferno', { professionId: 'flame-mage', name: '煉獄' }],
  ['flame-mage-burning-soul', { professionId: 'flame-mage', name: '燃燒之魂' }],
  ['flame-mage-blazing-flame', { professionId: 'flame-mage', name: '熾焰' }],
  ['flame-mage-combat-mastery-technique', { professionId: 'flame-mage', name: '戰鬥熟練：技巧' }],
  ['flame-mage-spark', { professionId: 'flame-mage', name: '火花' }],
  ['flame-mage-overheat', { professionId: 'flame-mage', name: '過熱' }],
  ['frost-mage-absolute-zero', { professionId: 'frost-mage', name: '絕對零度' }],
  ['frost-mage-winter-veil', { professionId: 'frost-mage', name: '冬之帷幕' }],
  ['frost-mage-icicle-mark', { professionId: 'frost-mage', name: '冰錐印記' }],
  ['frost-mage-combat-mastery-guard', { professionId: 'frost-mage', name: '戰鬥熟練：守護' }],
  ['frost-mage-fluttering-frost', { professionId: 'frost-mage', name: '紛飛的冰霜' }],
  ['frost-mage-piercing-chill', { professionId: 'frost-mage', name: '刺骨寒氣' }]
]);
const professionSkillById = new Map(categories.professionSkills.map(item => [item.id, item]));
for (const [id, binding] of [...issue9SkillBindings, ...issue10SkillBindings, ...issue55SkillBindings, ...issue57SkillBindings]) {
  const item = professionSkillById.get(id);
  if (!item) fail(`職業技能缺少正式圖標：${id}`);
  if (item.professionId !== binding.professionId) fail(`${id} professionId 應為 ${binding.professionId}`);
  if (item.name !== binding.name) fail(`${id} 正式名稱應為 ${binding.name}`);
  if (item.width !== 256 || item.height !== 256) fail(`${id} 必須宣告為 256x256`);
}
const mageTechnique = professionSkillById.get('mage-combat-mastery-technique');
const flameTechnique = professionSkillById.get('flame-mage-combat-mastery-technique');
if (!mageTechnique || !flameTechnique || flameTechnique.sharedWith !== mageTechnique.id ||
  flameTechnique.icon !== mageTechnique.icon || flameTechnique.sha256 !== mageTechnique.sha256) {
  fail('火焰術士戰鬥熟練：技巧必須依公開契約共用魔法師實體圖標');
}
const frostGuard = professionSkillById.get('frost-mage-combat-mastery-guard');
if (!frostGuard || Object.hasOwn(frostGuard, 'sharedWith') || frostGuard.icon !== 'assets/icons/profession-skills/frost-mage-combat-mastery-guard.png') {
  fail('冰霜術士戰鬥熟練：守護必須保有獨立實體圖標');
}
for (const id of ['thief', 'fighter', 'dual-blades', 'longbowman', 'crossbowman', 'mage', 'flame-mage', 'frost-mage']) {
  const item = categories.professions.find(entry => entry.id === id);
  if (item.width !== 256 || item.height !== 256) fail(`${id} 職業圖標必須宣告為 256x256`);
}

const ids = new Set();
const paths = new Map();
const hashes = new Map();
function isDeclaredSharedAsset(first, second) {
  return Boolean(first && second && first.id !== second.id &&
    (first.sharedWith === second.id || second.sharedWith === first.id) &&
    first.icon === second.icon && first.sha256 === second.sha256);
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
if (hashes.size !== all.length - sharedWithItems.length || paths.size !== all.length - sharedWithItems.length) {
  fail('公開圖標必須只含已宣告共用資產');
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
