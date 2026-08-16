/* Import bridge — how OTHER platforms open an image directly in the editor.

   Three transports, one contract, so an integration is a single line for anyone:

   1. URL:          https://your-editor.app/?image=<encoded https url>
   2. postMessage:  win = open(editorUrl); win.postMessage({type:'canvasmith:open', dataURL}, origin)
                    — for platforms whose images are behind auth/CORS: they read the pixels
                    themselves and hand us a dataURL, so we never need their cookies.
   3. localStorage handoff (same-origin tools): setItem('canvasmith.open', dataURL) then navigate.

   The editor answers {type:'canvasmith:ready'} to opener/parent on boot, and acks each open with
   {type:'canvasmith:opened'} — senders retry until acked, which closes the race where the message
   arrives before the editor booted. The bookmarklet and browser extension in plugins/ are thin
   wrappers over transport 2. */

const MSG_OPEN = 'canvasmith:open';
const MSG_READY = 'canvasmith:ready';
const MSG_ACK = 'canvasmith:opened';
const LS_KEY = 'canvasmith.open';

/* Pure and unit-testable: what should this launch context open? */
export function parseLaunch(search, hash, lsValue) {
  const q = new URLSearchParams(search || '');
  const url = q.get('image') || q.get('img') || q.get('src');
  if (url && /^https?:\/\//i.test(url)) return { kind: 'url', src: url };
  const h = (hash || '').replace(/^#/, '');
  if (h.startsWith('img=')) {
    const v = decodeURIComponent(h.slice(4));
    if (v.startsWith('data:image/') || /^https?:\/\//i.test(v)) return { kind: h.startsWith('img=data') ? 'data' : 'url', src: v };
  }
  if (lsValue && lsValue.startsWith('data:image/')) return { kind: 'storage', src: lsValue };
  return null;
}

/* Wire the bridge onto a page. onImage(src, meta) is called with a URL or dataURL.
   Returns an unsubscribe function. */
export function installBridge(onImage, { window: win = window, announce = true } = {}) {
  // 1+3: launch params (URL beats storage; storage is consumed so refresh doesn't re-open)
  let ls = null;
  try { ls = win.localStorage.getItem(LS_KEY); } catch (e) { /* sandboxed */ }
  const launch = parseLaunch(win.location.search, win.location.hash, ls);
  if (launch) {
    if (launch.kind === 'storage') { try { win.localStorage.removeItem(LS_KEY); } catch (e) { } }
    Promise.resolve().then(() => onImage(launch.src, { via: launch.kind }));
  }

  // 2: postMessage — accept only image payloads, never execute anything from the message
  const onMsg = (ev) => {
    const d = ev.data;
    if (!d || d.type !== MSG_OPEN) return;
    const src = d.dataURL || d.url;
    if (typeof src !== 'string') return;
    if (!src.startsWith('data:image/') && !/^https?:\/\//i.test(src)) return;
    onImage(src, { via: 'postMessage', origin: ev.origin, name: d.name });
    try { (ev.source || win.opener) && (ev.source || win.opener).postMessage({ type: MSG_ACK }, ev.origin || '*'); } catch (e) { }
  };
  win.addEventListener('message', onMsg);

  // tell whoever opened us that we can receive
  if (announce) {
    try { win.opener && win.opener.postMessage({ type: MSG_READY }, '*'); } catch (e) { }
    try { win.parent !== win && win.parent.postMessage({ type: MSG_READY }, '*'); } catch (e) { }
  }
  return () => win.removeEventListener('message', onMsg);
}

/* The SENDER half — what a platform (or our bookmarklet/extension) calls to open an image in a
   hosted editor. Retries the postMessage until the editor acks. */
export function openInEditor(editorUrl, image, { window: win = window, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = win.open(editorUrl, '_blank');
    if (!child) return reject(new Error('Popup blocked — allow popups for this site.'));
    let done = false;
    const onMsg = (ev) => {
      if (!ev.data) return;
      if (ev.data.type === MSG_READY || ev.data.type === MSG_ACK) {
        if (ev.data.type === MSG_ACK) { done = true; cleanup(); resolve(true); }
        else send();
      }
    };
    const send = () => { try { child.postMessage({ type: MSG_OPEN, dataURL: image.startsWith('data:') ? image : undefined, url: image.startsWith('data:') ? undefined : image }, '*'); } catch (e) { } };
    const iv = setInterval(send, 700);            // belt-and-braces until the ack lands
    const to = setTimeout(() => { cleanup(); done ? null : reject(new Error('Editor did not answer.')); }, timeoutMs);
    const cleanup = () => { clearInterval(iv); clearTimeout(to); win.removeEventListener('message', onMsg); };
    win.addEventListener('message', onMsg);
  });
}

/* Drag-and-drop + paste onto any element: the zero-integration path. */
export function installDropImport(el, onImage, { window: win = window } = {}) {
  const readFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = () => onImage(r.result, { via: 'drop', name: f.name });
    r.readAsDataURL(f);
  };
  const onDrop = (e) => { e.preventDefault(); [...(e.dataTransfer?.files || [])].forEach(readFile); };
  const onDrag = (e) => e.preventDefault();
  const onPaste = (e) => { [...(e.clipboardData?.items || [])].forEach(it => { if (it.kind === 'file') readFile(it.getAsFile()); }); };
  el.addEventListener('drop', onDrop);
  el.addEventListener('dragover', onDrag);
  win.addEventListener('paste', onPaste);
  return () => { el.removeEventListener('drop', onDrop); el.removeEventListener('dragover', onDrag); win.removeEventListener('paste', onPaste); };
}

export const BRIDGE = { MSG_OPEN, MSG_READY, MSG_ACK, LS_KEY };
