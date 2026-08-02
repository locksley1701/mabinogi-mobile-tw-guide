import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const contribution = JSON.parse(read('data/contribution.json'));
const site = JSON.parse(read('data/site.json'));

const fail = message => {
  console.error(`CONTRIBUTION_CONTRACT_FAIL: ${message}`);
  process.exitCode = 1;
};

const requiredFiles = [
  'CONTRIBUTION_WORKFLOW.md',
  'contribution-flow.css',
  'contribution-flow.js',
  'data/contribution.json',
  'scripts/validate-contribution-flow.mjs',
  'tests/e2e/contribution-flow.spec.cjs'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`缺少 ${file}`);
}

if (contribution.version !== 1) fail('version 必須為 1');
if (contribution.issue !== 8) fail('issue 必須為 8');
if (contribution.reviewer !== '法那提歐') fail('reviewer 必須為法那提歐');

const expectedCategories = [
  '職業／技能', '生活技能', '料理', '裝備', '地圖',
  '任務', '活動', '名稱更正', '其他'
];
const expectedSignatures = ['匿名', '遊戲 ID', '暱稱'];
const expectedStatuses = [
  '待初審', '待補件', '核對中', '已核准待發布',
  '已發布', '不採用', '已撤回'
];

if (JSON.stringify(contribution.categories) !== JSON.stringify(expectedCategories)) {
  fail('投稿分類集合不符合契約');
}
if (JSON.stringify(contribution.signatureModes) !== JSON.stringify(expectedSignatures)) {
  fail('公開署名方式不符合契約');
}
if (JSON.stringify(contribution.reviewStatuses) !== JSON.stringify(expectedStatuses)) {
  fail('審核狀態不符合契約');
}
if (!Array.isArray(contribution.workflow) || contribution.workflow.length !== 4) {
  fail('workflow 必須正好有四個階段');
}
if (!Array.isArray(contribution.privacyRules) || contribution.privacyRules.length < 4) {
  fail('privacyRules 至少需要四條');
}

const allowedStatuses = new Set(['preparing', 'open', 'paused']);
if (!allowedStatuses.has(contribution.formStatus)) fail('formStatus 不合法');

function isPublicFormUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (url.hostname === 'forms.gle') return true;
    return url.hostname === 'docs.google.com'
      && /^\/forms\/d\/e\/[^/]+\/viewform\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

for (const [label, value] of [
  ['data/contribution.json formUrl', contribution.formUrl],
  ['data/site.json submissionFormUrl', site.submissionFormUrl]
]) {
  if (!isPublicFormUrl(String(value || '').trim())) {
    fail(`${label} 只允許公開 Google Forms 填寫網址或空字串`);
  }
}

if (contribution.formStatus === 'open') {
  const publicUrl = String(contribution.formUrl || site.submissionFormUrl || '').trim();
  if (!publicUrl) fail('formStatus=open 時必須提供公開填寫網址');
}

const publicFiles = [
  'CONTRIBUTION_WORKFLOW.md',
  'contribution-flow.js',
  'data/contribution.json',
  'data/site.json'
];
const combined = publicFiles.map(file => read(file)).join('\n');
const forbiddenPatterns = [
  [/docs\.google\.com\/spreadsheets\//i, 'Google 試算表網址'],
  [/drive\.google\.com\/(?:file|drive\/folders)\//i, '私人 Drive 網址'],
  [/docs\.google\.com\/forms\/d\/[^e/][^/]*\/edit/i, 'Google Form 編輯網址'],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, '電子郵件地址'],
  [/1PkP0Ic4RYzGKpkWogFDn-kF4uHRpu_g7OwjfSCe20Cc/, '私人審核台帳 ID']
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(combined)) fail(`公開檔案包含禁止內容：${label}`);
}

const index = read('index.html');
for (const token of ['contribution-flow.css', 'contribution-flow.js', '#/contribute']) {
  if (!index.includes(token)) fail(`index.html 缺少 ${token}`);
}

for (const phrase of [
  '投稿不會立即公開',
  '私人審核',
  '原始附件不會放進公開 repository',
  '撤回'
]) {
  if (!combined.includes(phrase)) fail(`投稿頁公開來源缺少必要文案：${phrase}`);
}

if (!process.exitCode) {
  console.log('CONTRIBUTION_FLOW_CONTRACT_PASS');
}
