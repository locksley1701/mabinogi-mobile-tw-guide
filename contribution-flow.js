(() => {
  const CONTRIBUTION_DATA = 'data/contribution.json';
  const SITE_DATA = 'data/site.json';
  const CONTEXT_STORAGE_KEY = 'fanatio-contribution-context-v1';
  const CONTEXT_MAX_AGE = 2 * 60 * 60 * 1000;
  const ALLOWED_SOURCE_ROUTE = /^(?:equipment(?:\/[^?#\s]+)?|quests|quest\/[^?#\s]+|events|event\/[^?#\s]+|professions)$/;
  let dataPromise;

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function currentRoute() {
    return location.hash.replace(/^#\/?/, '') || 'home';
  }

  function isPublicFormUrl(value = '') {
    if (!value) return false;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return false;
      if (url.hostname === 'forms.gle') return true;
      return url.hostname === 'docs.google.com'
        && /^\/forms\/d\/e\/[^/]+\/viewform\/?$/.test(url.pathname);
    } catch {
      return false;
    }
  }

  async function loadData() {
    if (!dataPromise) {
      dataPromise = Promise.all([
        fetch(CONTRIBUTION_DATA).then(response => {
          if (!response.ok) throw new Error(`contribution data: ${response.status}`);
          return response.json();
        }),
        fetch(SITE_DATA).then(response => {
          if (!response.ok) throw new Error(`site data: ${response.status}`);
          return response.json();
        })
      ]);
    }
    return dataPromise;
  }

  function clearContext() {
    try {
      sessionStorage.removeItem(CONTEXT_STORAGE_KEY);
    } catch {
      // 無法使用 sessionStorage 時不影響通用投稿流程。
    }
  }

  function loadContext(config) {
    try {
      const raw = sessionStorage.getItem(CONTEXT_STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      const savedAt = Number(value.savedAt);
      const category = String(value.category || '').trim();
      const contextLabel = String(value.contextLabel || '').trim();
      const sourceRoute = String(value.sourceRoute || '').trim();
      const item = String(value.item || '').trim();
      const itemKind = String(value.itemKind || '').trim();

      const valid = value.version === 1
        && Number.isFinite(savedAt)
        && Date.now() - savedAt >= 0
        && Date.now() - savedAt <= CONTEXT_MAX_AGE
        && Array.isArray(config.categories)
        && config.categories.includes(category)
        && contextLabel.length > 0
        && contextLabel.length <= 40
        && ALLOWED_SOURCE_ROUTE.test(sourceRoute)
        && item.length <= 120
        && (!itemKind || ['query-code', 'name'].includes(itemKind));

      if (!valid) {
        clearContext();
        return null;
      }

      return { category, contextLabel, sourceRoute, item, itemKind };
    } catch {
      clearContext();
      return null;
    }
  }

  function workflowMarkup(items) {
    return items.map((item, index) => `
      <li class="contribution-step">
        <span class="contribution-step__number" aria-hidden="true">${index + 1}</span>
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.copy)}</p></div>
      </li>
    `).join('');
  }

  function listMarkup(items, className = '') {
    return items.map(item => `<li class="${className}">${escapeHtml(item)}</li>`).join('');
  }

  function buildFormActionUrl(candidateUrl, config, context) {
    const prefill = config.formPrefill || {};
    const fieldPattern = /^entry\.\d+$/;
    const categoryEntry = String(prefill.categoryEntryId || '');
    const nameEntry = String(prefill.nameEntryId || '');
    const categoryValue = prefill.categoryValues?.[context?.category];

    if (!context
      || prefill.enabled !== true
      || prefill.verified !== true
      || !fieldPattern.test(categoryEntry)
      || !categoryValue) {
      return { url: candidateUrl, applied: false };
    }

    try {
      const url = new URL(candidateUrl);
      url.searchParams.set('usp', 'pp_url');
      url.searchParams.set(categoryEntry, categoryValue);
      if (context.itemKind === 'name' && context.item && fieldPattern.test(nameEntry)) {
        url.searchParams.set(nameEntry, context.item);
      }
      return { url: url.toString(), applied: true };
    } catch {
      return { url: candidateUrl, applied: false };
    }
  }

  function contextMarkup(context) {
    if (!context) return '';
    const itemLine = context.item
      ? `<p><strong>${context.itemKind === 'query-code' ? '查詢代碼' : '項目'}：</strong>${escapeHtml(context.item)}</p>`
      : '<p>本次由分類總覽進入，可在表單中補充正式名稱。</p>';

    return `
      <section class="contribution-context" data-contribution-context-summary aria-labelledby="contribution-context-title">
        <div class="contribution-context__copy">
          <p class="eyebrow">本次投稿來源</p>
          <h2 id="contribution-context-title">正在補充：${escapeHtml(context.contextLabel)}</h2>
          <span class="contribution-context__category">${escapeHtml(context.category)}</span>
          ${itemLine}
          <small>只保存這個公開頁面的分類與查詢資訊；不會保存姓名、帳號、聯絡方式或表單回覆。</small>
        </div>
        <div class="contribution-context__actions">
          <a class="secondary-button" href="#/${escapeHtml(context.sourceRoute)}">返回原頁</a>
          <button class="secondary-button" type="button" data-clear-contribution-context>改為一般投稿</button>
        </div>
      </section>
    `;
  }

  function render(config, site) {
    const workspace = document.querySelector('#workspace');
    if (!workspace || currentRoute() !== 'contribute') return;

    const context = loadContext(config);
    const candidateUrl = String(config.formUrl || site.submissionFormUrl || '').trim();
    const formReady = config.formStatus === 'open' && isPublicFormUrl(candidateUrl);
    const formTarget = formReady ? buildFormActionUrl(candidateUrl, config, context) : { url: '', applied: false };
    const formAction = formReady
      ? `<a class="primary-button contribution-submit" href="${escapeHtml(formTarget.url)}" target="_blank" rel="noopener noreferrer" data-form-prefill="${formTarget.applied ? 'on' : 'off'}">開啟情報投稿表單</a>`
      : `<button class="primary-button contribution-submit" type="button" disabled aria-disabled="true">${escapeHtml(config.formStatusLabel)}</button>`;

    workspace.innerHTML = `
      <div data-contribution-flow>
        <header class="page-head contribution-head">
          <div class="page-head__copy">
            <p class="eyebrow">愛爾琳情報櫃台</p>
            <h1>提供台版情報</h1>
            <p>歡迎提供職業、生活技能、料理、裝備、地圖、任務、活動與名稱更正。投稿不會立即公開，會先進入私人審核，再由法那提歐核對與整理。</p>
          </div>
          <div class="page-meta">${escapeHtml(config.formStatusLabel)}</div>
        </header>

        ${contextMarkup(context)}

        <section class="contribution-status" aria-labelledby="contribution-status-title">
          <div>
            <p class="eyebrow">目前狀態</p>
            <h2 id="contribution-status-title">${escapeHtml(config.formStatusLabel)}</h2>
            <p>${formReady
              ? '表單會在新分頁開啟。請先閱讀下方隱私與署名規則。'
              : '公開填寫網址尚未接入。欄位、私人審核台帳與安全規則已建立；在正式表單完成前不會提供假投稿入口。'}</p>
          </div>
          <div class="contribution-actions">
            ${formAction}
            <a class="secondary-button" href="#/updates">查看增補紀錄</a>
          </div>
        </section>

        <section class="section-block" aria-labelledby="contribution-workflow-title">
          <div class="section-heading">
            <h2 class="section-title" id="contribution-workflow-title">投稿如何處理</h2>
            <span class="section-note">原始回覆不會自動公開</span>
          </div>
          <ol class="contribution-workflow">${workflowMarkup(config.workflow)}</ol>
        </section>

        <section class="contribution-grid">
          <article class="contribution-card">
            <p class="eyebrow">可投稿內容</p>
            <h2>目前接受的分類</h2>
            <ul class="contribution-category-list">${listMarkup(config.categories, 'contribution-category')}</ul>
          </article>

          <article class="contribution-card">
            <p class="eyebrow">公開署名</p>
            <h2>由投稿者選擇</h2>
            <p>核准發布後只顯示下列其中一種方式；未提供有效署名時使用「匿名玩家」。</p>
            <ul class="rule-list">${listMarkup(config.signatureModes)}</ul>
          </article>
        </section>

        <section class="contribution-privacy" aria-labelledby="contribution-privacy-title">
          <div>
            <p class="eyebrow">隱私與安全</p>
            <h2 id="contribution-privacy-title">只提交核對遊戲資料所需內容</h2>
          </div>
          <ul class="rule-list">${listMarkup(config.privacyRules)}</ul>
        </section>

        <section class="section-block" aria-labelledby="contribution-review-title">
          <div class="section-heading">
            <h2 class="section-title" id="contribution-review-title">審核狀態</h2>
            <span class="section-note">只有整理後資料能進入網站</span>
          </div>
          <div class="contribution-status-list">
            ${config.reviewStatuses.map(status => `<span>${escapeHtml(status)}</span>`).join('')}
          </div>
          <p class="contribution-withdrawal"><strong>撤回：</strong>正式表單開放後，請保存投稿編號。未發布內容會停止使用；已發布內容會建立可追溯的更新或移除紀錄。</p>
        </section>
      </div>
    `;

    workspace.querySelector('[data-clear-contribution-context]')?.addEventListener('click', () => {
      clearContext();
      render(config, site);
    });
  }

  async function enhanceContributionRoute() {
    const workspace = document.querySelector('#workspace');
    if (!workspace || currentRoute() !== 'contribute') return;
    if (workspace.querySelector('[data-contribution-flow]')) return;
    try {
      const [config, site] = await loadData();
      if (currentRoute() === 'contribute') render(config, site);
    } catch (error) {
      console.error('Contribution flow failed to load.', error);
    }
  }

  function scheduleEnhancement() {
    queueMicrotask(enhanceContributionRoute);
  }

  window.addEventListener('hashchange', () => {
    if (currentRoute() !== 'contribute') clearContext();
    scheduleEnhancement();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const workspace = document.querySelector('#workspace');
    if (workspace) {
      new MutationObserver(() => {
        if (currentRoute() === 'contribute' && !workspace.querySelector('[data-contribution-flow]')) {
          scheduleEnhancement();
        }
      }).observe(workspace, { childList: true });
    }
    scheduleEnhancement();
  });
})();
