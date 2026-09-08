let themeFilter = 'new';
const themeScene = id => window.elysiumThemes.get(id);
const themeImage = (id, thumbnail = false) => themeScene(id) ? `../assets/anime/novel-themes/${id}${thumbnail ? '-thumb' : ''}.webp` : art(`theme-${id}`);
function applyThemePalette(theme) {
  const selected = themeScene(theme.variant);
  document.body.dataset.palette = selected ? 'novel' : 'classic';
  document.body.dataset.tone = selected?.palette.mode || 'dark';
  document.body.dataset.novelScene = themeScene(theme.background) ? 'on' : 'off';
  for (const key of ['canvas','surface','raised','input','text','muted','accent','focus','line','onAccent','danger','success']) {
    if (selected) document.body.style.setProperty(`--novel-${key}`, selected.palette[key]);
    else document.body.style.removeProperty(`--novel-${key}`);
  }
}
function themeSwatches(colors) {
  return `<span class="theme-swatches" aria-hidden="true">${colors.map(color => `<i style="background:${color}"></i>`).join('')}</span>`;
}
function themeTile(id, name) {
  const item = themeScene(id), selected = state.settings.theme.variant === id;
  const palette = item?.palette;
  return `<button class="theme-tile ${selected ? 'selected' : ''}" data-theme-choice="${id}" aria-pressed="${selected}" aria-label="${esc(name)}${item ? ` · ${esc(item.title)}` : ''}">
    <div class="theme-art"><img src="${themeImage(id, true)}" alt="${esc(item ? `${item.character} · ${item.title}` : name)}" loading="lazy" decoding="async"><span class="theme-mode">${item?.palette.mode === 'light' ? 'โทนสว่าง' : 'โทนเข้ม'}</span>${selected ? `<span class="theme-selected-mark">${svg('check')}กำลังใช้</span>` : ''}</div>
    <span class="theme-tile-copy"><strong>${esc(name)}</strong>${item ? `<small>${esc(item.title)}</small>` : '<small>ชุด Classic</small>'}${themeSwatches(palette ? [palette.canvas,palette.surface,palette.accent,palette.focus] : ['#071122','#142746','#2f6bff','#9c7bff'])}</span>
  </button>`;
}
function renderThemeTiles() {
  const items = themeFilter === 'classic' ? window.elysiumThemes.legacy : window.elysiumThemes.novel.filter(theme => themeFilter === 'new' || theme.palette.mode === themeFilter).map(theme => [theme.id, theme.name]);
  $('#theme-tiles').innerHTML = items.map(([id, name]) => themeTile(id, name)).join('');
  document.querySelectorAll('[data-theme-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeFilter === themeFilter)));
}
function renderThemeStudio() {
  const theme = state.settings.theme, selected = themeScene(theme.variant);
  const customizationOpen = document.querySelector('.theme-customize')?.open || false;
  const name = selected?.name || window.elysiumThemes.catalog.find(([id]) => id === theme.variant)?.[1] || 'Electric Midnight';
  $('#content').innerHTML = `<section class="page theme-page novel-studio">
    <header class="theme-heading"><div><h1>Theme Studio</h1><p class="page-description">12 ภาพอนิเมะใหม่ · 24 ธีมสีสำหรับโลกของคุณ</p></div><button class="secondary-button" data-theme-random>${svg('wand')}สุ่มธีมใหม่</button></header>
    <section class="theme-current" aria-label="ธีมที่ใช้อยู่"><img src="${themeImage(theme.variant)}" alt=""><div><small>ธีมที่ใช้อยู่</small><h2>${esc(name)}</h2><p>${esc(selected?.description || 'บรรยากาศคลาสสิกของ elysium-browser')}</p><button class="primary-button" data-page="home">ดูหน้าแรก ${svg('arrow')}</button></div></section>
    <div class="theme-filter-bar" aria-label="เลือกกลุ่มธีม"><button data-theme-filter="new" aria-pressed="${themeFilter==='new'}">อนิเมะใหม่ <span>12</span></button><button data-theme-filter="light" aria-pressed="${themeFilter==='light'}">สว่าง <span>4</span></button><button data-theme-filter="dark" aria-pressed="${themeFilter==='dark'}">เข้ม <span>8</span></button><button data-theme-filter="classic" aria-pressed="${themeFilter==='classic'}">Classic <span>12</span></button></div>
    <div id="theme-tiles" class="theme-grid"></div>
    <details class="theme-customize" ${customizationOpen?'open':''}><summary>ปรับภาพและบรรยากาศ</summary><div class="settings-card"><h2>รูปโปรไฟล์และเพื่อน</h2><p class="muted">เปลี่ยนรูปโปรไฟล์และการ์ดเพื่อน · ภาพหลักเป็นภาพของแต่ละธีม</p><div class="character-picker">${['cherry','violet','ghost','nova'].map(character=>`<button class="${theme.character===character?'selected':''}" data-character="${character}" aria-pressed="${theme.character===character}">${avatar(character)}<strong>${character[0].toUpperCase()+character.slice(1)}</strong></button>`).join('')}</div>
    <div class="setting-row"><div><strong>แสดงภาพประกอบ</strong><p>ปิดภาพเพื่อใช้เฉพาะสีธีม</p></div><input id="graphics-enabled" type="checkbox" ${theme.graphics?'checked':''} aria-label="แสดงกราฟิก"></div>
    <div class="setting-row"><strong>ความเข้มภาพ</strong><input id="art-intensity" type="range" min="0" max="100" value="${theme.art}" aria-label="ความเข้มภาพ"></div>
    <div class="setting-row"><strong>ความเข้มแสง</strong><input id="glow-intensity" type="range" min="0" max="100" value="${theme.glow}" aria-label="ความเข้มแสง"></div>
    <div class="setting-row"><div><strong>Motion</strong><p>ใช้ร่วมกับการตั้งค่าลดการเคลื่อนไหวของเครื่อง</p></div><input id="motion-enabled" type="checkbox" ${theme.motion?'checked':''} aria-label="Motion"></div>
    <div class="setting-row"><div><strong>ภาพพื้นหลัง</strong><p>เลือกภาพแยกจากสีธีมได้</p></div><select id="theme-background" aria-label="ฉากหลัง"><option value="city" ${theme.background==='city'?'selected':''}>City</option><option value="team" ${theme.background==='team'?'selected':''}>elysium-browser workspace</option>${window.elysiumThemes.catalog.slice(3).map(([id,title])=>`<option value="${id}" ${theme.background===id?'selected':''}>${esc(title)}</option>`).join('')}${state.customBackground?`<option value="custom" ${theme.background==='custom'?'selected':''}>ภาพของคุณ</option>`:''}</select></div><button class="secondary-button" data-action="background-import">เลือกภาพจากเครื่อง</button></div></details>
    <p class="theme-source-note">ภาพใหม่จากตัวละครใน CHERRY : BODY ZERO และ CYRVOR · เก็บภาพไว้ในแอป เปิดใช้ได้โดยไม่ต้องออนไลน์</p>
  </section>`;
  renderThemeTiles();
}
document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.dataset.themeFilter) { themeFilter = button.dataset.themeFilter; renderThemeTiles(); }
  if (button.hasAttribute('data-theme-random')) {
    const candidates = window.elysiumThemes.novel.filter(theme => theme.id !== state.settings.theme.variant);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    await command('theme-save', {variant:chosen.id,background:chosen.id,character:chosen.character});
    toast(`เปลี่ยนเป็น ${chosen.name}`);
  }
});
