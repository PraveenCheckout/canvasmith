/* MV3 service worker: adds "Edit in Canvasmith" to every image's context menu.
   Opens the configured editor with ?image=<url> — the editor's bridge does the rest.
   (URL transport here: extensions can't rely on page-session canvas reads across sites;
   for auth-gated images use the bookmarklet, which runs inside the page.) */
const DEFAULT_EDITOR = 'https://canvasmith.netlify.app/';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'canvasmith-edit', title: 'Edit in Canvasmith', contexts: ['image'] });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'canvasmith-edit' || !info.srcUrl) return;
  const { editorUrl } = await chrome.storage.sync.get({ editorUrl: DEFAULT_EDITOR });
  const sep = editorUrl.includes('?') ? '&' : '?';
  chrome.tabs.create({ url: editorUrl + sep + 'image=' + encodeURIComponent(info.srcUrl) });
});
