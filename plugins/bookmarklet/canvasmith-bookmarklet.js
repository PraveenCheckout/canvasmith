/* "Edit in Canvasmith" bookmarklet — SOURCE (readable) version.
   Works on any image-generation site: click it, then click the image you want to edit.
   It reads the pixels IN THE PAGE's session (so auth-gated images work) and hands the editor a
   dataURL over the postMessage bridge. Set EDITOR to wherever you host the editor. */
(function () {
  var EDITOR = (window.CANVASMITH_URL || 'http://localhost:8901/apps/demo/index.html');
  var MSG = 'canvasmith:open';
  function send(dataURL) {
    var child = window.open(EDITOR, '_blank');
    if (!child) return alert('Allow popups for this site.');
    var iv = setInterval(function () { try { child.postMessage({ type: MSG, dataURL: dataURL }, '*'); } catch (e) {} }, 700);
    window.addEventListener('message', function on(ev) {
      if (ev.data && ev.data.type === 'canvasmith:opened') { clearInterval(iv); window.removeEventListener('message', on); }
    });
    setTimeout(function () { clearInterval(iv); }, 20000);
  }
  function grab(img) {
    try {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      send(c.toDataURL('image/png'));
    } catch (e) {
      /* canvas tainted by CORS — fall back to the URL transport; the editor fetches it fresh */
      send(img.currentSrc || img.src);
    }
  }
  var banner = document.createElement('div');
  banner.textContent = '🖼 Click the image to edit in Canvasmith (Esc to cancel)';
  banner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
    'background:#d4ff45;color:#111;font:600 13px system-ui;padding:8px 14px;border-radius:99px;box-shadow:0 8px 30px rgba(0,0,0,.4)';
  document.body.appendChild(banner);
  function cleanup() { banner.remove(); document.removeEventListener('click', onClick, true); document.removeEventListener('keydown', onKey, true); }
  function onClick(e) {
    var img = e.target.closest('img') || (e.target.tagName === 'CANVAS' ? e.target : null);
    if (!img) return;
    e.preventDefault(); e.stopPropagation();
    if (img.tagName === 'CANVAS') { try { send(img.toDataURL('image/png')); } catch (err) { alert('Canvas is CORS-protected.'); } }
    else grab(img);
    cleanup();
  }
  function onKey(e) { if (e.key === 'Escape') cleanup(); }
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
})();
