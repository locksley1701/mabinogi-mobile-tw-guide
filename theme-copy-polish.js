(function polishContrastThemeCopy() {
  const contrast = ThemeSystem.palettes.find(item => item.id === 'contrast');
  if (contrast) {
    contrast.label = '柔和高對比';
    contrast.description = '深墨、暖白、霧金與清楚邊框。';
  }

  const contrastThemeColors = {
    light: '#ece9df',
    dark: '#0e1411'
  };

  document.addEventListener('fanatio:themechange', event => {
    if (event.detail?.palette !== 'contrast') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = contrastThemeColors[event.detail.resolved] || contrastThemeColors.light;
  });
})();
