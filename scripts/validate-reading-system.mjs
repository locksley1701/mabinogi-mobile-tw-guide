import fs from 'node:fs';

const requiredFiles = [
  'reading-system.css',
  'reading-system.js',
  'theme-boot.js',
  'index.html'
];

const errors = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) errors.push(`缺少 ${file}`);
}

if (!errors.length) {
  const css = fs.readFileSync('reading-system.css', 'utf8');
  const js = fs.readFileSync('reading-system.js', 'utf8');
  const boot = fs.readFileSync('theme-boot.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');

  for (const size of ['standard', 'comfortable', 'large']) {
    if (!css.includes(`data-reading-size="${size}"`) && size !== 'standard') {
      errors.push(`CSS 缺少 ${size} 閱讀尺寸`);
    }
    if (!js.includes(`id: '${size}'`)) errors.push(`JS 缺少 ${size} 定義`);
  }

  if (!js.includes('fanatio-reading-size')) errors.push('JS 缺少閱讀尺寸儲存鍵');
  if (!boot.includes('fanatio-reading-size')) errors.push('前置啟動未讀取閱讀尺寸');
  if (!boot.includes('dataset.readingSize')) errors.push('前置啟動未設定 data-reading-size');
  if (!html.includes('reading-system.css')) errors.push('index.html 未載入 reading-system.css');
  if (!html.includes('reading-system.js')) errors.push('index.html 未載入 reading-system.js');
  if (!css.includes('--read-copy-size')) errors.push('CSS 缺少正文 token');
  if (!css.includes('--read-caption-size')) errors.push('CSS 缺少輔助文字 token');
  if (!js.includes('aria-pressed')) errors.push('閱讀尺寸選項缺少 aria-pressed');
}

if (errors.length) {
  console.error(`閱讀尺寸驗證失敗，共 ${errors.length} 項：`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('閱讀尺寸驗證通過：標準／舒適／放大、前置載入、偏好保存與 ARIA 契約完整。');
