/*
  Agregador da lista de presentes.
  Edite os arquivos abaixo para manter as categorias separadas:
  - data/lua-de-mel.js
  - data/presentes-virtuais.js
*/
const honeymoonItems = Array.isArray(window.WEDDING_HONEYMOON_ITEMS)
  ? window.WEDDING_HONEYMOON_ITEMS
  : [];
const registryItems = Array.isArray(window.WEDDING_REGISTRY_ITEMS)
  ? window.WEDDING_REGISTRY_ITEMS
  : [];

const WEDDING_ITEMS = [...honeymoonItems, ...registryItems];

window.WEDDING_ITEMS = WEDDING_ITEMS;
