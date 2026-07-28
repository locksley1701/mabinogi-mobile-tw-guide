const buildSearchItemsBeforeNameNormalization = buildSearchItems;

normalize = SearchNormalization.normalizeSearch;

function createLifeCategorySearchItems() {
  const guideCountBySkill = new Map();
  state.lifeGuides.forEach(guide => {
    guideCountBySkill.set(guide.skillId, (guideCountBySkill.get(guide.skillId) || 0) + 1);
  });

  return state.lifeCategories.map(category => ({
    type: 'life',
    entityId: category.id,
    canonicalName: category.name,
    title: category.name,
    description: category.description,
    route: 'life',
    keywords: `${category.name} ${category.group} ${guideCountBySkill.get(category.id) || 0} 筆攻略`,
    status: 'tw-confirmed',
    statusLabel: '台版遊戲資料'
  }));
}

function addStableSearchIdentity(item) {
  if (item.type === 'life') {
    const guide = state.lifeGuides.find(candidate => item.title.startsWith(`${candidate.skill}｜Lv.${candidate.level}`));
    if (guide) return {...item, entityId: guide.skillId, canonicalName: guide.skill};
    const category = state.lifeCategories.find(candidate => candidate.name === item.title);
    if (category) return {...item, entityId: category.id, canonicalName: category.name};
  }

  if (item.type === 'cooking') {
    const cooking = state.cooking.find(candidate => candidate.dish === item.title);
    if (cooking) return {...item, entityId: cooking.id, canonicalName: cooking.dish};
  }

  if (item.type === 'afk') {
    const tip = state.afk.find(candidate => `${candidate.target}任務` === item.title);
    if (tip) return {...item, entityId: tip.id || tip.target, canonicalName: tip.target};
  }

  if (item.type === 'profession') {
    const profession = state.professions.find(candidate => candidate.name === item.title);
    if (profession) return {...item, entityId: profession.id, canonicalName: profession.name};
  }

  if (item.type === 'combatSkill') {
    const professionId = item.route.startsWith('profession/') ? item.route.split('/')[1] : '';
    return {...item, entityId: `${professionId}:${item.title}`, canonicalName: item.title};
  }

  return {...item, entityId: item.title, canonicalName: item.title};
}

buildSearchItems = function buildSearchItemsWithNameNormalization() {
  const aliasDefinitions = state.aliases;
  let baseItems = [];

  try {
    // 舊版搜尋會把別名複製成新項目，再於去重時丟棄；暫時清空別名，
    // 只取回正式搜尋項目，後續再依穩定 ID 正確附加。
    state.aliases = [];
    baseItems = buildSearchItemsBeforeNameNormalization().map(addStableSearchIdentity);
  } finally {
    state.aliases = aliasDefinitions;
  }

  const categories = createLifeCategorySearchItems();
  const combined = [...categories, ...baseItems];
  const enriched = SearchNormalization.enrichSearchItems(combined, aliasDefinitions);
  const seen = new Set();

  return enriched.filter(item => {
    const key = `${item.type}:${item.entityId}:${item.title}:${item.route}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

renderSearchResults = function renderNormalizedSearchResults() {
  const container = workspace.querySelector('#search-results');
  if (!container) return;

  const query = SearchNormalization.normalizeSearch(state.searchQuery);
  const items = buildSearchItems()
    .map(item => ({
      ...item,
      matchedAlias: SearchNormalization.findMatchedAlias(item, query)
    }))
    .filter(item => {
      const categoryMatch = state.searchCategory === '全部' || item.type === state.searchCategory;
      return categoryMatch && SearchNormalization.searchItemMatches(item, query);
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
      <h2>${escapeHtml(label)} <small>(${group.length})</small></h2>
      <div class="result-list">
        ${group.slice(0, 18).map(item => `
          <article class="result-row">
            <div class="result-row__title">
              <strong>${escapeHtml(item.title)}</strong>
              ${item.matchedAlias ? `<small class="search-alias-note">由${escapeHtml(SearchNormalization.aliasKindLabel(item.matchedAlias.kind))}「${escapeHtml(item.matchedAlias.name)}」找到</small>` : ''}
            </div>
            <p>${escapeHtml(item.description)}</p>
            <a href="#/${escapeHtml(item.route)}">開啟章節</a>
          </article>
        `).join('')}
      </div>
    </section>
  `).join('');
};
