/* mount(el, options) — the complete tool for hosts that don't use React themselves.
   React/ReactDOM are bundled into the built file, so this is one <script> + one call. */

import React from 'react';
import { createRoot } from 'react-dom/client';
import CanvasmithEditor from './CanvasmithEditor.jsx';

export function mount(el, options = {}) {
  const node = typeof el === 'string' ? document.querySelector(el) : el;
  if (!node) throw new Error('mount: element not found.');
  const root = createRoot(node);
  let editor = null;
  root.render(React.createElement(CanvasmithEditor, {
    ...options,
    onReady: (ed) => { editor = ed; options.onReady && options.onReady(ed); },
  }));
  return {
    editor: () => editor,       // the headless Editor — full API access after onReady
    unmount: () => root.unmount(),
  };
}

export { CanvasmithEditor };
