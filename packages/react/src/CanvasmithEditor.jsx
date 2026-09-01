/* <CanvasmithEditor/> — the batteries-included UI over @canvasmith/core.
   Everything it does goes through the public Editor API, so anything you see here you can also
   build yourself against the core. Theme via the `theme` prop (CSS custom properties) layers on
   top of the built-in light/dark palettes, which the toolbar toggle switches between. */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor, ALL_TOOLS, PAINT_TOOLS, SEL_TOOLS, SHAPE_TOOLS, GeminiProvider, installBridge, installDropImport } from '@canvasmith/core';

// Compact SVG glyphs for the tool rail — avoids pulling in an icon-font/library dependency.
const ICONS = {
  select: <path d="M4 3l7 16 2-6 6-2z" />,
  hand: <path d="M8 12V5a1.5 1.5 0 0 1 3 0v5m0-4a1.5 1.5 0 0 1 3 0v4m0-2a1.5 1.5 0 0 1 3 0v6m0-3a1.5 1.5 0 0 1 3 0v5c0 4-2 7-6 7h-2c-3 0-4-1-6-4l-2.5-4c-.6-1 .2-2.2 1.4-1.8L8 12" />,
  crop: <path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2" />,
  brush: <path d="M9 15a3 3 0 1 0 4 4c1-1 1-2 0-3l6-6a2 2 0 0 0-3-3l-6 6c-1-1-2-1-3 0Z" />,
  pencil: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  eraser: <path d="M20 20H8l-5-5a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-8 8" />,
  clone: <path d="M8 8h11v11H8zM4 4h11v11" />,
  heal: <path d="M12 4v6m0 4v6M4 12h6m4 0h6" />,
  dodge: <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.4-6.4-1.4 1.4M7 17l-1.4 1.4M17 17l1.4 1.4M7 7 5.6 5.6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />,
  burn: <path d="M12 2c1 4-2 4-2 7a3 3 0 0 0 6 0c0-1-.5-2-1-3 2 1 4 4 4 7a7 7 0 1 1-14 0c0-5 4-7 7-11Z" />,
  sponge: <circle cx="12" cy="12" r="8" />,
  redeye: <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  marquee: <rect x="3" y="5" width="18" height="14" rx="1" strokeDasharray="3 3" />,
  'marquee-ellipse': <ellipse cx="12" cy="12" rx="9" ry="7" strokeDasharray="3 3" />,
  lasso: <path d="M12 3c5 0 9 3 9 6 0 2.5-2.5 4.5-6 5.3.5 1 .3 2.2-.6 3a2.5 2.5 0 0 1-3.8-3.2C6 13.4 3 11.2 3 9c0-3 4-6 9-6Z" />,
  'lasso-poly': <path d="M12 3l8 6-3 9H7L4 9z" />,
  'lasso-mag': <path d="M6 18L16 8M14 4l1.5 1.5M19 7l1.5-1.5M18 12l2 .5M9 3l.5 2M20 17l-1.5 1.5" />,
  wand: <path d="m15 4 1.5 3L20 8.5 16.5 10 15 13l-1.5-3L10 8.5 13.5 7Z M5 21l8-8" />,
  objectselect: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />,
  hoverselect: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  rect: <rect x="3" y="5" width="18" height="14" rx="2" />,
  ellipse: <ellipse cx="12" cy="12" rx="9" ry="7" />,
  line: <path d="M4 20 20 4" />,
  triangle: <path d="M12 3 22 20H2Z" />,
  polygon: <path d="m12 2 9 6.5-3.4 10.5H6.4L3 8.5Z" />,
  star: <path d="m12 2 3 6.5 7 .9-5 4.9 1.2 7-6.2-3.4-6.2 3.4L7 14.3l-5-4.9 7-.9Z" />,
  type: <path d="M5 5h14M12 5v14m-3 0h6" />,
  bucket: <path d="m10 3 9 9-8 8a3 3 0 0 1-4 0l-5-5a3 3 0 0 1 0-4Zm-6 10 9 9M17 4l3 3" />,
  gradient: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 4h18v16H3z" fill="url(#cm-grad-icon)" stroke="none" /></>,
  eyedropper: <path d="m11 8-6.5 6.5a2 2 0 0 0 0 2.8l.2.2a2 2 0 0 0 2.8 0L14 11m3-7 4 4-2.5 2.5-4-4Z" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-1" />,
  redo: <path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h1" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M6.5 6.7C4 8.3 2 12 2 12s4 7 10 7c2 0 3.7-.6 5-1.4M9.9 5.1A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a15.3 15.3 0 0 1-2.2 3" />,
  up: <path d="M18 15 12 9l-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  duplicate: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></>,
  chevron: <path d="M15 18 9 12l6-6" />,
  tool: <path d="M4 21v-6M4 9V3M12 21v-8M12 9V3M20 21v-4M20 13V3M2 15h4M8 9h8M18 17h4" />,
  layers: <><path d="m12 2 9 5-9 5-9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
};

function Icon({ name, size = 15 }) {
  const glyph = ICONS[name];
  if (!glyph) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyph}
    </svg>
  );
}

