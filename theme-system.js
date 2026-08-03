const ThemeSystem = (() => {
  const APPEARANCE_KEY = 'fanatio-appearance';
  const PALETTE_KEY = 'fanatio-palette';
  const LEGACY_THEME_KEY = 'fanatio-theme';
  const appearances = [
    {id: 'system', label: '跟隨系統', description: '依裝置的亮暗外觀自動切換。'},
    {id: 'light', label: '亮色', description: '固定使用明亮的羊皮紙工作區。'},
    {id: 'dark', label: '暗色', description: '固定使用低光、深色的閱讀環境。'}
  ];
  const palettes = [
    {id: 'forest', label: '愛爾琳森林', description: '森林綠、羊皮紙與暗金。'},
    {id: 'moonlight', label: '月光石板', description: '深藍灰、銀白與淡金。'},
    {id: 'hearth', label: '赤紅爐火', description: '酒紅、炭黑與銅金。'},
    {id: 'amethyst', label: '紫晶秘典', description: '深紫、石板灰與霧金。'},
    {id: 'contrast', label: '高對比', description: '黑白為主、強邊框與減少裝飾。'}
  ];
  const appearanceIds = new Set(appearances.map(item => item.id));
  const paletteIds = new Set(palettes.map(item => item.id));
  const media = matchMedia('(prefers-color-scheme: dark)');
  let panel = null;
  let lastTrigger = null;
  let mediaBound = false;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Keep the current-visit preference only. */ }
  }

  function readAppearance() {
    const saved = storageGet(APPEARANCE_KEY);
    if (appearanceIds.has(saved)) return saved;
    const legacy = storageGet(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark') return legacy;
    return 'system';
  }

  function readPalette() {
    const saved = storageGet(PALETTE_KEY);
    return paletteIds.has(saved) ? saved : 'forest';
  }

  function resolveAppearance(appearance) {
    return appearance === 'system' ? (media.matches ? 'dark' : 'light') : appearance;
  }

  function currentState() {
    const appearance = appearanceIds.has(document.documentElement.dataset.appearance)
      ? document.documentElement.dataset.appearance
      : readAppearance();
    const palette = paletteIds.has(document.documentElement.dataset.palette)
      ? document.documentElement.dataset.palette
      : readPalette();
    return {appearance, palette, resolved: resolveAppearance(appearance)};
  }

  function updateThemeColor(palette, resolved) {
    const colors = {
      forest: {light: '#e8e2d0', dark: '#071914'},
      moonlight: {light: '#e3e8ee', dark: '#0b1119'},
      hearth: {light: '#ece1dc', dark: '#180c0f'},
      amethyst: {light: '#e8e2ea', dark: '#120d18'},
      contrast: {light: '#ffffff', dark: '#000000'}
    };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = colors[palette]?.[resolved] || colors.forest[resolved];
  }

  function updateTriggers(state) {
    const icon = state.appearance === 'system' ? '◐' : (state.resolved === 'dark' ? '☾' : '☀');
    const palette = palettes.find(item => item.id === state.palette)?.label || '愛爾琳森林';
    document.querySelectorAll('#theme-toggle, #top-theme-toggle').forEach(button => {
      button.setAttribute('aria-label', `開啟外觀與配色設定；目前為${palette}、${state.appearance === 'system' ? '跟隨系統' : state.resolved === 'dark' ? '暗色' : '亮色'}`);
      const span = button.querySelector('span');
      if (span) span.textContent = icon;
      else button.textContent = icon;
    });
  }

  function syncPanel(state = currentState()) {
    if (!panel) return;
    panel.querySelectorAll('[data-appearance-choice]').forEach(button => {
      const selected = button.dataset.appearanceChoice === state.appearance;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
      const marker = button.querySelector('.theme-choice__marker');
      if (marker) marker.textContent = selected ? '已選' : '';
    });
    panel.querySelectorAll('[data-palette-choice]').forEach(button => {
      const selected = button.dataset.paletteChoice === state.palette;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
      const marker = button.querySelector('.theme-choice__marker');
      if (marker) marker.textContent = selected ? '已選' : '';
    });
    const status = panel.querySelector('#theme-settings-status');
    const appearanceLabel = appearances.find(item => item.id === state.appearance)?.label;
    const paletteLabel = palettes.find(item => item.id === state.palette)?.label;
    if (status) status.textContent = `目前使用：${appearanceLabel}・${paletteLabel}`;
  }

  function apply({appearance = readAppearance(), palette = readPalette(), persist = true} = {}) {
    const safeAppearance = appearanceIds.has(appearance) ? appearance : 'system';
    const safePalette = paletteIds.has(palette) ? palette : 'forest';
    const resolved = resolveAppearance(safeAppearance);
    const root = document.documentElement;

    root.dataset.appearance = safeAppearance;
    root.dataset.theme = resolved;
    root.dataset.palette = safePalette;

    if (persist) {
      storageSet(APPEARANCE_KEY, safeAppearance);
      storageSet(PALETTE_KEY, safePalette);
      storageSet(LEGACY_THEME_KEY, resolved);
    }

    updateThemeColor(safePalette, resolved);
    updateTriggers({appearance: safeAppearance, palette: safePalette, resolved});
    syncPanel({appearance: safeAppearance, palette: safePalette, resolved});
    document.dispatchEvent(new CustomEvent('fanatio:themechange', {
      detail: {appearance: safeAppearance, palette: safePalette, resolved}
    }));
    return {appearance: safeAppearance, palette: safePalette, resolved};
  }

  function applySavedPreferences() {
    return apply({appearance: readAppearance(), palette: readPalette(), persist: true});
  }

  function choiceButton(kind, item) {
    const data = kind === 'appearance'
      ? `data-appearance-choice="${item.id}"`
      : `data-palette-choice="${item.id}"`;
    return `
      <button class="theme-choice theme-choice--${kind}" type="button" ${data} aria-pressed="false">
        ${kind === 'palette' ? `<span class="theme-choice__swatches" aria-hidden="true"><i></i><i></i><i></i></span>` : `<span class="theme-choice__appearance" aria-hidden="true"></span>`}
        <span class="theme-choice__copy"><strong>${item.label}</strong><small>${item.description}</small></span>
        <span class="theme-choice__marker" aria-hidden="true"></span>
      </button>`;
  }

  function mount() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'theme-settings';
    panel.className = 'theme-settings';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="theme-settings__backdrop" data-theme-close></div>
      <section class="theme-settings__card" role="dialog" aria-modal="true" aria-labelledby="theme-settings-title" aria-describedby="theme-settings-copy">
        <header class="theme-settings__head">
          <div>
            <p class="eyebrow">手札外觀</p>
            <h2 id="theme-settings-title">選擇閱讀時的光與色</h2>
            <p id="theme-settings-copy">明暗外觀與配色彼此獨立，所有章節共用同一套版面。</p>
          </div>
          <button class="theme-settings__close" type="button" data-theme-close aria-label="關閉外觀與配色設定">×</button>
        </header>
        <div class="theme-settings__body">
          <fieldset class="theme-settings__group">
            <legend>明暗外觀</legend>
            <div class="theme-choice-grid theme-choice-grid--appearance">
              ${appearances.map(item => choiceButton('appearance', item)).join('')}
            </div>
          </fieldset>
          <fieldset class="theme-settings__group">
            <legend>配色主題</legend>
            <div class="theme-choice-grid theme-choice-grid--palette">
              ${palettes.map(item => choiceButton('palette', item)).join('')}
            </div>
          </fieldset>
        </div>
        <footer class="theme-settings__footer">
          <p id="theme-settings-status" aria-live="polite"></p>
          <button class="primary-button" type="button" data-theme-close>完成</button>
        </footer>
      </section>`;
    document.body.append(panel);

    panel.addEventListener('click', event => {
      const appearanceButton = event.target.closest('[data-appearance-choice]');
      if (appearanceButton) {
        const state = currentState();
        apply({appearance: appearanceButton.dataset.appearanceChoice, palette: state.palette});
        return;
      }
      const paletteButton = event.target.closest('[data-palette-choice]');
      if (paletteButton) {
        const state = currentState();
        apply({appearance: state.appearance, palette: paletteButton.dataset.paletteChoice});
        return;
      }
      if (event.target.closest('[data-theme-close]')) closePanel();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) closePanel();
    });

    if (!mediaBound) {
      media.addEventListener('change', () => {
        const state = currentState();
        if (state.appearance === 'system') apply({appearance: 'system', palette: state.palette});
      });
      mediaBound = true;
    }

    syncPanel();
    return panel;
  }

  function openPanel(trigger = document.activeElement) {
    mount();
    lastTrigger = trigger instanceof HTMLElement ? trigger : null;
    panel.hidden = false;
    document.body.classList.add('theme-settings-open');
    syncPanel();
    requestAnimationFrame(() => panel.querySelector('.theme-settings__close')?.focus({preventScroll: true}));
  }

  function closePanel() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    document.body.classList.remove('theme-settings-open');
    lastTrigger?.focus({preventScroll: true});
  }

  return Object.freeze({
    appearances,
    palettes,
    apply,
    applySavedPreferences,
    currentState,
    mount,
    openPanel,
    closePanel
  });
})();
