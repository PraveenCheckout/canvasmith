# Contributing to Canvasmith

## Run it locally
```bash
npm install       # dev deps only (react, for the standalone bundle)
npm test          # core unit tests — pure node, no browser
npm run build     # packages/react/dist/{index.js, standalone.js}
npm run demo      # http://localhost:8901/apps/demo/index.html — vanilla shell on the core
```

## Ground rules
- **Core stays headless and dependency-free** (fabric is a peer). UI belongs in `packages/react`
  or your own shell; anything DOM-optional belongs behind a plugin.
- Every tool/feature lands with a unit test where the logic is pure, and a line in the demo
  where it isn't — the demo is our integration test.
- Public API (the `Editor` facade) follows semver: breaking changes need a major bump and a
  CHANGELOG entry.
- AI features must degrade: no provider registered → the capability reports unavailable, the
  editor keeps working.

## PRs
Small and focused beats big and heroic. Describe the user-visible behaviour change first,
implementation second. Screenshots/GIFs for anything visual.
