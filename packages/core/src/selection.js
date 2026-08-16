/* Selection model — marquee (rect/ellipse), freehand lasso, polygon lasso, and a magic wand.

   A selection is plain data: {kind:'rect'|'ellipse'|'poly'|'multipoly', ...geometry, invert?}.
   toPath2D() turns it into a clip path the PaintEngine (and any canvas) can use directly; an
   inverted selection is expressed with an evenodd outer rect. Everything except toPath2D() is
   pure data-in/data-out, so the geometry is unit-testable without a DOM. */

export function startSelection(tool, pt) {
  if (tool === 'lasso') return { kind: 'poly', pts: [pt] };
  return { kind: tool === 'marquee-ellipse' ? 'ellipse' : 'rect', x: pt.x, y: pt.y, w: 0, h: 0, _a: pt };
}

export function updateSelection(sel, pt, opts = {}) {
  if (!sel) return sel;
  if (sel.kind === 'poly') { sel.pts.push(pt); return sel; }
  const a = sel._a;
  let x = Math.min(a.x, pt.x), y = Math.min(a.y, pt.y);
  let w = Math.abs(pt.x - a.x), h = Math.abs(pt.y - a.y);
  if (opts.square) { w = h = Math.max(w, h); x = pt.x < a.x ? a.x - w : a.x; y = pt.y < a.y ? a.y - h : a.y; }
  sel.x = x; sel.y = y; sel.w = w; sel.h = h;
  return sel;
}

/* A selection smaller than a few pixels is a slipped click, not intent. */
export function finalizeSelection(sel) {
  if (!sel) return null;
  const ok = sel.kind === 'poly' ? sel.pts.length > 2 : (sel.w > 6 && sel.h > 6);
  return ok ? sel : null;
}

export function selectionToPath2D(sel, W, H, Path2DImpl) {
  if (!sel) return null;
  const P = Path2DImpl || (typeof Path2D !== 'undefined' ? Path2D : null);
  if (!P) throw new Error('Path2D is unavailable — pass an implementation.');
  const p = new P();
  if (sel.invert) p.rect(0, 0, W, H);
  if (sel.kind === 'ellipse') {
    p.ellipse(sel.x + sel.w / 2, sel.y + sel.h / 2, Math.abs(sel.w / 2), Math.abs(sel.h / 2), 0, 0, 7);
  } else if (sel.kind === 'poly') {
    (sel.pts || []).forEach((pt, i) => i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y));
    p.closePath();
  } else if (sel.kind === 'multipoly') {
    (sel.polys || []).forEach(pl => {
      pl.forEach((pt, i) => i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y));
      p.closePath();
    });
  } else {
    p.rect(sel.x, sel.y, sel.w, sel.h);
  }
  return p;
}

export function selectionFillRule(sel) {
  return sel && sel.invert ? 'evenodd' : 'nonzero';
}

/* Magic-wand flood fill over raw RGBA pixels ({width, height, data}) — pure, node-testable.
   Selects the connected region within `tol` per channel of the seed colour, walks its boundary
   with a Moore contour trace, and returns simplified polygon points plus the bounding box. */
export function floodSelectPolygon(img, sx, sy, tol) {
  const w = img.width, h = img.height, data = img.data;
  if (!w || !h || sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const seed = ((sy * w + sx) << 2);
  const sr = data[seed], sg = data[seed + 1], sb = data[seed + 2], sa = data[seed + 3];
  const mask = new Uint8Array(w * h);
  const stack = [sx, sy];
  let cnt = 0, minx = sx, miny = sy, maxx = sx, maxy = sy;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (mask[p]) continue;
    const i = p << 2;
    if (Math.abs(data[i] - sr) > tol || Math.abs(data[i + 1] - sg) > tol ||
        Math.abs(data[i + 2] - sb) > tol || Math.abs(data[i + 3] - sa) > tol) continue;
    mask[p] = 1; cnt++;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  if (cnt < 8) return null;
  const rect = { x: minx, y: miny, w: (maxx - minx + 1), h: (maxy - miny + 1) };
  let start = -1;
  for (let i = 0; i < w * h; i++) { if (mask[i]) { start = i; break; } }
  const ins = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const sxp = start % w, syp = (start / w) | 0;
  const contour = [[sxp, syp]];
  let cx = sxp, cy = syp, dir = 6, iter = 0, max = (w * h) << 2;
  while (iter++ < max) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + k) % 8;
      const nx = cx + dirs[d][0], ny = cy + dirs[d][1];
      if (ins(nx, ny)) { cx = nx; cy = ny; contour.push([cx, cy]); dir = (d + 5) % 8; found = true; break; }
    }
    if (!found) break;
    if (cx === sxp && cy === syp) break;
  }
  let pts = null;
  if (contour.length >= 8) {
    const stepN = Math.max(1, Math.floor(contour.length / 240));
    pts = [];
    for (let i = 0; i < contour.length; i += stepN) pts.push({ x: contour[i][0], y: contour[i][1] });
  }
  return { pts, rect };
}

/* Convenience: run the wand against a canvas (the flattened scene) at a clicked point. */
export function wandSelect(flatCanvas, pt, tol = 32) {
  const w = flatCanvas.width, h = flatCanvas.height;
  let data;
  try { data = flatCanvas.getContext('2d').getImageData(0, 0, w, h).data; } catch (e) { return null; }
  const r = floodSelectPolygon({ width: w, height: h, data }, Math.round(pt.x), Math.round(pt.y), tol);
  if (!r) return null;
  if (r.pts) return { kind: 'poly', pts: r.pts };
  return { kind: 'rect', ...r.rect };
}
