(function setupGameGuidedTour() {
  'use strict';

  if (window.FanatioGuidedTour?.initialized || document.querySelector('#game-guided-tour')) return;

  const VERSION = '1';
  const STORAGE_VERSION = 'fanatio-guide-tour-version';
  const STORAGE_STATUS = 'fanatio-guide-tour-status';
  const LEGACY_STORAGE_STATUS = 'fanatio-tour-v2';
  const totalSteps = 6;
  const mobileQuery = matchMedia('(max-width: 959px)');
  const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let currentIndex = 0;
  let active = false;
  let target = null;
  let returnFocus = null;
  let guardPaused = false;
  let sessionGeneration = 0;
  let automaticStartTimer = 0;
  let startRetryTimer = 0;
  let missingTimer = 0;
  let positionFrame = 0;
  let stepFrame = 0;
  let focusFrame = 0;
  let guardFrame = 0;
  let actionAdvanceTimer = 0;
  let hashPositionTimer = 0;
  let viewportTimer = 0;
  let viewportScrollPending = false;
  let viewportAttempts = 0;
  let tourOpenedQuickSearch = false;
  let tourOpenedDrawer = false;

  const shell = document.createElement('section');
  shell.id = 'game-guided-tour';
  shell.className = 'game-guided-tour';
  shell.hidden = true;
  shell.innerHTML = `
    <div class="game-guided-tour__shade" aria-hidden="true"></div>
    <div class="game-guided-tour__spotlight" aria-hidden="true"></div>
    <div class="game-guided-tour__arrow" aria-hidden="true">➜</div>
    <section class="game-guided-tour__card" role="dialog" aria-labelledby="game-guided-tour-title" aria-describedby="game-guided-tour-copy" aria-live="polite">
      <p class="game-guided-tour__progress" id="game-guided-tour-progress">導覽任務 1／6</p>
      <p class="eyebrow">法那提歐的導覽任務</p>
      <h2 id="game-guided-tour-title"></h2>
      <p id="game-guided-tour-copy"></p>
      <p class="game-guided-tour__fallback" hidden>目前頁面的目標暫時無法定位；可按下一步繼續導覽。</p>
      <div class="game-guided-tour__actions">
        <button class="text-button" type="button" data-tour-action="skip">略過</button>
        <div>
          <button class="secondary-button" type="button" data-tour-action="previous">上一步</button>
          <button class="primary-button" type="button" data-tour-action="next">下一步</button>
        </div>
      </div>
    </section>
  `;
  document.body.append(shell);

  const card = shell.querySelector('.game-guided-tour__card');
  const title = shell.querySelector('#game-guided-tour-title');
  const copy = shell.querySelector('#game-guided-tour-copy');
  const progress = shell.querySelector('#game-guided-tour-progress');
  const spotlight = shell.querySelector('.game-guided-tour__spotlight');
  const arrow = shell.querySelector('.game-guided-tour__arrow');
  const fallback = shell.querySelector('.game-guided-tour__fallback');
  const previousButton = shell.querySelector('[data-tour-action="previous"]');
  const nextButton = shell.querySelector('[data-tour-action="next"]');

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch { return false; }
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    for (let current = element; current instanceof HTMLElement; current = current.parentElement) {
      if (current.hidden || current.inert || current.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    const rect = element.getBoundingClientRect();
    return element.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
  }

  function isInViewport(element) {
    if (!isVisible(element)) return false;
    const rect = element.getBoundingClientRect();
    return rect.top >= 4 && rect.left >= 4 && rect.bottom <= window.innerHeight - 4 && rect.right <= window.innerWidth - 4;
  }

  function currentRoute() {
    return location.hash.replace(/^#\/?/, '') || 'home';
  }

  function withoutGuard(callback) {
    guardPaused = true;
    const generation = sessionGeneration;
    try { callback(); } finally {
      cancelAnimationFrame(guardFrame);
      guardFrame = requestAnimationFrame(() => {
        if (generation === sessionGeneration) guardPaused = false;
      });
    }
  }

  function cancelPendingSessionWork({cancelAutomatic = false} = {}) {
    sessionGeneration += 1;
    clearTimeout(startRetryTimer);
    clearTimeout(missingTimer);
    clearTimeout(viewportTimer);
    clearTimeout(actionAdvanceTimer);
    clearTimeout(hashPositionTimer);
    if (cancelAutomatic) clearTimeout(automaticStartTimer);
    cancelAnimationFrame(positionFrame);
    cancelAnimationFrame(stepFrame);
    cancelAnimationFrame(focusFrame);
    cancelAnimationFrame(guardFrame);
    startRetryTimer = 0;
    missingTimer = 0;
    viewportTimer = 0;
    actionAdvanceTimer = 0;
    hashPositionTimer = 0;
    if (cancelAutomatic) automaticStartTimer = 0;
    guardPaused = false;
    viewportScrollPending = false;
    return sessionGeneration;
  }

  function automaticStartIsSuppressed() {
    const completed = safeStorageGet(STORAGE_VERSION) === VERSION && ['completed', 'skipped'].includes(safeStorageGet(STORAGE_STATUS));
    return completed || safeStorageGet(LEGACY_STORAGE_STATUS) === 'done';
  }

  function closeQuickSearch({force = false} = {}) {
    const panel = document.querySelector('#quick-search-panel');
    if (panel && !panel.hidden && (force || tourOpenedQuickSearch)) {
      withoutGuard(() => panel.querySelector('.quick-search-close')?.click());
    }
    tourOpenedQuickSearch = false;
  }

  function openQuickSearch() {
    const panel = document.querySelector('#quick-search-panel');
    if (panel?.hidden) {
      tourOpenedQuickSearch = true;
      withoutGuard(() => document.querySelector('#top-search-button')?.click());
    }
  }

  function closeTourDrawer() {
    if (!tourOpenedDrawer) return;
    withoutGuard(() => window.FanatioNavigation?.closeDrawer());
    tourOpenedDrawer = false;
  }

  function openTourDrawer() {
    if (!mobileQuery.matches || document.body.classList.contains('drawer-open')) return;
    tourOpenedDrawer = true;
    withoutGuard(() => window.FanatioNavigation?.openDrawer());
  }

  function navigate(route) {
    if (currentRoute() === route) {
      document.dispatchEvent(new CustomEvent('fanatio:route-rendered', {detail: {route}}));
      return;
    }
    location.hash = `#/${route}`;
  }

  const steps = [
    {
      title: '先從全站搜尋開始',
      copy: '可搜尋正式名稱、隱藏別名、技能、地圖或材料。直接在這裡輸入，或按下一步繼續。',
      target: () => document.querySelector('#quick-search-input'),
      prepare() { closeQuickSearch({force: true}); openQuickSearch(); },
      leave() { closeQuickSearch(); }
    },
    {
      title: '由章節地圖前往各處',
      copy: '生活技能、料理、職業、地圖與其他章節都能從這裡前往。手機會先打開安全的章節抽屜。',
      target: () => document.querySelector('.nav-link[data-route="life"]'),
      prepare() {
        closeQuickSearch();
        openTourDrawer();
      },
      leave() { closeTourDrawer(); }
    },
    {
      title: '用分類留下需要的資料',
      copy: '切換一次生活技能分類，只留下目前適合查閱的內容；完成切換會自動往下，也可手動下一步。',
      target: () => document.querySelector('[data-life-group="採集"]'),
      prepare() {
        closeTourDrawer();
        navigate('life');
      },
      advanceOnAction: '[data-life-group="採集"]'
    },
    {
      title: '列表先比較，詳情再深讀',
      copy: '這是已確認的台版生活技能項目。列表方便比較，右側詳情保留完整資料；目前網址也能直接分享給旅伴。',
      target: () => document.querySelector('[data-life-skill="daily-gathering"]')
    },
    {
      title: '把待核對情報交給法那提歐',
      copy: '發現缺漏或名稱有誤時可從這裡投稿。內容會先由法那提歐核對，不會自動公開。',
      target: () => document.querySelector('.contribution-submit, #submission-button'),
      prepare() { navigate('contribute'); }
    },
    {
      title: '導覽任務完成',
      copy: '導覽任務完成，開始翻閱愛爾琳手札吧。日後可從側邊欄的「重新觀看功能導覽」再次開啟。',
      target: () => null,
      complete: true
    }
  ];

  function setCompletionStatus(status) {
    safeStorageSet(STORAGE_VERSION, VERSION);
    safeStorageSet(STORAGE_STATUS, status);
  }

  function emitToast(message) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(emitToast.timer);
    emitToast.timer = setTimeout(() => { toast.hidden = true; }, 3600);
  }

  function resolveTarget() {
    const candidate = steps[currentIndex]?.target?.();
    return isVisible(candidate) ? candidate : null;
  }

  function allowedTarget(element) {
    return target instanceof HTMLElement && (target === element || target.contains(element));
  }

  function visibleTourFocusables() {
    return [...card.querySelectorAll(focusableSelector)].filter(isVisible);
  }

  function focusCardControl() {
    const preferred = currentIndex === 0 ? nextButton : previousButton;
    preferred?.focus({preventScroll: true});
  }

  function showMissingFallback(generation = sessionGeneration) {
    if (!active || generation !== sessionGeneration || target) return;
    fallback.hidden = false;
    shell.classList.add('is-fallback');
  }

  function scheduleMissingFallback(delay, generation = sessionGeneration) {
    clearTimeout(missingTimer);
    missingTimer = setTimeout(() => showMissingFallback(generation), delay);
  }

  function hideIndicators() {
    spotlight.hidden = true;
    arrow.hidden = true;
  }

  function requestViewportTarget(candidate, generation = sessionGeneration) {
    if (viewportScrollPending || viewportAttempts >= 2) return false;
    viewportAttempts += 1;
    viewportScrollPending = true;
    try {
      candidate.scrollIntoView({
        behavior: reducedMotionQuery.matches ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    } catch {
      viewportScrollPending = false;
      return false;
    }
    clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => {
      if (!active || generation !== sessionGeneration) return;
      viewportScrollPending = false;
      positionCard();
    }, reducedMotionQuery.matches ? 0 : 360);
    return true;
  }

  function positionCard() {
    const generation = sessionGeneration;
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      if (!active || generation !== sessionGeneration) return;
      target = resolveTarget();
      fallback.hidden = Boolean(target);
      shell.classList.toggle('is-fallback', !target);

      if (!target) {
        hideIndicators();
        card.style.removeProperty('--tour-card-x');
        card.style.removeProperty('--tour-card-y');
        scheduleMissingFallback(500, generation);
        return;
      }

      if (!isInViewport(target)) {
        target = null;
        hideIndicators();
        card.style.removeProperty('--tour-card-x');
        card.style.removeProperty('--tour-card-y');
        clearTimeout(missingTimer);
        if (requestViewportTarget(resolveTarget(), generation)) return;
        scheduleMissingFallback(0, generation);
        return;
      }

      clearTimeout(missingTimer);
      spotlight.hidden = false;
      arrow.hidden = false;
      const rect = target.getBoundingClientRect();
      const padding = 8;
      spotlight.style.setProperty('--tour-target-x', `${Math.max(4, rect.left - padding)}px`);
      spotlight.style.setProperty('--tour-target-y', `${Math.max(4, rect.top - padding)}px`);
      spotlight.style.setProperty('--tour-target-width', `${Math.min(window.innerWidth - 8, rect.width + padding * 2)}px`);
      spotlight.style.setProperty('--tour-target-height', `${Math.min(window.innerHeight - 8, rect.height + padding * 2)}px`);

      const cardRect = card.getBoundingClientRect();
      const gap = 22;
      const space = {
        bottom: window.innerHeight - rect.bottom,
        top: rect.top,
        right: window.innerWidth - rect.right,
        left: rect.left
      };
      let side = Object.entries(space).sort((a, b) => b[1] - a[1])[0][0];
      if (space[side] < Math.min(180, cardRect.height + gap)) side = 'center';
      let x = rect.left;
      let y = rect.bottom + gap;
      if (side === 'top') { x = rect.left + rect.width / 2 - cardRect.width / 2; y = rect.top - cardRect.height - gap; }
      if (side === 'bottom') { x = rect.left + rect.width / 2 - cardRect.width / 2; y = rect.bottom + gap; }
      if (side === 'left') { x = rect.left - cardRect.width - gap; y = rect.top + rect.height / 2 - cardRect.height / 2; }
      if (side === 'right') { x = rect.right + gap; y = rect.top + rect.height / 2 - cardRect.height / 2; }
      if (side === 'center') { x = (window.innerWidth - cardRect.width) / 2; y = (window.innerHeight - cardRect.height) / 2; }
      x = Math.max(12, Math.min(x, window.innerWidth - cardRect.width - 12));
      y = Math.max(12, Math.min(y, window.innerHeight - cardRect.height - 12));
      card.style.setProperty('--tour-card-x', `${Math.round(x)}px`);
      card.style.setProperty('--tour-card-y', `${Math.round(y)}px`);
      arrow.style.setProperty('--tour-arrow-x', `${Math.round(rect.left + rect.width / 2)}px`);
      arrow.style.setProperty('--tour-arrow-y', `${Math.round(rect.top - 17)}px`);
      arrow.dataset.side = side;
    });
  }

  function renderStep() {
    const step = steps[currentIndex];
    title.textContent = step.title;
    copy.textContent = step.copy;
    progress.textContent = `導覽任務 ${currentIndex + 1}／${totalSteps}`;
    previousButton.hidden = currentIndex === 0;
    nextButton.textContent = step.complete ? '完成' : '下一步';
    shell.classList.toggle('is-complete', Boolean(step.complete));
    shell.classList.toggle('has-target', !step.complete);
    if (step.complete) emitToast('導覽任務完成，開始翻閱愛爾琳手札吧。');
    positionCard();
  }

  function goTo(index) {
    if (!active) return;
    const generation = sessionGeneration;
    steps[currentIndex]?.leave?.();
    clearTimeout(viewportTimer);
    viewportScrollPending = false;
    viewportAttempts = 0;
    currentIndex = Math.max(0, Math.min(index, totalSteps - 1));
    steps[currentIndex]?.prepare?.();
    renderStep();
    cancelAnimationFrame(stepFrame);
    stepFrame = requestAnimationFrame(() => {
      if (!active || generation !== sessionGeneration) return;
      positionCard();
      focusCardControl();
    });
  }

  function finish(status) {
    if (!active) return;
    steps[currentIndex]?.leave?.();
    closeQuickSearch();
    closeTourDrawer();
    setCompletionStatus(status);
    active = false;
    target = null;
    const closingGeneration = cancelPendingSessionWork({cancelAutomatic: true});
    shell.hidden = true;
    document.documentElement.classList.remove('game-guided-tour-open');
    const focusTarget = returnFocus instanceof HTMLElement && returnFocus.isConnected && isInViewport(returnFocus)
      ? returnFocus
      : document.querySelector('#top-tour-button') || document.querySelector('#tour-button');
    focusFrame = requestAnimationFrame(() => {
      if (active || closingGeneration !== sessionGeneration) return;
      const fallback = isInViewport(focusTarget) ? focusTarget : document.querySelector('#menu-button');
      fallback?.focus({preventScroll: true});
    });
  }

  function beginStart(generation, automatic) {
    if (active || generation !== sessionGeneration) return;
    if (automatic && automaticStartIsSuppressed()) return;
    if (!document.querySelector('#workspace')?.childElementCount) {
      clearTimeout(startRetryTimer);
      startRetryTimer = setTimeout(() => beginStart(generation, automatic), 40);
      return;
    }
    startRetryTimer = 0;
    returnFocus = document.activeElement;
    tourOpenedQuickSearch = false;
    tourOpenedDrawer = false;
    active = true;
    shell.hidden = false;
    document.documentElement.classList.add('game-guided-tour-open');
    goTo(0);
  }

  function start() {
    if (active) return;
    const generation = cancelPendingSessionWork({cancelAutomatic: true});
    beginStart(generation, false);
  }

  function blockBackgroundPointer(event) {
    if (!active || guardPaused || steps[currentIndex].complete) return;
    const advanceTarget = steps[currentIndex]?.advanceOnAction;
    if (card.contains(event.target) || allowedTarget(event.target) || (advanceTarget && event.target instanceof Element && event.target.closest(advanceTarget))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function keepFocusInTour(event) {
    if (!active || guardPaused || steps[currentIndex].complete) return;
    if (card.contains(event.target) || allowedTarget(event.target)) return;
    focusCardControl();
  }

  function handleKeyboard(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      finish('skipped');
      return;
    }
    if (event.key !== 'Tab' || steps[currentIndex].complete) return;
    const items = [...visibleTourFocusables(), ...(target ? [target] : [])];
    if (!items.length) return;
    const current = document.activeElement;
    const index = items.indexOf(current);
    if (index === -1) {
      event.preventDefault();
      (event.shiftKey ? items.at(-1) : items[0]).focus({preventScroll: true});
      return;
    }
    const nextIndex = event.shiftKey ? (index - 1 + items.length) % items.length : (index + 1) % items.length;
    event.preventDefault();
    items[nextIndex].focus({preventScroll: true});
  }

  function actionAdvance(event) {
    const selector = steps[currentIndex]?.advanceOnAction;
    if (!active || !selector || !(event.target instanceof Element) || !event.target.closest(selector)) return;
    const generation = sessionGeneration;
    clearTimeout(actionAdvanceTimer);
    actionAdvanceTimer = setTimeout(() => {
      if (active && generation === sessionGeneration) goTo(currentIndex + 1);
    }, 0);
  }

  shell.addEventListener('click', event => {
    const action = event.target.closest('[data-tour-action]')?.dataset.tourAction;
    if (action === 'skip') finish('skipped');
    if (action === 'previous') goTo(currentIndex - 1);
    if (action === 'next') steps[currentIndex].complete ? finish('completed') : goTo(currentIndex + 1);
  });
  document.addEventListener('pointerdown', blockBackgroundPointer, true);
  document.addEventListener('click', blockBackgroundPointer, true);
  document.addEventListener('click', actionAdvance, true);
  document.addEventListener('focusin', keepFocusInTour, true);
  document.addEventListener('keydown', handleKeyboard, true);
  document.addEventListener('fanatio:route-rendered', positionCard);
  window.addEventListener('hashchange', () => {
    const generation = sessionGeneration;
    clearTimeout(hashPositionTimer);
    hashPositionTimer = setTimeout(() => {
      if (active && generation === sessionGeneration) positionCard();
    }, 0);
  });
  window.addEventListener('resize', positionCard, {passive: true});
  window.addEventListener('scroll', positionCard, {passive: true, capture: true});
  mobileQuery.addEventListener('change', positionCard);
  document.addEventListener('toggle', positionCard, true);
  new MutationObserver(positionCard).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'aria-hidden']});

  document.querySelectorAll('#tour-button, #top-tour-button').forEach(button => {
    if (button.dataset.guidedTourBound === 'true') return;
    button.dataset.guidedTourBound = 'true';
    button.addEventListener('click', start);
  });
  window.FanatioGuidedTour = {initialized: true, start, storage: {version: VERSION, versionKey: STORAGE_VERSION, statusKey: STORAGE_STATUS}};
  automaticStartTimer = setTimeout(() => {
    automaticStartTimer = 0;
    if (active || sessionGeneration !== 0) return;
    beginStart(sessionGeneration, true);
  }, 80);
})();
