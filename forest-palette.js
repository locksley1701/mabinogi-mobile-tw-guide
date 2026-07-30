(function polishForestPalette() {
  'use strict';

  const forest = window.FanatioThemeSystem?.palettes?.find(item => item.id === 'forest')
    || window.ThemeSystem?.palettes?.find(item => item.id === 'forest');

  if (forest) {
    forest.description = '晨霧森林、夜林苔石與柔和黃銅。';
  }

  const themeColors = {
    light: '#d8ddd3',
    dark: '#09130f'
  };

  function syncThemeColor(detail = {}) {
    const palette = detail.palette || document.documentElement.dataset.palette;
    if (palette !== 'forest') return;
    const resolved = detail.resolved || document.documentElement.dataset.theme || 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColors[resolved] || themeColors.light;
  }

  document.addEventListener('fanatio:themechange', event => syncThemeColor(event.detail));
  syncThemeColor();
})();
