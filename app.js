const DATA_FILES = {
  site: 'data/site.json',
  lifeCategories: 'data/life-skill-categories.json',
  lifeGuides: 'data/life-skills.json',
  cooking: 'data/cooking.json',
  afk: 'data/afk-tips.json',
  aliases: 'data/names.json',
  professions: 'data/professions.json',
  professionSkills: 'data/profession-skills.json',
  changelog: 'data/changelog.json'
};

const state = {
  site: null,
  lifeCategories: [],
  lifeGuides: [],
  cooking: [],
  afk: [],
  aliases: [],
  professions: [],
  professionSkills: {},
  changelog: [],
  selectedLifeGroup: '全部',
  selectedLifeSkill: 'daily-gathering',
  selectedCookingLevel: '全部',
  searchQuery: '',
  searchCategory: '全部'
};

const pageMeta = {
  home: ['手札總覽', '總覽'],
  search: ['快速查詢', '查詢'],
  life: ['生活技能', '生活技能'],
  cooking: ['料理手札', '料理'],
  afk: ['掛機技巧', '掛機技巧'],
  professions: ['職業總覽', '職業'],
  updates: ['手札增補紀錄', '更新紀錄'],
  contribute: ['愛爾琳情報櫃台', '提供情報']
};

const statusClass = {
  'tw-confirmed': 'status-confirmed',
  'user-tested': 'status-tested',
  'tw-testing': 'status-testing',
  'kr-reference': 'status-reference',
  'unconfirmed': 'status-unknown'
};

const searchCategoryLabels = {
  life: '生活技能',
  cooking: '料理',
  afk: '掛機技巧',
  profession: '職業',
  combatSkill: '職業技能'
};

const workspace = document.querySelector('#workspace');

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

function badge(item) {
  const label = item.statusLabel || ({
    'tw-confirmed': '台版已確認',
    'user-tested': '法那提歐實測',
    'tw-testing': '台版待實測',
    'kr-reference': '韓國版參考',
    'unconfirmed': '待確認'
  }[item.status] || '待確認');
  return `<span class="status-badge ${statusClass[item.status] || statusClass.unconfirmed}">${escapeHtml(label)}</span>`;
}

function attribution(item, fallback = '') {
  const name = item.contributor || (item.source?.includes('法那提歐') ? '法那提歐' : '');
  if (!name && !fallback) return '';
  return `<span class="attribution">✦ 情報提供：${escapeHtml(name || fallback)}</span>`;
}

function pageHead(eyebrow, title, copy, meta = '') {
  return `
    <header class="page-head">
      <div class="page-head__copy">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(title)}</h1>
        ${copy ? `<p>${escapeHtml(copy)}</p>` : ''}
      </div>
      ${meta ? `<div class="page-meta">${escapeHtml(meta)}</div>` : ''}
    </header>
  `;
}

function setTopbar(route, customTitle = '') {
  const [title, eyebrow] = route.startsWith('profession/')
    ? [customTitle || '職業手札', '職業技能']
    : (pageMeta[route] || pageMeta.home);
  document.querySelector('#page-title').textContent = title;
  document.querySelector('#page-eyebrow').textContent = eyebrow;
  document.title = `${title}｜法那提歐的愛爾琳手札`;
}

function setActiveNav(route) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkRoute = link.dataset.route;
    const active = route === linkRoute || (route.startsWith('profession/') && route === linkRoute);
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function syncProfessionNavGroups(route = getRoute()) {
  if (!route.startsWith('profession/')) return;
  const groups = [...document.querySelectorAll('[data-profession-nav-group]')];
  const activeGroup = groups.find(group => group.querySelector(`.nav-link[data-route="${route}"]`));
  if (!activeGroup) return;
  groups.forEach(group => { group.open = group === activeGroup; });
}

