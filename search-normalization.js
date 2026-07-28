(function attachSearchNormalization(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SearchNormalization = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSearchNormalization() {
  const aliasKindLabels = Object.freeze({
    'former-name': '曾用名',
    'other-version': '其他版本名稱',
    'common-typo': '常見誤稱',
    colloquial: '玩家俗稱',
    abbreviation: '常用簡稱'
  });

  function normalizeSearch(value = '') {
    return String(value)
      .normalize('NFKC')
      .toLocaleLowerCase('zh-Hant-TW')
      .replace(/[・·•‧／/｜|_]+/g, ' ')
      .replace(/[（）()【】\[\]「」『』：:，,。.!！?？]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function definitionsForItem(item, definitions = []) {
    return definitions.filter(definition =>
      definition &&
      definition.targetType === item.type &&
      definition.targetId === item.entityId
    );
  }

  function applyEntityCanonical(item, matchedDefinitions) {
    const entityDefinition = matchedDefinitions.find(definition => definition.scope === 'entity');
    if (!entityDefinition) return item;

    const currentCanonical = item.canonicalName || item.title || '';
    let title = item.title;

    if (title === currentCanonical) {
      title = entityDefinition.canonical;
    } else if (currentCanonical && title.startsWith(`${currentCanonical}｜`)) {
      title = `${entityDefinition.canonical}${title.slice(currentCanonical.length)}`;
    }

    return {
      ...item,
      title,
      canonicalName: entityDefinition.canonical
    };
  }

  function enrichSearchItems(items = [], definitions = []) {
    return items.map(originalItem => {
      const matchedDefinitions = definitionsForItem(originalItem, definitions);
      const item = applyEntityCanonical(originalItem, matchedDefinitions);
      const aliases = matchedDefinitions.flatMap(definition =>
        (definition.aliases || []).map(alias => ({
          ...alias,
          canonical: definition.canonical,
          definitionId: definition.id,
          scope: definition.scope
        }))
      );
      const canonicalTerms = matchedDefinitions.map(definition => definition.canonical);
      const aliasTerms = aliases.map(alias => alias.name);
      return {
        ...item,
        aliases,
        keywords: [item.keywords, ...canonicalTerms, ...aliasTerms].filter(Boolean).join(' ')
      };
    });
  }

  function findMatchedAlias(item, normalizedQuery) {
    if (!normalizedQuery) return null;
    return (item.aliases || []).find(alias => {
      const normalizedAlias = normalizeSearch(alias.name);
      return normalizedAlias === normalizedQuery || normalizedAlias.includes(normalizedQuery);
    }) || null;
  }

  function searchItemMatches(item, query) {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return true;
    return normalizeSearch(`${item.title || ''} ${item.description || ''} ${item.keywords || ''}`)
      .includes(normalizedQuery);
  }

  function aliasKindLabel(kind) {
    return aliasKindLabels[kind] || '搜尋別名';
  }

  return Object.freeze({
    aliasKindLabels,
    normalizeSearch,
    definitionsForItem,
    applyEntityCanonical,
    enrichSearchItems,
    findMatchedAlias,
    searchItemMatches,
    aliasKindLabel
  });
});
