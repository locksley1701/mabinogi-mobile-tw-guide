(() => {
  const workspaceRoot = document.querySelector('#workspace');
  if (!workspaceRoot) return;

  const moduleContexts = [
    { match: route => route === 'equipment' || route.startsWith('equipment/'), key: 'equipment', label: '裝備' },
    { match: route => route === 'quests' || route.startsWith('quest/'), key: 'quests', label: '任務' },
    { match: route => route === 'events' || route.startsWith('event/'), key: 'events', label: '活動' }
  ];

  function currentRoute() {
    return location.hash.replace(/^#\/?/, '') || 'home';
  }

  function guidanceMarkup(key, label) {
    const titleId = `contribution-guidance-${key}-title`;
    return `
      <section class="contribution-guidance" data-contribution-guidance data-guidance-context="${key}" aria-labelledby="${titleId}">
        <div class="contribution-guidance__copy">
          <p class="eyebrow">協助補完台版手札</p>
          <h2 id="${titleId}">你有可核對的台版${label}情報嗎？</h2>
          <p>投稿不會立即公開，會先由法那提歐核對，再把核准內容整理進入手札。</p>
          <small>請勿提交真實姓名、電話、地址或其他不必要的私人資訊。</small>
        </div>
        <a class="primary-button contribution-guidance__link" href="#/contribute">提供台版情報</a>
      </section>
    `;
  }

  function appendModuleGuidance(route) {
    const context = moduleContexts.find(item => item.match(route));
    if (!context) return;
    const emptyState = workspaceRoot.querySelector('.content-module-empty');
    if (!emptyState || emptyState.querySelector('[data-contribution-guidance]')) return;
    emptyState.insertAdjacentHTML('beforeend', guidanceMarkup(context.key, context.label));
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
      if (status) status.textContent = '詳細資料待收錄・提供情報';
      link.replaceWith(replacement);
    });

    const grid = workspaceRoot.querySelector('.profession-grid');
    if (!grid || workspaceRoot.querySelector('[data-guidance-context="professions"]')) return;
    grid.insertAdjacentHTML('afterend', guidanceMarkup('professions', '職業技能'));
  }

  function augment() {
    const route = currentRoute();
    appendModuleGuidance(route);
    enhanceProfessionEntries(route);
  }

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
