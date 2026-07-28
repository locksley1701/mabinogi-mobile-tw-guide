(function integrateThemeSystem() {
  const root = document.documentElement;
  const bootAppearance = root.dataset.appearance || 'system';
  const bootPalette = root.dataset.palette || 'forest';

  window.FanatioThemeSystem = ThemeSystem;
  ThemeSystem.apply({appearance: bootAppearance, palette: bootPalette, persist: true});
  ThemeSystem.mount();

  document.querySelectorAll('#theme-toggle, #top-theme-toggle').forEach(oldButton => {
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.addEventListener('click', () => {
      const menuButton = document.querySelector('#menu-button');
      const backdrop = document.querySelector('#drawer-backdrop');
      const mobileDrawerTrigger = button.id === 'theme-toggle' && menuButton && getComputedStyle(menuButton).display !== 'none';

      if (mobileDrawerTrigger) {
        document.body.classList.remove('drawer-open');
        menuButton.setAttribute('aria-expanded', 'false');
        if (backdrop) backdrop.hidden = true;
        ThemeSystem.openPanel(menuButton);
        return;
      }

      ThemeSystem.openPanel(button);
    });
  });

  ThemeSystem.apply({appearance: bootAppearance, palette: bootPalette, persist: true});
})();
