(() => {
  const workspaceRoot = document.querySelector('#workspace');
  if (!workspaceRoot) return;

  const STORAGE_KEY = 'fanatio-contribution-context-v1';
  const allowedCategories = new Set(['職業／技能', '裝備', '任務', '活動']);
  const allowedSourceRoute = /^(?:equipment(?:\/[^?#\s]+)?|quests|quest\/[^?#\s]+|events|event\/[^?#\s]+|professions)$/;
  const moduleContexts = [
    { match: route => route === 'equipment' || route.startsWith('equipment/'), key: 'equipment', label: '裝備', category: '裝備' },
    { match: route => route === 'quests' || route.startsWith('quest/'), key: 'quests', label: '任務', category: '任務' },
    { match: route => route === 'events' || route.startsWith('event/'), key: 'events', label: '活動', category: '活動' }
  ];

  function currentRoute() {
    return location.hash.replace(/^#\/?/, '') || 'home';
  }

  function escapeAttribute(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function detailItem(route = '') {
    if (!route.includes('/')) return '';
    const raw = route.split('/').slice(1).join('/');
    try {
      return decodeURIComponent(raw).slice(0, 120);
    } catch {
      return raw.slice(0, 120);
    }
  }

  function contextAttributes({ category, label, route, item = '', itemKind = '' }) {
    return [
      'data-contribution-context-link',
      `data-contribution-category="${escapeAttribute(category)}"`,
      `data-contribution-label="${escapeAttribute(label)}"`,
      `data-contribution-route="${escapeAttribute(route)}"`,
      item ? `data-contribution-item="${escapeAttribute(item)}"` : '',
      itemKind ? `data-contribution-item-kind="${escapeAttribute(itemKind)}"` : ''
    ].filter(Boolean).join(' ');
  }

  function guidanceMarkup(context) {
    const titleId = `contribution-guidance-${context.key}-title`;
    const item = detailItem(context.route);
    const attributes = contextAttributes({
      category: context.category,
      label: context.label,
      route: context.route,
      item,
      itemKind: item ? 'query-code' : ''
    });
    return `
      <section class="contribution-guidance" data-contribution-guidance data-guidance-context="${context.key}" aria-labelledby="${titleId}">
        <div class="contribution-guidance__copy">
          <p class="eyebrow">協助補完台版手札</p>
          <h2 id="${titleId}">你有可核對的台版${context.label}情報嗎？</h2>
          <p>投稿不會立即公開，會先由法那提歐核對，再把核准內容整理進入手札。</p>
          <small>請勿提交真實姓名、電話、地址或其他不必要的私人資訊。</small>
        </div>
        <a class="primary-button contribution-guidance__link" href="#/contribute" ${attributes}>提供台版情報</a>
      </section>
    `;
  }

  function saveContext(link) {
    const category = String(link.dataset.contributionCategory || '').trim();
    const contextLabel = String(link.dataset.contributionLabel || '').trim().slice(0, 40);
    const sourceRoute = String(link.dataset.contributionRoute || '').trim();
    const item = String(link.dataset.contributionItem || '').trim().slice(0, 120);
    const itemKind = String(link.dataset.contributionItemKind || '').trim();

    if (!allowedCategories.has(category) || !contextLabel || !allowedSourceRoute.test(sourceRoute)) return;
    if (itemKind && !['query-code', 'name'].includes(itemKind)) return;

    const payload = {
      version: 1,
      category,
      contextLabel,
      sourceRoute,
      item,
      itemKind,
      savedAt: Date.now()
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 無法使用 sessionStorage 時仍可進入通用投稿頁。
    }
  }

  function appendModuleGuidance(route) {
    const baseContext = moduleContexts.find(item => item.match(route));
    if (!baseContext) return;
    const emptyState = workspaceRoot.querySelector('.content-module-empty');
    if (!emptyState || emptyState.querySelector('[data-contribution-guidance]')) return;
    emptyState.insertAdjacentHTML('beforeend', guidanceMarkup({ ...baseContext, route }));
  }

  function enhanceProfessionEntries(route) {
    if (route !== 'professions') return;

    workspaceRoot.querySelectorAll('.profession-card[aria-disabled="true"]').forEach(link => {
      const replacement = link.cloneNode(true);
      const name = replacement.querySelector('strong')?.textContent?.trim() || '職業';
      const status = replacement.querySelector('small');
      replacement.href = '#/contribute';
      replacement.removeAttribute('aria-disabled');
      replacement.classList.add('is-contribution-entry');
      replacement.setAttribute('aria-label', `提供${name}台版職業技能情報`);
      replacement.setAttribute('data-contribution-context-link', '');
      replacement.dataset.contributionCategory = '職業／技能';
      replacement.dataset.contributionLabel = '職業技能';
      replacement.dataset.contributionRoute = 'professions';
      replacement.dataset.contributionItem = name.slice(0, 120);
      replacement.dataset.contributionItemKind = 'name';
      if (status) status.textContent = '詳細資料待收錄・提供情報';
      link.replaceWith(replacement);
    });

    const grid = workspaceRoot.querySelector('.profession-grid');
    if (!grid || workspaceRoot.querySelector('[data-guidance-context="professions"]')) return;
    grid.insertAdjacentHTML('afterend', guidanceMarkup({
      key: 'professions',
      label: '職業技能',
      category: '職業／技能',
      route: 'professions'
    }));
  }

  function augment() {
    const route = currentRoute();
    appendModuleGuidance(route);
    enhanceProfessionEntries(route);
  }

  workspaceRoot.addEventListener('click', event => {
    const link = event.target.closest('[data-contribution-context-link]');
    if (!link || !workspaceRoot.contains(link)) return;
    saveContext(link);
  });

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      augment();
    });
  });

  observer.observe(workspaceRoot, { childList: true, subtree: true });
  augment();

  window.FanatioContributionGuidance = { augment };
})();
