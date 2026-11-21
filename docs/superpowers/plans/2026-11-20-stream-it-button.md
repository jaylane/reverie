# Stream It Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Manifest V3 Chrome extension that shows a "Stream it" button on IMDb, Rotten Tomatoes and TMDB film pages and opens that film in the Stremio macOS app.

**Architecture:** A content script, with no service worker and no permissions beyond its match patterns. A pure module (`stremio-link.js`) turns page data (URL, JSON-LD blocks, IMDb links, `og:title`) into a film and then into a `stremio://` deep link. The content script reads the page on click rather than at load, so IMDb's client-side title-to-title navigation still opens the right film. Stremio registers `stremio://` with macOS (verified in `/Applications/Stremio.app/Contents/Info.plist`, v5.1.31), so Chrome's external-protocol handoff opens the app directly.

**Tech Stack:** Plain JavaScript, Manifest V3, no build step. Tests run on `node:test` (Node 26) with no dependencies.

**Spec:** None written. The source is the session request: "render a 'stream it' button on any movie review site ie imdb, rotten tomatoes, tmdb that will search for / open the selected film in the stremio osx app. Only needs to focus on OSX app for MVP but expanding to other operating systems should be planned as follow ups."

## Global Constraints

- Manifest V3 only. No `background.scripts`, `browserAction` or inline scripts.
- MVP sites: `www.imdb.com/title/*`, `www.rottentomatoes.com/m/*`, `www.themoviedb.org/movie/*`.
- No `permissions` and no `host_permissions` beyond content-script `matches`.
- No runtime dependencies. Dev dependencies stay at zero unless a task names one.
- Omit `icons` from the manifest for the MVP. Chrome supplies a default.
- Deep link with an IMDb id: `stremio:///detail/<type>/<imdbId>`, where `<type>` is `movie` or `series`.
- Deep link without an IMDb id: `stremio:///search?search=<encodeURIComponent(title)>`.
- Button label: `Stream it`.

## Review Focus

1. **IMDb soft navigation.** After a client-side jump to another title, a click must open the new film, not the stale JSON-LD one. The URL's `tt` id wins (Task 2 test `url id beats stale json-ld`).
2. **Rotten Tomatoes has no IMDb id.** The button must fall back to a Stremio title search (Task 2 test `rt json-ld without imdb id searches by name`).
3. **Titles with `&`, `:`, `/`, accents.** These must survive URL encoding (Task 2 test `search title is uri-encoded`).
4. **Malformed or array/`@graph` JSON-LD.** It must not throw and kill the button (Task 2 tests `bad json-ld is ignored` and `json-ld @graph and arrays are searched`).
5. **IMDb TV series pages.** `/title/tt…` also covers series. These must open `detail/series`, not an empty movie page (Task 2 test `tvseries json-ld gives series type`).

Not unit-testable, so covered by Task 3's manual QA: Stremio not installed. Chrome then shows nothing, which is accepted for the MVP. Follow-up F2 adds a web fallback.

---

## File Structure

```
reverie/
├── .gitignore
├── package.json                 # "test": "node --test"
├── extension/
│   ├── manifest.json
│   └── src/
│       ├── stremio-link.js      # pure: page data → film → deep link
│       └── content.js           # DOM read, shadow-DOM button, click handler
└── test/
    └── stremio-link.test.js
```

`stremio-link.js` is a classic script, so Chrome can load it as a content script. Its top-level functions become globals that `content.js` calls. It ends with a CommonJS guard so Node tests can `require` it:

```js
if (typeof module !== 'undefined') module.exports = { extractFilm, stremioUrl };
```

---

### Task 1: Scaffold and confirm Stremio deep links

**Files:**
- Create: `.gitignore`, `package.json`

**Interfaces:**
- Produces: the two confirmed deep-link formats in Global Constraints. If the spike disproves either one, update Global Constraints before Task 2.

- [ ] **Step 1: Confirm the detail link opens The Matrix in Stremio**

Run: `open 'stremio:///detail/movie/tt0133093'`
Expected: Stremio comes to the front on The Matrix (1999) detail page.

