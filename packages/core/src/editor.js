/* Editor — the headless facade. One instance per artboard.

     const ed = new Editor({ fabric, canvasEl, width, height });
     ed.setTool('brush'); ed.setToolOptions({ size: 40, color: '#ff0000' });
     ed.undo(); ed.exportPNG(); ed.ai.register(new GeminiProvider());

   Everything a UI needs is events + methods — no DOM of its own, no framework, no globals.
   The React package and the vanilla demo are both thin shells over exactly this class. */

import { PaintEngine, PAINT_TOOLS } from './engine.js';
import { History } from './history.js';
import { startSelection, updateSelection, finalizeSelection, selectionToPath2D, selectionFillRule, wandSelect } from './selection.js';
import { makeShape, makeText, layerLabel, uid } from './shapes.js';
import { getCropHandle, dragCropRect, applyCrop } from './crop.js';
import { EXTRA, serialize, restore, exportImage, addImageLayer, artboardForImage } from './io.js';
import { AIRegistry } from './ai/registry.js';

export const SEL_TOOLS = ['marquee', 'marquee-ellipse', 'lasso', 'wand'];
export const SHAPE_TOOLS = ['rect', 'ellipse', 'line', 'triangle', 'polygon', 'star'];
export const ALL_TOOLS = ['select', 'hand', ...PAINT_TOOLS, ...SEL_TOOLS, ...SHAPE_TOOLS, 'type', 'bucket', 'gradient', 'eyedropper', 'crop'];

export class Editor {
  constructor({ fabric, canvasEl, width = 1080, height = 1080, background = '#ffffff' } = {}) {
    if (!fabric) throw new Error('Pass fabric (v5) into the Editor — it is a peer dependency.');
    this.fabric = fabric;
    this.W = width; this.H = height;
    this._listeners = {};
    this.fc = new fabric.Canvas(canvasEl, {
      width, height, preserveObjectStacking: true, selection: true,
      backgroundColor: background, stopContextMenu: true, fireRightClick: true,
    });
    this.engine = new PaintEngine(fabric, this.fc, width, height);
    this.history = new History(60);
    this.ai = new AIRegistry();
    this.tool = 'select';
    this.toolOpts = { size: 30, opacity: 1, hardness: 0.7, color: '#d4ff45', color2: '#7c3aed', fill: '#d4ff45', tolerance: 32, fontSize: 48, aligned: true };
    this.selection = null;
    this.crop = null;               // {x,y,w,h} while the crop tool is live
    this._drag = null;
    this._bindPointer();
    this._bindModified();
    this.commit('init');
  }

  /* ── events: 'change' (scene), 'tool', 'selection', 'history', 'crop' ─────────────────── */
  on(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._listeners[ev] = (this._listeners[ev] || []).filter(f => f !== fn); }
  _emit(ev, data) { (this._listeners[ev] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); }

  /* ── tools ────────────────────────────────────────────────────────────────────────────── */
  setTool(t) {
    if (!ALL_TOOLS.includes(t)) throw new Error('Unknown tool "' + t + '". Tools: ' + ALL_TOOLS.join(', '));
    this.tool = t;
    const drawing = t !== 'select';
    this.fc.selection = !drawing;
    this.fc.defaultCursor = t === 'hand' ? 'grab' : drawing ? 'crosshair' : 'default';
    this.fc.getObjects().forEach(o => { o.selectable = !drawing && !o.locked; o.evented = !drawing && !o.locked; });
    if (t === 'crop') this.crop = { x: this.W * 0.1, y: this.H * 0.1, w: this.W * 0.8, h: this.H * 0.8 };
    else this.crop = null;
    if (drawing) this.fc.discardActiveObject();
    this.fc.renderAll();
    this._emit('tool', t);
    this._emit('crop', this.crop);
  }

  setToolOptions(patch) { this.toolOpts = { ...this.toolOpts, ...patch }; this._emit('tooloptions', this.toolOpts); }

  /* ── pointer plumbing (scene coordinates come from fabric's own transform) ─────────────── */
  _pt(opt) { return this.fc.getPointer(opt.e); }

