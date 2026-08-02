import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dataPath = join(root, 'data', 'content-modules.json');
const contractPath = join(root, 'CONTENT_MODULE_ARCHITECTURE.md');
const indexPath = join(root, 'index.html');
const scriptPath = join(root, 'content-modules.js');
const stylePath = join(root, 'content-modules.css');

function fail(message) {
  throw new Error(`CONTENT_MODULE_VALIDATION_FAILED: ${message}`);
}

for (const path of [dataPath, contractPath, indexPath, scriptPath, stylePath]) {
  if (!existsSync(path)) fail(`缺少必要檔案：${path}`);
}

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const contract = readFileSync(contractPath, 'utf8');
const index = readFileSync(indexPath, 'utf8');
const script = readFileSync(scriptPath, 'utf8');

if (data.version !== 1) fail(`version 為 ${data.version}，預期 1`);
if (data.issue !== 12) fail(`issue 為 ${data.issue}，預期 12`);
if (!Array.isArray(data.modules) || data.modules.length !== 4) {
  fail(`modules 數量為 ${data.modules?.length ?? '非陣列'}，預期 4`);
}

const expected = {
  equipment: {
    listRoute: 'equipment',
    detailRoutePattern: 'equipment/:id',
    detailRoutePrefix: 'equipment/',
    searchType: 'equipment',
    nextIssue: 13,
    allowedStates: [['tw-testing', '架構已建立']]
  },
  maps: {
    listRoute: 'maps',
    detailRoutePattern: 'map/:id',
    detailRoutePrefix: 'map/',
    searchType: 'map',
    nextIssue: 14,
    allowedStates: [
      ['tw-testing', '架構已建立'],
      ['tw-testing', 'MVP 已建立']
    ]
  },
  quests: {
    listRoute: 'quests',
    detailRoutePattern: 'quest/:id',
    detailRoutePrefix: 'quest/',
    searchType: 'quest',
    nextIssue: 15,
    allowedStates: [['tw-testing', '架構已建立']]
  },
  events: {
    listRoute: 'events',
    detailRoutePattern: 'event/:id',
    detailRoutePrefix: 'event/',
    searchType: 'event',
    nextIssue: 15,
    allowedStates: [['tw-testing', '架構已建立']]
  }
};

const ids = new Set();
const listRoutes = new Set();
const detailRoutes = new Set();
const searchTypes = new Set();

for (const module of data.modules) {
  if (!expected[module.id]) fail(`未定義模組 ID：${module.id}`);
  if (ids.has(module.id)) fail(`重複模組 ID：${module.id}`);
  ids.add(module.id);

  const expectation = expected[module.id];
  for (const [key, value] of Object.entries(expectation)) {
    if (key === 'allowedStates') continue;
    if (module[key] !== value) fail(`${module.id}.${key} 為 ${module[key]}，預期 ${value}`);
  }

  const stateAllowed = expectation.allowedStates.some(
    ([status, statusLabel]) => module.status === status && module.statusLabel === statusLabel
  );
  if (!stateAllowed) {
    const allowedText = expectation.allowedStates
      .map(([status, statusLabel]) => `${status}／${statusLabel}`)
      .join(' 或 ');
    fail(`${module.id} 狀態必須是 ${allowedText}`);
  }

  for (const key of ['name', 'navLabel', 'icon', 'summary', 'emptyTitle', 'emptyCopy']) {
    if (!String(module[key] || '').trim()) fail(`${module.id} 缺少 ${key}`);
  }

  for (const key of ['listFields', 'detailFields', 'relations', 'searchKeywords']) {
    if (!Array.isArray(module[key]) || module[key].length < 3) fail(`${module.id}.${key} 至少需要 3 項`);
  }

  if (listRoutes.has(module.listRoute)) fail(`重複列表 route：${module.listRoute}`);
  if (detailRoutes.has(module.detailRoutePattern)) fail(`重複詳情 route：${module.detailRoutePattern}`);
  if (searchTypes.has(module.searchType)) fail(`重複搜尋類型：${module.searchType}`);
  listRoutes.add(module.listRoute);
  detailRoutes.add(module.detailRoutePattern);
  searchTypes.add(module.searchType);
}

for (const [id, route] of Object.entries(expected)) {
  if (!ids.has(id)) fail(`缺少模組：${id}`);
  for (const value of [route.listRoute, route.detailRoutePattern]) {
    if (!contract.includes(`\`${value.startsWith('#/') ? value : `#/${value}`}\``)) {
      fail(`架構文件缺少 route：${value}`);
    }
  }
  if (!index.includes(`data-route="${route.listRoute}"`)) fail(`側邊欄缺少 ${route.listRoute}`);
  if (!script.includes(`detailPrefix: '${route.detailRoutePrefix}'`)) fail(`腳本缺少 ${route.detailRoutePrefix}`);
}

for (const required of [
  'content-modules.css',
  'content-modules.js',
  'data-content-module-nav'
]) {
  if (!index.includes(required)) fail(`index.html 缺少 ${required}`);
}

if (!script.includes("fetch(DATA_PATH, {cache: 'no-store'})")) fail('腳本未讀取 content-modules.json');
if (!script.includes('不以假資料代替正式內容')) fail('詳情空狀態未明確禁止假資料');
if (!contract.includes('Issue #12 階段只索引四個章節入口')) fail('架構文件缺少搜尋邊界');

console.log(
  `CONTENT_MODULE_VALIDATION_PASS: ${data.modules.length} modules, ` +
  `${listRoutes.size} list routes, ${detailRoutes.size} detail route patterns`
);
