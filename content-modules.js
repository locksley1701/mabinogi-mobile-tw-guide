(() => {
  const DATA_PATH = 'data/content-modules.json';
  const ROUTES = [
    { id: 'equipment', listRoute: 'equipment', detailPrefix: 'equipment/', searchType: 'equipment' },
    { id: 'maps', listRoute: 'maps', detailPrefix: 'map/', searchType: 'map' },
    { id: 'quests', listRoute: 'quests', detailPrefix: 'quest/', searchType: 'quest' },
    { id: 'events', listRoute: 'events', detailPrefix: 'event/', searchType: 'event' }
  ];

  const moduleState = {
    loaded: false,
    error: null,
    modules: []
  };

  Object.assign(pageMeta, {
    equipment: ['裝備查詢', '裝備'],
    maps: ['地圖與採集', '地圖'],
    quests: ['任務查詢', '任務'],
    events: ['活動查詢', '活動']
  });

  Object.assign(searchCategoryLabels, {
    equipment: '裝備',
    map: '地圖',
    quest: '任務',
    event: '活動'
  });

  const baseRenderRoute = renderRoute;
  const baseRenderHome = renderHome;
  const baseBuildSearchItems = buildSearchItems;

  function routeConfig(route) {
    return ROUTES.find(item => route === item.listRoute || route.startsWith(item.detailPrefix));
  }

  function moduleForRoute(route) {
    const config = routeConfig(route);
    if (!config) return null;
    return moduleState.modules.find(item => item.id === config.id) || { ...config, name: '章節' };
  }

  function openModuleDisclosure() {
    const disclosure = document.querySelector('[data-content-module-nav]');
    if (disclosure) disclosure.open = true;
  }

  function renderLoadingModule(route) {
    const config = routeConfig(route);
    const metaRoute = config?.listRoute || 'home';
    setActiveNav(metaRoute);
    openModuleDisclosure();
    setTopbar(metaRoute);
    workspace.innerHTML = `
      ${pageHead('新章節架構', '章節資料載入中', '正在讀取裝備、地圖、任務與活動的共用架構。')}
      <div class="empty-state"><strong>正在翻開手札</strong><p>請稍候片刻。</p></div>
    `;
  }

  function renderModuleList(module) {
    setActiveNav(module.listRoute);
    openModuleDisclosure();
    setTopbar(module.listRoute);
    workspace.innerHTML = `
      ${pageHead('新內容模組', `${module.name}章節`, module.summary, `下一施工：Issue #${module.nextIssue}`)}
      <section class="content-module-hero">
        <div class="content-module-hero__mark" aria-hidden="true">${escapeHtml(module.icon)}</div>
        <div>
          <div class="content-module-hero__title">
            <h2>${escapeHtml(module.navLabel)}</h2>
            ${badge({status: 'tw-testing', statusLabel: module.statusLabel})}
          </div>
          <p>${escapeHtml(module.emptyCopy)}</p>
          <code>#/${escapeHtml(module.listRoute)}</code>
          <code>#/${escapeHtml(module.detailRoutePattern)}</code>
        </div>
      </section>

      <section class="content-module-grid" aria-label="${escapeHtml(module.name)}資料架構">
        <article class="content-module-card">
          <h2>列表欄位</h2>
          <ul>${module.listFields.map(field => `<li>${escapeHtml(field)}</li>`).join('')}</ul>
        </article>
        <article class="content-module-card">
          <h2>詳情欄位</h2>
          <ul>${module.detailFields.map(field => `<li>${escapeHtml(field)}</li>`).join('')}</ul>
        </article>
        <article class="content-module-card">
          <h2>跨章節關聯</h2>
          <ul>${module.relations.map(field => `<li>${escapeHtml(field)}</li>`).join('')}</ul>
        </article>
      </section>

      <section class="content-module-empty">
        <p class="eyebrow">台版資料優先</p>
        <h2>${escapeHtml(module.emptyTitle)}</h2>
        <p>${escapeHtml(module.emptyCopy)}</p>
        <p class="content-module-empty__note">目前不建立示範項目，也不使用韓版資料或推測數值填滿頁面。</p>
      </section>
    `;
  }

  function renderModuleDetail(module, route) {
    const requestedId = route.slice(module.detailRoutePrefix.length).trim();
    setActiveNav(module.listRoute);
    openModuleDisclosure();
    setTopbar(module.listRoute, `${module.name}詳情`);
    workspace.innerHTML = `
      ${pageHead(`${module.name}詳情 route`, '這筆資料尚未收錄', `已收到可分享的詳情網址，但目前沒有核准的台版資料可顯示。`, `請求 ID：${requestedId || '未提供'}`)}
      <section class="content-module-empty content-module-empty--detail">
        <div class="content-module-route-id"><span>請求 ID</span><code>${escapeHtml(requestedId || '(empty)')}</code></div>
        <h2>不以假資料代替正式內容</h2>
        <p>待後續 Issue 完成台版核對後，這個 route 才會顯示名稱、條件、狀態、關聯與更新日期。</p>
        <a class="primary-button content-module-back" href="#/${escapeHtml(module.listRoute)}">返回${escapeHtml(module.name)}章節</a>
      </section>
    `;
  }

  function renderModuleRoute(route) {
    const config = routeConfig(route);
    if (!config) return false;

    if (!moduleState.loaded) {
      renderLoadingModule(route);
      return true;
    }

    if (moduleState.error) {
      setActiveNav(config.listRoute);
      openModuleDisclosure();
      setTopbar(config.listRoute);
      workspace.innerHTML = `
        ${pageHead('新章節架構', '模組資料載入失敗', '四類內容模組暫時無法讀取。')}
        <div class="empty-state"><strong>資料載入失敗</strong><p>請稍後重新整理頁面。</p></div>
      `;
      return true;
    }

    const module = moduleForRoute(route);
    if (route === module.listRoute) renderModuleList(module);
    else renderModuleDetail(module, route);
    return true;
  }

  function appendHomePortals() {
    if (!moduleState.loaded || moduleState.error || !moduleState.modules.length) return;
    const existing = workspace.querySelector('[data-content-module-portals]');
    if (existing) existing.remove();

    const section = document.createElement('section');
    section.className = 'section-block';
    section.dataset.contentModulePortals = 'true';
    section.innerHTML = `
      <div class="section-heading">
        <h2 class="section-title">世界與冒險章節</h2>
        <span class="section-note">架構已建立・內容依台版資料逐步編纂</span>
      </div>
      <div class="portal-grid content-module-portals">
        ${moduleState.modules.map(module => `
          <a class="portal-card" href="#/${escapeHtml(module.listRoute)}">
            <span class="portal-card__icon" aria-hidden="true">${escapeHtml(module.icon)}</span>
            <strong>${escapeHtml(module.navLabel)}</strong>
            <small>${escapeHtml(module.summary)}</small>
          </a>
        `).join('')}
      </div>
    `;

    const updateSection = workspace.querySelector('.section-block:last-of-type');
    if (updateSection) workspace.insertBefore(section, updateSection);
    else workspace.append(section);
  }

  renderHome = function enhancedRenderHome() {
    baseRenderHome();
    appendHomePortals();
  };

  buildSearchItems = function enhancedBuildSearchItems() {
    const baseItems = baseBuildSearchItems();
    if (!moduleState.loaded || moduleState.error) return baseItems;
    const moduleItems = moduleState.modules.map(module => ({
      type: module.searchType,
      title: `${module.name}章節`,
      description: module.summary,
      route: module.listRoute,
      keywords: `${module.name} ${module.navLabel} ${module.searchKeywords.join(' ')}`,
      status: 'tw-testing',
      statusLabel: module.statusLabel
    }));
    return [...baseItems, ...moduleItems];
  };

  renderSearch = function enhancedRenderSearch() {
    const categories = ['全部', 'life', 'cooking', 'afk', 'profession', 'combatSkill', 'equipment', 'map', 'quest', 'event'];
    workspace.innerHTML = `
      ${pageHead('全站索引', '快速查詢', '搜尋生活技能、料理、掛機技巧、職業、裝備、地圖、任務或活動。舊稱只用來協助搜尋，不會另外佔一整頁。', `資料更新：${state.site.updatedAt}`)}
      <section class="search-panel">
        <label class="search-input" for="site-search"><span aria-hidden="true">⌕</span><input id="site-search" type="search" autocomplete="off" placeholder="例如：日常採集、戰士、裝備、地圖、任務……" value="${escapeHtml(state.searchQuery)}"></label>
        <select id="search-category" aria-label="搜尋分類">
          ${categories.map(value => `<option value="${value}" ${state.searchCategory === value ? 'selected' : ''}>${value === '全部' ? '全部分類' : searchCategoryLabels[value]}</option>`).join('')}
        </select>
      </section>
      <div class="search-results" id="search-results"></div>
    `;
    const input = workspace.querySelector('#site-search');
    const select = workspace.querySelector('#search-category');
    const rerender = () => {
      state.searchQuery = input.value;
      state.searchCategory = select.value;
      renderSearchResults();
    };
    input.addEventListener('input', rerender);
    select.addEventListener('change', rerender);
    renderSearchResults();
    requestAnimationFrame(() => input.focus({preventScroll: true}));
  };

  function enhancedRenderRoute() {
    const route = getRoute();
    if (renderModuleRoute(route)) {
      workspace.focus({preventScroll: true});
      window.scrollTo({top: 0, behavior: 'auto'});
      return;
    }
    baseRenderRoute();
  }

  window.removeEventListener('hashchange', baseRenderRoute);
  renderRoute = enhancedRenderRoute;
  window.addEventListener('hashchange', enhancedRenderRoute);

  const ready = fetch(DATA_PATH, {cache: 'no-store'})
    .then(response => {
      if (!response.ok) throw new Error(`${DATA_PATH}: ${response.status}`);
      return response.json();
    })
    .then(data => {
      moduleState.modules = data.modules || [];
      moduleState.loaded = true;
      if (routeConfig(getRoute()) || ['home', 'search'].includes(getRoute())) enhancedRenderRoute();
      return moduleState.modules;
    })
    .catch(error => {
      console.error(error);
      moduleState.loaded = true;
      moduleState.error = error;
      if (routeConfig(getRoute())) enhancedRenderRoute();
      return [];
    });

  window.FanatioContentModules = {
    ready,
    get loaded() { return moduleState.loaded; },
    get modules() { return [...moduleState.modules]; },
    patch: enhancedRenderRoute
  };
})();
