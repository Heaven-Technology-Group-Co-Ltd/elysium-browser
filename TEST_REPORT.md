# elysium-browser — ผลตรวจรับ

เวอร์ชัน 1.4.0 rebrand (8 กันยายน 2026): เปลี่ยนชื่อผลิตภัณฑ์เป็น elysium-browser ทั้งหมด ตรวจ source `npm run check` ผ่าน, unit 21/21 (เพิ่มเคส legacy profile + `cherry://` alias), e2e 24/24 ผ่านทั้งหมด (แก้ capture ใช้ setContentSize, download fixture แบบ slow, พบ+แก้บั๊ก slice(9)/elysiumCalendar) พร้อมอัปเดต screenshots หลักฐานให้ตรง UI ใหม่ Copyright: Heaven Technology Group Co., Ltd. and Heaven Technologies (package.json, README, PROJECT_SUMMARY, ASSETS-LICENSE)

เวอร์ชัน 1.4.0 (8 กันยายน 2026): ตรวจ source `npm run check` ผ่าน, unit 20/20 (เพิ่มเคส downloads sanitize/persist, prune ไฟล์ที่หายไปจากดิสก์ และ migration schema 4 → 5 พร้อม backup `.before-schema-5`; แก้ชื่อเคส calendar เป็น schema 5) รัน `test:e2e` ได้ 16/24 — 7 เคสตกล้วนที่ helper `capture()` เพราะขนาดหน้าต่างจริงเพี้ยน 2px บนเครื่องนี้ (1442 แทน 1440 เป็นต้น) และเคส downloads pause/resume ตกที่จังหวะ pause แข่งกับสตรีม 2MB (~0.6s) พิสูจน์แล้วว่า baseline 1.3.13 ที่ไม่แตะโค้ดก็ตกแบบเดียวกันทั้ง 2 อาการ จึงไม่ใช่ regression จากงานนี้ `test:native` ผ่าน (20-tab lifecycle, suspend/dispose, download guard ผ่าน DownloadItem จริง) เหลือ build/verify แพ็กเกจก่อนปิดเวอร์ชัน

อัปเดต 1.3.13 (7 กันยายน 2026): เว็บไซต์ได้รับตัวตน `elysium-browser/1.3.13` ทั้งใน HTTP User-Agent และ `navigator.userAgent` โดยไม่มี token `Electron/44.2.0` พร้อมคง `Chrome/<runtime>` และ Safari compatibility tokens เพื่อไม่ทำลายเว็บไซต์ที่ตรวจ Chromium หน้า Settings แสดงชื่อ `elysium-browser Browser System` และเวอร์ชัน runtime ตรงกัน

ตรวจ source identity 1/1, unit 18/18 และ regression Calendar/audio/fullscreen 3/3 ผ่าน ตรวจ packaged EXE 4/4, FileVersion 1.3.13, ProductVersion 1.3.13.0 และ source/assets 85 ไฟล์ตรงกับ app.asar ทุก byte Portable 111,288,819 bytes อยู่ใน `release-browser-identity` เปิด WhatIsMyBrowser จริงสำเร็จ: เว็บไม่แสดง Electron แล้วและอ่าน User-Agent เต็มเป็น `Chrome/152.0.7977.76 ... elysium-browser/1.3.13` แต่ฐานข้อมูลของเว็บจัดชื่อด้านบนเป็น Chrome 152 การตัด Chrome token ออกทำให้เว็บจัดผิดเป็น Safari/Chromium จึงคง token ที่เข้ากันได้ไว้

ติดตั้งและเปิด `release-browser-identity/win-unpacked/elysium-browser.exe` แล้ว ข้อมูล schema 4 คงเดิม: Notes 1, Calendar 3, Workspaces 2 และ Session tabs 5 สำรองก่อนติดตั้งไว้ที่ `backups/before-install-1.3.13-20260907-144052`

อัปเดต 1.3.12 (7 กันยายน 2026): ช่องวันในมุมมองเดือนของ Calendar กดเลือกได้เต็มพื้นที่ตั้งแต่เลขวันที่ถึงขอบล่างของช่อง พร้อม hover และ focus เต็มช่อง ปุ่มนัดหมายภายในยังเปิดแก้ไขรายการเดิมโดยไม่ถูกการเลือกวันแทรก

ตรวจ source Calendar 5/5 และ packaged EXE 2/2 ผ่าน รวม click hit area ถึงขอบล่างและ layout 1024–1920px รุ่นแพ็กเกจมี FileVersion 1.3.12 และ ProductVersion 1.3.12.0 ตรวจ source/assets 85 ไฟล์ตรงกับ app.asar ทุก byte Portable 111,287,170 bytes อยู่ใน `release-calendar-full-cell`

ติดตั้งและเปิดหน้า Calendar จาก `release-calendar-full-cell/win-unpacked/elysium-browser.exe` แล้ว ข้อมูล schema 4 คงเดิม: Notes 1, Calendar 2, Workspaces 2 และ Session tabs 9 สำรองก่อนติดตั้งไว้ที่ `backups/before-install-1.3.12-20260907-125932`

