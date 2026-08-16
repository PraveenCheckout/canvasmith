# Browser extension — right-click → "Edit in Canvasmith"

Chrome/Edge/Brave (MV3). Load unpacked: chrome://extensions → Developer mode → Load unpacked →
this folder. Set your hosted editor URL in the extension's Options (defaults to the local demo).

Uses the `?image=<url>` transport. For images behind login (some Midjourney/ChatGPT CDNs reject
cross-origin fetches), prefer the bookmarklet — it reads pixels inside the page's own session.
Icons: add 16/48/128 px PNGs in icons/ and reference them in manifest.json before store submission.
