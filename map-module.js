(() => {
  const DATA_PATH = 'data/maps.json';
  const mapState = {
    loaded: false,
    error: null,
    maps: [],
    selectedType: 'all'
  };

  const lifeSkillLabels = {
    'daily-gathering': '無工具採集',
    herbalism: '採集藥草',
    shearing: '剪羊毛',
    harvest: '收割',
    hoeing: '鋤地',
    mining: '採礦'
  };

  const nameTypeLabels = {
    'formal-map': '正式地圖名稱',
    'verified-location-label': '台版地點標籤',
    'generic-area': '區域泛稱'
  };

  const baseRenderRoute = renderRoute;
  const baseBuildSearchItems = buildSearchItems;

  function openModuleDisclosure() {
    const disclosure = document.querySelector('[data-content-module-nav]');
    if (disclosure) disclosure.open = true;
  }

  function prepareMapPage(title = '地圖與採集') {
    setActiveNav('maps');
    openModuleDisclosure();
    setTopbar('maps', title);
  }

  function mapTypeBadge(map) {
    const label = nameTypeLabels[map.nameType] || map.nameType;
    return `<span class="map-name-type map-name-type--${escapeHtml(map.nameType)}">${escapeHtml(label)}</span>`;
  }

  function renderMapLoading() {
    prepareMapPage();
    workspace.innerHTML = `
      ${pageHead('台版地圖資料', '正在整理採集地點', '正在讀取地圖、採集點與生活技能關聯。')}
      <div class="empty-state"><strong>正在翻開地圖頁</strong><p>請稍候片刻。</p></div>
    `;
  }

  function renderMapError() {
    prepareMapPage();
    workspace.innerHTML = `
      ${pageHead('台版地圖資料', '地圖資料載入失敗', '目前無法讀取地圖與採集點資料。')}
      <div class="empty-state"><strong>資料載入失敗</strong><p>請稍後重新整理頁面。</p></div>
    `;
  }

  function visibleMaps() {
    if (mapState.selectedType === 'all') return mapState.maps;
    return mapState.maps.filter(map => map.nameType === mapState.selectedType);
  }

  function renderMapList() {
    prepareMapPage();
    const maps = visibleMaps();
    const formalCount = mapState.maps.filter(map => map.nameType === 'formal-map').length;
    const genericCount = mapState.maps.filter(map => map.nameType === 'generic-area').length;

    workspace.innerHTML = `
      ${pageHead('台版地圖與採集', '地圖與採集位置', '先公開來源可支持的地圖與採集區；泛稱地點會明確標示，不冒充正式台版地圖名稱。', `Issue #14・${mapState.maps.length} 筆資料`)}

      <section class="map-overview" aria-label="地圖資料概況">
        <div><strong>${mapState.maps.length}</strong><span>地圖／採集區</span></div>
        <div><strong>${formalCount}</strong><span>正式地圖名稱</span></div>
        <div><strong>${genericCount}</strong><span>區域泛稱待核對</span></div>
      </section>

      <section class="map-filter" aria-label="地圖名稱類型篩選">
        ${[
          ['all', '全部'],
          ['formal-map', '正式地圖'],
          ['verified-location-label', '台版地點'],
          ['generic-area', '區域泛稱']
        ].map(([value, label]) => `
          <button type="button" data-map-type="${value}" aria-pressed="${mapState.selectedType === value}">${label}</button>
        `).join('')}
      </section>

      <section class="map-records" aria-label="地圖與採集位置列表">
        ${maps.length ? maps.map(map => `
          <a class="map-record" href="#/${escapeHtml(map.route)}">
            <div class="map-record__main">
              <div class="map-record__heading">
                <strong>${escapeHtml(map.name)}</strong>
                ${mapTypeBadge(map)}
              </div>
              <p>${escapeHtml(map.summary)}</p>
              <small>${escapeHtml(map.category)}・${map.gatheringSpots.length} 個採集點</small>
            </div>
            <div class="map-record__status">
              ${badge(map)}
              <span aria-hidden="true">›</span>
            </div>
          </a>
        `).join('') : `
          <div class="empty-state"><strong>這個分類尚無資料</strong><p>切換其他名稱類型查看目前已整理的地點。</p></div>
        `}
      </section>

      <section class="map-source-note">
        <strong>資料邊界</strong>
        <p>本批依台版生活技能查詢表整理。低可信度、韓版候選或只有用途描述的地點，不會被寫成台版正式地圖。</p>
      </section>
    `;

    workspace.querySelectorAll('[data-map-type]').forEach(button => {
      button.addEventListener('click', () => {
        mapState.selectedType = button.dataset.mapType;
        renderMapList();
      });
    });
  }

  function renderMapDetail(map) {
    prepareMapPage(map.name);
    const lifeSkills = [...new Set(map.gatheringSpots.flatMap(spot => spot.lifeSkillIds))];
    const items = [...new Set(map.gatheringSpots.flatMap(spot => spot.items))];

    workspace.innerHTML = `
      ${pageHead(map.category, map.name, map.summary, `資料更新：${map.updatedAt}`)}

      <section class="map-detail-hero">
        <div class="map-detail-hero__status">
          ${mapTypeBadge(map)}
          ${badge(map)}
        </div>
        <p>${escapeHtml(map.details)}</p>
        ${attribution(map)}
      </section>

      <section class="map-detail-grid">
        <article>
          <h2>進入／採集條件</h2>
          <p>${escapeHtml(map.requirements)}</p>
        </article>
        <article>
          <h2>關聯生活技能</h2>
          <div class="map-tag-list">
            ${lifeSkills.map(id => `<a href="#/life">${escapeHtml(lifeSkillLabels[id] || id)}</a>`).join('')}
          </div>
        </article>
        <article>
          <h2>目前記錄的採集物</h2>
          <div class="map-tag-list">
            ${items.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
          </div>
        </article>
      </section>

      <section class="map-spots" aria-label="採集點">
        <div class="section-heading">
          <h2 class="section-title">採集點與注意事項</h2>
          <span class="section-note">${map.gatheringSpots.length} 筆</span>
        </div>
        ${map.gatheringSpots.map(spot => `
          <article class="map-spot-row">
            <div>
              <strong>${escapeHtml(spot.label)}</strong>
              <p>${escapeHtml(spot.note)}</p>
            </div>
            <div class="map-tag-list map-tag-list--compact">
              ${spot.items.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
            </div>
          </article>
        `).join('')}
      </section>

      <section class="map-aliases">
        <h2>搜尋別名</h2>
        <div class="map-tag-list">${map.aliases.map(alias => `<span>${escapeHtml(alias)}</span>`).join('')}</div>
      </section>

      <div class="map-detail-actions">
        <a class="secondary-button" href="#/maps">返回地圖與採集</a>
        <a class="primary-button" href="#/search">到快速查詢</a>
      </div>
    `;
  }

  function renderUnknownMap(requestedId) {
    prepareMapPage('地圖詳情');
    workspace.innerHTML = `
      ${pageHead('地圖詳情 route', '這筆地圖資料尚未收錄', '已保留可分享網址，但目前沒有核准的台版地圖或採集點可顯示。', `請求 ID：${requestedId || '未提供'}`)}
      <section class="content-module-empty content-module-empty--detail">
        <div class="content-module-route-id"><span>請求 ID</span><code>${escapeHtml(requestedId || '(empty)')}</code></div>
        <h2>不以其他版本位置代替台版資料</h2>
        <p>待台版地圖名稱、點位與採集關聯核對完成後，這個 route 才會公開正式內容。</p>
        <a class="primary-button content-module-back" href="#/maps">返回地圖與採集</a>
      </section>
    `;
  }

  function renderMapRoute(route) {
    if (route !== 'maps' && !route.startsWith('map/')) return false;
    if (!mapState.loaded) {
      renderMapLoading();
      return true;
    }
    if (mapState.error) {
      renderMapError();
      return true;
    }
    if (route === 'maps') {
      renderMapList();
      return true;
    }

    const requestedId = route.slice('map/'.length).trim();
    const map = mapState.maps.find(item => item.id === requestedId);
    if (map) renderMapDetail(map);
    else renderUnknownMap(requestedId);
    return true;
  }

  buildSearchItems = function mapEnhancedBuildSearchItems() {
    const baseItems = baseBuildSearchItems();
    if (!mapState.loaded || mapState.error) return baseItems;
    const mapItems = mapState.maps.map(map => ({
      type: 'map',
      title: map.name,
      description: map.summary,
      route: map.route,
      keywords: [
        map.name,
        map.category,
        map.details,
        map.requirements,
        ...map.aliases,
        ...map.gatheringSpots.flatMap(spot => [
          spot.label,
          spot.note,
          ...spot.items,
          ...spot.lifeSkillIds.map(id => lifeSkillLabels[id] || id)
        ])
      ].join(' '),
      status: map.status,
      statusLabel: map.statusLabel
    }));
    return [...baseItems, ...mapItems];
  };

  function enhancedRenderRoute() {
    const route = getRoute();
    if (renderMapRoute(route)) {
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
      mapState.maps = data.maps || [];
      mapState.loaded = true;
      const route = getRoute();
      if (route === 'maps' || route.startsWith('map/') || (state.site && route === 'search')) enhancedRenderRoute();
      return mapState.maps;
    })
    .catch(error => {
      console.error(error);
      mapState.loaded = true;
      mapState.error = error;
      const route = getRoute();
      if (route === 'maps' || route.startsWith('map/')) enhancedRenderRoute();
      return [];
    });

  window.FanatioMapData = {
    ready,
    get loaded() { return mapState.loaded; },
    get maps() { return [...mapState.maps]; },
    patch: enhancedRenderRoute
  };
})();