  _bindPointer() {
    const fc = this.fc;
    fc.on('mouse:down', (opt) => this._down(opt));
    fc.on('mouse:move', (opt) => this._move(opt));
    fc.on('mouse:up', () => this._up());
    // wheel zoom around the cursor
    fc.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let z = fc.getZoom() * Math.pow(0.999, delta);
      z = Math.min(5, Math.max(0.1, z));
      fc.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
      opt.e.preventDefault(); opt.e.stopPropagation();
      this._emit('zoom', z);
    });
  }

  _applySelClip() {
    this.engine.setClip(selectionToPath2D(this.selection, this.W, this.H), selectionFillRule(this.selection));
  }

  _down(opt) {
    const t = this.tool, pt = this._pt(opt), e = opt.e || {};
    const o = { ...this.toolOpts, alt: e.altKey, shift: e.shiftKey };
    if (t === 'hand' || e.spaceKey) { this._drag = { kind: 'pan', x: e.clientX, y: e.clientY }; return; }
    if (PAINT_TOOLS.includes(t)) {
      this._applySelClip();
      const r = this.engine.down(t, pt, o);
      this._drag = { kind: 'paint' };
      if (r === 'src-set') this._emit('clonesource', pt);
      return;
    }
    if (t === 'marquee' || t === 'marquee-ellipse' || t === 'lasso') {
      this.selection = startSelection(t, pt);
      this._drag = { kind: 'sel' };
      return;
    }
    if (t === 'wand') {
      this.engine.captureFlat();
      const sel = wandSelect(this.engine._flat, pt, this.toolOpts.tolerance);
      this.selection = sel ? { ...sel, invert: e.altKey || undefined } : null;
      this._emit('selection', this.selection);
      this.fc.renderAll();
      return;
    }
    if (SHAPE_TOOLS.includes(t)) {
      const obj = makeShape(this.fabric, t, pt, this.toolOpts);
      if (obj) { this.fc.add(obj); this.fc.setActiveObject(obj); this.commit('shape'); }
      return;
    }
    if (t === 'type') {
      const txt = makeText(this.fabric, pt, this.toolOpts);
      this.fc.add(txt); this.fc.setActiveObject(txt); txt.enterEditing && txt.enterEditing();
      this.commit('text');
      return;
    }
    if (t === 'bucket') {
      this._applySelClip();
      this.engine.fill(this.toolOpts.color);
      this.commit('bucket');
      return;
    }
    if (t === 'gradient') { this._drag = { kind: 'gradient', from: pt }; return; }
    if (t === 'eyedropper') {
      const hex = this.engine.sample(pt);
      if (hex) { this.setToolOptions({ color: hex }); this._emit('eyedropper', hex); }
      return;
    }
    if (t === 'crop' && this.crop) {
      const handle = getCropHandle(this.crop, pt, this.fc.getZoom());
      if (handle) this._drag = { kind: 'crop', handle, last: pt };
      return;
    }
  }

  _move(opt) {
    const d = this._drag;
    if (!d) return;
    const pt = this._pt(opt), e = opt.e || {};
    if (d.kind === 'pan') {
      const vpt = this.fc.viewportTransform;
      vpt[4] += e.clientX - d.x; vpt[5] += e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      this.fc.requestRenderAll();
      return;
    }
    if (d.kind === 'paint') { this.engine.move(this.tool, pt, { ...this.toolOpts }); return; }
    if (d.kind === 'sel') { updateSelection(this.selection, pt, { square: e.shiftKey }); this.fc.renderAll(); this._emit('selection', this.selection); return; }
    if (d.kind === 'crop') {
      this.crop = dragCropRect(this.crop, d.handle, pt.x - d.last.x, pt.y - d.last.y, this.toolOpts.cropRatio || 0);
      d.last = pt;
      this._emit('crop', this.crop);
      this.fc.renderAll();
      return;
    }
  }

  _up() {
    const d = this._drag; this._drag = null;
    if (!d) return;
    if (d.kind === 'paint') { this.engine.up(); this.engine.setClip(null); this.commit('stroke'); }
    if (d.kind === 'sel') { this.selection = finalizeSelection(this.selection); this._emit('selection', this.selection); }
    if (d.kind === 'gradient' && this.engine._curPt !== null) { /* released without move: ignore */ }
  }

  /* Gradient is click-drag-release across two points. */
  dragGradient(from, to) {
    this._applySelClip();
    this.engine.paintGradient(from.x, from.y, to.x, to.y, this.toolOpts.color, this.toolOpts.color2);
    this.engine.setClip(null);
    this.commit('gradient');
  }

  clearSelection() { this.selection = null; this._emit('selection', null); this.fc.renderAll(); }
  invertSelection() { if (this.selection) { this.selection.invert = !this.selection.invert; this._emit('selection', this.selection); } }

  /* ── history ──────────────────────────────────────────────────────────────────────────── */
  _bindModified() {
    this.fc.on('object:modified', () => this.commit('transform'));
    this.fc.on('text:changed', () => this._soon());
  }
  _soon() { clearTimeout(this._st); this._st = setTimeout(() => this.commit('text-edit'), 350); }

  commit(label) {
    if (this.history.push(serialize(this.fc))) {
      this._emit('history', this.history.depth());
      this._emit('change', { label });
    }
  }
  undo() {
    const s = this.history.undo();
    if (s) restore(this.fc, s, { engine: this.engine, history: this.history, onDone: () => { this._emit('history', this.history.depth()); this._emit('change', { label: 'undo' }); } });
  }
  redo() {
    const s = this.history.redo();
    if (s) restore(this.fc, s, { engine: this.engine, history: this.history, onDone: () => { this._emit('history', this.history.depth()); this._emit('change', { label: 'redo' }); } });
  }

  /* ── layers ───────────────────────────────────────────────────────────────────────────── */
  layers() {
    return this.fc.getObjects().map((o, i) => ({
      id: o.id || (o.id = uid()), index: i, name: layerLabel(o), role: o.role || 'shape',
      visible: o.visible !== false, locked: !!o.locked, opacity: o.opacity != null ? o.opacity : 1,
      blend: o.globalCompositeOperation || 'source-over',
      active: this.fc.getActiveObject() === o,
    })).reverse();   // panel order: topmost first
  }
  _byId(id) { return this.fc.getObjects().find(o => o.id === id); }
  setLayer(id, patch) {
    const o = this._byId(id); if (!o) return;
    if ('visible' in patch) o.visible = patch.visible;
    if ('opacity' in patch) o.opacity = patch.opacity;
    if ('locked' in patch) { o.locked = patch.locked; o.selectable = !patch.locked; o.evented = !patch.locked; }
    if ('blend' in patch) o.globalCompositeOperation = patch.blend;
    if ('name' in patch) { o.name = patch.name; o.renamed = true; }
    this.fc.renderAll(); this.commit('layer');
  }
  moveLayer(id, dir) {
    const o = this._byId(id); if (!o) return;
    if (dir === 'up') this.fc.bringForward(o); else if (dir === 'down') this.fc.sendBackwards(o);
    else if (dir === 'top') this.fc.bringToFront(o); else if (dir === 'bottom') this.fc.sendToBack(o);
    this.fc.renderAll(); this.commit('reorder');
  }
  removeLayer(id) { const o = this._byId(id); if (o) { this.fc.remove(o); this.commit('remove'); } }
  activate(id) { const o = this._byId(id); if (o) { this.fc.setActiveObject(o); this.fc.renderAll(); this._emit('change', { label: 'activate' }); } }

  /* ── crop ─────────────────────────────────────────────────────────────────────────────── */
  applyCrop() {
    if (!this.crop) return;
    const dim = applyCrop(this.fc, this.crop, this.engine);
    this.W = dim.width; this.H = dim.height;
    this.fc.setDimensions(dim);
    this.crop = null;
    this.setTool('select');
    this.commit('crop');
    this._emit('resize', dim);
  }

  /* ── io ───────────────────────────────────────────────────────────────────────────────── */
  async openImage(src, { fitArtboard = true } = {}) {
    if (fitArtboard) {
      const dim = await artboardForImage(src);
      this.W = dim.width; this.H = dim.height;
      this.fc.setDimensions(dim);
      this.engine.W = dim.width; this.engine.H = dim.height;
      this._emit('resize', dim);
    }
    const img = await addImageLayer(this.fabric, this.fc, src, { W: this.W, H: this.H });
    this.commit('open');
    return img;
  }
  addImage(src, opts = {}) { return addImageLayer(this.fabric, this.fc, src, { W: this.W, H: this.H, ...opts }).then(i => { this.commit('image'); return i; }); }
  exportPNG(mult = 1) { return exportImage(this.fc, this.W, this.H, { format: 'png', multiplier: mult }); }
  exportJPEG(quality = 0.92) { return exportImage(this.fc, this.W, this.H, { format: 'jpeg', quality }); }
  toJSON() { return serialize(this.fc); }
  loadJSON(json) { restore(this.fc, json, { engine: this.engine, history: this.history, onDone: () => this.commit('load') }); }

  /* ── AI conveniences (thin sugar over the registry) ───────────────────────────────────── */
  async aiEdit(instruction) {
    const r = await this.ai.run('magicEdit', this.exportPNG(), instruction);
    if (r.status === 'ok') { await this.openImageResult(r.result); }
    return r;
  }
  async aiInsert(prompt) {
    const r = await this.ai.run('generateImage', prompt);
    if (r.status === 'ok') await this.addImage(r.result, { name: prompt.slice(0, 24) });
    return r;
  }
  async openImageResult(dataURL) {
    /* An AI edit replaces the composition: keep history (undo returns to the original). */
    this.fc.getObjects().slice().forEach(o => this.fc.remove(o));
    await this.addImage(dataURL, { name: 'AI edit', fit: 'cover' });
    this.commit('ai');
  }

  destroy() { this.fc.dispose(); this._listeners = {}; }
}
