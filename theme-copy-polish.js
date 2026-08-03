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

(function guardPublicPlayerCopy() {
  const INTERNAL_BRANCH_PATTERN = /\b(?:feat|fix|chore|refactor|docs|test|architecture)\/[A-Za-z0-9._/-]+\b/g;
  const COMMIT_SHA_PATTERN = /\b[0-9a-f]{40}\b/gi;

  function sanitizeText(value = '') {
    return String(value)
      .replace(/下一施工[：:]\s*Issue\s*#\d+/gi, '台版資料待補')
      .replace(/下一施工/g, '後續作業')
      .replace(/待後續\s*Issue\s*完成台版核對後/g, '待台版資料核對完成後')
      .replace(/待後續\s*Issue\s*完成/g, '待資料核對完成')
      .replace(/\bIssue\s*#\d+\s*[・·]?\s*/gi, '')
      .replace(/\bPR\s*#\d+\s*[・·]?\s*/gi, '')
      .replace(INTERNAL_BRANCH_PATTERN, '')
      .replace(COMMIT_SHA_PATTERN, '')
      .replace(/詳情\s*route/gi, '資料頁')
      .replace(/這個\s*route/gi, '這個資料頁')
      .replace(/請求\s*ID/gi, '查詢代碼')
      .replace(/新內容模組/g, '攻略章節')
      .replace(/新章節架構/g, '章節資料')
      .replace(/\s+・/g, '・')
      .replace(/・\s*$/g, '');
  }

  function sanitizeWorkspace() {
    const workspace = document.querySelector('#workspace');
    if (!workspace) return;

    workspace.querySelectorAll('.content-module-hero code').forEach(node => node.remove());

    const walker = document.createTreeWalker(workspace, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(node => {
      if (node.parentElement?.closest('script, style, code')) return;
      const next = sanitizeText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });

    workspace.querySelectorAll('[aria-label], [title]').forEach(element => {
      for (const attribute of ['aria-label', 'title']) {
        if (!element.hasAttribute(attribute)) continue;
        const value = element.getAttribute(attribute);
        const next = sanitizeText(value);
        if (next !== value) element.setAttribute(attribute, next);
      }
    });
  }

  function scheduleSanitize() {
    queueMicrotask(sanitizeWorkspace);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const workspace = document.querySelector('#workspace');
    if (workspace) {
      new MutationObserver(scheduleSanitize).observe(workspace, {
        childList: true,
        subtree: true
      });
    }
    scheduleSanitize();
  });

  window.addEventListener('hashchange', scheduleSanitize);
})();
