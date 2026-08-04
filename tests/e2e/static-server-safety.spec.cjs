const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const repositoryRoot = path.resolve('.');
let repositoryFixture;

function createPrivateFixture(root) {
  const privateDirectory = path.join(root, '.codex-input');
  const fixturePath = path.join(privateDirectory, 'server-safety-fixture.txt');
  const state = {
    privateDirectory,
    fixturePath,
    createdDirectory: false,
    createdFixture: false
  };

  try {
    if (!fs.existsSync(privateDirectory)) {
      fs.mkdirSync(privateDirectory);
      state.createdDirectory = true;
    } else if (!fs.statSync(privateDirectory).isDirectory()) {
      throw new Error(`${privateDirectory} 必須是資料夾`);
    }

    fs.writeFileSync(fixturePath, 'server safety fixture\n', { encoding: 'utf8', flag: 'wx' });
    state.createdFixture = true;
    return state;
  } catch (error) {
    if (state.createdDirectory && fs.existsSync(privateDirectory)) fs.rmdirSync(privateDirectory);
    throw error;
  }
}

function cleanupPrivateFixture(state) {
  if (!state) return;
  if (state.createdFixture && fs.existsSync(state.fixturePath)) fs.unlinkSync(state.fixturePath);
  if (state.createdDirectory && fs.existsSync(state.privateDirectory)) fs.rmdirSync(state.privateDirectory);
}

test.beforeAll(() => {
  repositoryFixture = createPrivateFixture(repositoryRoot);
});

test.afterAll(() => {
  cleanupPrivateFixture(repositoryFixture);
});

function rawRequest(pathname) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: 4173,
      method: 'GET',
      path: pathname,
      agent: false
    }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
    request.end();
  });
}

function skipNonDesktop(testInfo) {
  test.skip(testInfo.project.name !== 'desktop-chrome', '伺服器路徑安全與 viewport 無關，只需執行一次');
}

test('私人、dot 與測試工作目錄無法由靜態站讀取', async ({ request }, testInfo) => {
  skipNonDesktop(testInfo);
  expect(repositoryFixture.createdFixture).toBeTruthy();
  expect(fs.existsSync(repositoryFixture.fixturePath)).toBeTruthy();
  const blockedPaths = [
    '/.codex-input/server-safety-fixture.txt',
    '/.git/config',
    '/node_modules/package.json',
    '/test-results/index.html',
    '/playwright-report/index.html',
    '/.hidden/example.txt',
    '/%2ecodex-input/issue-9/jobs.json',
    '/%2Egit/config',
    '/safe/%2e%2e/.git/config'
  ];

  for (const pathname of blockedPaths) {
    const response = await request.get(pathname);
    expect([403, 404], pathname).toContain(response.status());
  }

  for (const pathname of [
    '/.codex-input\\server-safety-fixture.txt',
    '/%2ecodex-input%5cserver-safety-fixture.txt',
    '/node_modules\\package.json'
  ]) {
    expect([403, 404], pathname).toContain(await rawRequest(pathname));
  }
});

test('正常首頁、腳本、資料與圖像資產維持 200', async ({ request }, testInfo) => {
  skipNonDesktop(testInfo);
  for (const pathname of [
    '/',
    '/index.html',
    '/app.js',
    '/data/profession-skills.json',
    '/assets/emblem.svg'
  ]) {
    const response = await request.get(pathname);
    expect(response.status(), pathname).toBe(200);
  }
});

test('malformed encoding 回傳 400 且伺服器持續運作', async ({ request }, testInfo) => {
  skipNonDesktop(testInfo);
  expect(await rawRequest('/%E0%A4%A')).toBe(400);
  expect(await rawRequest('/%')).toBe(400);

  const response = await request.get('/data/profession-skills.json');
  expect(response.status()).toBe(200);
  expect(await response.json()).toHaveProperty('fighter');
});

test('缺少 .codex-input 時可建立 fixture 並只清理測試產物', async ({}, testInfo) => {
  skipNonDesktop(testInfo);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fanatio-server-safety-'));
  const privateDirectory = path.join(temporaryRoot, '.codex-input');
  let fixture;

  try {
    expect(fs.existsSync(privateDirectory)).toBeFalsy();
    fixture = createPrivateFixture(temporaryRoot);
    expect(fixture.createdDirectory).toBeTruthy();
    expect(fixture.createdFixture).toBeTruthy();
    expect(fs.existsSync(fixture.fixturePath)).toBeTruthy();
  } finally {
    cleanupPrivateFixture(fixture);
    expect(fs.existsSync(privateDirectory)).toBeFalsy();
    fs.rmdirSync(temporaryRoot);
  }
});
