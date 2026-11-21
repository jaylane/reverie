const test = require('node:test');
const assert = require('node:assert/strict');
const { extractFilm, stremioUrl } = require('../extension/src/stremio-link.js');

const page = (p) => ({ url: 'https://example.com/', jsonLd: [], imdbHrefs: [], ogTitle: null, docTitle: '', ...p });
const ld = (o) => JSON.stringify(o);

test('imdb url gives movie id', () => {
  const f = extractFilm(page({ url: 'https://www.imdb.com/title/tt0133093/?ref_=x' }));
  assert.deepEqual(f, { type: 'movie', imdbId: 'tt0133093', title: null });
});

test('url id beats stale json-ld', () => {
  const f = extractFilm(page({
    url: 'https://www.imdb.com/title/tt0234215/',
    jsonLd: [ld({ '@type': 'Movie', url: '/title/tt0133093/', name: 'The Matrix' })],
  }));
  assert.equal(f.imdbId, 'tt0234215');
});

test('tvseries json-ld gives series type', () => {
  const f = extractFilm(page({
    url: 'https://www.imdb.com/title/tt0903747/',
    jsonLd: [ld({ '@type': 'TVSeries', url: '/title/tt0903747/', name: 'Breaking Bad' })],
  }));
  assert.equal(f.type, 'series');
});

test('tmdb imdb link gives id', () => {
  const f = extractFilm(page({
    url: 'https://www.themoviedb.org/movie/603-the-matrix',
    imdbHrefs: ['https://www.imdb.com/title/tt0133093/'],
    ogTitle: 'The Matrix (1999)',
  }));
  assert.deepEqual(f, { type: 'movie', imdbId: 'tt0133093', title: 'The Matrix' });
});

test('rt json-ld without imdb id searches by name', () => {
  const f = extractFilm(page({
    url: 'https://www.rottentomatoes.com/m/the_matrix',
    jsonLd: [ld({ '@type': 'Movie', name: 'The Matrix' })],
  }));
  assert.deepEqual(f, { type: 'movie', imdbId: null, title: 'The Matrix' });
});

test('og:title fallback strips site suffix', () => {
  const f = extractFilm(page({ ogTitle: 'Mission: Impossible - Fallout | Rotten Tomatoes' }));
  assert.equal(f.title, 'Mission: Impossible - Fallout');
});

test('json-ld @graph and arrays are searched', () => {
  const f = extractFilm(page({
    jsonLd: [ld([{ '@type': 'WebPage' }, { '@graph': [{ '@type': ['Movie'], sameAs: ['https://www.imdb.com/title/tt0133093/'] }] }])],
  }));
  assert.equal(f.imdbId, 'tt0133093');
});

test('bad json-ld is ignored', () => {
  const f = extractFilm(page({ jsonLd: ['{not json', ld({ '@type': 'Movie', name: 'Heat' })] }));
  assert.equal(f.title, 'Heat');
});

test('nothing found returns null', () => {
  assert.equal(extractFilm(page({})), null);
});

test('detail url for id', () => {
  assert.equal(stremioUrl({ type: 'series', imdbId: 'tt0903747', title: null }), 'stremio:///detail/series/tt0903747');
});

test('search title is uri-encoded', () => {
  assert.equal(
    stremioUrl({ type: 'movie', imdbId: null, title: 'Amélie & Co: 1/2' }),
    'stremio:///search?search=Am%C3%A9lie%20%26%20Co%3A%201%2F2',
  );
});

test('stale tvseries json-ld does not make a movie a series', () => {
  const f = extractFilm(page({
    url: 'https://www.imdb.com/title/tt0133093/',
    jsonLd: [ld({ '@type': 'TVSeries', url: '/title/tt0903747/', name: 'Breaking Bad' })],
  }));
  assert.equal(f.type, 'movie');
});

test('stale movie json-ld with tv series doc title gives series', () => {
  const f = extractFilm(page({
    url: 'https://www.imdb.com/title/tt0903747/',
    jsonLd: [ld({ '@type': 'Movie', url: '/title/tt0133093/', name: 'The Matrix' })],
    docTitle: 'Breaking Bad (TV Series 2008\u20132013) - IMDb',
  }));
  assert.equal(f.type, 'series');
});

test('imdb episode page gives null', () => {
  const f = extractFilm(page({
    url: 'https://www.imdb.com/title/tt0959621/',
    jsonLd: [ld({ '@type': 'TVEpisode', url: '/title/tt0959621/', name: 'Pilot' })],
  }));
  assert.equal(f, null);
});

test('imdb non-title page gives null', () => {
  const f = extractFilm(page({
    url: 'https://www.imdb.com/name/nm0000206/',
    jsonLd: [ld({ '@type': 'Movie', url: '/title/tt0133093/', name: 'The Matrix' })],
  }));
  assert.equal(f, null);
});
