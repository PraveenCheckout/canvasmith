# Bookmarklet — "Edit in Canvasmith" from any site

One drag-to-bookmarks-bar install; works on Midjourney web, ChatGPT (DALL·E images), Ideogram,
Leonardo, Krea, Grok/X — anything that shows an `<img>` or `<canvas>`.

## Install
1. Host the editor somewhere (or run the demo: `npm run demo` → `http://localhost:8901/apps/demo/index.html`).
2. Open `generate.html` in a browser, paste your editor URL, and drag the generated link to your
   bookmarks bar. (Or minify `canvasmith-bookmarklet.js` yourself and prefix `javascript:`.)

## How it works
Click the bookmarklet → click any image on the page. The image's pixels are read *inside the
page's own session* (so login-gated CDN images work), then handed to the editor over the
`canvasmith:open` postMessage bridge with retry-until-ack. If the canvas is CORS-tainted it falls
back to sending the URL and the editor fetches it directly.
