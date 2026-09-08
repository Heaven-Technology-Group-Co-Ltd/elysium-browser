# elysium-browser 1.4.0

แอปเว็บเบราว์เซอร์ Windows ธีมอนิเมะ elysium-browser ใช้ Electron 44.2.0 / Chromium / WebContentsView จากโปรเจกต์เดิม หน้าต้อนรับเป็น DOM จริง แยกจากเว็บไซต์ภายนอก

## เปิดแอป

ดับเบิลคลิก `release/elysium-browser-1.4.0-portable.exe` หรือ `Start-Elysium.cmd` ซึ่งเปิดรุ่นล่าสุดพร้อมตัวตนเว็บไซต์ `elysium-browser/<version>` โดยไม่เปิดเผย `Electron/<version>` และยังคง token Chromium สำหรับความเข้ากันได้ ไอคอนอนิเมะ elysium-browser และเลขเวอร์ชันอยู่ใต้โลโก้ ช่องวันใน Calendar กดเลือกได้เต็มพื้นที่ Full screen จาก YouTube และเว็บไซต์จะขยาย WebContents เต็มทั้งหน้าจอจนผู้ใช้สั่งออก ลากหน้าต่างได้เต็มหัวแถบข้าง และไอคอนลำโพงแสดงเฉพาะแท็บที่มีเสียงหรือถูกปิดเสียงไว้ เข้า **การตั้งค่า → Theme Studio** หรือ `elysium://themes` เพื่อเลือกธีม สำหรับพัฒนา:

```powershell
npm ci
npm start
```

## สิ่งที่ใช้ได้