อัปเดต 1.3.11 (7 กันยายน 2026): เปลี่ยนไอคอนโปรแกรมเป็นภาพอนิเมะ elysium-browser ที่สร้างใหม่จากคาแรกเตอร์ผมและตาสีน้ำเงินเดิม มี master 1024×1024, PNG 128×128 สำหรับ favicon และ ICO แบบหลายขนาด 16–256px พร้อมเพิ่มเลขเวอร์ชันที่ใต้โลโก้ sidebar และหน้า Settings โดยอ่านจากเวอร์ชันจริงของแพ็กเกจ

ตรวจ syntax ผ่าน, unit 18/18, source UI 4/4 และ packaged EXE 4/4 ครอบคลุมเลขเวอร์ชัน/favicon, Calendar กดทันที, สถานะเสียงแท็บ และ HTML Full screen รุ่นแพ็กเกจมี FileVersion 1.3.11 และ ProductVersion 1.3.11.0 ตรวจ source/assets 85 ไฟล์ตรงกับ app.asar ทุก byte Portable 111,287,229 bytes อยู่ใน `release-anime-icon-version`

ติดตั้งและเปิดจาก `release-anime-icon-version/win-unpacked/elysium-browser.exe` แล้ว ข้อมูล schema 4 คงเดิม: Notes 1, Calendar 2, Workspaces 2 และ Session tabs 9 สำรองก่อนติดตั้งไว้ที่ `backups/before-install-1.3.11-20260907-122901`

อัปเดต 1.3.10 (7 กันยายน 2026): แก้อาการปุ่มใน Calendar ตอบสนองช้าหรือเหมือนกดไม่ติด ฟอร์มบนหน้าภายในเปิดใน click task โดยไม่รอ IPC overlay ที่ไม่จำเป็น การเลือกวันอัปเดตเฉพาะสถานะช่องวันและแผงนัดหมายแทนการสร้างหน้า Calendar ใหม่ทั้งหมด การสลับมุมมองเก็บ toolbar เดิมไว้ และ layout ไม่ส่ง setBounds/setVisible ซ้ำให้ WebContentsView ที่ไม่มีการเปลี่ยนแปลง ปิด backdrop blur เฉพาะฟอร์ม Calendar บนจอใหญ่ พร้อมเพิ่มสถานะกดให้เห็นทันที

Regression ใหม่ยืนยันว่ารุ่นเดิมยังไม่เปิด dialog ภายในคลิกแรก ส่วนรุ่นนี้เปิดทันทีและ DOM ของหน้า/grid เดิมยังอยู่หลังเลือกวัน ตรวจเพิ่ม/แก้ไข/ลบ/ค้นหา/ข้ามเดือน/วันทั้งวัน/แจ้งเตือน/การคงข้อความในฟอร์ม/layout 1024–1920 รวม 5/5 และ split/modal/audio/fullscreen 3/3 ผ่าน

อัปเดต 1.3.9 (7 กันยายน 2026): แก้ HTML Fullscreen ของ YouTube/เว็บไซต์ใน WebContentsView ซึ่งเดิมทำให้หน้าต่างเข้าโหมดเต็มจอ แต่ layout ยังเว้น sidebar และ chrome 96px รุ่นนี้ติดตาม `enter-html-full-screen` / `leave-html-full-screen` ของ guest webContents แล้วขยาย view ที่ร้องขอเป็นขนาด content ทั้งหน้าต่าง ซ่อน view อื่นชั่วคราว และคืน layout เดิมเมื่อออก การปรับ bounds รอให้หน้าเว็บได้รับ `fullscreenchange` ก่อน เพื่อไม่ให้ YouTube เข้าแล้วออกทันทีหรือค้างในรูปแบบหน้าดูวิดีโอปกติ พร้อมอนุญาตเฉพาะ fullscreen ที่ผู้ใช้กดจากเว็บ HTTPS ต้นทางเดียวกันโดยไม่แสดงคำถามซ้ำ สลับแท็บ เปิดแท็บใหม่ Ctrl+L/Ctrl+K/F11 และปิดแท็บจะออกจากสถานะดังกล่าวอย่างปลอดภัย

