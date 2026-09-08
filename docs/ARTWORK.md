# Runtime artwork mapping

อ้างอิงภาพหลัก `elysium-browser_Browser_Codex_Handoff/cherry-browser-handoff/reference/01-newtab-target.png` พร้อม feature reference, before และ characters ภาพอ้างอิงทั้งเจ็ดถูกเปิดดูจริงก่อนสร้างภาพ

ใช้ built-in ImageGen แก้/สร้างภาพตาม reference แล้วใช้ Sharp เฉพาะ crop/resize/export ที่ handoff ระบุ ข้อความ ปุ่ม ไอคอนเส้น และ wordmark เป็น DOM/SVG แยกจาก bitmap ทั้งหมด

| Runtime asset | แหล่ง/การเตรียม | ใช้ที่ |
| --- | --- | --- |
| cherry-hero.webp | `artwork-source/cherry-hero.png`, retouch/recompose elysium-browser ชุดไม่มีตรา | hero หลัก New Tab |
| city-backdrop.webp | `artwork-source/city-backdrop.png`, ฉากเมืองไม่มีข้อความ/ตัวละคร/ตรา | layer ฉาก ปรับความเข้มด้วย CSS |
| team-banner.webp | `artwork-source/team-banner.png`, ทีม elysium-browser/Violet/Ghost/Nova ไม่มีตราหรือข้อความ | banner รอง/background |
| avatar-cherry.webp | crop ใบหน้าจาก hero ที่สร้างใหม่ | toolbar / Theme Studio |
| avatar-violet/ghost/nova.webp | crop ใบหน้าจาก character-board ตามชื่อใน reference | toolbar / Theme Studio |
| portrait-cherry/violet/ghost/nova.webp | crop จากภาพทีมที่ retouch แล้ว | companion card (เริ่มต้น Violet) |
| theme-midnight/slate.webp | ฉากเมืองจริง 480×270 | thumbnails; Quiet Navy ลดสี/แสงผ่าน CSS |
| theme-violet.webp | ภาพทีมจริง 480×270 | thumbnail |
| backdrop-rose/aurora/solar/crimson/emerald/cosmic/aqua/lunar/silver.webp | ภาพฉากที่สร้างด้วย built-in ImageGen 1672×941 | ฉากหลังจริงของเก้าธีมใหม่ |
| theme-rose/aurora/solar/crimson/emerald/cosmic/aqua/lunar/silver.webp | ภาพฉากเดียวกันย่อเป็น 480×270 | thumbnail ใน Theme Studio |
| assets/elysium.png / elysium.ico | `scripts/build-icon.ps1`, monogram `c.` | app/taskbar icon |

ขนาด/bytes/alpha อยู่ใน [manifest.json](../assets/anime/manifest.json) ไม่มี font file เพิ่ม ใช้ชื่อ Leelawadee UI / Segoe UI / Tahoma ที่ระบบมี

Hero เป็น **artwork panel พื้น navy แบบตั้งใจ ไม่มี alpha** ภาพทดลองที่ได้ checkerboard ถูกปฏิเสธและไม่อยู่ใน runtime ขอบใช้ CSS gradient/mask ไม่มีการอ้างว่า checkerboard คือความโปร่งใส City มีขนาดจริง 1672×941 ไม่ upscale เพื่อเติมตัวเลขตามสเปก

## Generation brief

ด้านล่างเป็น brief ที่จัดรูปแบบใหม่เพื่ออธิบายงาน ไม่ใช่ transcript คำสั่งแบบคำต่อคำ:

- Hero: รักษา elysium-browser ผม/ตาสีน้ำเงินจาก reference เป็นหญิงสาวอนิเมะผู้ใหญ่ เสื้อขาว/น้ำเงิน มือข้างเดียวเอื้อมไปข้างหน้า นิ้วห้านิ้วและสัดส่วนปกติ ภาพแนวนอน ใบหน้าอยู่ด้านขวาของ artwork เพื่อวางในพื้นที่ซ้ายของ hero; navy matte ไม่มีข้อความ UI โลโก้ ตรา ผลไม้ ใบไม้ โล่ กุญแจ หรือแม่กุญแจ
- City: anime city ยามค่ำ navy, electric blue, cyan และ violet เฉพาะจุด อาคาร/แสงเมืองละเอียด ไม่มีคน ป้ายข้อความ โลโก้ UI ผลไม้ ใบไม้ โล่ กุญแจ หรือแม่กุญแจ มีพื้นที่สงบสำหรับ DOM heading/search ที่วางแยกภายหลัง
- Team: banner มีพื้นที่ว่างทางซ้าย ทีมทางขวา: elysium-browser ผมน้ำเงินชุดขาว/น้ำเงิน, Violet ผมม่วงชุดดำ/ม่วง, Ghost ชายผมเงินแว่นชุดดำ/น้ำเงิน, Nova หญิงผมขาวเครื่องประดับดำ/แดง รักษาอัตลักษณ์ reference ลบตราและสัญลักษณ์ต้องห้าม ไม่มีข้อความหรือ controls ในภาพ
- Theme collection: เก้าฉากอนิเมะ 16:9 แบบ environment-only ได้แก่ Rose Neon, Aurora Glass, Solar Drift, Crimson Circuit, Emerald Grid, Cosmic Archive, Aqua Horizon, Lunar Station และ Silver Fog ใช้ภาพเมืองเดิมเป็น style reference; ไม่มีคน ตัวละคร ข้อความ โลโก้ UI ผลไม้ ใบไม้ โล่ กุญแจ แม่กุญแจ หรือลายน้ำ ส่งออกทั้งฉากหลัง 1672×941 และ thumbnail 480×270

ส่งออกซ้ำด้วย `npm run assets:export` พิกัด crop/คุณภาพ WebP อยู่ใน [export-anime-assets.js](../scripts/export-anime-assets.js) PNG ต้นฉบับเก็บนอก production bundle ไม่มี artwork hotlink

เปิดตรวจ export ทุกไฟล์ รวมใบหน้า มือ และตราเล็กบนชุด ตรวจซ้ำใน UI ที่สี่ขนาดและภาพจำลอง scaling 125%/150% หลังพบ Nova crop ผิดตำแหน่งและ head crop ในจอกว้าง ได้แก้ก่อนแพ็กเกจสุดท้าย
