const DATA_FILES = {
  site: 'data/site.json',
  lifeSkills: 'data/life-skills.json',
  cooking: 'data/cooking.json',
  afkTips: 'data/afk-tips.json',
  names: 'data/names.json',
  changelog: 'data/changelog.json'
};

const state = {
  site: null,
  lifeSkills: [],
  cooking: [],
  afkTips: [],
  names: [],
  changelog: [],
  query: '',
  category: 'all',
  status: 'all',
  visibleLimit: 12
};

const statusClass = {
  'tw-confirmed': 'status-badge--confirmed',
  'user-tested': 'status-badge--tested',
  'tw-testing': 'status-badge--testing',
  'kr-reference': 'status-badge--kr',
  'unconfirmed': 'status-badge--unknown'
};

const categoryLabel = {
  'life-skill': '生活技能',
  cooking: '料理',
  afk: '掛機技巧',
  name: '台版名稱'
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalize(value = '') {
  return String(value).toLocaleLowerCase('zh-Hant-TW').replace(/\s+/g, ' ').trim();
}

function highlight(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${escaped})`, 'ig'), '<mark>$1</mark>');
}

function badge(item) {
  return `<span class="status-badge ${statusClass[item.status] || statusClass.unconfirmed}">${escapeHtml(item.statusLabel || '待確認')}</span>`;
}

function cardSearchText(item) {
  return normalize(Object.values(item).join(' '));
}

function allSearchItems() {
  const life = state.lifeSkills.map(item => ({
    ...item,
    title: `${item.skill}｜Lv.${item.level}`,
    summary: item.recommendation,
    meta: [
      ['地點／方式', item.location],
      ['掛機適性', item.afk],
      ['工具／材料', item.requirements]
    ]
  }));
  const cooking = state.cooking.map(item => ({
    ...item,
    title: item.dish,
    summary: `${item.level} 推薦候選；${item.use}`,
    meta: [
      ['解鎖', item.unlock],
      ['材料', item.materials],
      ['練等 CP', item.cp]
    ]
  }));
  const afk = state.afkTips.map(item => ({
    ...item,
    title: `${item.target}任務掛機`,
    summary: item.method,
    meta: [
      ['技能', item.skill],
      ['停止條件', item.stop],
      ['效果', item.effect]
    ]
  }));
  const names = state.names.map(item => ({
    ...item,
    title: `${item.other} → ${item.tw}`,
    summary: item.evidence,
    meta: [
      ['分類', item.type],
      ['其他版本／舊稱', item.other],
      ['台版正式名稱', item.tw]
    ]
  }));
  return [...life, ...cooking, ...afk, ...names];
}

function renderResults() {
  const query = normalize(state.query);
  const items = allSearchItems().filter(item => {
    const matchQuery = !query || cardSearchText(item).includes(query);
    const matchCategory = state.category === 'all' || item.category === state.category;
    const matchStatus = state.status === 'all' || item.status === state.status;
    return matchQuery && matchCategory && matchStatus;
  });

  const container = document.querySelector('#search-results');
  const empty = document.querySelector('#empty-state');
  const count = document.querySelector('#result-count');
  const loadMore = document.querySelector('#load-more-button');
  const visibleItems = items.slice(0, state.visibleLimit);
  count.textContent = `共 ${items.length} 筆${items.length > visibleItems.length ? `・已顯示 ${visibleItems.length} 筆` : ''}`;
  empty.hidden = items.length > 0;
  loadMore.hidden = items.length <= visibleItems.length;

  container.innerHTML = visibleItems.map(item => `
    <article class="info-card">
      <div class="info-card__top">
        <div>
          <span class="info-card__type">${categoryLabel[item.category]}</span>
          <h3>${highlight(item.title, query)}</h3>
        </div>
        ${badge(item)}
      </div>
      <p>${highlight(item.summary, query)}</p>
      <dl>
        ${item.meta.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${highlight(value, query)}</dd>`).join('')}
        ${item.note ? `<dt>備註</dt><dd>${highlight(item.note, query)}</dd>` : ''}
      </dl>
    </article>
  `).join('');
}