const GROUPS = [
  { label: 'Move', tools: [['select', 'Select'], ['hand', 'Pan'], ['crop', 'Crop']] },
  { label: 'Paint', tools: [['brush', 'Brush'], ['pencil', 'Pencil'], ['eraser', 'Eraser'], ['clone', 'Clone'], ['heal', 'Heal'], ['dodge', 'Dodge'], ['burn', 'Burn'], ['sponge', 'Sponge'], ['redeye', 'Red-eye']] },
  { label: 'Select', tools: [['marquee', 'Marquee'], ['marquee-ellipse', 'Ellipse'], ['lasso', 'Lasso'], ['lasso-poly', 'Polygon lasso'], ['lasso-mag', 'Magnetic lasso'], ['wand', 'Wand'], ['objectselect', 'Object select'], ['hoverselect', 'Hover select']] },
  { label: 'Draw', tools: [['rect', 'Rect'], ['ellipse', 'Ellipse'], ['line', 'Line'], ['triangle', 'Triangle'], ['polygon', 'Polygon'], ['star', 'Star'], ['type', 'Text'], ['bucket', 'Fill'], ['gradient', 'Gradient'], ['eyedropper', 'Pick']] },
];

const THEMES = {
  dark: { bg: '#141417', panel: '#1b1b20', line: '#2a2a31', ink: '#eceae4', dim: '#9a978f', accent: '#d4ff45', accentInk: '#111', stage: '#0e0e11' },
  light: { bg: '#f4f3ef', panel: '#ffffff', line: '#dedbd2', ink: '#1c1b18', dim: '#726f66', accent: '#6f6a00', accentInk: '#fff', stage: '#e4e2da' },
};

