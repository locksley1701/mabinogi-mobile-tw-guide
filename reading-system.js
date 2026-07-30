const ReadingSystem = (() => {
  'use strict';

  const STORAGE_KEY = 'fanatio-reading-size';
  const sizes = [
    {id: 'standard', label: '標準', description: '維持較緊湊的資訊密度，適合大螢幕快速瀏覽。'},
    {id: 'comfortable', label: '舒適', description: '提高正文與輔助文字，適合長時間閱讀。'},
    {id: 'large', label: '放大', description: '進一步放大文字與間距，適合手機或視力需求。'}
  ];
  const sizeIds = new Set(sizes.map(item => item.id));
  let mountedPanel = null;

  function read() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return sizeIds.has(saved) ? saved : 'comfortable';
  }

  function current() {
    const value = document.documentElement.dataset.readingSize;
    return sizeIds.has(value) ? value : read();
  }

  function labelFor(size) {
    return sizes.find(item => item.id === size)?.label || '舒適';
  }

  function syncPanel() {
    const panel = document.querySelector('#theme-settings');
    if (!panel) return;

    const selectedSize = current();
    panel.querySelectorAll('[data-reading-size-choice]').forEach(button => {
      const selected = button.dataset.readingSizeChoice === selectedSize;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
      const marker = button.querySelector('.theme-choice__marker');
      if (marker) marker.textContent = selected ? '已選' : '';
    });

    const status = panel.querySelector('#theme-settings-status');
    if (status) {
      const base = status.textContent.replace(/・閱讀尺寸：(?:標準|舒適|放大)$/, '');
      status.textContent = `${base}・閱讀尺寸：${labelFor(selectedSize)}`;
    }
  }

  function apply(size = read(), {persist = true} = {}) {
    const safeSize = sizeIds.has(size) ? size : 'comfortable';
    document.documentElement.dataset.readingSize = safeSize;
    if (persist) localStorage.setItem(STORAGE_KEY, safeSize);
    syncPanel();
    document.dispatchEvent(new CustomEvent('fanatio:readingsizechange', {
      detail: {size: safeSize, label: labelFor(safeSize)}
    }));
    return safeSize;
  }

  function choiceButton(item) {
    return `
      <button class="theme-choice theme-choice--reading" type="button"
        data-reading-size-choice="${item.id}" aria-pressed="false">
        <span class="theme-choice__reading theme-choice__reading--${item.id}" aria-hidden="true">文</span>
        <span class="theme-choice__copy">
          <strong>${item.label}</strong>
          <small>${item.description}</small>
        </span>
        <span class="theme-choice__marker" aria-hidden="true"></span>
      </button>`;
  }

  function mountIntoThemePanel() {
    const panel = document.querySelector('#theme-settings');
    if (!panel) return false;

    if (!panel.querySelector('[data-reading-settings-group]')) {
      const body = panel.querySelector('.theme-settings__body');
      if (!body) return false;

      const fieldset = document.createElement('fieldset');
      fieldset.className = 'theme-settings__group';
      fieldset.dataset.readingSettingsGroup = 'true';
      fieldset.innerHTML = `
        <legend>閱讀尺寸</legend>
        <p class="theme-settings__group-copy">調整全站文字與閱讀間距；不依賴瀏覽器縮放。</p>
        <div class="theme-choice-grid theme-choice-grid--reading">
          ${sizes.map(choiceButton).join('')}
        </div>`;
      body.append(fieldset);
    }

    if (mountedPanel !== panel) {
      panel.addEventListener('click', event => {
        const button = event.target.closest('[data-reading-size-choice]');
        if (!button) return;
        apply(button.dataset.readingSizeChoice);
      });
      mountedPanel = panel;
    }

    syncPanel();
    return true;
  }

  function watchThemePanel() {
    if (mountIntoThemePanel()) return;
    const observer = new MutationObserver(() => {
      if (mountIntoThemePanel()) observer.disconnect();
    });
    observer.observe(document.body, {childList: true, subtree: true});
  }

  apply(read(), {persist: false});

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchThemePanel, {once: true});
  } else {
    watchThemePanel();
  }

  document.addEventListener('fanatio:themechange', () => {
    requestAnimationFrame(syncPanel);
  });

  return Object.freeze({
    sizes,
    read,
    current,
    apply,
    syncPanel,
    mountIntoThemePanel
  });
})();

window.FanatioReadingSystem = ReadingSystem;