- Calendar ภายในแอป: เมนู **Calendar · ปฏิทิน** หรือ `elysium://calendar` มีตารางเดือนและรายการรายเดือน ค้นหาชื่อ/สถานที่/รายละเอียด ไปยังเดือนที่เลือก และปุ่มวันนี้ เพิ่ม/แก้ไข/ลบนัดหมาย กำหนดเวลาเริ่ม–สิ้นสุด นัดหมายทั้งวันหรือข้ามวัน และ 5 หมวดสี เก็บข้อมูลในเครื่องโดยไม่ต้องมีบัญชีหรืออินเทอร์เน็ต
- Calendar แจ้งผ่าน Windows ขณะเปิด elysium-browser ตามเวลาเครื่อง เลือกไม่เตือน/เมื่อถึงเวลา/ก่อน 5, 15, 30, 60 นาทีหรือ 1 วัน นัดหมายทั้งวันนับเวลาเตือนจาก 09:00 ของวันเริ่มต้น เมื่อเปิดใหม่จะเตือนรายการที่ถึงเวลาและยังไม่สิ้นสุด ไม่เตือนซ้ำรายการเดิม ข้อมูลเดิมสำรองเป็น `elysium-data.json.before-schema-5` ก่อนย้ายเป็น schema 5
- Tabs, URL/search ไทย/อังกฤษ, back/forward/reload/stop, favicon/title, drag reorder, pin/mute/reopen, private tabs และ session restore
- เว็บไซต์ได้รับ User-Agent `elysium-browser/<version>` โดยไม่มี `Electron/<version>` และยังมี Chrome compatibility token เว็บตรวจเบราว์เซอร์ที่ยังไม่รู้จัก elysium-browser อาจจัดกลุ่มเป็น Chrome แต่ดูชื่อ elysium-browser ได้ในรายละเอียด User-Agent
- Bookmarks พร้อมโฟลเดอร์, history พร้อมค้นหา/ล้างตามช่วงเวลา, downloads พร้อมปลายทาง/progress/pause/resume/cancel จริง (resume ขึ้นกับ runtime/เซิร์ฟเวอร์) รายการที่เสร็จในโหมดปกติจะอยู่ในเครื่องข้ามการเปิดแอป (schema 5) และถูกลบออกจากรายการเมื่อไฟล์ในเครื่องหายไป (ลบ/ย้าย/เปลี่ยนชื่อข้างนอก) ส่วน Private ไม่ถูกเก็บ
- Workspaces แยกกลุ่มแท็บ โดย cookies/session ปกติยังใช้ร่วมกัน
- Split View สองเว็บจริง คลิกเว็บหรือหัว L/R เพื่อเลือกด้าน active ปรับสัดส่วนได้ แผงด้านข้างลดพื้นที่เว็บจริง
- Command palette ค้นหาคำสั่ง/แท็บ/บุ๊กมาร์กด้วย Ctrl+K
- Notes & Clip บันทึกด้วยปุ่มบันทึกในเครื่อง มี source URL; มีบอร์ด Post-it 5 สีพร้อมปักหมุด และ Reminders ที่กำหนดวันเวลา ทำเสร็จ เลื่อนเตือน และส่ง Windows notification จริง; Reader อ่านข้อความจากหน้าปัจจุบันโดยไม่ต้องมี LLM โดยเลือกบล็อกเนื้อหาหลักจากคะแนนความหนาแน่นของข้อความและข้ามเมนู/sidebar (หลายคอลัมน์/iframe อาจยังอ่านไม่ครบ)
- Theme Studio: 24 ธีม รวมภาพใหม่จากตัวละคร CHERRY : BODY ZERO และ CYRVOR จำนวน 12 ภาพ (เข้ม 8 / สว่าง 4) แต่ละธีมมีสีเมนู แท็บ ฟอร์ม ปฏิทิน และภาพของตัวเอง มีตัวกรองโทนสี ปุ่มสุ่มธีมใหม่ ภาพตัวอย่างพร้อมแถบสี และจำค่าหลังเปิดแอปใหม่
- ภาพใหม่: Rose Glass, Stellar Library, Titan Sanctuary, Last Light Express, Jade Atelier, Ivory Orbit, Ember Workshop, Lilac Observatory, Cobalt Skyport, Graphite Snow, Scarlet Signal, Honey Cloud รวม wallpaper/thumbnail เพียง 2.7 MB ใช้งานออฟไลน์ ดู [ที่มาและคำสั่งสร้างภาพ](docs/NOVEL_THEMES.md)
- ไอคอนโปรแกรมอนิเมะ elysium-browser สร้างใหม่พร้อมมุมโปร่งใสและ ICO หลายขนาด ดู [ที่มาและคำสั่งสร้างไอคอน](docs/APP_ICON.md)
- ปรับรูปโปรไฟล์/เพื่อน ความเข้มภาพ/แสง ปิดภาพ ลดการเคลื่อนไหว ย่อ sidebar และเลือกภาพพื้นหลังแยกจากสีธีมหรือนำเข้าภาพจากเครื่องได้
- หน้า Home/New Tab ใช้ layout classic แบบรุ่น 1.3 พร้อม search, shortcuts, recent tabs/history, AI actions, workspaces และ Your Today จริง; ไม่มี artwork ไปเปลี่ยนหน้าตาเว็บปลายทาง
- Memory Saver ปิด WebContents จริง แล้วโหลด URL ใหม่เมื่อกลับมา อัตโนมัติต้องเปิดส่วนกลางและอนุญาตรายแท็บ มี hostname exceptions; ป้องกัน active/split/audio/capture/download/iframe และงานค้างที่ตรวจพบ
- Clock/todo เป็นข้อมูลจริง AI/Translate/Weather ต้องตั้งค่า provider ก่อน

## ตั้งค่า provider

เปิด **การตั้งค่า → elysium-browser AI provider** ใส่ API base URL และ model แล้วเลือกยืนยันตัวตนด้วย API key หรือ OAuth ตามที่ backend รองรับ

| Provider | API base URL | ข้อกำหนด |
| --- | --- | --- |
| Ollama | `http://127.0.0.1:11434` | เปิดบริการในเครื่องและติดตั้ง model เอง |
| OpenAI-compatible | HTTPS base URL ของบริการ เช่น `https://your-host/v1` | รองรับ `/models` และ `/chat/completions`; ใส่ key ในช่องของแอปเมื่อบริการต้องการ |
| OpenAI-compatible + OAuth (PKCE) | HTTPS base URL ของ AI backend | ต้องมี authorization endpoint, token endpoint และ public/native client ID; redirect URI เป็น `http://127.0.0.1:<พอร์ต>/oauth/callback` |

API key และ OAuth access/refresh token เข้ารหัสผ่าน Electron safeStorage ของ Windows ใน main process ไม่อยู่ใน renderer/localStorage/bundle OAuth ใช้ Authorization Code + PKCE, ตรวจ `state`, เปิดหน้ารับรองสิทธิ์ในเบราว์เซอร์หลัก และ refresh token ให้อัตโนมัติเมื่อ provider ส่งมา แอปเดสก์ท็อปเป็น public client จึงไม่รับหรือเก็บ client secret

