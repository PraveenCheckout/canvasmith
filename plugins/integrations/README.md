# Opening generated images in Canvasmith — per-platform recipes

Every path funnels into ONE contract (see `core/src/bridge.js`):
`?image=<url>` · `#img=<dataURL>` · postMessage `{type:'canvasmith:open', dataURL|url}` ·
`localStorage['canvasmith.open']` (same-origin).

| Platform | Recommended transport | Recipe |
|---|---|---|
| **Midjourney (web)** | Bookmarklet | Images are auth-gated on their CDN — the bookmarklet reads pixels in-session, then postMessages a dataURL. |
| **ChatGPT / DALL·E** | Bookmarklet | Same as Midjourney: blob/auth URLs, so in-page pixel grab is the reliable path. |
| **Ideogram / Leonardo / Krea** | Extension or bookmarklet | Public CDN URLs usually work with plain `?image=`; right-click → Edit in Canvasmith. |
| **Stable Diffusion WebUI (A1111)** | `?image=` | Outputs are served by the local web UI: `http://editor/?image=http://127.0.0.1:7860/file=outputs/....png`. A one-line custom script can add an "Edit" button per gallery item. |
| **ComfyUI** | `?image=` | Add a link node / small JS snippet: `window.open(EDITOR + '?image=' + encodeURIComponent(viewUrl))`. |
| **Your own product** (like the parent platform) | postMessage | `import {openInEditor} from '@canvasmith/core'` → `openInEditor(editorUrl, dataURL)` — retries until the editor acks. |
| **Anything else** | Drag & drop / paste | Zero integration: the editor accepts drops and clipboard images out of the box. |

Security notes for editor hosts:
- The bridge accepts only `data:image/*` and `http(s)` strings — payloads are never executed.
- If you host the editor publicly, consider an allowlist of `ev.origin` values in `installBridge`.
