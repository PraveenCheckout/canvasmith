const DEFAULT_EDITOR = 'https://canvasmith.netlify.app/';
chrome.storage.sync.get({ editorUrl: DEFAULT_EDITOR }).then(v => document.getElementById('u').value = v.editorUrl);
document.getElementById('s').onclick = () =>
  chrome.storage.sync.set({ editorUrl: document.getElementById('u').value.trim() || DEFAULT_EDITOR }).then(() => window.close());