OAuth ตัวเลือกนี้มีไว้สำหรับ OpenAI-compatible backend ที่ผู้ใช้หรือองค์กรตั้งค่า OAuth ไว้ ไม่ใช่การ Sign in ด้วยบัญชี ChatGPT/OpenAI เพราะ OpenAI API สาธารณะไม่ได้เปิด OAuth login สำหรับแอปเดสก์ท็อปทั่วไป ใช้ API key ของ OpenAI ในตัวเลือก OpenAI-compatible แทน เครื่องมือตรวจ connection อ่าน model list จริง แต่ไม่ได้รับรองทุก model พร้อมตอบ

AI/Translate แสดงข้อความที่จะส่งจาก **หน้าปัจจุบันหรือข้อความที่เลือก** ให้ติ๊กยินยอมทุกครั้ง ไม่อ่าน form values/cookies/storage และไม่มี tools หรือสิทธิ์ควบคุมเครื่อง ผลลัพธ์เป็น plain text บันทึกเป็นโน้ตได้ Translate ใช้ provider เดียวกัน ส่วน Reader ทำงานโดยไม่ใช้ AI

Weather เลือก Open-Meteo และระบุเมืองใน Settings จากนั้นกด widget อากาศบน New Tab เพื่อดึงข้อมูลจริง ไม่ขอตำแหน่งอัตโนมัติ ไม่แสดงอุณหภูมิจนกว่าจะตั้งค่าและดึงข้อมูลสำเร็จ

## อัปเดตแอป

เปิด **การตั้งค่า → อัปเดตแอป** เพื่อตรวจเวอร์ชันใหม่จาก GitHub Releases ของ `Heaven-Technology-Group-Co-Ltd/elysium-browser` กดตรวจเองหรือเปิด "ตรวจสอบอัตโนมัติเมื่อเปิดแอป" (ตรวจหนึ่งครั้งหลังเปิด ~30 วินาที ไม่ดาวน์โหลดเอง) เมื่อมีเวอร์ชันใหม่ให้กดดาวน์โหลดก่อน แล้วกดรีสตาร์ทเพื่อติดตั้ง

เวอร์ชัน Setup (NSIS) รองรับติดตั้งอัปเดตอัตโนมัติผ่าน electron-updater ส่วนเวอร์ชัน Portable ไม่รองรับ ให้ดาวน์โหลดไฟล์ใหม่จากหน้า release แทน และขณะรันจากซอร์สโค้ด (`npm start`) จะแสดงสถานะ dev เท่านั้น

## คีย์ลัด

| คีย์ | การทำงาน |
| --- | --- |
| Ctrl+L | ช่องที่อยู่ |
| Ctrl+T / Ctrl+W / Ctrl+Shift+T | เปิด / ปิด / คืนแท็บ |
| Ctrl+Tab / Ctrl+Shift+Tab | สลับแท็บใน workspace |
| Ctrl+1…8 / Ctrl+9 | เลือกตามลำดับ / แท็บสุดท้าย |
| Ctrl+K | Command palette |
| Alt+← / Alt+→ | ย้อนกลับ / ไปข้างหน้า |
| Ctrl+R / F5 / Ctrl+Shift+R | โหลดใหม่ / โหลดใหม่โดยไม่ใช้แคช |
| Escape | หยุดโหลดหรือปิด dialog/palette |
| Ctrl+D / Ctrl+H / Ctrl+J | บุ๊กมาร์ก / ประวัติ / ดาวน์โหลด |
| Ctrl++ / Ctrl+- / Ctrl+0 / F11 | ซูมเข้า / ออก / คืนค่า / เต็มหน้าจอ |

## ตรวจและ build

```powershell
npm run check
npm test
npm run test:e2e
npm run test:native
npm run build
```

`check` ตรวจ syntax (repo ไม่มี TypeScript/linter), `test` ตรวจ URL/storage/migration/layout/provider policy, `test:e2e` เปิด Electron กับเว็บเซิร์ฟเวอร์จริงในเครื่อง ส่วน `test:native` ตรวจ lifecycle โดยเปิด Electron ตรง เพราะ CDP ใน runtime นี้ทำให้แท็บถูกนับว่ากำลังจับภาพ

ทดสอบแพ็กเกจ:

```powershell
$env:ELYSIUM_EXECUTABLE = (Resolve-Path 'release/win-unpacked/elysium-browser.exe').Path
npm run test:e2e
node scripts/verify-scaling.js
node scripts/smoke-online.js
Remove-Item Env:ELYSIUM_EXECUTABLE
```

