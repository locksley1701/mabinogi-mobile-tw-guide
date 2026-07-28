const renderCookingBeforeSidebarFilter = renderCooking;
const renderProfessionBeforeAttributePalette = renderProfession;

const attributeClassMap = [
  ['力量', 'attribute-strength'],
  ['技巧', 'attribute-dexterity'],
  ['智力', 'attribute-intelligence'],
  ['意志', 'attribute-will'],
  ['幸運', 'attribute-luck']
];

function getAttributeClass(value = '') {
  const text = String(value);
  return attributeClassMap.find(([label]) => text.includes(label))?.[1] || '';
}

function decorateAttributeValues(root = document) {
  root.querySelectorAll('.cooking-effect-list span').forEach(token => {
    const attributeClass = getAttributeClass(token.textContent);
    if (attributeClass) token.classList.add('attribute-token', attributeClass);
  });

  root.querySelectorAll('.profession-skill__stats dt').forEach(label => {
    const value = label.nextElementSibling;
    const attributeClass = getAttributeClass(`${label.textContent} ${value?.textContent || ''}`);
    if (!attributeClass) return;
    label.classList.add('attribute-stat-label', attributeClass);
    value?.classList.add('attribute-stat-value', attributeClass);
  });
}

function ensureCookingSidebarFilter() {
  let filter = document.querySelector('#cooking-sidebar-filter');
  if (filter) return filter;

  const cookingLink = document.querySelector('.nav-link[data-route="cooking"]');
  if (!cookingLink) return null;

  filter = document.createElement('section');
  filter.id = 'cooking-sidebar-filter';
  filter.className = 'sidebar-context-filter';
  filter.setAttribute('aria-label', '料理解鎖等級');
  filter.setAttribute('aria-hidden', 'true');
  filter.innerHTML = `
    <p class="sidebar-context-filter__label">料理等級</p>
    <div class="sidebar-context-filter__slot"></div>
  `;
  cookingLink.insertAdjacentElement('afterend', filter);
  return filter;
}

function setCookingSidebarVisibility(visible) {
  const filter = ensureCookingSidebarFilter();
  if (!filter) return;
  filter.classList.toggle('is-visible', visible);
  filter.setAttribute('aria-hidden', String(!visible));
}

renderCooking = function renderCookingWithSidebarFilter() {
  const filter = ensureCookingSidebarFilter();
  const slot = filter?.querySelector('.sidebar-context-filter__slot');
  slot?.replaceChildren();

  renderCookingBeforeSidebarFilter();

  const layout = workspace.querySelector('.cooking-layout');
  const levelNav = workspace.querySelector('.level-nav');
  if (layout) layout.classList.add('cooking-layout--sidebar-filter');
  if (levelNav && slot) {
    levelNav.classList.add('level-nav--sidebar');
    slot.append(levelNav);
  }

  setCookingSidebarVisibility(true);
  decorateAttributeValues(workspace);
};

renderProfession = function renderProfessionWithAttributePalette(id) {
  renderProfessionBeforeAttributePalette(id);
  decorateAttributeValues(workspace);
};

function syncContextualSidebar() {
  setCookingSidebarVisibility(getRoute() === 'cooking');
}

window.addEventListener('hashchange', () => requestAnimationFrame(syncContextualSidebar));
ensureCookingSidebarFilter();
syncContextualSidebar();
