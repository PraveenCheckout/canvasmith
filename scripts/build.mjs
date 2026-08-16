/* Builds the react package with esbuild (via npx, same as the parent platform's pipeline):
   - dist/index.js       ESM, react/react-dom EXTERNAL (for apps that already use React)
   - dist/standalone.js  IIFE, React BUNDLED, exposes window.Canvasmith.mount (one <script> drop-in) */
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync(new URL('../packages/react/dist', import.meta.url), { recursive: true });
const run = (cmd) => { console.log('$', cmd); execSync(cmd, { stdio: 'inherit', cwd: new URL('..', import.meta.url) }); };

run(`npx -y esbuild@0.24.2 packages/react/src/mount.js --bundle --format=esm ` +
    `--external:react --external:react-dom --external:react-dom/client --external:@canvasmith/core ` +
    `--loader:.jsx=jsx --jsx=automatic --outfile=packages/react/dist/index.js`);

run(`npx -y esbuild@0.24.2 packages/react/src/mount.js --bundle --format=iife --global-name=Canvasmith ` +
    `--loader:.jsx=jsx --jsx=automatic --minify --outfile=packages/react/dist/standalone.js ` +
    `--alias:@canvasmith/core=./packages/core/src/index.js`);

console.log('build ok');
