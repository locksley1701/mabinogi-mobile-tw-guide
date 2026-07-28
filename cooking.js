const cookingLevelOrder = ['Lv.1', 'Lv.3', 'Lv.5', 'Lv.10', 'Lv.15'];

function renderCookingEffectList(item) {
  if (!item.effects?.length) {
    return '<p class="cooking-card__empty-effect">此項目是料理材料，沒有可直接食用的能力效果。</p>';
  }

  return `
    <div class="cooking-effect-list" aria-label="${escapeHtml(item.dish)}的食用效果">
      ${item.effects.map(effect => `<span>${escapeHtml(effect)}</span>`).join('')}
    </div>
  `;
}

function renderCookingMeta(item) {
  const rows = [
    ['解鎖等級', item.unlock],
    ['稀有度', item.rarity],
    ['分類', item.itemType],
    ['重量', item.weight],
    ['販售價', item.salePrice === null ? '無法販售' : `${item.salePrice} 金幣`]
  ];

  return `
    <dl class="cooking-card__meta">
      ${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}
    </dl>
  `;
}

function renderCookingCard(item) {
  const heading = item.itemType === '材料' ? '材料用途' : '食用效果';
  const descriptionHeading = item.itemType === '材料' ? '材料介紹' : '料理介紹';

  return `
    <article class="cooking-card cooking-card--${escapeHtml(item.rarityKey)}">
      <div class="cooking-card__head">
        <div>
          <p class="cooking-card__kicker">${escapeHtml(item.rarity)}・${escapeHtml(item.itemType)}</p>
          <h2>${escapeHtml(item.dish)}</h2>
        </div>
        ${badge(item)}
      </div>

      <section class="cooking-card__section">
        <div class="cooking-card__section-head">
          <h3>${heading}</h3>
          ${item.duration ? `<span>持續 ${escapeHtml(item.duration)}</span>` : ''}
        </div>
        ${renderCookingEffectList(item)}
        ${item.specialEffect ? `<p class="cooking-party-effect"><strong>營火分食效果</strong>${escapeHtml(item.specialEffect)}</p>` : ''}
      </section>

      <section class="cooking-card__section cooking-card__description">
        <h3>${descriptionHeading}</h3>
        <p>${escapeHtml(item.description)}</p>
      </section>

      ${item.sharedEffect ? `
        <details class="cooking-shared-effect">
          <summary>查看所有食物共通效果</summary>
          <p>${escapeHtml(item.sharedEffect)}</p>
        </details>
      ` : ''}

      ${renderCookingMeta(item)}
      <span class="attribution">✦ 台版實機確認：${escapeHtml(item.contributor)}</span>
    </article>
  `;
}

renderCooking = function renderCookingPage() {
  const levels = ['全部', ...cookingLevelOrder.filter(level => state.cooking.some(item => item.levelKey === level))];
  if (!levels.includes(state.selectedCookingLevel)) state.selectedCookingLevel = '全部';

  const visible = state.selectedCookingLevel === '全部'
    ? state.cooking
    : state.cooking.filter(item => item.levelKey === state.selectedCookingLevel);

  workspace.innerHTML = `
    ${pageHead(
      '台版實機圖鑑',
      '料理手札',
      '依台版遊戲截圖逐道收錄料理效果、持續時間與原文介紹。料理練等效率仍待實測，這一頁不把候選推測混進正式效果。',
      '台版實機確認：法那提歐'
    )}
    <aside class="cooking-notice">
      <strong>本次先收錄文字資料</strong>
      <p>官方圖標尚在另一條工作線整理，因此目前不使用替代圖示；待正式素材完成後再接入。</p>
    </aside>
    <section class="cooking-layout">
      <nav class="level-nav" aria-label="料理解鎖等級">
        ${levels.map(level => `
          <button class="${state.selectedCookingLevel === level ? 'is-active' : ''}" type="button" data-cooking-level="${escapeHtml(level)}">
            <span>${escapeHtml(level)}</span>
            <small>${level === '全部' ? state.cooking.length : state.cooking.filter(item => item.levelKey === level).length} 筆</small>
          </button>
        `).join('')}
      </nav>
      <div>
        <div class="cooking-grid">
          ${visible.map(renderCookingCard).join('')}
        </div>
        <p class="cooking-data-note">練等 CP、單次料理經驗與材料成本尚未由台版實測完成，因此本頁暫不排列「最推薦料理」。</p>
      </div>
    </section>
  `;

  workspace.querySelectorAll('[data-cooking-level]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedCookingLevel = button.dataset.cookingLevel;
      renderCooking();
    });
  });
};

const renderHomeBeforeCookingExpansion = renderHome;
renderHome = function renderHomeWithCookingCount() {
  renderHomeBeforeCookingExpansion();
  const metricLabels = workspace.querySelectorAll('.metric span');
  if (metricLabels[1]) metricLabels[1].textContent = '台版料理資料';
  const cookingPortalCopy = workspace.querySelector('.portal-card[href="#/cooking"] small');
  if (cookingPortalCopy) cookingPortalCopy.textContent = '依解鎖等級查詢效果與料理介紹';
};
