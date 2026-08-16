/* Snapshot history — undo/redo over serialized scene states.

   Deliberately snapshot-based rather than command-based: with a raster paint layer in the scene,
   inverse commands would have to capture pixel diffs anyway, and full-state snapshots make
   undo correct BY CONSTRUCTION for every tool, including ones plugins add later.

   Storage-agnostic: push() takes any string. The Editor feeds it fabric.toJSON(EXTRA) strings. */

export class History {
  constructor(cap = 60) {
    this.past = [];
    this.future = [];
    this.cap = cap;
    this.lock = false;      // set while restoring, so the restore itself is not recorded
  }

  /* Record a state. Consecutive identical states are collapsed — a no-op edit is not an undo step. */
  push(state) {
    if (this.lock || state == null) return false;
    if (state === this.past[this.past.length - 1]) return false;
    this.past.push(state);
    if (this.past.length > this.cap) this.past.shift();
    this.future = [];
    return true;
  }

  canUndo() { return this.past.length >= 2; }
  canRedo() { return this.future.length > 0; }

  /* Returns the state to restore, or null. The CURRENT state moves to the redo stack. */
  undo() {
    if (!this.canUndo()) return null;
    this.future.push(this.past.pop());
    return this.past[this.past.length - 1];
  }

  redo() {
    if (!this.canRedo()) return null;
    const s = this.future.pop();
    this.past.push(s);
    return s;
  }

  depth() { return { past: this.past.length, future: this.future.length }; }
}
