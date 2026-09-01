/* Layout — pure geometry helpers for aligning a layer to the artboard and snapping while dragging.
   Both take plain {left,top,width,height} bounding boxes so they're testable without fabric. */

/* Delta to align a box to one artboard edge/axis. edge: 'left'|'center'|'right'|'top'|'middle'|'bottom'. */
export function alignDelta(box, W, H, edge) {
  const dx = { left: -box.left, center: (W - box.width) / 2 - box.left, right: W - box.width - box.left }[edge];
  const dy = { top: -box.top, middle: (H - box.height) / 2 - box.top, bottom: H - box.height - box.top }[edge];
  return { dx: dx ?? 0, dy: dy ?? 0 };
}

/* Snap a moving box's edges/center to the artboard bounds and to other boxes' edges/centers.
   Returns the {dx,dy} nudge to apply (0 on an axis with no snap within `threshold`). */
export function snapDelta(box, W, H, others, threshold = 8) {
  const targetsX = [0, W / 2, W];
  const targetsY = [0, H / 2, H];
  for (const ob of others) {
    targetsX.push(ob.left, ob.left + ob.width / 2, ob.left + ob.width);
    targetsY.push(ob.top, ob.top + ob.height / 2, ob.top + ob.height);
  }
  const edgesX = [box.left, box.left + box.width / 2, box.left + box.width];
  const edgesY = [box.top, box.top + box.height / 2, box.top + box.height];
  let dx = null, dy = null;
  for (const e of edgesX) for (const t of targetsX) { const d = t - e; if (Math.abs(d) <= threshold && (dx == null || Math.abs(d) < Math.abs(dx))) dx = d; }
  for (const e of edgesY) for (const t of targetsY) { const d = t - e; if (Math.abs(d) <= threshold && (dy == null || Math.abs(d) < Math.abs(dy))) dy = d; }
  return { dx: dx ?? 0, dy: dy ?? 0, snappedX: dx != null, snappedY: dy != null };
}
