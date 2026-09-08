# แก้ error เสียงใน Cherry Browser 1.1.1

จากภาพ `Screenshot 2026-09-06 212624.png`: main process แจ้ง `Cannot read properties of undefined (reading 'audible')` ที่ตัวรับเหตุการณ์เสียงใน `src/main.js`

Electron 44.2.0 ส่ง `audible` อยู่บน event ตัวแรก ตัวรับเดิมอ่าน argument ตัวที่สองซึ่งไม่มี จึงเกิด uncaught exception เมื่อหน้าเว็บเริ่มหรือหยุดมีเสียง แก้ให้รับ `event.audible` ตาม type declaration ของ runtime ที่ติดตั้งและ [Electron API](https://www.electronjs.org/docs/latest/api/web-contents#event-audio-state-changed) ไม่ซ่อน exception ด้วย catch หรือ handler ในแอปจริง

## หลักฐานทดสอบ

- เพิ่ม regression ด้วย HTMLAudioElement เล่น WAV ที่มีคลื่นเสียงจริงใน WebContentsView; เสียงเงียบที่เคยใช้ตรวจ media protection ไม่กระตุ้นเหตุการณ์นี้
- รันบนโค้ดเดิม: ล้มเหลวด้วยข้อความ `Cannot read properties of undefined (reading 'audible')` ตรงกับภาพ
- หลังแก้: ผ่านทั้ง source Electron และ EXE 1.1.1 ที่ build แล้ว เห็นเหตุการณ์ `true → false → true → false` และไม่มี main-process exception
- ตรวจเล่น/หยุดเสียง, mute/unmute ของ WebContents จริง, เล่นในแท็บเบื้องหลัง, ปิดแท็บขณะเล่น และเปิดเว็บต่อได้
- `npm run check`: ผ่าน
- `npm test`: ผ่าน 7/7
- `$env:CHERRY_EXECUTABLE=(Resolve-Path 'release/win-unpacked/Cherrywebbrowser.exe').Path; npx playwright test --grep-invert 'native screenshots'`: ผ่าน 7/7 รวม browser regression เดิม 6 กรณีและเสียง 1 กรณี
- `npm run build`: exit 0; portable 1.1.1 ขนาด 100,976,478 bytes
- `node scripts/verify-package.js`: exit 0; source/assets 26 ไฟล์ตรงกับ app.asar ทุก byte; SHA-256 อยู่ใน [รายงานแพ็กเกจ](package-verification.json)
- [ผลเสียงจาก EXE](audio-regression.json), [ภาพ native ขณะเล่นเสียง](screenshots/audio-error-fixed.png)

ทดสอบโดยใช้เว็บ fixture ในเครื่องและโปรไฟล์ชั่วคราวแยกจากผู้ใช้ ไม่ได้กดปุ่มอ่านออกเสียงบนหน้า Google ตามภาพโดยตรง รอบนี้ไม่มีการแก้ layout จึงไม่ได้รัน screenshot matrix/DPI ซ้ำ ผลตรวจหน้าตา 1.1.0 ยังอยู่ใน TEST_REPORT.md

## ไฟล์ที่เปลี่ยน

- `src/main.js`: แก้ argument ของเหตุการณ์เสียง
- `tests/browser.spec.js`: เพิ่มไฟล์เสียง fixture และ native regression; ดัก error dialog เฉพาะใน test เพื่อให้รายงาน failure แทนรอผู้ใช้กด OK
- `package.json`, `package-lock.json`: รุ่น 1.1.1
- `scripts/verify-package.js`: ใช้เลขรุ่นปัจจุบันหา portable แทนชื่อไฟล์ตายตัว
- `README.md`, `TEST_REPORT.md`, `IMPLEMENTATION_LOG.md` และรายงาน/ภาพใน `docs/`

สำรองไฟล์เดิมไว้ที่ `backups/before-audio-fix-20260906-213259` คง portable 1.1.0 เดิมไว้ และใช้ path/partition/schema ของ user profile เดิม ไม่มีการล้างข้อมูล

เปิดรุ่นแก้ไขด้วย `Start-Cherry.cmd` หรือ `release/Cherrywebbrowser-1.1.1-portable.exe`

เปิดแอป 1.1.1 จาก `release/win-unpacked/Cherrywebbrowser.exe` ด้วยโปรไฟล์ปกติแล้ว ตรวจพบหน้าต่าง Cherrywebbrowser และ process ตอบสนองตามปกติ
