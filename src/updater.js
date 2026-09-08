const { app, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const REPO = { owner: 'Heaven-Technology-Group-Co-Ltd', repo: 'elysium-browser' };
const RELEASES_URL = `https://github.com/${REPO.owner}/${REPO.repo}/releases/latest`;

let onStatus = () => {};
let configured = false;
let status = { state: 'idle', version: null, progress: null, message: '', releasePage: RELEASES_URL };

function setStatus(patch) {
  status = { ...status, ...patch };
  onStatus();
}

function init(publish) {
  onStatus = publish;
  if (!app.isPackaged) {
    setStatus({ state: 'dev', message: 'รันจากซอร์สโค้ด — การอัปเดตใช้ได้เฉพาะเวอร์ชันติดตั้ง (Setup)' });
    return;
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    setStatus({ state: 'unsupported', message: 'เวอร์ชัน Portable ไม่รองรับ auto-update — ดาวน์โหลดไฟล์ใหม่จากหน้า release แทน' });
    return;
  }
  configured = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking', message: 'กำลังตรวจสอบอัปเดต…' }));
  autoUpdater.on('update-available', info => setStatus({ state: 'available', version: info.version, message: `มีเวอร์ชันใหม่ ${info.version} พร้อมดาวน์โหลด` }));
  autoUpdater.on('update-not-available', () => setStatus({ state: 'none', message: 'คุณใช้เวอร์ชันล่าสุดแล้ว' }));
  autoUpdater.on('download-progress', progress => setStatus({ state: 'downloading', progress: Math.round(progress.percent), message: `กำลังดาวน์โหลด ${Math.round(progress.percent)}%` }));
  autoUpdater.on('update-downloaded', info => setStatus({ state: 'ready', version: info.version, progress: 100, message: `ดาวน์โหลดเวอร์ชัน ${info.version} เสร็จแล้ว — รีสตาร์ทเพื่อติดตั้ง` }));
  autoUpdater.on('error', error => setStatus({ state: 'error', message: `ตรวจสอบอัปเดตไม่สำเร็จ: ${error.message}` }));
}

async function check() {
  if (!configured || status.state === 'checking' || status.state === 'downloading') return status;
  try { await autoUpdater.checkForUpdates(); }
  catch (error) { setStatus({ state: 'error', message: `ตรวจสอบอัปเดตไม่สำเร็จ: ${error.message}` }); }
  return status;
}

async function download() {
  if (status.state !== 'available' && status.state !== 'error') throw new Error('ยังไม่มีอัปเดตให้ดาวน์โหลด');
  await autoUpdater.downloadUpdate();
  return status;
}

function install() {
  if (status.state !== 'ready') throw new Error('ยังไม่มีอัปเดตที่ดาวน์โหลดแล้ว');
  autoUpdater.quitAndInstall();
}

function openReleases() {
  shell.openExternal(RELEASES_URL);
}

module.exports = {
  init, check, download, install, openReleases,
  get status() { return status; },
};
