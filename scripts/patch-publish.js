const fs = require('node:fs');

const [owner, repo = 'CYRVOR-CherryBrowser'] = (process.env.GITHUB_REPOSITORY || '').split('/');
if (!owner) process.exit(0);

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.build = pkg.build || {};
pkg.build.publish = { provider: 'github', owner, repo };
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const updaterPath = 'src/updater.js';
const source = fs.readFileSync(updaterPath, 'utf8');
fs.writeFileSync(updaterPath, source.replace(/const REPO = \{ owner: '[^']*', repo: '[^']*' \};/, `const REPO = { owner: '${owner}', repo: '${repo}' };`));

console.log(`publish target set to ${owner}/${repo}`);
