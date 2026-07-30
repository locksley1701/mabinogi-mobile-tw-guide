(() => {
  'use strict';

  const ICONS = window.ISSUE7_ICON_DATA || {};
  const workspace = document.querySelector('#workspace');
  const sidebar = document.querySelector('#sidebar');
  let queued = false;

  function ensureLayoutFix() {
    if (document.querySelector('#issue7-icon-layout-fix')) return;
    const style = document.createElement('style');
    style.id = 'issue7-icon-layout-fix';
    style.textContent = `
      .skill-tile:has(.skill-tile__icon.has-pilot-icon) {
        grid-template-columns: 52px minmax(0, 1fr);
        column-gap: 12px;
      }
      .skill-tile:has(.skill-tile__icon.has-pilot-icon) > span:last-child {
        min-width: 0;
      }
      .skill-tile:has(.skill-tile__icon.has-pilot-icon) strong,
      .skill-tile:has(.skill-tile__icon.has-pilot-icon) small {
        overflow-wrap: anywhere;
      }
      @media (max-width: 390px) {
        .skill-tile:has(.skill-tile__icon.has-pilot-icon) {
          grid-template-columns: 46px minmax(0, 1fr);
          column-gap: 10px;
        }
      }
    `;
    document.head.append(style);
  }

  function createImage(uri) {
    const image = document.createElement('img');
    image.src = uri;
    image.alt = '';
    image.className = 'pilot-icon';
    image.setAttribute('aria-hidden', 'true');
    return image;
  }

  function install(host, uri, type = 'default') {
    if (!host || !uri || host.dataset.pilotIcon === uri) return;
    host.dataset.fallback = host.textContent.trim();
    host.dataset.pilotIcon = uri;
    host.dataset.pilotIconHost = 'true';
    host.classList.add('has-pilot-icon', `pilot-icon-host--${type}`);
    host.textContent = '';
    const image = createImage(uri);
    image.addEventListener('error', () => {
      host.classList.remove('has-pilot-icon');
      host.textContent = host.dataset.fallback || '';
      delete host.dataset.pilotIcon;
    }, { once: true });
    host.append(image);
  }

  function addNotice() {
    if (!workspace || workspace.querySelector('.pilot-preview-notice')) return;
    const notice = document.createElement('aside');
    notice.className = 'pilot-preview-notice';
    notice.setAttribute('role', 'note');
    notice.innerHTML = '<strong>Issue #7 未合併預覽</strong><span>這是完整網站測試分支；正式站尚未修改。目前先接入生活技能官方圖標，其他類別將在同一網址陸續補齊。</span>';
    workspace.prepend(notice);
  }

  function patchLife() {
    document.querySelectorAll('.skill-tile[data-life-skill]').forEach(tile => {
      const id = tile.dataset.lifeSkill;
      install(tile.querySelector('.skill-tile__icon'), ICONS[id], 'life');
    });

    const selected = document.querySelector('.skill-tile.is-active[data-life-skill]')?.dataset.lifeSkill;
    const detail = document.querySelector('#life-detail');
    const title = detail?.querySelector('.detail-title');
    if (selected && ICONS[selected] && title && !detail.querySelector('.pilot-detail-icon')) {
      const icon = document.createElement('span');
      icon.className = 'pilot-detail-icon';
      icon.dataset.pilotIconHost = 'true';
      icon.append(createImage(ICONS[selected]));
      title.before(icon);
    }
  }

  function patchAll() {
    queued = false;
    ensureLayoutFix();
    addNotice();
    patchLife();
  }

  function queuePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(patchAll);
  }

  const observer = new MutationObserver(queuePatch);
  if (workspace) observer.observe(workspace, { childList: true, subtree: true });
  if (sidebar) observer.observe(sidebar, { childList: true, subtree: true });
  window.addEventListener('hashchange', queuePatch);
  window.addEventListener('load', queuePatch);
  document.addEventListener('fanatio:themechange', queuePatch);
  queuePatch();
})();