- [ ] **Step 2: Confirm the series link**

Run: `open 'stremio:///detail/series/tt0903747'`
Expected: Stremio shows Breaking Bad's series page.

- [ ] **Step 3: Confirm the search link**

Run: `open 'stremio:///search?search=Am%C3%A9lie'`
Expected: Stremio's search page with "Amélie" results.
If this fails, try `stremio:///#/search?search=Am%C3%A9lie` and record whichever works in Global Constraints.

- [ ] **Step 4: Init the repo and scaffold**

`git init`. `.gitignore` lists `node_modules/`, `.remember/`, `.agents/`, `.claude/`, `.hermes/`.
`package.json`: `{"name":"reverie","private":true,"scripts":{"test":"node --test"}}`. Leave out `"type"`, so `.js` stays CommonJS for tests.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json skills-lock.json docs/
git commit -m "chore: scaffold reverie extension"
```

---

### Task 2: Film extraction and deep links (pure module)

**Files:**
- Create: `extension/src/stremio-link.js`
- Test: `test/stremio-link.test.js`

**Interfaces:**
- Produces:
  - `PageData = { url: string, jsonLd: string[], imdbHrefs: string[], ogTitle: string|null, docTitle: string }`. Here `jsonLd` holds the raw text of each `script[type="application/ld+json"]`, and `imdbHrefs` holds the `href` of each `a[href*="imdb.com/title/tt"]`.
  - `Film = { type: 'movie'|'series', imdbId: string|null, title: string|null }`
  - `extractFilm(page: PageData) -> Film|null`. Returns null when neither an id nor a title is found.
  - `stremioUrl(film: Film) -> string`

Resolution order for `extractFilm`:
1. **imdbId** comes from the first source that has one: `/tt\d{7,}/` in `page.url`, then JSON-LD `url` or `sameAs` (string or array), then `page.imdbHrefs`.
2. **type** is `series` when any JSON-LD node's `@type` (string or array) includes `TVSeries`. Otherwise it is `movie`.
3. **title** is the JSON-LD `Movie` or `TVSeries` node's `name`. Otherwise it is `ogTitle` with a trailing ` | …` and then a trailing ` (yyyy)` removed.

JSON-LD is searched across top-level arrays and `@graph`. `JSON.parse` failures are skipped per block.

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractFilm, stremioUrl } = require('../extension/src/stremio-link.js');

const page = (p) => ({ url: 'https://example.com/', jsonLd: [], imdbHrefs: [], ogTitle: null, ...p });
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
    jsonLd: [ld({ '@type': 'TVSeries', name: 'Breaking Bad' })],
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module '../extension/src/stremio-link.js'`

- [ ] **Step 3: Implement `extractFilm` and `stremioUrl` in `extension/src/stremio-link.js`**

Use top-level `function` declarations, not `const`, so they become content-script globals. End with the CommonJS guard from File Structure.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: `# pass 11`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add extension/src/stremio-link.js test/stremio-link.test.js
git commit -m "feat: extract film from page data and build stremio deep link"
```

---

### Task 3: Content script, button and manifest

**Files:**
- Create: `extension/manifest.json`, `extension/src/content.js`

**Interfaces:**
- Consumes: `extractFilm(page: PageData) -> Film|null` and `stremioUrl(film: Film) -> string` from Task 2, as globals.
- Produces: `readPage() -> PageData` in `content.js`, built from `location.href` and the selectors named in Task 2.

Manifest values:

```json
{
  "manifest_version": 3,
  "name": "Reverie: Stream it",
  "version": "0.1.0",
  "description": "Adds a Stream it button to IMDb, Rotten Tomatoes and TMDB film pages that opens the film in Stremio.",
  "content_scripts": [{
    "matches": [
      "https://www.imdb.com/title/*",
      "https://www.rottentomatoes.com/m/*",
      "https://www.themoviedb.org/movie/*"
    ],
    "js": ["src/stremio-link.js", "src/content.js"],
    "run_at": "document_idle"
  }]
}
```

`content.js` behavior:
- On load, if `extractFilm(readPage())` is null, render nothing.
- Otherwise attach a closed shadow root to a host `div` on `document.body`, so page CSS cannot restyle the button. The root holds one `<button type="button">Stream it</button>`, fixed at bottom-right with `z-index: 2147483647`.
- On click, recompute `extractFilm(readPage())`, which covers soft navigation. If the result is non-null, run `location.assign(stremioUrl(film))`.

- [ ] **Step 1: Write `manifest.json` and `content.js`**

- [ ] **Step 2: Load the extension**

In `chrome://extensions`, turn on Developer mode, choose Load unpacked, and pick `extension/`.
Expected: no errors badge on the card.

