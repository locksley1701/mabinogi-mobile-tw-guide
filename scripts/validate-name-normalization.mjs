import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SearchNormalization = require('../search-normalization.js');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const aliases = readJson('data/names.json');
const lifeCategories = readJson('data/life-skill-categories.json');
const lifeGuides = readJson('data/life-skills.json');
const cooking = readJson('data/cooking.json');
const afk = readJson('data/afk-tips.json');
const professions = readJson('data/professions.json');
const professionSkills = readJson('data/profession-skills.json');

const targets = {
  life: new Set([
    ...lifeCategories.map(item => item.id),
    ...lifeGuides.map(item => item.skillId)
  ]),
  cooking: new Set(cooking.map(item => item.id)),
  afk: new Set(afk.map(item => item.id || item.target)),
  profession: new Set(professions.map(item => item.id)),
  combatSkill: new Set(Object.values(professionSkills).flatMap(profession =>
    [...profession.active, ...profession.passive].map(skill => `${profession.id}:${skill.name}`)
  ))
};

const errors = [];
function fail(message) {
  errors.push(message);
}

for (const definition of aliases) {
  if (!targets[definition.targetType]?.has(definition.targetId)) {
    fail(`${definition.id}: 找不到目標 ${definition.targetType}:${definition.targetId}`);
  }
}

const searchItems = [
  ...lifeCategories.map(item => ({
    type: 'life', entityId: item.id, canonicalName: item.name,
    title: item.name, description: item.description,
    keywords: `${item.name} ${item.group}`, route: 'life'
  })),
  ...lifeGuides.map(item => ({
    type: 'life', entityId: item.skillId, canonicalName: item.skill,
    title: `${item.skill}｜Lv.${item.level}`,
    description: item.recommendation,
    keywords: `${item.skill} ${item.level} ${item.location} ${item.requirements} ${item.note || ''}`,
    route: 'life'
  })),
  ...cooking.map(item => ({
    type: 'cooking', entityId: item.id, canonicalName: item.dish,
    title: item.dish, description: `${item.unlock}・${item.use}`,
    keywords: `${item.dish} ${item.level} ${item.materials} ${item.note || ''}`,
    route: 'cooking'
  })),
  ...afk.map(item => ({
    type: 'afk', entityId: item.id || item.target, canonicalName: item.target,
    title: `${item.target}任務`,
    description: `${item.skill}・${item.effect}`,
    keywords: `${item.target} ${item.skill} ${item.method} ${item.stop}`,
    route: 'afk'
  })),
  ...professions.map(item => ({
    type: 'profession', entityId: item.id, canonicalName: item.name,
    title: item.name,
    description: item.documented ? '已收錄職業介紹與技能' : '台版職業名稱已確認，詳細資料待收錄',
    keywords: item.name, route: item.documented ? `profession/${item.id}` : 'professions'
  })),
  ...Object.values(professionSkills).flatMap(profession =>
    [...profession.active, ...profession.passive].map(skill => ({
      type: 'combatSkill', entityId: `${profession.id}:${skill.name}`, canonicalName: skill.name,
      title: skill.name, description: profession.name,
      keywords: `${profession.name} ${skill.name} ${skill.unlock || ''}`,
      route: `profession/${profession.id}`
    }))
  )
];

const enriched = SearchNormalization.enrichSearchItems(searchItems, aliases);

const cases = [
  ['無工具採集', '日常採集'],
  ['煉金術', '鍊金術'],
  ['韌性草', '採集藥草'],
  ['成長蘑菇', '採集藥草'],
  ['藏藏花', '採集藥草'],
  ['斧', '伐木'],
  ['十字鎬', '採礦'],
  ['藥草工具', '採集藥草'],
  ['剪刀', '剪羊毛'],
  ['鋤頭', '鋤地'],
  ['捕蟲網', '昆蟲採集'],
  ['攜著吃的點心', '擠著吃的點心'],
  ['鋼梭', '鋼楔']
];

for (const [query, expectedTitlePart] of cases) {
  const normalizedQuery = SearchNormalization.normalizeSearch(query);
  const matches = enriched.filter(item => SearchNormalization.searchItemMatches(item, normalizedQuery));
  const expected = matches.find(item => item.title.includes(expectedTitlePart));
  if (!expected) {
    fail(`搜尋「${query}」未找到包含「${expectedTitlePart}」的正式項目`);
    continue;
  }
  const matchedAlias = SearchNormalization.findMatchedAlias(expected, normalizedQuery);
  if (!matchedAlias || matchedAlias.name !== query) {
    fail(`搜尋「${query}」未記錄正確的別名命中資訊`);
  }
}

const travelerMatches = enriched.filter(item => SearchNormalization.searchItemMatches(item, '旅行者點心'));
if (!travelerMatches.some(item => item.title === '旅行者點心')) {
  fail('正式名稱「旅行者點心」無法搜尋');
}
if (travelerMatches.some(item => item.title === '擠著吃的點心')) {
  fail('「旅行者點心」與「擠著吃的點心」被錯誤合併');
}

const canonicalPortable = enriched.find(item => item.title === '擠著吃的點心');
if (!canonicalPortable || !SearchNormalization.searchItemMatches(canonicalPortable, '擠著吃的點心')) {
  fail('正式名稱「擠著吃的點心」無法直接搜尋');
}
if (SearchNormalization.findMatchedAlias(canonicalPortable, '擠著吃的點心')) {
  fail('搜尋正式名稱時不應顯示別名命中提示');
}

if (errors.length) {
  console.error(`名稱正規化驗證失敗，共 ${errors.length} 項：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`名稱正規化驗證通過：${aliases.length} 組名稱定義、${cases.length} 個別名案例與 2 個防誤合併案例。`);
