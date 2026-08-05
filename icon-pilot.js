(() => {
  'use strict';

  const DATA_URL = 'data/icon-pilot.json';
  const workspace = document.querySelector('#workspace');
  const sidebar = document.querySelector('#sidebar');
  const skillBindingOverrides = Object.freeze({
    'greatsword-warrior-blockade-front': '肩撞'
  });
  let data = null;
  let queued = false;

  function normalize(value = '') {
    return String(value).replace(/\s+/g, ' ').trim();
  }

  function createImage(item, context) {
    const image = document.createElement('img');
    image.src = item.icon;
    image.alt = '';
    image.width = item.width;
    image.height = item.height;
    image.loading = ['detail', 'hero', 'profession-series'].includes(context) ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.className = 'official-icon__image';
    image.dataset.officialIcon = item.id;
    image.setAttribute('aria-hidden', 'true');
    return image;
  }

  function makeHost(item, kind, context = 'list') {
    const host = document.createElement('span');
    host.className = `official-icon official-icon--${kind} official-icon--${context}`;
    host.dataset.officialIconHost = item.id;
    host.setAttribute('aria-hidden', 'true');
    const image = createImage(item, context);
    image.addEventListener('error', () => host.remove(), { once: true });
    host.append(image);
    return host;
  }

  function replaceHost(host, item, kind) {
    if (!host
      || host.dataset.officialIconHost === item.id
      || host.dataset.officialIconFailed === item.id) return;

    if (host.dataset.officialIconFailed && host.dataset.officialIconFailed !== item.id) {
      delete host.dataset.officialIconFailed;
    }
    if (!host.dataset.officialIconFallback) {
      host.dataset.officialIconFallback = normalize(host.textContent);
    }
    host.dataset.officialIconHost = item.id;
    host.classList.add('has-official-icon', `official-icon-source--${kind}`);
    host.textContent = '';
    const image = createImage(item, 'list');
    image.addEventListener('error', () => {
      host.dataset.officialIconFailed = item.id;
      host.classList.remove('has-official-icon', `official-icon-source--${kind}`);
      host.textContent = host.dataset.officialIconFallback || '';
      delete host.dataset.officialIconHost;
    }, { once: true });
    host.append(image);
  }

  function maps() {
    const categories = data?.categories || {};
    return {
      lifeById: new Map((categories.lifeSkills || []).map(item => [item.id, item])),
      professionSeriesById: new Map((categories.professionSeries || []).map(item => [item.id, item])),
      professionById: new Map((categories.professions || []).map(item => [item.id, item])),
      skillByKey: new Map((categories.professionSkills || []).map(item => {
        const bindingName = skillBindingOverrides[item.id] || item.name;
        return [`${item.professionId}:${bindingName}`, item];
      })),
      cookingByName: new Map((categories.cooking || []).map(item => [item.name, item]))
    };
  }

  function patchLife(iconMaps) {
    document.querySelectorAll('.skill-tile[data-life-skill]').forEach(tile => {
      const item = iconMaps.lifeById.get(tile.dataset.lifeSkill);
      if (item) replaceHost(tile.querySelector('.skill-tile__icon'), item, 'life');
    });

    const selectedId = document.querySelector('.skill-tile.is-active[data-life-skill]')?.dataset.lifeSkill;
    const item = selectedId ? iconMaps.lifeById.get(selectedId) : null;
    const detail = document.querySelector('#life-detail');
    if (!item || !detail || detail.querySelector(`[data-official-icon-detail="${item.id}"]`)) return;
    detail.querySelectorAll('[data-official-icon-detail]').forEach(node => node.remove());
    const title = detail.querySelector('.detail-title');
    if (!title) return;
    const host = makeHost(item, 'life', 'detail');
    host.dataset.officialIconDetail = item.id;
    title.before(host);
  }

  function professionIdFromCard(card) {
    const match = card.getAttribute('href')?.match(/^#\/profession\/([^/?#]+)/);
    return match?.[1] || '';
  }

  function replaceSidebarHost(host, item) {
    if (!host
      || host.dataset.officialIconHost === item.id
      || host.dataset.officialIconFailed === item.id) return;

    if (host.dataset.officialIconFailed && host.dataset.officialIconFailed !== item.id) {
      delete host.dataset.officialIconFailed;
    }
    if (!host.dataset.officialIconFallback) {
      host.dataset.officialIconFallback = normalize(host.textContent);
    }

    const fallback = host.dataset.officialIconFallback || '';
    host.dataset.officialIconHost = item.id;
    host.classList.add('official-icon-source--profession-sidebar');
    host.textContent = fallback;

    const wrapper = document.createElement('span');
    wrapper.className = 'official-icon--sidebar';
    wrapper.dataset.officialIconSidebar = item.id;
    wrapper.setAttribute('aria-hidden', 'true');
    const image = createImage(item, 'sidebar');
    image.addEventListener('error', () => {
      host.dataset.officialIconFailed = item.id;
      host.classList.remove('official-icon-source--profession-sidebar');
      host.textContent = fallback;
      delete host.dataset.officialIconHost;
    }, { once: true });
    wrapper.append(image);
    host.append(wrapper);
  }

  function patchProfessionSidebar(iconMaps) {
    document.querySelectorAll('.sidebar .nav-link[data-route^="profession/"] > span[aria-hidden="true"]').forEach(host => {
      const route = host.parentElement?.dataset.route || '';
      const match = route.match(/^profession\/([^/?#]+)$/);
      const item = match ? iconMaps.professionById.get(match[1]) : null;
      if (item) replaceSidebarHost(host, item);
    });
  }

  function replaceProfessionSeriesHost(host, item) {
    if (!host
      || host.dataset.officialIconHost === item.id
      || host.dataset.officialIconFailed === item.id) return;

    if (host.dataset.officialIconFailed && host.dataset.officialIconFailed !== item.id) {
      delete host.dataset.officialIconFailed;
    }
    if (!host.dataset.officialIconFallback) {
      host.dataset.officialIconFallback = normalize(host.textContent);
    }

    const fallback = host.dataset.officialIconFallback || '';
    host.dataset.officialIconHost = item.id;
    host.classList.add('official-icon-source--profession-series');
    host.textContent = fallback;

    const wrapper = document.createElement('span');
    wrapper.className = 'official-icon--profession-series';
    wrapper.dataset.officialIconProfessionSeries = item.id;
    wrapper.setAttribute('aria-hidden', 'true');
    const image = createImage(item, 'profession-series');
    image.addEventListener('error', () => {
      host.dataset.officialIconFailed = item.id;
      host.classList.remove('official-icon-source--profession-series');
      host.textContent = fallback;
      delete host.dataset.officialIconHost;
    }, { once: true });
    wrapper.append(image);
    host.append(wrapper);
  }

  function patchProfessionSeries(iconMaps) {
    document.querySelectorAll('[data-profession-series-host]').forEach(host => {
      const item = iconMaps.professionSeriesById.get(host.dataset.professionSeriesHost);
      if (item) replaceProfessionSeriesHost(host, item);
    });
  }

  function patchProfessions(iconMaps) {
    document.querySelectorAll('.profession-card').forEach(card => {
      const id = professionIdFromCard(card);
      const item = iconMaps.professionById.get(id);
      if (item) replaceHost(card.querySelector('.profession-card__icon'), item, 'profession');
    });

    const routeMatch = location.hash.match(/^#\/profession\/([^/?#]+)/);
    const id = routeMatch?.[1] || '';
    const item = iconMaps.professionById.get(id);
    const hero = document.querySelector('.profession-hero');
    if (!item || !hero || hero.querySelector(`[data-official-icon-detail="${item.id}"]`)) return;
    const copy = hero.querySelector(':scope > div');
    if (!copy) return;
    const host = makeHost(item, 'profession', 'hero');
    host.dataset.officialIconDetail = item.id;
    copy.prepend(host);
  }

  function patchProfessionSkills(iconMaps) {
    const routeMatch = location.hash.match(/^#\/profession\/([^/?#]+)/);
    const professionId = routeMatch?.[1] || '';
    if (!professionId) return;

    document.querySelectorAll('.profession-skill').forEach(row => {
      const name = normalize(row.querySelector('.profession-skill__identity strong')?.textContent);
      const item = iconMaps.skillByKey.get(`${professionId}:${name}`);
      if (item) replaceHost(row.querySelector('.profession-skill__number'), item, 'profession-skill');
    });

    document.querySelectorAll('.combat-skill').forEach(row => {
      const name = normalize(row.querySelector('strong')?.textContent);
      const item = iconMaps.skillByKey.get(`${professionId}:${name}`);
      if (item) replaceHost(row.querySelector('.combat-skill__icon'), item, 'profession-skill');
    });
  }

  function patchCooking(iconMaps) {
    const notice = document.querySelector('.cooking-notice');
    if (notice && notice.dataset.iconPilotUpdated !== 'true') {
      const title = notice.querySelector('strong');
      const copy = notice.querySelector('p');
      if (title) title.textContent = '官方圖標小批次試點';
      if (copy) copy.textContent = '本批已接入煎蛋、水煮蛋、烤整顆馬鈴薯與蘋果汁；其餘料理仍保留純文字呈現，待批次導入後補齊。';
      notice.dataset.iconPilotUpdated = 'true';
    }

    document.querySelectorAll('.cooking-card').forEach(card => {
      const head = card.querySelector('.cooking-card__head');
      const name = normalize(head?.querySelector('h2')?.textContent);
      const item = iconMaps.cookingByName.get(name);
      if (!item || !head || head.querySelector(`[data-official-icon-host="${item.id}"]`)) return;
      head.prepend(makeHost(item, 'cooking', 'card'));
    });
  }

  function patchSearch(iconMaps) {
    document.querySelectorAll('.result-row').forEach(row => {
      const title = normalize(row.querySelector('strong')?.textContent).split('｜')[0];
      const routeMatch = row.querySelector('a')?.getAttribute('href')?.match(/^#\/profession\/([^/?#]+)/);
      const professionId = routeMatch?.[1] || '';
      const item = (professionId ? iconMaps.skillByKey.get(`${professionId}:${title}`) : null)
        || iconMaps.cookingByName.get(title)
        || [...iconMaps.lifeById.values()].find(entry => entry.name === title)
        || [...iconMaps.professionById.values()].find(entry => entry.name === title);
      if (!item || row.querySelector(`[data-official-icon-host="${item.id}"]`)) return;
      const kind = item.icon.includes('/cooking/') ? 'cooking'
        : item.icon.includes('/professions/') ? 'profession'
        : item.icon.includes('/profession-skills/') ? 'profession-skill'
        : 'life';
      row.prepend(makeHost(item, kind, 'search'));
    });
  }

  function patchAll() {
    queued = false;
    if (!data) return;
    const iconMaps = maps();
    patchLife(iconMaps);
    patchProfessionSeries(iconMaps);
    patchProfessionSidebar(iconMaps);
    patchProfessions(iconMaps);
    patchProfessionSkills(iconMaps);
    patchCooking(iconMaps);
    patchSearch(iconMaps);
  }

  function queuePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(patchAll);
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      window.FanatioIconPilot = Object.freeze({ data, patch: queuePatch });
      queuePatch();
    } catch (error) {
      console.warn('官方圖標試點資料載入失敗，保留既有文字與符號呈現。', error);
    }
  }

  const observer = new MutationObserver(queuePatch);
  if (workspace) observer.observe(workspace, { childList: true, subtree: true });
  if (sidebar) observer.observe(sidebar, { childList: true, subtree: true });
  window.addEventListener('hashchange', queuePatch);
  document.addEventListener('fanatio:themechange', queuePatch);
  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