- [ ] **Step 3: Run the manual QA matrix**

| Page | Click result in Stremio |
|---|---|
| `https://www.imdb.com/title/tt0133093/` | The Matrix detail |
| IMDb: from The Matrix, click a "More like this" title, then click Stream it | the new title's detail, not The Matrix |
| `https://www.imdb.com/title/tt0903747/` | Breaking Bad series page |
| `https://www.themoviedb.org/movie/603-the-matrix` | The Matrix detail |
| `https://www.rottentomatoes.com/m/the_matrix` | search results for "The Matrix" |
| `https://www.imdb.com/` (not a title page) | no button rendered |
| `https://www.imdb.com/title/tt0959621/` (episode) | no button rendered |
| IMDb title page → click a cast member (client-side jump to `/name/…`) → click Stream it | button disappears, Stremio not opened |
| IMDb search for "Heat", click the result (may be a client-side jump into `/title/…`) | button present; if missing until reload, file follow-up F8 |

The first click shows Chrome's "Open Stremio?" prompt. Tick "Always allow" per site.
Then quit Stremio, rename `/Applications/Stremio.app`, click the button, and record what Chrome does. This feeds follow-up F2. Rename the app back afterwards.

- [ ] **Step 4: Run the unit tests again**

Run: `npm test`
Expected: `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add extension/manifest.json extension/src/content.js
git commit -m "feat: render Stream it button on IMDb, RT and TMDB film pages"
```

---

## Follow-ups (separate plans)

| # | Follow-up | Why it is not in the MVP |
|---|---|---|
| F1 | **Windows and Linux.** Stremio registers `stremio://` on both, so the MVP likely already works there. Run Task 3's QA matrix on each OS and fix any scheme differences in `stremioUrl`. | Needs the other machines to verify. |
| F2 | **Web fallback.** Add an options page with "Open in: App / Stremio Web" (`https://web.stremio.com/#/detail/...`). Default it per OS via `chrome.runtime.getPlatformInfo` in a service worker. | Covers machines without the app. The MVP targets this Mac, which has it. |
| F3 | **Exact match on Rotten Tomatoes.** Resolve title to IMDb id through Cinemeta (`https://v3-cinemeta.strem.io/catalog/movie/top/search=<title>.json`) in a service worker, then deep-link to the detail page instead of search. | Adds a host permission and a network call. Search already works. |
| F4 | **More sites (Letterboxd, Metacritic, Trakt).** Add `matches` and QA rows. Letterboxd exposes IMDb links, so `imdbHrefs` covers it. "Any site" is opt-in `optional_host_permissions` plus `chrome.scripting.registerContentScripts`. | Each site is one QA row. "Any site" needs a permission UX. |
| F5 | **TV on RT and TMDB** (`/tv/*`). Add the matches. Type detection already reads `TVSeries` JSON-LD. | The request scoped to films. |
| F6 | **Inline placement** next to each site's title or watchlist button instead of floating. | Per-site selectors break on redesigns. A floating button never does. |
| F8 | **IMDb client-side entry to title pages.** Match `https://www.imdb.com/*` and show or hide the button as the URL gains or loses a `tt` id. | Unverified whether IMDb routes into title pages client-side; QA row decides. |
| F7 | **Icons and Chrome Web Store** listing, with `CHROMEWEBSTORE.md`. | Only after the button proves useful locally. |
