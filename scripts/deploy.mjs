// Builds the arcade and publishes dist/ to the gh-pages branch of this repo's origin (GitHub Pages).
import {execFileSync} from 'node:child_process';
import {cp, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, {cwd, stdio: 'inherit'});
const origin = execFileSync('git', ['remote', 'get-url', 'origin'], {cwd: root}).toString().trim();

run('node', ['scripts/build.mjs']);
const out = await mkdtemp(join(tmpdir(), 'pocket-deploy-'));
try {
  await cp(join(root, 'dist'), out, {recursive: true});
  await writeFile(join(out, '.nojekyll'), '');
  run('git', ['init', '-q', '-b', 'gh-pages'], out);
  run('git', ['add', '-A'], out);
  run('git', ['commit', '-q', '-m', `Deploy ${new Date().toISOString()}`], out);
  run('git', ['push', '-q', '--force', origin, 'gh-pages'], out);
  console.log('Published dist/ to gh-pages on ' + origin);
} finally {
  await rm(out, {recursive: true, force: true});
}