function renderMetrics() {
  document.querySelector('#metric-life').textContent = state.lifeSkills.length;
  document.querySelector('#metric-cooking').textContent = state.cooking.length;
  document.querySelector('#metric-tested').textContent = state.afkTips.filter(item => item.status === 'user-tested').length;
  document.querySelector('#metric-names').textContent = state.names.length;
}

function renderAfk() {
  document.querySelector('#afk-list').innerHTML = state.afkTips
    .filter(item => item.id !== 'four-leaf-clover')
    .map(item => `
      <article class="compact-item">
        <h3>${escapeHtml(item.target)}｜${escapeHtml(item.skill)}</h3>
        <p>${escapeHtml(item.method)}</p>
        ${badge(item)}
      </article>
    `).join('');
}

function renderCooking() {
  document.querySelector('#cooking-list').innerHTML = state.cooking.map(item => `
    <article class="table-card">
      <span class="table-card__level">${escapeHtml(item.level)}</span>
      <div><h3>${escapeHtml(item.dish)}</h3><small>${escapeHtml(item.unlock)}</small></div>
      <p>${escapeHtml(item.materials)}<br><small>${escapeHtml(item.source)}</small></p>
      <span class="table-card__cp">${escapeHtml(item.cp)}</span>
      ${badge(item)}
    </article>
  `).join('');
}

function renderNames() {
  document.querySelector('#name-list').innerHTML = state.names.map(item => `
    <article class="name-card">
      <span class="name-card__old">${escapeHtml(item.other)}</span>
      <span class="name-card__arrow" aria-hidden="true">→</span>
      <span class="name-card__tw">${escapeHtml(item.tw)}</span>
      <small>${escapeHtml(item.type)}・${escapeHtml(item.evidence)}</small>
    </article>
  `).join('');
}

function renderChangelog() {
  document.querySelector('#changelog-list').innerHTML = state.changelog.map(item => `
    <li>
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <h3>${escapeHtml(item.item)}</h3>
      <p>${escapeHtml(item.change)} <small>依據：${escapeHtml(item.basis)}</small></p>
    </li>
  `).join('');
}

function renderSiteMeta() {
  if (!state.site) return;
  document.querySelector('#data-updated-at').textContent = `資料更新：${state.site.updatedAt}`;
  const sourceLink = document.querySelector('#source-sheet-link');
  sourceLink.href = state.site.sourceSheetUrl;
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function openModal(id) {
  const modal = document.querySelector(id);
  modal.hidden = false;
  modal.querySelector('button, a')?.focus();
  document.body.style.overflow = 'hidden';
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(modal => { modal.hidden = true; });
  document.body.style.overflow = '';
}

const tourSteps = [
  {
    target: '[data-tour="brand"]',
    title: '歡迎來到愛爾琳手札',
    copy: '這裡以台版實機資料為優先，所有未確認內容都會留下清楚標記。'
  },
  {
    target: '[data-tour="search"]',
    title: '直接搜尋需要的情報',
    copy: '輸入料理、技能、藥草或工具名稱，就能從所有已收錄資料裡快速查找。'
  },
  {
    target: '[data-tour="filters"]',
    title: '用分類與狀態縮小範圍',
    copy: '可以只看生活技能、料理、掛機技巧，或只看已台版確認的內容。'
  },
  {
    target: '[data-tour="cards"]',
    title: '每張卡片都保留資料依據',
    copy: '卡片會列出推薦方式、材料、掛機適性與資料狀態，避免把候選資訊誤當定論。'
  },
  {
    target: '[data-tour="contribute"]',
    title: '也歡迎留下你的旅途發現',
    copy: '情報經法那提歐核對後才會收錄，並可選擇顯示遊戲 ID、自訂暱稱或匿名。'
  }
];
let tourIndex = 0;

function clearTourHighlight() {
  document.querySelectorAll('.tour-highlight').forEach(element => element.classList.remove('tour-highlight'));
}

function renderTourStep() {
  clearTourHighlight();
  const step = tourSteps[tourIndex];
  const target = document.querySelector(step.target);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => target.classList.add('tour-highlight'), 260);
  }
  document.querySelector('#tour-progress').textContent = `${tourIndex + 1} / ${tourSteps.length}`;
  document.querySelector('#tour-title').textContent = step.title;
  document.querySelector('#tour-copy').textContent = step.copy;
  document.querySelector('#tour-prev').hidden = tourIndex === 0;
  document.querySelector('#tour-next').textContent = tourIndex === tourSteps.length - 1 ? '完成並開始探索' : '下一步';
}

