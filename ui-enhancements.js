const originalBuildSearchItemsForEnhancements = buildSearchItems;
const originalRenderLifeDetailForEnhancements = renderLifeDetail;

attribution = function attributionWithPublicWording(item, fallback = '') {
  const name = item.contributor || (item.source?.includes('法那提歐') ? '法那提歐' : '');
  if (!name && !fallback) return '';
  return `<span class="attribution">✦ 資料整理：${escapeHtml(name || fallback)}</span>`;
};

function findProfessionSkill(route, title) {
  const professionId = route.startsWith('profession/') ? route.split('/')[1] : '';
  const profession = state.professionSkills[professionId];
  if (!profession) return null;
  return [...profession.active, ...profession.passive].find(skill => skill.name === title) || null;
}

buildSearchItems = function buildSearchItemsWithDescriptions() {
  return originalBuildSearchItemsForEnhancements().map(item => {
    if (item.type !== 'combatSkill') return item;
    const skill = findProfessionSkill(item.route, item.title);
    if (!skill) return item;
    const stats = (skill.stats || []).map(stat => `${stat.label} ${stat.value}`).join(' ');
    return {
      ...item,
      description: skill.description ? `${item.description}・${skill.description.split('\n')[0]}` : item.description,
      keywords: `${item.keywords} ${skill.description || ''} ${stats} ${(skill.tags || []).join(' ')}`
    };
  });
};

renderLifeDetail = function renderLifeDetailWithPublicAttribution() {
  originalRenderLifeDetailForEnhancements();
  const source = workspace.querySelector('#life-detail > .attribution');
  if (source) source.textContent = '✦ 資料整理：法那提歐';
};

function renderProfessionSkill(skill, index, type) {
  const hasDetails = Boolean(skill.description || skill.stats?.length);
  const number = String(index + 1).padStart(2, '0');
  const metadata = [skill.rarity, skill.enhancement, ...(skill.tags || [])].filter(Boolean);
  const unlock = skill.unlock ? `<span class="unlock-condition">解鎖條件：${escapeHtml(skill.unlock)}</span>` : '';
  const header = `
    <span class="profession-skill__number" aria-hidden="true">${number}</span>
    <span class="profession-skill__identity">
      <strong>${escapeHtml(skill.name)}</strong>
      <small>${escapeHtml(type)}技能${metadata.length ? `・${escapeHtml(metadata.join('・'))}` : ''}</small>
    </span>
    ${unlock}
  `;

  if (!hasDetails) {
    return `
      <article class="profession-skill profession-skill--summary-only">
        <div class="profession-skill__summary">${header}</div>
        <p class="profession-skill__pending">${escapeHtml(skill.detailStatus || '技能名稱與解鎖條件已依台版遊戲內容整理，詳細效果待補。')}</p>
      </article>
    `;
  }

  return `
    <details class="profession-skill" ${index === 0 ? 'open' : ''}>
      <summary class="profession-skill__summary">
        ${header}
        <span class="profession-skill__toggle" aria-hidden="true">⌄</span>
      </summary>
      <div class="profession-skill__body">
        ${skill.description ? `<p class="profession-skill__description">${escapeHtml(skill.description)}</p>` : ''}
        ${skill.stats?.length ? `
          <dl class="profession-skill__stats">
            ${skill.stats.map(stat => `<dt>${escapeHtml(stat.label)}</dt><dd>${escapeHtml(stat.value)}</dd>`).join('')}
          </dl>
        ` : ''}
        <span class="attribution">✦ 資料整理：法那提歐</span>
      </div>
    </details>
  `;
}

function renderProfessionSkillSection(title, skills, type) {
  return `
    <article class="profession-skill-section">
      <div class="profession-skill-section__head">
        <h2>${escapeHtml(title)}</h2>
        <span>${skills.length} 個</span>
      </div>
      <div class="profession-skill-stack">
        ${skills.map((skill, index) => renderProfessionSkill(skill, index, type)).join('')}
      </div>
    </article>
  `;
}

