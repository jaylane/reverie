// IMDb, Rotten Tomatoes and TMDB title elements. When none matches (site redesign), the button floats bottom-right instead.
const TITLE = 'h1[data-testid="hero__pageTitle"], rt-text[slot="title"], section.header .title h2';

function readPage() {
  return {
    url: location.href,
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
    imdbHrefs: [...document.querySelectorAll('a[href*="imdb.com/title/tt"]')].map((a) => a.href),
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
    docTitle: document.title,
  };
}

if (extractFilm(readPage())) {
  const host = document.createElement('span');
  // Closed shadow root so the site's CSS cannot restyle or hide the button.
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      /* Spacing sits on the button: Rotten Tomatoes' ::slotted rules outrank :host margins. */
      :host { display: inline-block; vertical-align: middle; }
      :host([data-floating]) { position: fixed; right: 24px; bottom: 24px; z-index: 2147483647; }
      :host(:not([data-floating])) button { margin-inline-start: 16px; }
      button {
        padding: 10px 18px; border: 0; border-radius: 999px;
        background: #7b5bf5; color: #fff; cursor: pointer;
        font: 600 15px/1 system-ui, sans-serif; letter-spacing: normal; text-transform: none;
        box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
      }
      button:hover { background: #6847e8; }
      button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    </style>
    <button type="button">Stream it</button>`;

  const place = () => {
    const title = document.querySelector(TITLE);
    host.toggleAttribute('data-floating', !title);
    (title ?? document.body).append(host);
  };
  // IMDb re-renders the title on client-side navigation and drops the button with it, so put it back on the new title.
  const observer = new MutationObserver(() => {
    if (!host.isConnected && document.querySelector(TITLE)) place();
  });

  root.querySelector('button').addEventListener('click', () => {
    // Re-read on click: IMDb swaps titles without reloading, so load-time data can be stale.
    const film = extractFilm(readPage());
    if (film) return location.assign(stremioUrl(film));
    // Nothing to open after a client-side jump to a non-film page, so drop the button rather than leave it dead.
    observer.disconnect();
    host.remove();
  });

  place();
  observer.observe(document.body, { childList: true, subtree: true });
}