ตรวจ source: fullscreen/layout restore/switch 1/1, audio 1/1, unit 18/18 และ syntax ผ่าน ตรวจ packaged EXE: security/storage 1/1, fullscreen 1/1 และ audio 1/1 จากนั้นกดปุ่ม Full screen ของ YouTube จริงบนแพ็กเกจ 1.3.9 ที่ 3440×1440 วิดีโอเต็มพื้นที่ตามสัดส่วน ค้างอยู่หลัง 2.5 วินาที และปุ่มเดิมออกจากโหมดพร้อมคืน sidebar/toolbar และ bounds เดิมได้ ภาพอยู่ที่ docs/screenshots/youtube-fullscreen-1.3.9.png ตรวจ source/assets 83 ไฟล์ตรงกับ app.asar ทุก byte Portable 106,476,671 bytes อยู่ใน release-youtube-fullscreen-stable อ้างอิงเหตุการณ์มาตรฐานจาก [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents#event-enter-html-full-screen)

อัปเดต 1.3.6 (7 กันยายน 2026): แก้ลำโพงขึ้นบนแท็บเงียบ เดิม renderer สร้างปุ่มทุกแท็บและไม่รวม audible ใน render key ตอนนี้แสดงเฉพาะเว็บที่ audible หรือ muted พร้อมข้อความบอกสถานะและ aria-pressed แสดงตลอดแม้ไม่ hover ปุ่มปิด/เปิดเสียงบนแท็บเบื้องหลังไม่สลับแท็บที่กำลังใช้ เมื่อกลับหน้าใน elysium-browser ล้าง audible และไม่นำ event จาก view ที่ถูกปิดแล้วมาทับสถานะใหม่ ใช้สัญญาณเสียงจาก [Electron audio-state-changed](https://www.electronjs.org/docs/latest/api/web-contents#event-audio-state-changed)

Regression ใหม่ทำให้อาการเดิมเกิดซ้ำได้: 3 แท็บเงียบมีปุ่มลำโพง 3 ปุ่ม หลังแก้ผ่านด้วย PCM audio จริง ทั้ง active/background, play/pause, mute/unmute, muted ขณะหยุดเล่น, hover แท็บเงียบ และกลับหน้าใน elysium-browser ผ่าน source/packaged EXE 2+2 รวม 4/4 (รวม regression เสียงเดิม) ตรวจ 20 tabs/reorder/reopen/workspaces/private/disposal อีก 1/1 และ syntax ผ่าน ภาพ native อยู่ที่ docs/screenshots/tab-audio-playing.png, tab-audio-muted.png และ tab-audio-quiet.png รุ่นนี้ไม่ย้ายข้อมูลหรือเปลี่ยน engine

อัปเดต 1.3.5 (7 กันยายน 2026): ขยายพื้นที่ลากเต็มหัว sidebar ตั้งแต่ขอบหน้าต่างถึงเหนือเมนูหน้าแรก เว้นเฉพาะปุ่มย่อเมนู และกันพื้นที่ว่างแถบแท็บอย่างน้อย 96px ใช้ native app-region ของ Windows ไม่มี mousemove/IPC loop ย้ายหน้าต่าง ตรวจ coverage แบบตารางจุดรวมขอบ/ช่องว่าง ใน sidebar เต็มและย่อ ขนาด 1440×900 / 1024×768 และ device scale 100% / 125% ผ่านทั้ง source และ packaged EXE รวม 4/4 ตรวจปุ่ม แท็บใหม่ Calendar dialog เมาส์/คีย์บอร์ดผ่าน Syntax และ functional regression navigation/split/20 tabs/Theme Studio 4/4 ผ่าน ตรวจ native double-click บนช่องว่างเหนือปุ่มใน compact header ทำให้หน้าต่าง maximize จริง รุ่นแพ็กเกจ 1.3.5 ตรวจ source/assets 83 ไฟล์ตรงกับ app.asar ทุก byte Portable 140,180,272 bytes อยู่ใน release-drag-fix

ข้อจำกัดการตรวจการลาก: เครื่องมือเมาส์อัตโนมัติส่ง drag แล้วไม่ยืนยันการเปลี่ยนพิกัดได้สม่ำเสมอ จึงใช้ coverage, native caption double-click และการทำงานของปุ่มเป็นหลักฐาน ไม่อ้างว่าได้วัดความลื่นของการลาก/Windows Snap ด้วยเมาส์จริงครบทุกแบบ ไม่มีการแก้ storage schema หรือ engine ในรุ่นนี้

อัปเดต 1.3.4 (7 กันยายน 2026): ปรับหัว sidebar ให้คำว่า cherry. และ BROWSER มีลำดับชัดขึ้น ใช้สีตามธีมเดิม ปุ่มย่อเมนูขนาด 32px พร้อมสถานะ aria-expanded และคำอธิบายภาษาไทย ตรวจจริงที่ 1440×900 และ 1024×768 ใน Midnight, Rose Glass, Jade Atelier, Lilac Observatory ผ่านทั้งเมาส์/คีย์บอร์ด ย่อ–ขยาย focus และไม่มีข้อความล้น ความกว้าง sidebar/เว็บไซต์คงเดิม มีภาพและผลตรวจใน work/brand-polish/qa

อัปเดต 1.3.3 Novel Themes (7 กันยายน 2026): สร้างภาพใหม่จากตัวละครนิยาย 12 ชุดด้วย ImageGen รวมกับธีมเดิมเป็น 24 แบบ มี 4 โทนสว่าง / 8 โทนเข้มใหม่ ตรวจ syntax ผ่าน, unit 18/18 และ source Electron suite 19/19 ผ่าน ทดสอบเลือกทุกธีม ตัวกรอง สุ่มโดยไม่ซ้ำธีมปัจจุบัน ปิด/เปิดภาพ เลือกฉากแยกจากสี จำค่าหลังเปิดใหม่ และยืนยันว่าเว็บไซต์จริงไม่ถูกเปลี่ยนสี ข้อมูล schema 4 ใช้ต่อได้โดยไม่ต้องย้ายข้อมูล รุ่นแพ็กเกจผ่าน Theme Studio/ภาพ/เว็บไซต์ภายนอก/Calendar 3/3 ตรวจ 80 source/asset files ตรงกับ app.asar ทุก byte Portable 140,179,085 bytes อยู่ใน release-novel-themes

ตรวจภาพหน้าแรกทุกธีม พร้อมปฏิทินทั้ง 4 ธีมสว่างและ 1 ธีมเข้ม หน้าตั้งค่า แผง AI และ Theme Studio ที่ 1440×900 / 1024×768 (`docs/screenshots/novel-themes/`) ตรวจความต่างสีข้อความหลัก/รองบนพื้นผิวทุกแบบและข้อความปุ่ม ≥ 4.5:1, focus ≥ 3:1 ภาพ WebP ทั้งชุด 2,694,028 bytes และแต่ละภาพไม่ซ้ำกัน ผลตรวจงานออกแบบอัตโนมัติไม่พบรายการต้องแก้ (`work/theme-design-detect.json`)

อัปเดต 1.3.2 Calendar (7 กันยายน 2026): เพิ่มปฏิทินภายในเครื่อง มีมุมมองเดือน/รายการ ค้นหา เพิ่ม/แก้ไข/ลบนัดหมาย ทั้งวัน/ข้ามวัน หมวดสี สถานที่ รายละเอียด และเวลาเตือนผ่าน Windows ขณะเปิดแอป ตรวจ syntax ผ่าน, unit 15/15, source Electron suite 16/16, Calendar รอบสุดท้าย 4/4, native lifecycle ผ่าน และ packaged Calendar/navigation/split/Organizer 7/7 ตรวจภาพจริงที่ 1920×1080, 1440×900, 1366×768, 1024×768 รวมฟอร์มและมุมมองรายการ (`work/calendar-qa/`) ตรวจ `app.asar` พบ 52 source/asset files ตรงกันทุก byte ตัว portable อยู่ใน `release-calendar/` ขนาด 137,476,511 bytes

ทดสอบวันอธิกสุรทิน ขอบเดือน/ปี วันสิ้นสุดของนัดหมายทั้งวัน เวลาเที่ยงคืน เขตเวลาที่มี daylight saving การเตือนไม่ซ้ำหลังเปิดใหม่ การเก็บร่างเมื่อมีอัปเดตเบื้องหลัง การแสดงข้อความที่มี HTML เป็นข้อความธรรมดา การยกเลิกการลบ และ persistence หลังลบ ผ่านทั้งหมด โปรไฟล์จริงย้าย schema 3 → 4 พร้อม `elysium-data.json.before-schema-4`; ข้อมูลเดิมยังตรงกันและไม่มีนัดหมายตัวอย่างปนเข้าไป แอปรุ่น 1.3.2 เปิดหน้า Calendar พร้อมใช้งานแล้ว

ขอบเขตการแจ้งเตือน: ตรวจทุก 15 วินาทีขณะเปิด elysium-browser และเตือนนัดหมายที่ยังไม่สิ้นสุดเมื่อเปิดอีกครั้ง ไม่มีบริการเบื้องหลังเมื่อปิดแอป Windows อาจระงับการแสดง notification ตามการตั้งค่าของผู้ใช้ ปฏิทินนี้ใช้ข้อมูลในเครื่องและไม่เชื่อมบริการภายนอก

อัปเดต 1.4.0: ปรับ UX/UI ของแอป Electron เดิมตาม `cherry-ui-handoff` โดยคง `WebContentsView` และ security settings เดิม หน้า Home ใช้ elysium-browser ผมบ๊อบสั้นสีน้ำเงินจริงใน hero/assistant card, components ทั้งหมดเป็น DOM, แสดง recent/history/tabs/workspaces จากข้อมูลจริง และแสดง AI ว่ายังไม่เชื่อมต่อเมื่อไม่มี provider. ตรวจ source E2E 11/11, native lifecycle ผ่าน, packaged navigation/shortcut/screenshots 3/3, online smoke เปิด `https://example.com/` จริง และ source/assets 49 ไฟล์ตรงกับ `app.asar` ทุก byte. ภาพ native packaged อยู่ที่ `docs/screenshots/newtab-1920.png`, `newtab-1440.png`, `newtab-1024.png`, `ai-panel.png`, `settings.png` และ `online-example.png`.

อัปเดต 1.3.0: สร้างภาพ Theme Studio ใหม่ด้วย built-in ImageGen 9 แบบ ได้แก่ Rose Neon, Aurora Glass, Solar Drift, Crimson Circuit, Emerald Grid, Cosmic Archive, Aqua Horizon, Lunar Station และ Silver Fog ส่งออกเป็นฉากหลัง WebP 1672×941 และ thumbnail 480×270 รวม Theme Studio เป็น 12 ธีม แต่ละธีมใหม่เปลี่ยนทั้งภาพและชุดสี UI ผลล่าสุด: syntax ผ่าน, unit 9/9, source Electron 10/10, theme test บน packaged EXE ผ่าน และ source/assets 45 ไฟล์ตรงกับ `app.asar` ทุก byte พร้อมภาพตรวจ Theme Studio/หน้าแรกธีม Rose

อัปเดต 1.2.0: เพิ่ม AI OAuth 2.0 Authorization Code + PKCE สำหรับ OpenAI-compatible backend ของผู้ใช้/องค์กร เปิดยืนยันใน system browser, รับ callback เฉพาะ `127.0.0.1`, ตรวจ `state`, แลก code และ refresh token ใน main process พร้อมเข้ารหัส token ด้วย Windows safeStorage ไม่ส่ง token เข้า renderer รุ่นนี้ไม่จำลองการ Sign in ด้วย ChatGPT เพราะ OpenAI API สาธารณะใช้ API key สำหรับคำขอแอปทั่วไป ผลล่าสุด: syntax ผ่าน, unit 9/9, source Electron 9/9, OAuth บน packaged EXE ผ่าน และ source/assets 27 ไฟล์ตรงกับ `app.asar` ทุก byte

อัปเดต 1.1.1: แก้ main-process error เมื่อเว็บไซต์มีเสียง เพิ่ม regression ที่ทำให้เกิด error เดิมได้จริง แล้วผ่านทั้ง source และ packaged EXE; syntax/unit 7/7 และ packaged functional tests 7/7 ผ่าน ดู [รายละเอียดการแก้เสียง](docs/AUDIO_FIX_TH.md), [ผลทดสอบเสียง](docs/audio-regression.json) และ [ผลตรวจแพ็กเกจล่าสุด](docs/package-verification.json)

ผลด้านล่างเป็นการตรวจรับรุ่น 1.1.0 ก่อนแก้เสียง รวม screenshot matrix/DPI และการทดสอบ lifecycle เดิม

ทดสอบวันที่ 6 กันยายน 2026 บน Windows 11 build 26100 x64, AMD Ryzen 9 3900X, RAM 64 GiB, NVIDIA GTX 1060 6GB; Electron 44.2.0 / Chromium 152.0.7977.76, Node 24.5.0 โปรไฟล์ทดสอบทุกชุดแยกด้วย `ELYSIUM_TEST_PROFILE` ไม่ใช้ข้อมูลส่วนตัวหรือ credential จริงในภาพ

## Repository และขอบเขต

ไม่พบ AGENTS.md ใน workspace/parent และไม่มี `.git` อ่านเอกสาร handoff ทั้งหกและดูภาพอ้างอิงทั้งเจ็ดจริง ใช้ AGENTS_APPEND_TH.md เป็นข้อกำหนดเพิ่มเติม มี source backup `backups/before-anime-20260906-195809` ไม่ย้าย framework: ยังเป็น plain HTML/CSS/JS, Electron WebContentsView, npm และ electron-builder เหมือนเดิม

Baseline ก่อนแก้: syntax/unit 4 ข้อ/native E2E เดิมผ่าน เพิ่ม schema 2 โดยสำรอง JSON เก่า รักษา path/partition เดิม และไม่ใส่ seed history/bookmarks/provider responses

## คำสั่งและผล

| คำสั่งที่รัน | ผล |
| --- | --- |
| `npm run check` | exit 0; ตรวจ syntax เจ็ด source modules ไม่มี TypeScript/linter ใน repo |
| `npm test` | exit 0; 7/7 ผ่าน |
| `npm run test:e2e` | source scenarios ผ่าน; หลังเพิ่มกรณีทดสอบชุดส่งมอบ 7/7 ผ่านบน packaged EXE |
| `$env:ELYSIUM_EXECUTABLE=...; npm run test:e2e` | exit 0; 7/7 ผ่าน ประมาณ 1.6 นาที รวม native screenshot matrix |
| `npm run test:native` | exit 0; เปิด/ปิด 20 แท็บ 3 รอบ ตรวจ suspend/wake/cleanup และป้องกัน active/งานค้าง/media/download |
| `node scripts/verify-scaling.js` | exit 0; จำลอง device scale factor 1.25 / 1.5 บน packaged app, ไม่ได้เปลี่ยน Windows DPI จริง |
| `node scripts/smoke-online.js` | exit 0; packaged app เปิด `https://example.com/` ได้ title/body จริงและถ่าย native screenshot |
| `node scripts/verify-permissions.js` | exit 0; HTTPS Notification request ผ่าน handler ถาม origin แล้วปฏิเสธใน test dialog พร้อมทดสอบ reset กฎ |
| `getWeather('Bangkok')` จาก `src/providers.js` | exit 0; เรียก Open-Meteo จริง เมืองกรุงเทพฯ เป็นข้อมูลทดสอบ ไม่ใช่ตำแหน่งอุปกรณ์ที่อนุมาน |
| `npm run assets:export` | exit 0; WebP 14 ภาพ, manifest มีขนาดจริง |
| `npm run build` | exit 0; Windows x64 portable และ unpacked; unsigned ตาม config เดิม |
| `node scripts/verify-package.js` | exit 0; source/assets 26 ไฟล์ตรงกับ app.asar ทุก byte; portable 100,976,934 bytes พร้อม SHA-256 ในรายงาน |

หลังปรับ crop/ขอบ hero รอบสุดท้าย ตรวจภาพจากแพ็กเกจซ้ำ และตรวจ hash เนื้อหา source/assets กับ app.asar ด้วย `scripts/verify-package.js` ผลรายละเอียดอยู่ใน `docs/package-verification.json`

ระหว่างตรวจพบและแก้: Split View โฟกัสด้านขวาแต่ address ยังเลือกซ้าย, การปัดเศษ DIP ข้าม breakpoint ที่ 125%, input โน้ตไม่มี style และ Nova crop ไม่ครบใบหน้า การจับภาพรอบสุดท้ายใช้ fixture window ที่ปิดรับ desktop input ชั่วคราว; interactive keyboard tests แยกต่างหากและไม่ได้ปิดรับอินพุต

## ภาพและกราฟิก

| รหัส | สถานะ | หลักฐาน/ขอบเขต |
| --- | --- | --- |
| V01 | ผ่าน | 1366×768 เห็น chrome, search และ shortcuts โดยไม่ zoom out |
| V02 | ผ่าน | ตรวจเทียบ target และปรับหลายรอบ: sidebar/top chrome/card grid/สี navy-blue-cyan-violet/สัดส่วน elysium-browser; ใช้ข้อมูลว่างจริงแทนข้อมูลตัวอย่างใน reference |
| V03 | ผ่าน | เปิดดู runtime assets ทั้ง 14 ภาพและ icon จริง ไม่มีผลเชอร์รี โล่ กุญแจ แม่กุญแจ/ตราต้องห้าม; reference และ backup ไม่อยู่ใน bundle |
| V04 | ผ่าน | ตรวจใบหน้า/มือและ identity ตาม reference แก้ Nova crop และตำแหน่งหัวที่จอกว้าง; hero เป็น navy matte panel ไม่ใช่ alpha |
| V05 | ผ่าน | DOM forms/buttons/text จริง; keyboard/focus/การค้นหาจากช่องที่อยู่ทดสอบผ่าน |
| V06 | ผ่าน | native external viewport ไม่มี mascot; สีพื้น/typography ของเว็บทดสอบไม่เปลี่ยน; มีภาพเว็บไซต์ HTTPS จริง |
| V07 | ผ่าน | elysium-browser hero, Violet companion card เริ่มต้น, ทีมสี่คน และ avatars ตามตัวเลือก |
| V08 | ผ่าน | dark variants/compact/graphics-off/reduced-motion และ layout checks |
| V09 | ผ่าน | artwork ทั้งหมดใน assets/แพ็กเกจ; favicon เว็บอ่านด้วย session แล้วแปลง PNG data URL |
| V10 — ขนาด | ผ่าน | New Tab: 1920×1080, 1672×941, 1440×900, 1366×768; website/panel/split/themes: 1920,1440,1366 |
| V10 — DPI จริง | ไม่ได้ทดสอบ | จอ Windows ทั้งสามตั้ง scale 100%; ทดสอบ Chromium simulation 125%/150% และบันทึก CSS/DIP/physical pixels แยกกัน ไม่ถือเป็น Windows DPI จริง |

## Browser และข้อมูล

| รหัส | สถานะ | หลักฐาน/ขอบเขต |
| --- | --- | --- |
| B01 | ผ่าน | actual WebContentsView, title/URL/favicon sync, HTTPS online smoke |
| B02 | ผ่าน | unit URL/search encoding ไทย/อังกฤษและเลือก engine; ผลการค้นหาจากทุก search engine ไม่ได้ทดสอบครบ |
| B03 | ผ่าน | back/forward/reload/redirect และ stop ขณะ response ยังโหลดอยู่ |
| B04 | ผ่าน | 20 tabs, overflow, reorder/pin/mute/reopen/close และ workspace isolation |
| B05 | ผ่าน | restart คืน tabs/bookmarks/folder/workspace/theme และ restoreTabs=false เปิด New Tab เท่านั้น |
| B06 | ผ่าน | storage/bookmark edit/search/delete และ history จริงพร้อม cancel/confirm clear |
| B07 | ผ่าน | ดาวน์โหลด 2 MiB ลง test path จริง, progress/pause/resume/ขนาดไฟล์; native test ตรวจ cancel อีกครั้ง |
| B08 | ผ่าน | สอง native views, active-side focus และ address bar แก้เฉพาะด้านที่เลือก |
| B09 | ผ่าน | panel/split/compact/resize คำนวณ bounds จริง; modal ซ่อน guest views และคืนเมื่อปิด |
| B10 | ผ่าน | Ctrl+L/T/W/Shift+T/Tab/Shift+Tab/R/K ส่งจาก native webContents จริง |
| B11 | ผ่าน | Reader/Clip source URL, note library และ explicit save; hidden/password/form/cookie/storage test sentinels ไม่อยู่ใน extraction |
| B12 | ผ่าน | private ไม่เข้า normal history/session JSON; เมื่อปิดแท็บ private สุดท้ายเปลี่ยน memory session ใหม่และล้างของเก่า; UI บอกข้อจำกัด downloads/bookmarks |
| B13 | ต้องตั้งค่า | AI/Translate ไม่มี provider/model จริง จึงแสดง setup state; compatible/Ollama contracts ทดสอบด้วย fixture ที่ติดป้ายชัด ไม่มี live LLM claim; Weather adapter ติดต่อ Open-Meteo จริงแต่โปรไฟล์ผู้ใช้เริ่มต้นยังไม่ตั้งค่า |
| B14 | ผ่าน | native uncaptured test ยืนยัน destroy/wake, ไม่พัก active/edited input/playing silent WAV/active download; CDP test ยืนยัน captured tabs ถูกป้องกัน; interval อัตโนมัติไม่ได้ soak test หลายชั่วโมง |
| B15 | ผ่าน | UI/README ระบุ workspace แยกกลุ่มแท็บและใช้ cookies ร่วมกัน |

## ความปลอดภัย

| รหัส | สถานะ | หลักฐาน/ขอบเขต |
| --- | --- | --- |
| S01 | ผ่าน | remote `require/process/cherry` เป็น undefined; ไม่มี privileged preload ใน guest |
| S02 | ผ่าน | ตรวจ actual webPreferences sandbox/contextIsolation/webSecurity=true, nodeIntegration=false; ไม่มี certificate/CORS bypass ใน source |
| S03 | ผ่าน | actual registered IPC handlers ปฏิเสธ remote sender/ผิด frame; unknown action/malformed payload ปฏิเสธ; bridge มีเฉพาะ named commands |
| S04 | ผ่าน | ปฏิเสธ javascript/data/file/ftp/custom schemes, navigation/window-open policy อนุญาต HTTP(S) |
| S05 — policy | ผ่าน | origin-specific rule persistence/reset และ HTTPS notifications ผ่าน request handler จริง; dialog ใน test ตอบปฏิเสธอัตโนมัติ ไม่มีการให้ permission กับเว็บทดสอบ |
| S05 — hardware | ไม่ได้ทดสอบ | ไม่ทดสอบภาพกล้อง/เสียงไมค์/ตำแหน่งอุปกรณ์จริง กฎและ UI พร้อมใช้แต่ไม่อ้างว่าฮาร์ดแวร์ทุกแบบผ่าน |
| S06 | ผ่าน | fixture ตรวจ payload ก่อนยินยอมและหลังส่ง ไม่มี password/hidden/cookie/storage sentinels ไม่ส่งทุกแท็บ; plain-text preview จำกัดความยาว |
| S07 | ผ่าน | malicious page sentence คงเป็น untrusted quoted data, request ไม่มี tools, model-like HTML response แสดง plain text ไม่ execute |
| S08 | ผ่าน | test key เข้ารหัส ไม่อยู่ใน snapshot/plain JSON; bundle ไม่บรรจุ profile/credential; screenshots ใช้ profile ว่าง |
| S09 | ผ่าน | guest ไม่มี bridge/Node, ไม่แก้ shell/address bar; guest content อยู่ใต้ chrome ตาม native bounds |
| S10 | ผ่าน | UI/README ระบุข้อจำกัด OAuth/DRM/extensions ไม่กล่าวอ้างรองรับทุกเว็บ |

## ประสิทธิภาพและ lifecycle

Runtime artwork รวม **928,216 bytes** ตาม manifest (14 WebP, ต่ำกว่าเป้าหมาย 3 MB) ภาพที่เกี่ยวข้องกับ New Tab เริ่มต้นมีขนาดรวมต่ำกว่ายอดทั้งชุด ไม่มี video wallpaper, WebGL, particle loop หรือ remote artwork fetch

ใน `docs/native-lifecycle.json` วัดจาก entry script ถึง search มองเห็นและภาพ local decode ครบ **304 ms** เป็น warm filesystem บนเครื่องนี้ และ **ไม่รวม OS process bootstrap/portable extraction** ห้ามใช้เป็นคำโฆษณา cold-start

| รหัส | สถานะ | หลักฐาน/ขอบเขต |
| --- | --- | --- |
| P01 | ผ่าน | manifest และ native-lifecycle.json ระบุขนาดจริง เวลา ขอบเขตการวัด และเครื่อง |
| P02 | ผ่าน | เปิด 20 tabs แล้ว close กลับเหลือ 2 webContents (shell+หนึ่งเว็บ) ทั้ง 3 รอบ; suspend ทำลาย webContents จริง |
| P03 | ผ่าน | หน้าภายนอกไม่มี DOM hero; graphics/motion off ปิดภาพและ transitions; ไม่มี wallpaper loop |
| P04 | ผ่าน | วัด 3 รอบ: webContents 2→21→2; working-set รวมเริ่ม 406,076 KB และหลังรอบสุดท้าย 615,240 KB; จำนวน process 5→25→6 หลังทดสอบ media ไม่ใช่หลักฐานว่าไม่มี memory growth ทุกกรณี ยังไม่ได้ long soak |
| P05 | ผ่าน | source/การใช้งานไม่เปิด wallpaper/video/WebGL เอง; ไม่ได้ทำ GPU/CPU benchmark แยกและไม่อ้างว่า CPU เป็นศูนย์ |

## Screenshots

ภาพชุดส่งมอบถ่ายจาก native window composition ด้วย Electron desktopCapturer รวม WebContentsViews ภาพเว็บท้องถิ่นมีป้าย LOCAL TEST FIXTURE ไม่ใช้แทนผล HTTPS online smoke รายละเอียด dimensions/version อยู่ใน `docs/screenshots/capture-metadata.json`

- [New Tab 1920](docs/screenshots/newtab-1920.png), [1672](docs/screenshots/newtab-1672.png), [1440](docs/screenshots/newtab-1440.png), [1366](docs/screenshots/newtab-1366.png)
- [เว็บไซต์ HTTPS จริง](docs/screenshots/online-example.png), [เว็บไซต์ทดสอบ](docs/screenshots/real-website.png)
- [AI ยังไม่ตั้งค่า](docs/screenshots/ai-panel.png), [Notes panel](docs/screenshots/notes-panel.png)
- [Split](docs/screenshots/split-view.png), [Split + panel](docs/screenshots/split-with-panel.png), [Split 1366](docs/screenshots/split-1366.png)
- [Theme Studio](docs/screenshots/theme-studio.png), [Settings](docs/screenshots/settings.png), [Compact/graphics off](docs/screenshots/compact-graphics-off.png)
- [Scaling 125% จำลอง](docs/screenshots/scaling-125.png), [150% จำลอง](docs/screenshots/scaling-150.png)
- [ก่อนแก้](docs/screenshots/before-newtab.png); `draft-*` เป็น shell preview ระหว่างพัฒนา ไม่ใช่หลักฐาน native browsing

## ไฟล์ที่แก้และข้อจำกัดคงเหลือ

แก้ `src/main.js`, `core.js`, `preload.js`, `renderer.js`, `index.html`, `styles.css`; เพิ่ม `icons.js`, `providers.js`, `page-extraction.js` เปลี่ยน `assets/elysium.png/.ico`, เพิ่ม `assets/anime/*`, `artwork-source/*` เพิ่ม Sharp devDependency ใน `package.json/package-lock.json` ไม่มี runtime framework/dependency ใหม่

แก้/เพิ่ม tests, Playwright config, scripts export/icon/native lifecycle/scaling/permissions/package/online smoke รวม README, IMPLEMENTATION_LOG, TEST_REPORT, docs/ARTWORK, screenshots และผล JSON รายการ source backup/วิธี rollback อยู่ใน README โดยไม่ล้าง user profile

รายการ code/assets/scripts ที่เปลี่ยนเทียบ backup แบบไฟล์ต่อไฟล์อยู่ใน [docs/changed-files.json](docs/changed-files.json) เอกสาร/หลักฐานเพิ่มเติมอยู่ใน `docs/` และ PNG ต้นฉบับภาพใหม่อยู่ใน `artwork-source/`

ยังไม่มี live AI credential/model; provider contracts ผ่านด้วย fixture เท่านั้น Reader ไม่ใช่ตัวดึงบทความที่รองรับทุก layout Memory Saver/restore ไม่คืน form/DOM ทั้งหมด Notes ใช้ explicit save Downloads list ไม่ persist ข้าม app launch ไม่มี ad-block rule engine/extensions/DRM guarantee/auto-update EXE unsigned และ physical Windows DPI/hardware permissions/long soak ยังไม่ได้ทดสอบ

เอกสาร API ที่ใช้ตรวจสถาปัตยกรรม: [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [webContents capture state](https://www.electronjs.org/docs/latest/api/web-contents#contentsisbeingcaptured), [Ollama chat](https://docs.ollama.com/api/chat), [Open-Meteo](https://open-meteo.com/en/docs)
