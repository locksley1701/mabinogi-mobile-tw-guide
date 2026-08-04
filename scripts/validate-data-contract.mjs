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
  /docs\.google\.com\/(?!forms\/d\/e\/[^/?#]+\/viewform$)/i,
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

function validateProfessionData(professions, professionSkills) {
  if (!Array.isArray(professions)) {
    fail('professions.json', '職業總覽必須是陣列');
    return;
  }
  if (!professionSkills || typeof professionSkills !== 'object' || Array.isArray(professionSkills)) {
    fail('profession-skills.json', '職業技能資料必須是以職業 ID 為 key 的物件');
    return;
  }

  const professionIds = new Set();
  for (const [index, profession] of professions.entries()) {
    const location = `professions.json[${index}]`;
    if (professionIds.has(profession.id)) fail(`${location}.id`, '職業 ID 重複');
    professionIds.add(profession.id);
    if (profession.routeSlug && profession.routeSlug !== profession.id) {
      fail(`${location}.routeSlug`, 'routeSlug 必須與職業 ID 一致');
    }
    if (profession.documented && !professionSkills[profession.id]) {
      fail(location, '已編纂職業必須有 profession-skills.json 資料');
    }
  }

  for (const [id, profession] of Object.entries(professionSkills)) {
    const location = `profession-skills.json.${id}`;
    if (!professionIds.has(id)) fail(location, '職業技能資料找不到職業總覽項目');
    if (profession.id !== id) fail(`${location}.id`, '職業物件 ID 必須與資料 key 一致');
    if (profession.routeSlug && profession.routeSlug !== id) fail(`${location}.routeSlug`, 'routeSlug 必須與職業 ID 一致');
    if (!Array.isArray(profession.active) || !Array.isArray(profession.passive)) {
      fail(location, 'active 與 passive 必須是陣列');
    }
  }

  const issue9Definitions = {
    thief: ['奇襲', '隱身', '毒陷阱', '螺旋匕首', '投擲炸彈'],
    fighter: ['後退步', '爆裂拳：第1擊', '蓄力拳', '空翻踢：第1擊', '重踏踢'],
    'dual-blades': ['雙重新月', '滑行狂怒', '怒號疾風', '旋轉突襲', '分裂斬']
  };
  const allowedClientDataStatuses = new Set([
    'verified_client_text',
    'verified_combo_part',
    'verified_corrected_name'
  ]);
  const forbiddenExternalText = /drive\.google\.com|[A-Za-z]:\\|[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/i;

  for (const [id, expectedNames] of Object.entries(issue9Definitions)) {
    const profession = professionSkills[id];
    const overview = professions.find(item => item.id === id);
    const location = `profession-skills.json.${id}`;
    if (!profession || !overview) {
      fail(location, 'Issue #9 職業或總覽項目缺漏');
      continue;
    }
    if (!overview.documented) fail(`professions.json.${id}.documented`, 'Issue #9 職業必須開放職業頁');
    if (profession.summaryBasis !== 'derived_from_verified_skills') {
      fail(`${location}.summaryBasis`, '職業摘要必須標示為依已確認技能內容整理');
    }
    if (profession.preferredEquipment !== null || profession.preferredEquipmentStatus !== 'pending_verified_source') {
      fail(`${location}.preferredEquipment`, '偏好裝備資料不足時必須保持 null 與待核實狀態');
    }
    if (profession.status !== 'tw-confirmed') fail(`${location}.status`, '職業資料狀態必須沿用台版已確認狀態');
    if (profession.active.length !== 5 || profession.passive.length !== 0) {
      fail(location, 'Issue #9 每個職業應收錄 5 筆已確認主動技能，且不得補寫未提供的被動技能');
      continue;
    }

    const names = profession.active.map(skill => skill.name);
    if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
      fail(`${location}.active`, `技能名稱或順序不符：${names.join('、')}`);
    }
    const clientSkillIds = new Set();
    profession.active.forEach((skill, index) => {
      const skillLocation = `${location}.active[${index}]`;
      if (skill.order !== index + 1) fail(`${skillLocation}.order`, '技能 order 必須由 1 連續排列');
      if (!skill.clientSkillId || clientSkillIds.has(skill.clientSkillId)) fail(`${skillLocation}.clientSkillId`, 'clientSkillId 缺漏或重複');
      clientSkillIds.add(skill.clientSkillId);
      if (skill.status !== 'tw-confirmed') fail(`${skillLocation}.status`, '技能必須標示台版已確認');
      if (!allowedClientDataStatuses.has(skill.dataStatus)) fail(`${skillLocation}.dataStatus`, '不允許的客戶端文字確認狀態');
      if (skill.numericValuesStatus !== 'pending_resolution' || !Array.isArray(skill.stats) || skill.stats.length) {
        fail(`${skillLocation}.numericValuesStatus`, '未解析數值必須保持待補且不得自行建立 stats');
      }
      if (typeof skill.publicNumericPolicy !== 'string' || !skill.publicNumericPolicy.includes('不得')) {
        fail(`${skillLocation}.publicNumericPolicy`, '缺少未解析數值的公開限制');
      }
      for (const key of ['name', 'description', 'publicNumericPolicy']) {
        if (forbiddenExternalText.test(String(skill[key] || ''))) {
          fail(`${skillLocation}.${key}`, '公開內容不得包含 Drive、Windows 路徑或韓文參照式');
        }
      }
    });
  }

  const fighter = professionSkills.fighter;
  for (const name of ['爆裂拳：第1擊', '空翻踢：第1擊']) {
    const skill = fighter?.active.find(item => item.name === name);
    if (!skill || skill.presentationMode !== 'combo_part' || skill.comboPart !== 1 || skill.comboTotal !== 3) {
      fail(`profession-skills.json.fighter.${name}`, '組合技只能以已確認的第 1 擊基礎列呈現，並保留 1／3 連段關係');
    }
  }
  const stompKick = fighter?.active.find(item => item.name === '重踏踢');
  if (
    !stompKick ||
    stompKick.clientSkillId !== 'StompKick' ||
    stompKick.presentationMode !== 'corrected_alias'
  ) {
    fail('profession-skills.json.fighter.重踏踢', '更名技能必須以重踏踢為公開名稱，並維持 StompKick 與 corrected_alias 契約');
  }
  if (stompKick && ('internalAlias' in stompKick || 'publicAliasPolicy' in stompKick)) {
    fail('profession-skills.json.fighter.重踏踢', '公開技能資料不得保留內部別名或公開別名政策欄位');
  }
}

const jsonFiles = fs.readdirSync(dataDir).filter(name => name.endsWith('.json')).sort();
for (const fileName of jsonFiles) {
  const filePath = path.join(dataDir, fileName);
  const data = readJson(filePath);
  if (data === null) continue;
  if (JSON.stringify(data).includes('AxeKick')) {
    fail(fileName, '公開 data JSON 不得包含 AxeKick');
  }
  walk(data, fileName);
  if (fileName === 'names.json') validateAliases(data, fileName);
}

const professions = readJson(path.join(dataDir, 'professions.json'));
const professionSkills = readJson(path.join(dataDir, 'profession-skills.json'));
if (professions !== null && professionSkills !== null) {
  validateProfessionData(professions, professionSkills);
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