function startTour() {
  closeModals();
  tourIndex = 0;
  const tour = document.querySelector('#tour');
  tour.hidden = false;
  document.body.style.overflow = 'hidden';
  renderTourStep();
}

function endTour() {
  clearTourHighlight();
  document.querySelector('#tour').hidden = true;
  document.body.style.overflow = '';
  localStorage.setItem('fanatio-tour-v1', 'done');
}

function setupInteractions() {
  const search = document.querySelector('#global-search');
  const category = document.querySelector('#category-filter');
  const status = document.querySelector('#status-filter');

  search.addEventListener('input', event => {
    state.query = event.target.value;
    state.visibleLimit = 12;
    renderResults();
  });
  category.addEventListener('change', event => {
    state.category = event.target.value;
    state.visibleLimit = 12;
    renderResults();
  });
  status.addEventListener('change', event => {
    state.status = event.target.value;
    state.visibleLimit = 12;
    renderResults();
  });
  document.querySelectorAll('[data-status-pick]').forEach(button => {
    button.addEventListener('click', () => {
      const picked = button.dataset.statusPick;
      state.status = state.status === picked ? 'all' : picked;
      status.value = state.status;
      state.visibleLimit = 12;
      renderResults();
      document.querySelector('#results-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelector('#load-more-button').addEventListener('click', () => {
    state.visibleLimit += 12;
    renderResults();
  });

  document.querySelector('#theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('fanatio-theme', next);
  });

  document.querySelector('#help-button').addEventListener('click', () => openModal('#guide-modal'));
  document.querySelector('#contributor-guide-button').addEventListener('click', () => openModal('#guide-modal'));
  document.querySelector('#footer-tour-button').addEventListener('click', startTour);
  document.querySelector('#replay-tour-button').addEventListener('click', startTour);
  document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModals));

  document.querySelector('#submit-info-button').addEventListener('click', () => {
    const url = state.site?.submissionFormUrl?.trim();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      openModal('#submission-modal');
    }
  });

  document.querySelector('#tour-next').addEventListener('click', () => {
    if (tourIndex >= tourSteps.length - 1) return endTour();
    tourIndex += 1;
    renderTourStep();
  });
  document.querySelector('#tour-prev').addEventListener('click', () => {
    if (tourIndex <= 0) return;
    tourIndex -= 1;
    renderTourStep();
  });
  document.querySelector('#tour-skip').addEventListener('click', endTour);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModals();
      if (!document.querySelector('#tour').hidden) endTour();
    }
  });
}

function applySavedTheme() {
  const saved = localStorage.getItem('fanatio-theme');
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved;
    return;
  }
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

async function loadData() {
  try {
    const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, path]) => {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return [key, await response.json()];
    }));
    entries.forEach(([key, value]) => { state[key] = value; });
    renderSiteMeta();
    renderMetrics();
    renderResults();
    renderAfk();
    renderCooking();
    renderNames();
    renderChangelog();
  } catch (error) {
    console.error(error);
    document.querySelector('#result-count').textContent = '資料載入失敗';
    showToast('資料載入失敗，請確認網站是透過 HTTP 伺服器開啟。');
  }
}

async function init() {
  applySavedTheme();
  setupInteractions();
  await loadData();
  if (!localStorage.getItem('fanatio-tour-v1')) {
    setTimeout(startTour, 600);
  }
}

init();
