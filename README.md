# Reverie

A Chrome extension that adds a Stremio button next to the film title on IMDb, Rotten Tomatoes and TMDB. Click it and the film opens in the [Stremio](https://www.stremio.com/) desktop app.

## How it picks the film

| Site | What opens in Stremio |
|---|---|
| IMDb | The title's detail page, using the `tt` id in the URL. Series open as series; episode and game pages show no button. |
| TMDB | The detail page, using the IMDb link on the page. |
| Rotten Tomatoes | A Stremio search for the film's name, because the page has no IMDb id. |

The button opens a `stremio://` link, which the desktop app handles. The extension has no background worker, requests no permissions beyond these three sites, and sends no data anywhere.

## Install locally

Requires Chrome and the Stremio desktop app (macOS is the tested platform).

1. Clone the repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the `extension/` folder.
4. Open a film page, for example https://www.imdb.com/title/tt0133093/, and click the Reverie icon beside the title.

The first click asks "Open Stremio?". Tick **Always allow** for that site to skip the prompt next time.

After changing the code, click the reload icon on the extension's card in `chrome://extensions`, then refresh the film page. Tabs that were open before a reload keep running the old version.

## Development

```bash
npm test
```

Runs the unit tests for film detection and link building (`node:test`, tested on Node 26, no dependencies).

| File | Purpose |
|---|---|
| `extension/src/stremio-link.js` | Turns page data into a film and a `stremio://` link. Pure functions, unit-tested. |
| `extension/src/content.js` | Reads the page and places the button next to the title. |
| `test/stremio-link.test.js` | Unit tests. |

The design and the follow-up list (Windows and Linux, a Stremio Web fallback, more sites) are in [`docs/superpowers/plans/2026-11-20-stream-it-button.md`](docs/superpowers/plans/2026-11-20-stream-it-button.md).

## Trademark

Stremio is a trademark of its owners. This project is not affiliated with or endorsed by Stremio. The extension's icon is original; its source is `assets/icon.svg`.
