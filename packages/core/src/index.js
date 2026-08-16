/* @canvasmith/core — headless image-editor engine on Fabric.js.
   Use the Editor facade for everything, or import the pieces and build your own. */

export { Editor, ALL_TOOLS, SEL_TOOLS, SHAPE_TOOLS } from './editor.js';
export { PaintEngine, PAINT_TOOLS } from './engine.js';
export { History } from './history.js';
export {
  startSelection, updateSelection, finalizeSelection,
  selectionToPath2D, selectionFillRule, floodSelectPolygon, wandSelect,
} from './selection.js';
export { makeShape, makeText, layerLabel, starPoints, uid } from './shapes.js';
export { getCropHandle, dragCropRect, applyCrop } from './crop.js';
export { EXTRA, serialize, restore, exportImage, addImageLayer, artboardForImage } from './io.js';
export { AIRegistry, CAPABILITIES } from './ai/registry.js';
export { GeminiProvider } from './ai/gemini.js';
export { installBridge, openInEditor, installDropImport, parseLaunch, BRIDGE } from './bridge.js';
export { hexRgb, rgba, toHex, relLum } from './color.js';