renderProfession = function renderProfessionWithDetails(id) {
  const profession = state.professionSkills[id];
  if (!profession) {
    navigate('professions');
    return;
  }

  const active = profession.active;
  const passive = profession.passive;
  const detailedCount = [...active, ...passive].filter(skill => skill.description || skill.stats?.length).length;
  setTopbar(`profession/${id}`, profession.name);
  workspace.innerHTML = `
    <section class="profession-hero">
      <div>
        <p class="eyebrow">台版職業手札</p>
        <h1>${escapeHtml(profession.name)}</h1>
        <p>${escapeHtml(profession.description)}</p>
        <span class="attribution">✦ 資料整理：法那提歐</span>
      </div>
      <aside class="profession-summary">
        <span>偏好裝備</span><strong>${escapeHtml(profession.preferredArmor)}</strong>
        <span>技能收錄</span><strong>${active.length + passive.length} 個</strong>
        <span>完整效果</span><strong>${detailedCount} 個</strong>
        <span>資料狀態</span>${badge({status:'tw-confirmed', statusLabel:'台版遊戲資料'})}
      </aside>
    </section>
    <p class="profession-detail-note">點選技能列即可展開遊戲內說明與數值；尚未補齊詳情的技能會保留正常可閱讀樣式，不會被誤標為失效。</p>
    <section class="profession-skill-sections">
      ${renderProfessionSkillSection('主動技能', active, '主動')}
      ${renderProfessionSkillSection('被動技能', passive, '被動')}
    </section>
  `;
};

function applyPublicDataCorrections() {
  if (!state.cooking?.length) return false;
  const snack = state.cooking.find(item => item.id === 'portable-snack');
  if (snack) snack.dish = '擠著吃的點心';
  state.cooking.forEach(item => { item.statusLabel = '台版遊戲資料'; });
  return true;
}

function waitForPublicData() {
  if (!applyPublicDataCorrections()) {
    setTimeout(waitForPublicData, 30);
    return;
  }
  if (getRoute() === 'cooking' || getRoute() === 'search' || getRoute() === 'home') renderRoute();
}

function setupQuickSearch() {
  const oldButton = document.querySelector('#top-search-button');
  const topbar = document.querySelector('.topbar');
  if (!oldButton || !topbar) return;

  const button = oldButton.cloneNode(true);
  oldButton.replaceWith(button);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'quick-search-panel');
  button.setAttribute('aria-label', '開啟全站快速搜尋');

  const panel = document.createElement('section');
  panel.id = 'quick-search-panel';
  panel.className = 'quick-search-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <form class="quick-search-form" role="search">
      <label for="quick-search-input">全站快速搜尋</label>
      <div class="quick-search-field">
        <span aria-hidden="true">⌕</span>
        <input id="quick-search-input" type="search" autocomplete="off" placeholder="輸入料理、生活技能、職業或技能名稱">
      </div>
      <button class="primary-button" type="submit">搜尋</button>
      <button class="quick-search-close" type="button" aria-label="關閉快速搜尋">×</button>
    </form>
  `;
  topbar.insertAdjacentElement('afterend', panel);

  const form = panel.querySelector('form');
  const input = panel.querySelector('input');
  const closeButton = panel.querySelector('.quick-search-close');

  const close = () => {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('quick-search-open');
  };
  const open = () => {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.body.classList.add('quick-search-open');
    input.value = state.searchQuery || '';
    requestAnimationFrame(() => input.focus({preventScroll: true}));
  };

  button.addEventListener('click', () => panel.hidden ? open() : close());
  closeButton.addEventListener('click', () => {
    close();
    button.focus();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    state.searchQuery = input.value.trim();
    state.searchCategory = '全部';
    close();
    navigate('search');
  });
  document.addEventListener('pointerdown', event => {
    if (panel.hidden || panel.contains(event.target) || button.contains(event.target) || (event.target instanceof Element && event.target.closest('#game-guided-tour'))) return;
    close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      close();
      button.focus();
    }
  });
}

function setupBackToTop() {
  const button = document.createElement('button');
  button.className = 'back-to-top';
  button.type = 'button';
  button.hidden = true;
  button.setAttribute('aria-label', '回到頁首');
  button.innerHTML = '<span aria-hidden="true">↑</span>';
  document.body.append(button);

  let ticking = false;
  const update = () => {
    button.hidden = window.scrollY < 720;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, {passive: true});
  button.addEventListener('click', () => {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top: 0, behavior: reduceMotion ? 'auto' : 'smooth'});
  });
  update();
}

setupQuickSearch();
setupBackToTop();
waitForPublicData();
