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
      /* Spacing and alignment sit on the button: Rotten Tomatoes' ::slotted rules outrank :host margin and vertical-align. */
      :host { display: inline-block; }
      :host([data-floating]) { position: fixed; right: 24px; bottom: 24px; z-index: 2147483647; }
      :host(:not([data-floating])) button { margin-inline-start: 16px; }
      button {
        /* The host's bottom sits on the title baseline; shift the 32px icon so its centre meets the text's (about 0.35em up). */
        position: relative; top: calc(16px - 0.35em); font-size: inherit;
        display: block; width: 32px; height: 32px;
        padding: 0; border: 0; border-radius: 8px; background: none; cursor: pointer;
      }
      :host([data-floating]) button { top: 0; }
      img { display: block; width: 100%; height: 100%; transition: transform 0.12s; }
      button:hover img { transform: scale(1.08); }
      button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
      /* Instant tooltip: the native title tooltip waits about a second. */
      button::after {
        content: attr(aria-label); position: absolute; z-index: 2147483647;
        top: calc(100% + 6px); left: 50%; transform: translateX(-50%);
        padding: 6px 10px; border-radius: 6px; background: #111; color: #fff; white-space: nowrap;
        font: 500 13px/1.2 system-ui, sans-serif; letter-spacing: normal; text-transform: none;
        opacity: 0; pointer-events: none; transition: opacity 0.12s;
      }
      button:hover::after, button:focus-visible::after { opacity: 1; }
      :host([data-floating]) button::after { top: auto; bottom: calc(100% + 6px); left: auto; right: 0; transform: none; }
    </style>
    <button type="button" aria-label="Stream it with Stremio"><img src="${chrome.runtime.getURL('icons/stremio-64.png')}" alt=""></button>`;

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
