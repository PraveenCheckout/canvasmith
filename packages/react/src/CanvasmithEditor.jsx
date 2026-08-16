/* <CanvasmithEditor/> — the batteries-included UI over @canvasmith/core.
   Everything it does goes through the public Editor API, so anything you see here you can also
   build yourself against the core. Theme via the `theme` prop (CSS custom properties). */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor, ALL_TOOLS, PAINT_TOOLS, SEL_TOOLS, SHAPE_TOOLS, GeminiProvider, installBridge, installDropImport } from '@canvasmith/core';

const GROUPS = [
  { label: 'Move', tools: [['select', '◇ Select'], ['hand', '✋ Pan'], ['crop', '⬚ Crop']] },
  { label: 'Paint', tools: [['brush', '🖌 Brush'], ['pencil', '✏️ Pencil'], ['eraser', '⌫ Eraser'], ['clone', '⧉ Clone'], ['heal', '✚ Heal'], ['dodge', '☀ Dodge'], ['burn', '◐ Burn'], ['sponge', '◌ Sponge'], ['redeye', '👁 Red-eye']] },
  { label: 'Select', tools: [['marquee', '▭ Marquee'], ['marquee-ellipse', '◯ Ellipse'], ['lasso', '➰ Lasso'], ['wand', '✨ Wand']] },
  { label: 'Draw', tools: [['rect', '▮ Rect'], ['ellipse', '● Ellipse'], ['line', '― Line'], ['triangle', '▲ Triangle'], ['polygon', '⬡ Polygon'], ['star', '★ Star'], ['type', 'T Text'], ['bucket', '▨ Fill'], ['gradient', '▤ Gradient'], ['eyedropper', '💧 Pick']] },
];

const CSS = `
.cm-root{--cm-bg:#141417;--cm-panel:#1b1b20;--cm-line:#2a2a31;--cm-ink:#eceae4;--cm-dim:#9a978f;--cm-accent:#d4ff45;
  display:grid;grid-template-columns:52px 1fr 230px;grid-template-rows:44px 1fr;height:100%;min-height:480px;
  background:var(--cm-bg);color:var(--cm-ink);font:13px/1.45 system-ui,sans-serif}
.cm-top{grid-column:1/4;display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid var(--cm-line);background:var(--cm-panel)}
.cm-rail{display:flex;flex-direction:column;gap:2px;padding:6px 4px;border-right:1px solid var(--cm-line);background:var(--cm-panel);overflow-y:auto}
.cm-rail button{all:unset;cursor:pointer;text-align:center;font-size:15px;padding:7px 0;border-radius:7px;color:var(--cm-dim)}
.cm-rail button:hover{background:var(--cm-bg);color:var(--cm-ink)}
.cm-rail button[data-on=true]{background:var(--cm-accent);color:#111}
.cm-rail .cm-grp{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--cm-dim);text-align:center;margin-top:8px}
.cm-stage{position:relative;overflow:hidden;display:grid;place-items:center;background:repeating-conic-gradient(#151519 0 25%,#101014 0 50%) 0 0/22px 22px}
.cm-side{border-left:1px solid var(--cm-line);background:var(--cm-panel);overflow-y:auto;padding:10px}
.cm-side h4{margin:8px 0 6px;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--cm-dim)}
.cm-layer{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:7px;cursor:pointer;font-size:12px}
.cm-layer:hover{background:var(--cm-bg)}.cm-layer[data-on=true]{outline:1px solid var(--cm-accent)}
.cm-layer .cm-eye{cursor:pointer;opacity:.7}
.cm-btn{all:unset;cursor:pointer;padding:5px 11px;border-radius:7px;border:1px solid var(--cm-line);font-size:12px}
.cm-btn:hover{border-color:var(--cm-accent)}.cm-btn:disabled{opacity:.4;cursor:default}
.cm-top input[type=range]{width:90px}.cm-top input[type=color]{width:26px;height:26px;border:none;background:none;cursor:pointer}
.cm-ai{display:flex;gap:6px;margin-top:6px}.cm-ai input{flex:1;background:var(--cm-bg);border:1px solid var(--cm-line);border-radius:7px;color:var(--cm-ink);padding:5px 8px;font-size:12px}
.cm-note{font-size:11px;color:var(--cm-dim);margin-top:6px;line-height:1.5}
`;

export function CanvasmithEditor({ fabric, width = 1080, height = 1080, image = null, ai = 'gemini', theme = {}, bridge = true, onReady, onExport }) {
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
  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true); setAiMsg('');
    const r = await ed().aiEdit(aiPrompt.trim());
    setAiBusy(false);
    setAiMsg(r.status === 'ok' ? 'Applied ✓ (undo to revert)' : r.message || r.reason);
  };
  const saveKey = (k) => { ed().ai.provider().setKey(k); setNeedKey(!k); };

  const style = Object.fromEntries(Object.entries(theme).map(([k, v]) => ['--cm-' + k, v]));
  return (
    <div className="cm-root" style={style}>
      <style>{CSS}</style>
      <div className="cm-top">
        <strong style={{ fontSize: 13 }}>Canvasmith</strong>
        <button className="cm-btn" disabled={hist.past < 2} onClick={() => ed().undo()}>↩ Undo</button>
        <button className="cm-btn" disabled={!hist.future} onClick={() => ed().redo()}>↪ Redo</button>
        <span style={{ width: 1, height: 20, background: 'var(--cm-line)' }} />
        <label>Size <input type="range" min="2" max="220" value={opts.size} onChange={e => ed().setToolOptions({ size: +e.target.value })} /></label>
        <label>Opacity <input type="range" min="0.05" max="1" step="0.05" value={opts.opacity} onChange={e => ed().setToolOptions({ opacity: +e.target.value })} /></label>
        <input type="color" value={opts.color} onChange={e => ed().setToolOptions({ color: e.target.value, fill: e.target.value })} title="Colour" />
        {tool === 'crop' && <button className="cm-btn" onClick={() => ed().applyCrop()}>✓ Apply crop</button>}
        <span style={{ flex: 1 }} />
        <button className="cm-btn" onClick={() => { const u = ed().exportPNG(); onExport ? onExport(u) : downloadURL(u, 'canvasmith.png'); }}>⬇ PNG</button>
        <button className="cm-btn" onClick={() => { const u = ed().exportJPEG(); onExport ? onExport(u) : downloadURL(u, 'canvasmith.jpg'); }}>⬇ JPG</button>
      </div>
      <div className="cm-rail">
        {GROUPS.map(g => (
          <React.Fragment key={g.label}>
            <div className="cm-grp">{g.label}</div>
            {g.tools.map(([id, label]) => (
              <button key={id} data-on={tool === id} title={label} onClick={() => pick(id)}>{label.split(' ')[0]}</button>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="cm-stage" ref={stageRef}><canvas ref={canvasRef} /></div>
      <div className="cm-side">
        <h4>Layers</h4>
        {layers.map(l => (
          <div key={l.id} className="cm-layer" data-on={l.active} onClick={() => ed().activate(l.id)}>
            <span className="cm-eye" onClick={e => { e.stopPropagation(); ed().setLayer(l.id, { visible: !l.visible }); }}>{l.visible ? '👁' : '—'}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: l.visible ? 1 : 0.4 }}>{l.name}</span>
            <span className="cm-eye" title="Up" onClick={e => { e.stopPropagation(); ed().moveLayer(l.id, 'up'); }}>↑</span>
            <span className="cm-eye" title="Delete" onClick={e => { e.stopPropagation(); ed().removeLayer(l.id); }}>✕</span>
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