const CSS = `
.cm-root{--cm-bg:#141417;--cm-panel:#1b1b20;--cm-line:#2a2a31;--cm-ink:#eceae4;--cm-dim:#9a978f;--cm-accent:#d4ff45;--cm-accent-ink:#111;--cm-stage:#0e0e11;
  display:grid;grid-template-columns:52px 1fr 230px;grid-template-rows:44px 1fr;height:100%;min-height:480px;
  background:var(--cm-bg);color:var(--cm-ink);font:13px/1.45 system-ui,sans-serif;position:relative}
.cm-root[data-side-collapsed=true]{grid-template-columns:52px 1fr 0px}
.cm-top{grid-column:1/4;display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid var(--cm-line);background:var(--cm-panel)}
.cm-rail{display:flex;flex-direction:column;gap:2px;padding:6px 4px;border-right:1px solid var(--cm-line);background:var(--cm-panel);overflow-y:auto}
.cm-rail button{all:unset;cursor:pointer;text-align:center;display:flex;align-items:center;justify-content:center;padding:9px 0;border-radius:7px;color:var(--cm-dim)}
.cm-rail button:hover{background:var(--cm-bg);color:var(--cm-ink)}
.cm-rail button[data-on=true]{background:var(--cm-accent);color:var(--cm-accent-ink)}
.cm-rail .cm-grp{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--cm-dim);text-align:center;margin-top:8px}
.cm-stage{position:relative;overflow:hidden;display:grid;place-items:center;background:var(--cm-stage)}
.cm-side{border-left:1px solid var(--cm-line);background:var(--cm-panel);overflow-y:auto;overflow-x:hidden;padding:10px;transition:padding .15s}
.cm-root[data-side-collapsed=true] .cm-side{padding:0;width:0}
.cm-side h4{margin:8px 0 6px;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--cm-dim)}
.cm-tabs{display:flex;gap:4px;margin-bottom:10px}
.cm-tabs button{all:unset;cursor:pointer;display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:8px;font-size:12.5px;font-weight:600;color:var(--cm-dim)}
.cm-tabs button:hover{background:var(--cm-bg)}
.cm-tabs button[data-on=true]{background:var(--cm-bg);color:var(--cm-ink)}
.cm-collapse{position:absolute;top:50%;right:229px;transform:translateY(-50%);width:22px;height:36px;border-radius:8px;
  border:1px solid var(--cm-line);background:var(--cm-panel);color:var(--cm-dim);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;transition:right .15s}
.cm-root[data-side-collapsed=true] .cm-collapse{right:0}
.cm-collapse:hover{color:var(--cm-ink);border-color:var(--cm-accent)}
.cm-collapse[data-flip=true] svg{transform:rotate(180deg)}
.cm-align{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:10px 0}
.cm-align button{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;height:28px;border-radius:7px;border:1px solid var(--cm-line);font-size:11px;color:var(--cm-ink)}
.cm-align button:hover{border-color:var(--cm-accent)}
.cm-toggle{all:unset;cursor:pointer;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--cm-line);color:var(--cm-dim)}
.cm-toggle[data-on=true]{background:var(--cm-ink);color:var(--cm-panel);border-color:var(--cm-ink)}
.cm-layer{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:7px;cursor:pointer;font-size:12px}
.cm-layer:hover{background:var(--cm-bg)}.cm-layer[data-on=true]{outline:1px solid var(--cm-accent)}
.cm-layer .cm-eye{cursor:pointer;opacity:.7;display:flex}
.cm-btn{all:unset;cursor:pointer;padding:5px 11px;border-radius:7px;border:1px solid var(--cm-line);font-size:12px;display:inline-flex;align-items:center;gap:6px}
.cm-btn:hover{border-color:var(--cm-accent)}.cm-btn:disabled{opacity:.4;cursor:default}
.cm-icon-btn{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;border:1px solid var(--cm-line);color:var(--cm-ink)}
.cm-icon-btn:hover{border-color:var(--cm-accent)}
.cm-top input[type=range]{width:90px}.cm-top input[type=color]{width:26px;height:26px;border:none;background:none;cursor:pointer}
.cm-ai{display:flex;gap:6px;margin-top:6px}.cm-ai input{flex:1;background:var(--cm-bg);border:1px solid var(--cm-line);border-radius:7px;color:var(--cm-ink);padding:5px 8px;font-size:12px}
.cm-note{font-size:11px;color:var(--cm-dim);margin-top:6px;line-height:1.5}
`;

