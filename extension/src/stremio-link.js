// Classic script: Chrome loads it as a content script, so these top-level functions are globals for content.js.

function ldNodes(jsonLd) {
  const nodes = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    nodes.push(n);
    if (n['@graph']) walk(n['@graph']);
  };
  for (const text of jsonLd) {
    try { walk(JSON.parse(text)); } catch { /* sites ship broken blocks; skip them */ }
  }
  return nodes;
}

function hasType(node, type) {
  return [].concat(node['@type']).includes(type);
}

function firstImdbId(candidates) {
  for (const s of candidates) {
    const m = typeof s === 'string' && s.match(/tt\d{7,}/);
    if (m) return m[0];
  }
  return null;
}

function nodeImdbId(node) {
  return firstImdbId([].concat(node.url, node.sameAs));
}

function isFilm(node) {
  return hasType(node, 'Movie') || hasType(node, 'TVSeries');
}

function extractFilm(page) {
  const nodes = ldNodes(page.jsonLd);
  const urlId = firstImdbId([page.url]);
  if (!urlId && /^https?:\/\/[^/]*imdb\.com\//.test(page.url)) return null;

  let node;
  if (urlId) {
    // IMDb navigates client-side and leaves the previous title's JSON-LD behind, so only trust a node for this id.
    node = nodes.find((n) => nodeImdbId(n) === urlId);
    if (node && !isFilm(node)) return null; // episodes and games have no Stremio page under their own id
  } else {
    node = nodes.find(isFilm);
  }

  const imdbId = urlId || firstImdbId([...(node ? [nodeImdbId(node)] : []), ...page.imdbHrefs]);
  const ogTitle = page.ogTitle?.replace(/\s*\|.*$/, '').replace(/\s*\(\d{4}\)\s*$/, '').trim();
  const title = node?.name || ogTitle || null;
  if (!imdbId && !title) return null;
  const series = node ? hasType(node, 'TVSeries') : /\(TV (Mini )?Series\b/.test(page.docTitle);
  return { type: series ? 'series' : 'movie', imdbId, title };
}

function stremioUrl(film) {
  return film.imdbId
    ? `stremio:///detail/${film.type}/${film.imdbId}`
    : `stremio:///search?search=${encodeURIComponent(film.title)}`;
}

if (typeof module !== 'undefined') module.exports = { extractFilm, stremioUrl };
