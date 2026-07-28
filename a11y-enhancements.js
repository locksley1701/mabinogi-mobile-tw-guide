(function setupAccessibilityEnhancements() {
  const mobileQuery = matchMedia('(max-width: 959px)');
  const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const modalReturnFocus = new WeakMap();
  let syncing = false;

  function setAttributeIfChanged(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  function setInert(element, value) {
    if (element.inert !== value) element.inert = value;
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement) || element.hidden) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function visibleFocusable(root) {
    return [...root.querySelectorAll(focusableSelector)].filter(element => {
      if (!(element instanceof HTMLElement) || element.inert) return false;
      return isVisible(element) && element.getClientRects().length > 0;
    });
  }

  function setPressedState(selector) {
    document.querySelectorAll(selector).forEach(element => {
      setAttributeIfChanged(element, 'aria-pressed', String(element.classList.contains('is-active')));
    });
  }

  function syncSelectionStates() {
    setPressedState('[data-life-group]');
    setPressedState('[data-life-skill]');
    setPressedState('[data-cooking-level]');

    const results = document.querySelector('#search-results');
    if (results) {
      setAttributeIfChanged(results, 'aria-live', 'polite');
      setAttributeIfChanged(results, 'aria-atomic', 'false');
    }
  }

  function syncDetails() {
    document.querySelectorAll('details.profession-skill').forEach((details, index) => {
      const summary = details.querySelector(':scope > summary');
      const body = details.querySelector(':scope > .profession-skill__body');
      if (!summary || !body) return;
      const id = body.id || `profession-skill-panel-${index + 1}`;
      body.id = id;
      setAttributeIfChanged(summary, 'aria-controls', id);
      setAttributeIfChanged(summary, 'aria-expanded', String(details.open));
    });
  }

  function syncQuickSearch() {
    const panel = document.querySelector('#quick-search-panel');
    if (!panel) return;
    setAttributeIfChanged(panel, 'aria-hidden', String(panel.hidden));
  }

  function syncContextFilters() {
    document.querySelectorAll('.sidebar-context-filter').forEach(filter => {
      const hidden = filter.getAttribute('aria-hidden') === 'true' || !filter.classList.contains('is-visible');
      setInert(filter, hidden);
    });
  }

  function syncDrawer() {
    const sidebar = document.querySelector('#sidebar');
    if (!sidebar) return;
    const mobile = mobileQuery.matches;
    const open = document.body.classList.contains('drawer-open');

    if (mobile) {
      setInert(sidebar, !open);
      setAttributeIfChanged(sidebar, 'aria-hidden', String(!open));
    } else {
      setInert(sidebar, false);
      if (sidebar.hasAttribute('aria-hidden')) sidebar.removeAttribute('aria-hidden');
    }
  }

  function activeModal() {
    return [document.querySelector('#theme-settings'), document.querySelector('#tour')]
      .find(element => element && !element.hidden && isVisible(element));
  }

  function syncBackgroundInert() {
    const appShell = document.querySelector('.app-shell');
    if (appShell) setInert(appShell, Boolean(activeModal()));
  }

  function syncAll() {
    if (syncing) return;
    syncing = true;
    requestAnimationFrame(() => {
      syncSelectionStates();
      syncDetails();
      syncQuickSearch();
      syncContextFilters();
      syncDrawer();
      syncBackgroundInert();
      syncing = false;
    });
  }

  function trapModalFocus(event) {
    if (event.key !== 'Tab') return;
    const modal = activeModal();
    if (!modal) return;
    const focusable = visibleFocusable(modal);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function preserveDrawerTriggerOnEscape(event) {
    if (event.key !== 'Escape' || !mobileQuery.matches || !document.body.classList.contains('drawer-open')) return;
    const menuButton = document.querySelector('#menu-button');
    requestAnimationFrame(() => menuButton?.focus({preventScroll: true}));
  }

  function syncModalVisibility(modal) {
    if (!(modal instanceof HTMLElement)) return;
    if (!modal.hidden) {
      if (!modalReturnFocus.has(modal)) modalReturnFocus.set(modal, document.activeElement);
      syncBackgroundInert();
      requestAnimationFrame(() => {
        if (!modal.contains(document.activeElement)) visibleFocusable(modal)[0]?.focus({preventScroll: true});
      });
      return;
    }

    syncBackgroundInert();
    const returnTarget = modalReturnFocus.get(modal);
    modalReturnFocus.delete(modal);
    if (returnTarget instanceof HTMLElement && returnTarget.isConnected && isVisible(returnTarget)) {
      requestAnimationFrame(() => returnTarget.focus({preventScroll: true}));
    }
  }

  const nativeScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function accessibleScrollIntoView(options) {
    if (reducedMotionQuery.matches && options && typeof options === 'object' && options.behavior === 'smooth') {
      return nativeScrollIntoView.call(this, {...options, behavior: 'auto'});
    }
    return nativeScrollIntoView.call(this, options);
  };

  document.addEventListener('keydown', event => {
    preserveDrawerTriggerOnEscape(event);
    trapModalFocus(event);
  }, true);
  document.addEventListener('toggle', event => {
    if (event.target instanceof HTMLDetailsElement) syncDetails();
  }, true);
  document.addEventListener('click', syncAll, true);
  window.addEventListener('hashchange', syncAll);
  mobileQuery.addEventListener('change', syncDrawer);

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'attributes' && record.attributeName === 'hidden') {
        const target = record.target;
        if (target instanceof HTMLElement && (target.id === 'theme-settings' || target.id === 'tour')) {
          syncModalVisibility(target);
        }
      }
    });
    syncAll();
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'hidden', 'open', 'aria-hidden']
  });

  syncAll();
})();
