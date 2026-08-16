/* Unit tests for everything in core that is pure data-in/data-out — runs in bare node,
   no DOM, no fabric. The DOM-touching layers get their coverage from the demo smoke test. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hexRgb, rgba, toHex, relLum } from '../packages/core/src/color.js';
import { History } from '../packages/core/src/history.js';
import { startSelection, updateSelection, finalizeSelection, floodSelectPolygon, selectionFillRule } from '../packages/core/src/selection.js';
import { getCropHandle, dragCropRect } from '../packages/core/src/crop.js';
import { parseLaunch } from '../packages/core/src/bridge.js';
import { starPoints } from '../packages/core/src/shapes.js';

/* ── colour ─────────────────────────────────────────────────────────── */
test('color: hex round-trips and short form expands', () => {
  assert.deepEqual(hexRgb('#d4ff45'), [212, 255, 69]);
  assert.deepEqual(hexRgb('#fff'), [255, 255, 255]);
  assert.equal(toHex(212, 255, 69), '#d4ff45');
  assert.equal(rgba('#000000', 0.5), 'rgba(0,0,0,0.5)');
  assert.equal(toHex(300, -5, 12), '#ff000c');           // clamps out-of-range
});

test('color: relative luminance orders black < mid < white', () => {
  const black = relLum([0, 0, 0]), mid = relLum([128, 128, 128]), white = relLum([255, 255, 255]);
  assert.ok(black < mid && mid < white);
  assert.ok(Math.abs(white - 1) < 1e-9);
});

/* ── history ────────────────────────────────────────────────────────── */
test('history: push/undo/redo with dedupe, cap and lock', () => {
  const h = new History(3);
  assert.equal(h.push('a'), true);
  assert.equal(h.push('a'), false);                      // identical state collapses
  h.push('b'); h.push('c');
  assert.equal(h.canUndo(), true);
  assert.equal(h.undo(), 'b');                           // returns the state to RESTORE
  assert.equal(h.redo(), 'c');
  h.push('d');                                           // cap=3: 'a' fell off
  assert.deepEqual(h.past, ['b', 'c', 'd']);
  assert.equal(h.push('x') && false || (h.lock = true, h.push('y')), false);  // locked = ignored
  h.lock = false;
  h.undo();
  assert.equal(h.future.length, 1);
  h.push('z');
  assert.equal(h.future.length, 0);                      // a new edit clears redo
});

/* ── selection geometry ─────────────────────────────────────────────── */
test('selection: marquee drag produces a normalized rect; tiny drags are rejected', () => {
  const s = startSelection('marquee', { x: 100, y: 100 });
  updateSelection(s, { x: 40, y: 60 });                  // drag up-left
  assert.deepEqual([s.x, s.y, s.w, s.h], [40, 60, 60, 40]);
  assert.ok(finalizeSelection(s));
  const tiny = startSelection('marquee', { x: 0, y: 0 });
  updateSelection(tiny, { x: 4, y: 4 });
  assert.equal(finalizeSelection(tiny), null);           // slipped click, not intent
});

test('selection: shift constrains marquee to a square', () => {
  const s = startSelection('marquee', { x: 10, y: 10 });
  updateSelection(s, { x: 50, y: 30 }, { square: true });
  assert.equal(s.w, s.h);
  assert.equal(s.w, 40);
});

test('selection: inverted selections clip with evenodd', () => {
  assert.equal(selectionFillRule({ kind: 'rect', invert: true }), 'evenodd');
  assert.equal(selectionFillRule({ kind: 'rect' }), 'nonzero');
});

