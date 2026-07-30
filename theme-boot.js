(function applyThemeBeforePaint() {
  try {
    const root = document.documentElement;
    const legacy = localStorage.getItem('fanatio-theme');
    const savedAppearance = localStorage.getItem('fanatio-appearance');
    const appearance = ['system', 'light', 'dark'].includes(savedAppearance)
      ? savedAppearance
      : (legacy === 'light' || legacy === 'dark' ? legacy : 'system');
    const savedPalette = localStorage.getItem('fanatio-palette');
    const palette = ['forest', 'moonlight', 'hearth', 'amethyst', 'contrast'].includes(savedPalette)
      ? savedPalette
      : 'forest';
    const savedReadingSize = localStorage.getItem('fanatio-reading-size');
    const readingSize = ['standard', 'comfortable', 'large'].includes(savedReadingSize)
      ? savedReadingSize
      : 'comfortable';
    const resolved = appearance === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : appearance;

    root.dataset.appearance = appearance;
    root.dataset.theme = resolved;
    root.dataset.palette = palette;
    root.dataset.readingSize = readingSize;
    localStorage.setItem('fanatio-theme', resolved);
  } catch {
    document.documentElement.dataset.appearance = 'system';
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.palette = 'forest';
    document.documentElement.dataset.readingSize = 'comfortable';
  }
})();
