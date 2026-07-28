(function integrateThemeSystem() {
  const root = document.documentElement;
  const bootAppearance = root.dataset.appearance || 'system';
  const bootPalette = root.dataset.palette || 'forest';

  ThemeSystem.apply({appearance: bootAppearance, palette: bootPalette, persist: true});
  ThemeSystem.mount();

  document.querySelectorAll('#theme-toggle, #top-theme-toggle').forEach(oldButton => {
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.addEventListener('click', () => ThemeSystem.openPanel(button));
  });

  ThemeSystem.apply({appearance: bootAppearance, palette: bootPalette, persist: true});
})();
