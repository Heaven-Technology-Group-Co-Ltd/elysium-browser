const asar = require('@electron/asar');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const buildDirectory = process.env.CHERRY_BUILD_DIR || 'release';
const archive = path.resolve(buildDirectory, 'win-unpacked/resources/app.asar');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => (
    entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  ));
}

const checked = [];
for (const file of [...files('src'), ...files('assets')]) {
  const relative = file.replaceAll('\\', '/');
  assert.ok(fs.readFileSync(file).equals(asar.extractFile(archive, path.normalize(relative))), `Stale packaged file: ${relative}`);
  checked.push(relative);
}
const entries = asar.listPackage(archive);
assert.ok(!entries.some(item => /backups|artwork-source|cherry-(?:browser|ui)-handoff|test-results|\.env/i.test(item)));

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const version = require('../package.json').version;
const portable = path.join(buildDirectory, `Cherrywebbrowser-${version}-portable.exe`);
const report = {
  version,
  buildDirectory,
  checkedFiles: checked,
  archiveSHA256: hash(archive),
  portable: { file: portable.replaceAll('\\', '/'), bytes: fs.statSync(portable).size, sha256: hash(portable) },
  sourceAndPackagedAssetsIdentical: true,
};
fs.writeFileSync('docs/package-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ filesChecked: checked.length, version, portableBytes: report.portable.bytes, sourceAndPackagedAssetsIdentical: true }));
