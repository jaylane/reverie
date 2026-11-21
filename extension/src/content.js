function readPage() {
  return {
    url: location.href,
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
    imdbHrefs: [...document.querySelectorAll('a[href*="imdb.com/title/tt"]')].map((a) => a.href),
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
  };
}

if (extractFilm(readPage())) {
  const host = document.createElement('div');
  // Closed shadow root so the site's CSS cannot restyle or hide the button.
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      button {
        position: fixed; right: 24px; bottom: 24px; z-index: 2147483647;
        padding: 12px 20px; border: 0; border-radius: 999px;
        background: #7b5bf5; color: #fff; cursor: pointer;
        font: 600 15px/1 system-ui, sans-serif;
        box-shadow: 0 4px 16px rgb(0 0 0 / 0.35);
      }
      button:hover { background: #6847e8; }
      button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    </style>
    <button type="button">Stream it</button>`;
  root.querySelector('button').addEventListener('click', () => {
    // Re-read on click: IMDb swaps titles without reloading, so load-time data can be stale.
    const film = extractFilm(readPage());
    if (film) location.assign(stremioUrl(film));
  });
  document.body.append(host);
}
