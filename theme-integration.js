(function integrateThemeSystem() {
  ThemeSystem.applySavedPreferences();
  ThemeSystem.mount();

  document.querySelectorAll('#theme-toggle, #top-theme-toggle').forEach(oldButton => {
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.addEventListener('click', () => ThemeSystem.openPanel(button));
  });

  ThemeSystem.applySavedPreferences();
})();
