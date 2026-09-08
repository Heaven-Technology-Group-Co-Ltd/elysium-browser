const {spawnSync}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'elysium-lifecycle-'));const env={...process.env,ELYSIUM_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
const r=spawnSync(require('electron'),[path.resolve('scripts/native-lifecycle.js')],{env,stdio:'inherit',timeout:120000,windowsHide:true});process.exitCode=r.status??1;