function getRoute() {
  return location.hash.replace(/^#\/?/, '') || 'home';
}

function syncDrawerAccessibility() {
  const sidebar = document.querySelector('#sidebar');
  if (!sidebar) return;
  const mobile = matchMedia('(max-width: 959px)').matches;
  const open = document.body.classList.contains('drawer-open');
  if (mobile) {
    sidebar.inert = !open;
    sidebar.setAttribute('aria-hidden', String(!open));
    return;
  }
  sidebar.inert = false;
  sidebar.removeAttribute('aria-hidden');
}

function closeDrawer() {
  document.body.classList.remove('drawer-open');
  document.querySelector('#drawer-backdrop').hidden = true;
  document.querySelector('#menu-button').setAttribute('aria-expanded', 'false');
  syncDrawerAccessibility();
}

function openDrawer() {
  syncProfessionNavGroups(getRoute());
  document.body.classList.add('drawer-open');
  document.querySelector('#drawer-backdrop').hidden = false;
  document.querySelector('#menu-button').setAttribute('aria-expanded', 'true');
  syncDrawerAccessibility();
}

function navigate(route) {
  if (location.hash === `#/${route}`) renderRoute();
  else location.hash = `#/${route}`;
  closeDrawer();
}

function renderHome() {
  const documentedProfessions = state.professions.filter(item => item.documented).length;
  const testedTips = state.afk.filter(item => item.status === 'user-tested').length;
  const recent = state.changelog.slice(0, 3);
  workspace.innerHTML = `
    <section class="hero-panel">
      <p class="eyebrow">手札編纂者・法那提歐</p>
      <h1>從營火旁的生活技藝，<br>到戰場上的劍與魔法。</h1>
      <p class="hero-panel__lead">這裡不再是一條無止盡的長卷。請從側邊欄選擇章節，直接前往生活技能、料理、掛機技巧或職業資料。</p>
      <div class="hero-actions">
        <button class="primary-button" type="button" data-nav="search">開始查詢</button>
        <button class="secondary-button" type="button" data-nav="professions">查看職業</button>
      </div>
    </section>

    <section class="metric-grid" aria-label="收錄概況">
      <article class="metric"><strong>${state.lifeCategories.length}</strong><span>台版生活技能分類</span></article>
      <article class="metric"><strong>${state.cooking.length}</strong><span>料理候選</span></article>
      <article class="metric"><strong>${testedTips}</strong><span>法那提歐實測技巧</span></article>
      <article class="metric"><strong>${documentedProfessions}/${state.professions.length}</strong><span>已編纂職業</span></article>
    </section>

    <section class="section-block">
      <div class="section-heading">
        <h2 class="section-title">選擇要翻開的章節</h2>
        <span class="section-note">每次只顯示一個主題</span>
      </div>
      <div class="portal-grid">
        <a class="portal-card" href="#/life"><span class="portal-card__icon">⚒</span><strong>生活技能</strong><small>20 個台版正式分類與目前攻略</small></a>
        <a class="portal-card" href="#/cooking"><span class="portal-card__icon">♨</span><strong>料理手札</strong><small>依解鎖等級切換候選料理</small></a>
        <a class="portal-card" href="#/afk"><span class="portal-card__icon">☘</span><strong>掛機技巧</strong><small>實測與待確認技巧分開呈現</small></a>
        <a class="portal-card" href="#/professions"><span class="portal-card__icon">⚔</span><strong>職業總覽</strong><small>台版 18 個職業與技能手札</small></a>
      </div>
    </section>

    <section class="section-block">
      <div class="section-heading"><h2 class="section-title">最近增補</h2><a class="section-note" href="#/updates">查看全部</a></div>
      ${recent.map(item => `
        <article class="update-strip">
          <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
          <p><strong>${escapeHtml(item.item)}</strong>・${escapeHtml(item.change)}</p>
          <a href="#/updates">詳情</a>
        </article>
      `).join('')}
    </section>
  `;
  workspace.querySelectorAll('[data-nav]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.nav)));
}

function buildSearchItems() {
  const life = state.lifeGuides.map(item => ({
    type: 'life', title: `${item.skill}｜Lv.${item.level}`, description: item.recommendation, route: 'life',
    keywords: `${item.skill} ${item.level} ${item.location} ${item.requirements} ${item.note || ''}`, status: item.status, statusLabel: item.statusLabel
  }));
  const cooking = state.cooking.map(item => ({
    type: 'cooking', title: item.dish, description: `${item.unlock}・${item.use}`, route: 'cooking',
    keywords: `${item.dish} ${item.level} ${item.materials} ${item.source} ${item.note || ''}`, status: item.status, statusLabel: item.statusLabel
  }));
  const afk = state.afk.map(item => ({
    type: 'afk', title: `${item.target}任務`, description: `${item.skill}・${item.effect}`, route: 'afk',
    keywords: `${item.target} ${item.skill} ${item.method} ${item.stop}`, status: item.status, statusLabel: item.statusLabel
  }));
  const professions = state.professions.map(item => ({
    type: 'profession', title: item.name,
    description: item.documented ? '已收錄職業介紹與技能' : '台版職業名稱已確認，詳細資料待收錄',
    route: item.documented ? `profession/${item.id}` : 'professions', keywords: item.name,
    status: item.documented ? 'tw-confirmed' : 'tw-testing', statusLabel: item.documented ? '台版已確認' : '資料待收錄'
  }));
  const combatSkills = Object.values(state.professionSkills).flatMap(profession =>
    [...profession.active.map(skill => ({...skill, kind: '主動'})), ...profession.passive.map(skill => ({...skill, kind: '被動'}))]
      .map(skill => ({
        type: 'combatSkill', title: skill.name, description: `${profession.name}・${skill.kind}${skill.unlock ? `・${skill.unlock}` : ''}`,
        route: `profession/${profession.id}`, keywords: `${profession.name} ${skill.name} ${skill.kind} ${skill.unlock || ''}`,
        status: skill.status || profession.status || 'tw-confirmed', statusLabel: '台版已確認'
      }))
  );
  const aliases = state.aliases.flatMap(alias => {
    const target = [...life, ...cooking, ...afk].find(item => normalize(item.keywords).includes(normalize(alias.tw)));
    return target ? [{...target, keywords: `${target.keywords} ${alias.other} ${alias.tw}`}] : [];
  });
  const combined = [...life, ...cooking, ...afk, ...professions, ...combatSkills, ...aliases];
  const seen = new Set();
  return combined.filter(item => {
    const key = `${item.type}:${item.title}:${item.route}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderSearch() {
  workspace.innerHTML = `
    ${pageHead('全站索引', '快速查詢', '搜尋生活技能、料理、掛機技巧、職業或職業技能。舊稱只用來協助搜尋，不會另外佔一整頁。', `資料更新：${state.site.updatedAt}`)}
    <section class="search-panel">
      <label class="search-input" for="site-search"><span aria-hidden="true">⌕</span><input id="site-search" type="search" autocomplete="off" placeholder="例如：日常採集、旅行者點心、戰士、疾風斬……" value="${escapeHtml(state.searchQuery)}"></label>
      <select id="search-category" aria-label="搜尋分類">
        ${['全部','life','cooking','afk','profession','combatSkill'].map(value => `<option value="${value}" ${state.searchCategory === value ? 'selected' : ''}>${value === '全部' ? '全部分類' : searchCategoryLabels[value]}</option>`).join('')}
      </select>
    </section>
    <div class="search-results" id="search-results"></div>
  `;
  const input = workspace.querySelector('#site-search');
  const select = workspace.querySelector('#search-category');
  const rerender = () => { state.searchQuery = input.value; state.searchCategory = select.value; renderSearchResults(); };
  input.addEventListener('input', rerender);
  select.addEventListener('change', rerender);
  renderSearchResults();
  requestAnimationFrame(() => input.focus({preventScroll: true}));
}

function renderSearchResults() {
  const container = workspace.querySelector('#search-results');
  if (!container) return;
  const query = normalize(state.searchQuery);
  const items = buildSearchItems().filter(item => {
    const categoryMatch = state.searchCategory === '全部' || item.type === state.searchCategory;
    const queryMatch = !query || normalize(`${item.title} ${item.description} ${item.keywords}`).includes(query);
    return categoryMatch && queryMatch;
  });
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><strong>這頁手札還沒有記載</strong><p>換個關鍵字，或把新情報送往情報櫃台。</p></div>`;
    return;
  }
  const groups = Object.entries(searchCategoryLabels)
    .map(([type, label]) => [type, label, items.filter(item => item.type === type)])
    .filter(([, , group]) => group.length);
  container.innerHTML = groups.map(([, label, group]) => `
    <section class="result-group">
      <h2>${label} <small>(${group.length})</small></h2>
      <div class="result-list">
        ${group.slice(0, 18).map(item => `
          <article class="result-row"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p><a href="#/${escapeHtml(item.route)}">開啟章節</a></article>
        `).join('')}
      </div>
    </section>
  `).join('');
  window.FanatioIconPilot?.patch();
}

function renderLife() {
  const groups = ['全部', '採集', '製作', '其他'];
  const visible = state.lifeCategories.filter(item => state.selectedLifeGroup === '全部' || item.group === state.selectedLifeGroup);
  if (!visible.some(item => item.id === state.selectedLifeSkill)) state.selectedLifeSkill = visible[0]?.id || 'daily-gathering';
  workspace.innerHTML = `
    ${pageHead('台版正式分類', '生活技能', '依遊戲內「生活技能」頁面建立 20 個正式分類。選一項即可查看目前已編纂的練法，不再把每個等級區間全部攤在首頁。', '資料提供：法那提歐')}
    <section class="master-detail">
      <div class="panel">
        <div class="filter-chips" role="group" aria-label="生活技能分類">
          ${groups.map(group => `<button class="chip ${state.selectedLifeGroup === group ? 'is-active' : ''}" type="button" data-life-group="${group}">${group}</button>`).join('')}
        </div>
        <div class="skill-grid">
          ${visible.map(item => {
            const count = state.lifeGuides.filter(guide => guide.skillId === item.id).length;
            return `<button class="skill-tile ${state.selectedLifeSkill === item.id ? 'is-active' : ''}" type="button" data-life-skill="${item.id}">
              <span class="skill-tile__icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
              <span><strong>${escapeHtml(item.name)}</strong><small>${count ? `${count} 筆攻略` : '待編纂'}</small></span>
            </button>`;
          }).join('')}
        </div>
      </div>
      <div class="detail-panel" id="life-detail"></div>
    </section>
  `;
  workspace.querySelectorAll('[data-life-group]').forEach(button => button.addEventListener('click', () => { state.selectedLifeGroup = button.dataset.lifeGroup; renderLife(); }));
  workspace.querySelectorAll('[data-life-skill]').forEach(button => button.addEventListener('click', () => {
    state.selectedLifeSkill = button.dataset.lifeSkill;
    renderLifeDetail();
    workspace.querySelectorAll('.skill-tile').forEach(tile => tile.classList.toggle('is-active', tile.dataset.lifeSkill === state.selectedLifeSkill));
    if (matchMedia('(max-width: 959px)').matches) workspace.querySelector('#life-detail').scrollIntoView({behavior: 'smooth', block: 'start'});
  }));
  renderLifeDetail();
}

function renderLifeDetail() {
  const container = workspace.querySelector('#life-detail');
  if (!container) return;
  const category = state.lifeCategories.find(item => item.id === state.selectedLifeSkill) || state.lifeCategories[0];
  const guides = state.lifeGuides.filter(item => item.skillId === category.id);
  container.innerHTML = `
    <p class="detail-kicker">${escapeHtml(category.group)}類生活技能</p>
    <h2 class="detail-title">${escapeHtml(category.name)}</h2>
    <p class="detail-intro">${escapeHtml(category.description)}</p>
    ${attribution({contributor: '法那提歐'})}
    <div class="guide-stack">
      ${guides.length ? guides.map(item => `
        <article class="guide-entry">
          <div class="guide-entry__head"><h3>Lv.${escapeHtml(item.level)}</h3>${badge(item)}</div>
          <p>${escapeHtml(item.recommendation)}</p>
          <dl>
            <dt>地點／方式</dt><dd>${escapeHtml(item.location)}</dd>
            <dt>掛機適性</dt><dd>${escapeHtml(item.afk)}</dd>
            <dt>工具／材料</dt><dd>${escapeHtml(item.requirements)}</dd>
            ${item.note ? `<dt>備註</dt><dd>${escapeHtml(item.note)}</dd>` : ''}
          </dl>
          ${attribution(item)}
        </article>
      `).join('') : `<div class="empty-state"><strong>這個分類尚未編纂攻略</strong><p>正式分類已由台版截圖確認，練等路線仍等待實測資料。</p></div>`}
    </div>
  `;
}

function renderCooking() {
  const levels = ['全部', ...new Set(state.cooking.map(item => item.levelKey))];
  const visible = state.selectedCookingLevel === '全部' ? state.cooking : state.cooking.filter(item => item.levelKey === state.selectedCookingLevel);
  workspace.innerHTML = `
    ${pageHead('料理 CP 候選', '料理手札', '依解鎖等級切換料理候選。名稱與解鎖可已確認，但效率、成本與經驗值仍會分開標示。', '料理名稱資料：法那提歐')}
    <section class="cooking-layout">
      <nav class="level-nav" aria-label="料理等級">
        ${levels.map(level => `<button class="${state.selectedCookingLevel === level ? 'is-active' : ''}" type="button" data-cooking-level="${level}"><span>${level}</span><small>${level === '全部' ? state.cooking.length : state.cooking.filter(item => item.levelKey === level).length} 筆</small></button>`).join('')}
      </nav>
      <div class="cooking-grid">
        ${visible.map(item => `
          <article class="cooking-card">
            <div class="cooking-card__head"><h2>${escapeHtml(item.dish)}</h2>${badge(item)}</div>
            <p>${escapeHtml(item.use)}</p>
            <dl>
              <dt>解鎖</dt><dd>${escapeHtml(item.unlock)}</dd><dt>材料</dt><dd>${escapeHtml(item.materials)}</dd>
              <dt>取得</dt><dd>${escapeHtml(item.source)}</dd><dt>練等 CP</dt><dd>${escapeHtml(item.cp)}</dd>
              <dt>備註</dt><dd>${escapeHtml(item.note)}</dd>
            </dl>
            ${attribution(item)}
          </article>
        `).join('')}
      </div>
    </section>
  `;
  workspace.querySelectorAll('[data-cooking-level]').forEach(button => button.addEventListener('click', () => { state.selectedCookingLevel = button.dataset.cookingLevel; renderCooking(); }));
}

function renderAfk() {
  workspace.innerHTML = `
    ${pageHead('玩家實測與待確認', '掛機技巧', '已實測的技巧與仍待確認的假說分開呈現，避免把推測當成台版結論。', '實測者：法那提歐')}
    <section class="afk-grid">
      ${state.afk.map(item => `
        <article class="afk-card">
          <span class="afk-card__mark" aria-hidden="true">${item.status === 'unconfirmed' ? '?' : '☘'}</span>
          <h2>${escapeHtml(item.target)}</h2>${badge(item)}<p>${escapeHtml(item.method)}</p>
          <dl><dt>適用技能</dt><dd>${escapeHtml(item.skill)}</dd><dt>停止條件</dt><dd>${escapeHtml(item.stop)}</dd><dt>效果</dt><dd>${escapeHtml(item.effect)}</dd><dt>備註</dt><dd>${escapeHtml(item.note)}</dd></dl>
          ${attribution(item)}
        </article>
      `).join('')}
    </section>
  `;
}

function renderProfessions() {
  workspace.innerHTML = `
    ${pageHead('台版職業分類', '職業總覽', '依台版遊戲內「職業」頁面建立 18 個正式職業。已取得完整截圖的職業可直接開啟技能手札。', '資料提供：法那提歐')}
    <section class="profession-grid">
      ${state.professions.map(item => `
        <a class="profession-card ${item.documented ? 'is-documented' : ''}" href="${item.documented ? `#/profession/${item.id}` : '#/professions'}" ${item.documented ? '' : 'aria-disabled="true"'}>
          <span class="profession-card__icon" aria-hidden="true">${escapeHtml(item.icon)}</span><strong>${escapeHtml(item.name)}</strong><small>${item.documented ? '已收錄職業技能' : '詳細資料待收錄'}</small>
        </a>
      `).join('')}
    </section>
  `;
  workspace.querySelectorAll('[aria-disabled="true"]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); showToast('這個職業已確認台版名稱，技能資料尚待收錄。'); }));
}

function renderProfession(id) {
  const profession = state.professionSkills[id];
  if (!profession) { navigate('professions'); return; }
  const active = profession.active;
  const passive = profession.passive;
  setTopbar(`profession/${id}`, profession.name);
  workspace.innerHTML = `
    <section class="profession-hero">
      <div><p class="eyebrow">台版職業手札</p><h1>${escapeHtml(profession.name)}</h1><p>${escapeHtml(profession.description)}</p>${attribution({contributor:'法那提歐'})}</div>
      <aside class="profession-summary"><span>偏好裝備</span><strong>${escapeHtml(profession.preferredEquipment || profession.preferredArmor || '資料待補')}</strong><span>技能收錄</span><strong>${active.length + passive.length} 個</strong><span>資料狀態</span>${badge({status:profession.status || 'tw-confirmed',statusLabel:'台版已確認'})}</aside>
    </section>
    <section class="skill-columns">${renderCombatSkillColumn('主動技能', active, '主動')}${renderCombatSkillColumn('被動技能', passive, '被動')}</section>
  `;
}

function renderCombatSkillColumn(title, skills, type) {
  return `<article class="skill-column"><h2>${escapeHtml(title)}</h2><div class="combat-skill-list">
    ${skills.map((skill, index) => `<div class="combat-skill ${skill.unlock ? 'is-locked' : ''}"><span class="combat-skill__icon" aria-hidden="true">${String(index + 1).padStart(2,'0')}</span><span><strong>${escapeHtml(skill.name)}</strong>${skill.unlock ? `<small>${escapeHtml(skill.unlock)}</small>` : ''}</span><span class="combat-skill__type">${escapeHtml(type)}</span></div>`).join('')}
  </div></article>`;
}

function renderUpdates() {
  workspace.innerHTML = `${pageHead('手札增補紀錄', '最近更新', '每次資料更正、介面重整與新章節收錄都留下紀錄。', `最後更新：${state.site.updatedAt}`)}
    <section class="timeline">${state.changelog.map(item => `<article class="timeline-entry"><time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time><div><h2>${escapeHtml(item.item)}</h2><p>${escapeHtml(item.change)} <small>依據：${escapeHtml(item.basis)}</small></p></div></article>`).join('')}</section>`;
}

function renderContribute() {
  workspace.innerHTML = `<section class="contribute-panel"><p class="eyebrow">愛爾琳情報櫃台</p><h1>旅人，你發現新的情報嗎？</h1>
    <p>台版名稱、職業技能、採集位置、料理經驗與掛機技巧都歡迎提供。投稿不會直接公開，會先由法那提歐核對，再依投稿者選擇顯示遊戲 ID、自訂暱稱或匿名。</p>
    <ul class="rule-list"><li>建議附上台版實機截圖與可重現步驟。</li><li>原始截圖、Google 帳號與聯絡資訊不會放進公開 repository。</li><li>正式收錄後，資料頁會標示情報提供者 ID。</li></ul>
    <div class="hero-actions"><button class="primary-button" id="submission-button" type="button">提供愛爾琳情報</button><button class="secondary-button" type="button" data-nav="updates">查看增補紀錄</button></div></section>`;
  workspace.querySelector('#submission-button').addEventListener('click', () => {
    const url = state.site.submissionFormUrl?.trim();
    if (url) window.open(url, '_blank', 'noopener,noreferrer'); else showToast('投稿表單尚在架設中。');
  });
  workspace.querySelector('[data-nav="updates"]').addEventListener('click', () => navigate('updates'));
}

function renderRoute() {
  const route = getRoute();
  setActiveNav(route);
  syncProfessionNavGroups(route);
  if (route.startsWith('profession/')) renderProfession(route.split('/')[1]);
  else {
    setTopbar(route);
    ({home: renderHome, search: renderSearch, life: renderLife, cooking: renderCooking, afk: renderAfk, professions: renderProfessions, updates: renderUpdates, contribute: renderContribute}[route] || renderHome)();
  }
  workspace.focus({preventScroll: true});
  window.scrollTo({top: 0, behavior: 'auto'});
  document.dispatchEvent(new CustomEvent('fanatio:route-rendered', {detail: {route}}));
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function applySavedTheme() {
  let saved = null;
  try { saved = localStorage.getItem('fanatio-theme'); } catch { /* Private browsing or disabled storage. */ }
  document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('fanatio-theme', next); } catch { /* Theme still changes for this visit. */ }
}

function setupInteractions() {
  window.addEventListener('hashchange', renderRoute);
  document.querySelector('#menu-button').addEventListener('click', () => {
    const opening = !document.body.classList.contains('drawer-open');
    if (opening) openDrawer(); else closeDrawer();
  });
  document.querySelector('#drawer-backdrop').addEventListener('click', closeDrawer);
  document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', closeDrawer));
  const professionGroups = [...document.querySelectorAll('[data-profession-nav-group]')];
  professionGroups.forEach(group => group.addEventListener('toggle', () => {
    if (group.open) professionGroups.forEach(other => {
      if (other !== group) other.open = false;
    });
  }));
  document.querySelector('#theme-toggle').addEventListener('click', toggleTheme);
  document.querySelector('#top-theme-toggle').addEventListener('click', toggleTheme);
  document.querySelector('#top-search-button').addEventListener('click', () => navigate('search'));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDrawer(); });
}

window.FanatioNavigation = {closeDrawer, openDrawer, navigate};

async function loadData() {
  const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, path]) => {
    const response = await fetch(path, {cache: 'no-store'});
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return [key, await response.json()];
  }));
  entries.forEach(([key, value]) => { state[key] = value; });
}

async function init() {
  applySavedTheme();
  setupInteractions();
  try {
    await loadData();
    renderRoute();
  } catch (error) {
    console.error(error);
    workspace.innerHTML = `<div class="empty-state"><strong>資料載入失敗</strong><p>請稍後重新整理頁面。</p></div>`;
  }
}

init();