export function CanvasmithEditor({ fabric, width = 1080, height = 1080, image = null, ai = 'gemini', theme = {}, mode, bridge = true, onReady, onExport }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const edRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [opts, setOpts] = useState({ size: 30, opacity: 1, color: '#d4ff45' });
  const [layers, setLayers] = useState([]);
  const [hist, setHist] = useState({ past: 1, future: 0 });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [needKey, setNeedKey] = useState(false);
  const [mode_, setMode] = useState(mode || 'dark');
  const [sideTab, setSideTab] = useState('tool');
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [snapOn, setSnapOn] = useState(true);

  useEffect(() => {
    const f = fabric || (typeof window !== 'undefined' && window.fabric);
    const ed = new Editor({ fabric: f, canvasEl: canvasRef.current, width, height });
    edRef.current = ed;
    const offs = [
      ed.on('tool', setTool),
      ed.on('history', h => setHist(h)),
      ed.on('change', () => setLayers(ed.layers())),
      ed.on('tooloptions', o => setOpts({ size: o.size, opacity: o.opacity, color: o.color })),
    ];
    if (ai === 'gemini') {
      const p = new GeminiProvider();
      ed.ai.register(p);
      setNeedKey(!p.hasKey());
    } else if (ai && typeof ai === 'object') {
      ed.ai.register(ai);
    }
    const stops = [];
    if (bridge) {
      stops.push(installBridge(src => ed.openImage(src)));
      stops.push(installDropImport(stageRef.current, src => ed.addImage(src)));
    }
    if (image) ed.openImage(image);
    setLayers(ed.layers());
    onReady && onReady(ed);
    return () => { offs.forEach(f2 => f2()); stops.forEach(f2 => f2()); ed.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ed = () => edRef.current;
  const pick = useCallback((t) => ed().setTool(t), []);
  const activeLayer = layers.find(l => l.active);
  const align = (edge) => activeLayer && ed().alignLayer(activeLayer.id, edge);
  const duplicate = () => activeLayer && ed().duplicateLayer(activeLayer.id);
  const toggleSnap = () => { const on = !snapOn; setSnapOn(on); ed().setSnapEnabled(on); };
  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true); setAiMsg('');
    const r = await ed().aiEdit(aiPrompt.trim());
    setAiBusy(false);
    setAiMsg(r.status === 'ok' ? 'Applied ✓ (undo to revert)' : r.message || r.reason);
  };
  const saveKey = (k) => { ed().ai.provider().setKey(k); setNeedKey(!k); };

  const palette = THEMES[mode_] || THEMES.dark;
  const style = Object.fromEntries(Object.entries({ ...palette, 'accent-ink': palette.accentInk, ...theme })
    .filter(([k]) => k !== 'accentInk').map(([k, v]) => ['--cm-' + k, v]));
  return (
    <div className="cm-root" style={style} data-cm-mode={mode_}>
      <style>{CSS}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs><linearGradient id="cm-grad-icon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--cm-accent)" /><stop offset="1" stopColor="var(--cm-ink)" />
        </linearGradient></defs>
      </svg>
      <div className="cm-top">
        <strong style={{ fontSize: 13 }}>Canvasmith</strong>
        <button className="cm-btn" disabled={hist.past < 2} onClick={() => ed().undo()}><Icon name="undo" /> Undo</button>
        <button className="cm-btn" disabled={!hist.future} onClick={() => ed().redo()}><Icon name="redo" /> Redo</button>
        <span style={{ width: 1, height: 20, background: 'var(--cm-line)' }} />
        <label>Size <input type="range" min="2" max="220" value={opts.size} onChange={e => ed().setToolOptions({ size: +e.target.value })} /></label>
        <label>Opacity <input type="range" min="0.05" max="1" step="0.05" value={opts.opacity} onChange={e => ed().setToolOptions({ opacity: +e.target.value })} /></label>
        <input type="color" value={opts.color} onChange={e => ed().setToolOptions({ color: e.target.value, fill: e.target.value })} title="Colour" />
        {tool === 'crop' && <button className="cm-btn" onClick={() => ed().applyCrop()}>✓ Apply crop</button>}
        <span style={{ flex: 1 }} />
        <button className="cm-icon-btn" title={mode_ === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setMode(mode_ === 'dark' ? 'light' : 'dark')}>
          <Icon name={mode_ === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className="cm-btn" onClick={() => { const u = ed().exportPNG(); onExport ? onExport(u) : downloadURL(u, 'canvasmith.png'); }}>⬇ PNG</button>
        <button className="cm-btn" onClick={() => { const u = ed().exportJPEG(); onExport ? onExport(u) : downloadURL(u, 'canvasmith.jpg'); }}>⬇ JPG</button>
      </div>
      <div className="cm-rail">
        {GROUPS.map(g => (
          <React.Fragment key={g.label}>
            <div className="cm-grp">{g.label}</div>
            {g.tools.map(([id, label]) => (
              <button key={id} data-on={tool === id} title={label} onClick={() => pick(id)}><Icon name={id} /></button>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="cm-stage" ref={stageRef}><canvas ref={canvasRef} /></div>
      <button className="cm-collapse" data-flip={sideCollapsed} title={sideCollapsed ? 'Show panel' : 'Hide panel'} onClick={() => setSideCollapsed(s => !s)}>
        <Icon name="chevron" size={13} />
      </button>
      <div className="cm-side">
        {!sideCollapsed && (
          <React.Fragment>
            <div className="cm-tabs">
              <button data-on={sideTab === 'tool'} onClick={() => setSideTab('tool')}><Icon name="tool" size={13} /> Tool</button>
              <button data-on={sideTab === 'layers'} onClick={() => setSideTab('layers')}><Icon name="layers" size={13} /> Layers {layers.length ? <span style={{ color: 'var(--cm-dim)' }}>{layers.length}</span> : null}</button>
            </div>

            {sideTab === 'tool' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Icon name={tool} />
                  <strong style={{ textTransform: 'capitalize' }}>{tool}</strong>
                </div>
                <div className="cm-note" style={{ marginTop: 0 }}>
                  {tool === 'select' ? 'Click a layer on the canvas, or drag to move the selected layer.'
                    : tool === 'crop' ? 'Drag the handles, then Apply crop in the top bar.'
                    : 'Drag on the canvas to use this tool.'}
                </div>
                <button className="cm-toggle" data-on={snapOn} onClick={toggleSnap} style={{ marginTop: 10 }}>
                  {snapOn ? 'Snap: on' : 'Snap: off'}
                </button>
                <h4>Align to canvas</h4>
                <div className="cm-align">
                  {['left', 'center', 'right', 'top', 'middle', 'bottom'].map(edge => (
                    <button key={edge} disabled={!activeLayer} title={'Align ' + edge} onClick={() => align(edge)}>
                      {edge[0].toUpperCase()}
                    </button>
                  ))}
                </div>
                <button className="cm-btn" disabled={!activeLayer} onClick={duplicate}>
                  <Icon name="duplicate" /> Duplicate
                </button>
              </div>
            )}

            {sideTab === 'layers' && (
              <React.Fragment>
                {layers.map(l => (
                  <div key={l.id} className="cm-layer" data-on={l.active} onClick={() => ed().activate(l.id)}>
                    <span className="cm-eye" onClick={e => { e.stopPropagation(); ed().setLayer(l.id, { visible: !l.visible }); }}><Icon name={l.visible ? 'eye' : 'eyeOff'} size={13} /></span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: l.visible ? 1 : 0.4 }}>{l.name}</span>
                    <span className="cm-eye" title="Up" onClick={e => { e.stopPropagation(); ed().moveLayer(l.id, 'up'); }}><Icon name="up" size={13} /></span>
                    <span className="cm-eye" title="Delete" onClick={e => { e.stopPropagation(); ed().removeLayer(l.id); }}><Icon name="close" size={13} /></span>
                  </div>
                ))}
                <h4>AI</h4>
                {needKey ? (
                  <div className="cm-note">
                    AI runs on your own free Gemini key (Google includes free daily usage — no card).
                    Get one at <b>aistudio.google.com/apikey</b>, then paste it:
                    <input style={{ width: '100%', marginTop: 6 }} className="cm-ai-key" placeholder="AIza…" onKeyDown={e => { if (e.key === 'Enter') saveKey(e.target.value.trim()); }} />
                  </div>
                ) : (
                  <React.Fragment>
                    <div className="cm-ai">
                      <input placeholder="e.g. make the background sunset" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runAI(); }} />
                      <button className="cm-btn" disabled={aiBusy} onClick={runAI}>{aiBusy ? '…' : '✦'}</button>
                    </div>
                    {aiMsg && <div className="cm-note">{aiMsg}</div>}
                  </React.Fragment>
                )}
              </React.Fragment>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function downloadURL(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

export default CanvasmithEditor;