ทุก script ใช้โปรไฟล์ชั่วคราวแยกจากผู้ใช้ ภาพ native อยู่ใน `docs/screenshots/` ถ่ายด้วย desktopCapturer รวม WebContentsViews ส่วน `draft-*` คือภาพ shell ระหว่างพัฒนา ไม่ใช้แทนหลักฐาน native browsing

`npm run assets:export` ส่งออกภาพจาก `artwork-source/` และ handoff โดยใช้ Sharp เป็น devDependency เท่านั้น `npm run assets:icon` สร้าง PNG และ ICO หลายขนาดจาก `assets/elysium-anime-icon.png` และ `npm run build:dir` สร้างเฉพาะแอป unpacked

## ข้อมูลและ rollback

ใช้ตำแหน่ง `%APPDATA%/elysium-browser` โดยทั่วไป `elysium-data.json` เก็บข้อมูลแอป Cookies/cache อยู่ใน `persist:cherry-web` Schema 5 สำรอง JSON เดิมเป็น `elysium-data.json.before-schema-5` ก่อนเก็บประวัติ downloads ที่เสร็จแล้ว และคง backup เก่า (schema 2/3/4 และ legacy savedTabs) ไว้ โปรไฟล์จาก schema ใหม่กว่าจะไม่ถูกเขียนทับ เปิดครั้งแรกหลังเปลี่ยนชื่อจาก Cherry โปรไฟล์เดิม `%APPDATA%/Cherrywebbrowser` (รวม `cherry-data.json`, cookies และ sessions) จะถูกย้ายมาให้อัตโนมัติ และ `cherry://` URL เก่ายังเปิดได้เหมือนเดิม

Source ก่อนแก้อยู่ที่ `backups/before-anime-20260906-195809` และ build UI 1.4.0 ที่ `release-ui-handoff` (workspace ไม่มี `.git`) หากต้อง rollback ให้ปิดแอปและสำรองทั้งโปรไฟล์ปัจจุบันก่อน เปิดรุ่นเดิมด้วย **สำเนาโปรไฟล์แยก** ผ่าน `ELYSIUM_TEST_PROFILE` หากต้องคืน JSON เก่า ให้คัดลอก `.before-schema-3` ไปยังสำเนานั้น ข้อมูล Post-it/Reminder ที่สร้างหลังย้าย schema จะไม่อยู่ใน JSON เก่า อย่าลบหรือเขียนทับโปรไฟล์หลักเพื่อ rollback

## ข้อจำกัด

Restore คืน URL/workspace/pin/ตัวเลือกพักแท็บ ไม่คืน DOM/form/navigation stack ทั้งหมด Notes ต้องกดบันทึก Reminders จะแจ้งเมื่อแอปกำลังทำงานอยู่ (หากปิดเครื่อง/ปิดแอป ระบบจะแจ้งหลังเปิด elysium-browser ครั้งถัดไป) Memory Saver โหลดหน้าใหม่และรับประกันการกู้ฟอร์มทุกเว็บไม่ได้ รายการดาวน์โหลดที่เสร็จแล้วจะอยู่ข้ามการเปิดแอป (เฉพาะโหมดปกติ ไม่รวม Private) แต่ดาวน์โหลดค้าง/pause ไม่ได้กู้ต่อหลังปิดแอป ไฟล์ที่ดาวน์โหลดยังคงอยู่ Private ไม่เข้า normal history/restore แต่ไฟล์/บุ๊กมาร์กที่สั่งเก็บยังอยู่ และไม่ซ่อนการเชื่อมต่อจากเว็บหรือเครือข่าย

Reader เลือกบล็อกเนื้อหาหลักอัตโนมัติแต่ยังอ่านหลายคอลัมน์/iframe ได้ไม่ครบ ยังไม่มี ad/tracker blocking rule engine, Chrome extension manager, password manager, account sync ไม่รับรอง OAuth/DRM/ทุกเว็บไซต์ EXE ยังไม่ได้ลงลายเซ็นดิจิทัล

ดูผลตรวจรายข้อใน [TEST_REPORT.md](TEST_REPORT.md) และ asset mapping ใน [docs/ARTWORK.md](docs/ARTWORK.md)

## License

Copyright © 2026 Heaven Technology Group Co., Ltd. and Heaven Technologies.

Source code is licensed under the [Apache License 2.0](LICENSE).

CYRVOR and Cherry artwork, characters, logos, trademarks, and brand assets
are separate copyrighted materials. See [ASSETS-LICENSE.md](ASSETS-LICENSE.md).