test('magic wand: flood fill finds the square and traces its boundary', () => {
  // 20x20 white image with a 8x8 black square at (5,5)
  const w = 20, h = 20, data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 5; y < 13; y++) for (let x = 5; x < 13; x++) {
    const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0;
  }
  const r = floodSelectPolygon({ width: w, height: h, data }, 8, 8, 32);
  assert.ok(r, 'region found');
  assert.deepEqual(r.rect, { x: 5, y: 5, w: 8, h: 8 });
  assert.ok(r.pts && r.pts.length >= 4, 'boundary polygon traced');
  for (const p of r.pts) {
    assert.ok(p.x >= 5 && p.x <= 12 && p.y >= 5 && p.y <= 12, 'contour stays on the square');
  }
});

test('magic wand: clicking noise smaller than 8px selects nothing', () => {
  const w = 10, h = 10, data = new Uint8ClampedArray(w * h * 4).fill(255);
  const i = (5 * w + 5) * 4; data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;   // single dark pixel
  assert.equal(floodSelectPolygon({ width: w, height: h, data }, 5, 5, 10), null);
});

/* ── crop ───────────────────────────────────────────────────────────── */
test('crop: handle hit-testing respects zoom and priority', () => {
  const c = { x: 100, y: 100, w: 200, h: 100 };
  assert.equal(getCropHandle(c, { x: 100, y: 100 }, 1), 'tl');
  assert.equal(getCropHandle(c, { x: 300, y: 200 }, 1), 'br');
  assert.equal(getCropHandle(c, { x: 200, y: 100 }, 1), 't');
  assert.equal(getCropHandle(c, { x: 200, y: 150 }, 1), 'move');
  assert.equal(getCropHandle(c, { x: 0, y: 0 }, 1), null);
  // zoomed in 4x: tolerance shrinks — 8px from the corner no longer grabs 'tl',
  // it falls through to the interior ('move'), exactly like the parent editor
  assert.equal(getCropHandle(c, { x: 108, y: 100 }, 4), 'move');
  assert.equal(getCropHandle(c, { x: 102, y: 101 }, 4), 'tl');   // 2px away still does
});

test('crop: dragging edges resizes, ratio locks aspect, min size holds', () => {
  const c = { x: 0, y: 0, w: 100, h: 100 };
  assert.deepEqual(dragCropRect(c, 'move', 10, 5), { x: 10, y: 5, w: 100, h: 100 });
  assert.deepEqual(dragCropRect(c, 'r', 50, 0), { x: 0, y: 0, w: 150, h: 100 });
  const locked = dragCropRect(c, 'br', 100, 0, 2);       // ratio 2:1
  assert.equal(locked.w / locked.h, 2);
  const clamped = dragCropRect(c, 'r', -200, 0);
  assert.equal(clamped.w, 24);                           // never collapses below min
});

/* ── bridge launch parsing ──────────────────────────────────────────── */
test('bridge: parses ?image=, #img=, storage handoff, and rejects junk', () => {
  assert.deepEqual(parseLaunch('?image=https%3A%2F%2Fx.com%2Fa.png', '', null),
    { kind: 'url', src: 'https://x.com/a.png' });
  assert.equal(parseLaunch('?image=javascript:alert(1)', '', null), null);   // scheme rejected
  const d = 'data:image/png;base64,AAAA';
  assert.deepEqual(parseLaunch('', '#img=' + encodeURIComponent(d), null), { kind: 'data', src: d });
  assert.deepEqual(parseLaunch('', '', d), { kind: 'storage', src: d });
  assert.equal(parseLaunch('', '', 'not-an-image'), null);
  // URL param beats storage
  assert.equal(parseLaunch('?image=https://x.com/a.png', '', d).kind, 'url');
});

/* ── shapes ─────────────────────────────────────────────────────────── */
test('shapes: starPoints yields 2n vertices alternating radii', () => {
  const pts = starPoints(0, 0, 10, 5, 5);
  assert.equal(pts.length, 10);
  const r0 = Math.hypot(pts[0].x, pts[0].y), r1 = Math.hypot(pts[1].x, pts[1].y);
  assert.ok(Math.abs(r0 - 10) < 1e-9 && Math.abs(r1 - 5) < 1e-9);
});
