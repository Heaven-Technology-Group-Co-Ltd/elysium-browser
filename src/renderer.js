const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${window.cherryIcons[name] || window.cherryIcons.globe}</svg>`;
const art = name => `../assets/anime/${name}.webp`;
const host = url => { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; } };
const date = time => new Date(time).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const reminderTime = time => {
 const value=new Date(time);const overdue=time<Date.now();
 return `${overdue?'เลยเวลา · ':''}${value.toLocaleString('th-TH',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`;
};
const localDateTimeValue = time => {
 const value=new Date(time||Date.now()+3600000);
 return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
const engines = {google:'Google',duckduckgo:'DuckDuckGo',bing:'Bing'};
const themeCatalog = window.cherryThemes.catalog;
const generatedThemeIds = new Set(themeCatalog.slice(3).map(([id])=>id));
const labels = {home:'หน้าแรก',workspaces:'My Workspace',bookmarks:'บุ๊กมาร์ก',history:'ประวัติ',downloads:'ดาวน์โหลด',settings:'การตั้งค่า',themes:'Theme Studio',notes:'Notes & Clip',memory:'Memory Saver',calendar:'Calendar · ปฏิทิน'};
const avatar = name => `<img class="avatar" src="${art(`avatar-${name}`)}" alt="${esc(name)}">`;
const ib = (icon, label, attributes='') => `<button class="icon-button" title="${esc(label)}" aria-label="${esc(label)}" ${attributes}>${svg(icon)}</button>`;
const empty = (icon,title,detail) => `<div class="empty-state">${svg(icon)}<strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;
const site = item => `<span class="site-icon">${item.favicon?.startsWith('data:image/png;') ? `<img src="${esc(item.favicon)}" alt="">` : esc(host(item.url).charAt(0).toUpperCase()) || svg('globe')}</span>`;
const active = () => state?.tabs.find(t => t.id === state.activeId);
let state, currentPage, shownTabId, pageKey='', panelKey='', tabsKey='', workspaceKey='', toastTimer, formSubmit;
let filter='', folderFilter='', selectedNoteId=null, noteDirty=false, paletteIndex=0, openingDialog=false, organizerTab='notes';
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML=svg(el.dataset.icon); });

function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200); }
async function command(action,payload) {
  try { const r=await window.cherry.command(action,payload); if(!r.ok) toast(r.error); return r; }
  catch { toast('ไม่สามารถติดต่อแอปได้ กรุณาเปิด Cherry อีกครั้ง'); return {ok:false}; }
}
function focusAddress(){ $('#address').focus(); $('#address').select(); }
function closeDialogs(){ for(const d of document.querySelectorAll('dialog[open]')) d.close(); }
async function showForm(title,body,onSubmit,accept='บันทึก') {
  openingDialog=true; closeDialogs();
  const overlay=command('overlay',true);
  // Internal pages have no guest view covering the dialog, so show the form
  // during the click instead of waiting for an unnecessary IPC round trip.
  if(isWebsite(active()?.url))await overlay;
  $('#dialog-title').textContent=title; $('#dialog-body').innerHTML=body; $('#confirm-accept').textContent=accept; formSubmit=onSubmit; $('#form-dialog').showModal(); openingDialog=false;
}
const field=(label,name,value='',type='text',extra='')=>`<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
async function confirmAction(title,detail,action){ await showForm(title,`<p class="muted">${esc(detail)}</p>`,async()=>{await action();return true;},'ยืนยัน'); }

function render(next) {
  state=next; const tab=active(); if(!tab)return;
  const visibleVersion=`v${state.version}`;
  $('#app-version').textContent=visibleVersion;
  $('.brand-signature').setAttribute('aria-label',`Cherry Browser ${visibleVersion}`);
  const page=tab.url.startsWith('cherry://')?tab.url.slice(9):'web';
  if(currentPage!==page){filter='';folderFilter='';currentPage=page;$('#content').scrollTop=0;}
  const theme=state.settings.theme;
  applyThemePalette(theme);
  Object.assign(document.body.dataset,{theme:theme.variant,page,sidebar:state.settings.compactSidebar?'compact':'full',panel:state.ui.panel?'open':'closed',graphics:theme.graphics?'on':'off',motion:theme.motion?'on':'off'});
  const compactToggle=$('#compact-toggle');
  const sidebarLabel=state.settings.compactSidebar?'ขยายเมนูด้านข้าง':'ย่อเมนูด้านข้าง';
  compactToggle.setAttribute('aria-expanded',String(!state.settings.compactSidebar));
  compactToggle.setAttribute('aria-label',sidebarLabel);compactToggle.title=sidebarLabel;
  // Electron DIP rounding can differ from CSS innerWidth by one pixel at 125%.
  // Use the main-process layout widths so breakpoints cannot misalign guest views.
  if(state.ui.bounds){document.body.style.setProperty('--side',`${state.ui.bounds.sidebar}px`);document.body.style.setProperty('--right',`${state.ui.bounds.panelWidth}px`);}
  document.body.style.setProperty('--art-opacity',theme.art/100);document.body.style.setProperty('--glow-opacity',theme.glow/100);
  const bg=themeScene(theme.background)?themeImage(theme.background):theme.background==='custom'&&state.customBackground?state.customBackground:art(theme.background==='team'?'team-banner':generatedThemeIds.has(theme.background)?`backdrop-${theme.background}`:'city-backdrop');
  document.body.style.setProperty('--scene',`url("${bg.replace(/["\n\r]/g,'')}")`);
  $('#profile-avatar').src=art(`avatar-${theme.character}`);$('#profile-avatar').alt=theme.character;
  $('#side-panel').hidden=!state.ui.panel;
  $('#back').disabled=!tab.canGoBack;$('#forward').disabled=!tab.canGoForward;$('#reload').disabled=page!=='web';$('#reload').innerHTML=svg(tab.loading?'close':'reload');
  $('#reload').setAttribute('aria-label',tab.loading?'หยุดโหลด':'โหลดอีกครั้ง');
  if(document.activeElement!==$('#address')||shownTabId!==tab.id)$('#address').value=tab.url==='cherry://home'?'':tab.url;
  shownTabId=tab.id;$('#private-indicator').hidden=!tab.private;
  $('#bookmark-toggle').disabled=page!=='web';$('#bookmark-toggle').classList.toggle('bookmarked',state.bookmarks.some(b=>b.url===tab.url));
  $('#bookmark-toggle').setAttribute('aria-pressed',String(state.bookmarks.some(b=>b.url===tab.url)));
  $('#bookmark-count').textContent=state.bookmarks.length||'';$('#download-count').textContent=state.downloads.filter(d=>d.state==='progressing').length||'';
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  document.querySelectorAll('.navigation [data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===state.ui.panel));
  renderTabs();renderWorkspacesSidebar();renderSplit();
  const key=JSON.stringify([tab.id,page,tab.error,tab.private,theme,state.settings.searchEngine,page==='home'?[state.history,state.tabs.map(t=>[t.id,t.title,t.workspaceId,t.suspended]),state.workspaces,state.shortcuts,state.todos,state.weather]:null,['history','bookmarks'].includes(page)?[state.history,state.bookmarks]:null,page==='workspaces'?[state.workspaces,state.tabs]:null,page==='downloads'?state.downloads:null,page==='memory'?state.tabs:null,page==='calendar'?state.calendarEvents:null]);
  // Do not rebuild focused editors or settings forms in response to background tab events.
  const contentKey=page==='notes'?`${key}:${organizerTab}:${JSON.stringify([state.notes,state.postIts,state.reminders])}`:key;
  if(contentKey!==pageKey) {
    const focusId=document.activeElement?.id; const preservedFilter=['library-filter','search-input'].includes(focusId); const caret=preservedFilter?document.activeElement.selectionStart:0; const inputValue=preservedFilter?document.activeElement.value:'';
    const oldScroll=$('#content').scrollTop;pageKey=contentKey;
    if(tab.error&&!state.ui.split)$('#content').innerHTML=`<section class="error-page">${svg('globe')}<h1>ยังเปิดหน้านี้ไม่ได้</h1><p>${esc(tab.url)}</p><p class="muted">${esc(tab.error.description)}</p><button class="primary-button" data-action="reload">ลองอีกครั้ง</button></section>`;
    else if(page==='home')renderHome();else if(page==='bookmarks'||page==='history')renderLibrary(page);else if(page==='workspaces')renderWorkspaces();else if(page==='themes')renderThemes();else if(page==='settings')renderSettings();else if(page==='downloads')renderDownloads();else if(page==='calendar')renderCalendar();else if(page==='notes')renderNotesPage();else if(page==='memory')renderMemory();else $('#content').innerHTML='';
    $('#content').scrollTop=oldScroll;if(page==='themes'&&['art-intensity','glow-intensity','graphics-enabled','motion-enabled','theme-background'].includes(focusId))document.getElementById(focusId)?.focus({preventScroll:true});if(preservedFilter&&document.getElementById(focusId)){const input=document.getElementById(focusId);input.value=inputValue;input.focus();input.setSelectionRange(caret,caret);}
  }
  renderPanel();if(state.storageError)toast(state.storageError);
}

function renderTabs(){
 const visible=state.tabs.filter(t=>t.workspaceId===state.activeWorkspace);
 const key=JSON.stringify(visible.map(t=>[t.id,t.title,t.url,t.loading,t.favicon,t.pinned,t.muted,t.audible,t.suspended,t.id===state.activeId]));if(key===tabsKey)return;tabsKey=key;
 const previousScroll=$('#tabs').scrollLeft;
 $('#tabs').innerHTML=visible.map(t=>`<div class="tab ${t.id===state.activeId?'active':''} ${t.pinned?'pinned':''}" draggable="true" data-tab-id="${esc(t.id)}"><button class="tab-select" role="tab" aria-selected="${t.id===state.activeId}" data-activate="${esc(t.id)}" title="${esc(t.title)}${t.private?' · Private':''}"><span class="tab-symbol ${t.loading?'loading':''}">${t.loading?svg('reload'):t.suspended?svg('moon'):t.private?svg('moon'):t.pinned?svg('pin'):t.url.startsWith('cherry://')?'<b>c.</b>':site(t)}</span><span class="tab-title">${esc(t.title)}</span></button>${isWebsite(t.url)&&(t.audible||t.muted)?`<button class="icon-button tab-mute" data-mute="${esc(t.id)}" aria-pressed="${!!t.muted}" aria-label="${t.muted?'เปิดเสียงแท็บ':'ปิดเสียงแท็บ'} ${esc(t.title)}" title="${t.muted?'ปิดเสียงอยู่ · คลิกเพื่อเปิดเสียง':'กำลังมีเสียง · คลิกเพื่อปิดเสียง'}">${svg(t.muted?'muted':'volume')}</button>`:''}<button class="tab-close" data-close="${esc(t.id)}" aria-label="ปิดแท็บ ${esc(t.title)}" title="ปิดแท็บ">${svg('close')}</button></div>`).join('');
 $('#tabs').scrollLeft=previousScroll;
 requestAnimationFrame(()=>$('#tabs .tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'}));
}
function renderWorkspacesSidebar(){
 const key=JSON.stringify([state.workspaces,state.activeWorkspace,state.tabs.map(t=>t.workspaceId)]);if(key===workspaceKey)return;workspaceKey=key;
 $('#workspace-list').innerHTML=state.workspaces.map(w=>`<button class="workspace-item ${w.id===state.activeWorkspace?'active':''}" data-workspace="${esc(w.id)}" title="${esc(w.name)}"><span class="workspace-mark" style="color:${esc(w.color)}">${svg('briefcase')}</span><span>${esc(w.name)}</span><small>${state.tabs.filter(t=>t.workspaceId===w.id).length}</small></button>`).join('');
}
function renderSplit(){
 const split=state.ui.split;$('#split-head').hidden=!split;$('#split-divider').hidden=!split;document.body.classList.toggle('is-split',!!split);
 if(!split)return;const bounds=state.ui.bounds;const left=state.tabs.find(t=>t.id===split[0]);const right=state.tabs.find(t=>t.id===split[1]);
 $('#split-head').innerHTML=`<button data-activate="${left.id}" class="${active().id===left.id?'active':''}">L · ${esc(left.title)}</button><label class="split-ratio-label">สัดส่วน<input id="split-ratio" aria-label="สัดส่วน Split View" type="range" min="25" max="75" value="${state.ui.ratio*100}"></label><button data-activate="${right.id}" class="${active().id===right.id?'active':''}">R · ${esc(right.title)}</button>${ib('close','ปิด Split View','data-action="split-close"')}`;
 $('#split-divider').style.left=`${bounds.left.width}px`;
}

function renderHomeRefresh(){
 const recent=state.history.filter((item,i,all)=>all.findIndex(other=>other.url===item.url)===i).slice(0,3);
 const recentTabs=state.tabs.filter(t=>!t.url.startsWith('cherry://')&&t.workspaceId===state.activeWorkspace).slice(-3).reverse();
 const quickIcon=s=>s.id==='google'?'<b class="google-g">G</b>':s.id==='youtube'?svg('youtube'):s.id==='github'?svg('github'):s.id==='figma'?'<span class="figma-mark"><i></i><i></i><i></i><i></i><i></i></span>':s.id==='notion'?'<b class="notion-n">N</b>':s.id==='chatgpt'?svg('sparkles'):esc(host(s.url).charAt(0).toUpperCase());
 const aiReady=state.settings.ai.provider!=='none'&&state.settings.ai.endpoint&&state.settings.ai.model&&(state.settings.ai.provider!=='oauth-openai-compatible'||state.aiOAuth?.connected);
 $('#content').innerHTML=`<div class="newtab">${active().private?'<div class="private-banner">Private session · ไม่เก็บประวัติหรือ restore แท็บนี้ · บุ๊กมาร์ก/ไฟล์ดาวน์โหลดที่สั่งเก็บยังคงอยู่ และเว็บไซต์/เครือข่ายยังเห็นการเชื่อมต่อได้</div>':''}
  <section class="hero"><div class="hero-scene"></div><img class="hero-character" src="${art('cherry-home-short')}" alt="Cherry ผู้ช่วยผมบ๊อบสั้นสีน้ำเงินกำลังทำงาน"><div class="hero-copy"><p class="eyebrow">GOOD MORNING, EXPLORER</p><h1>ค้นพบโลกที่กว้างกว่าเดิม<br>ไปกับ <span>cherry.</span></h1><p class="hero-subtitle">พื้นที่สำหรับการค้นหา ไอเดีย และสิ่งที่คุณสนใจ</p><form id="home-search" class="hero-search">${svg('search')}<div class="search-copy"><label for="search-input">ค้นหาด้วย <strong>cherry.</strong> หรือพิมพ์ URL</label><input id="search-input" aria-label="ค้นหาด้วย cherry หรือพิมพ์ URL" placeholder="Search with cherry. or type a URL" autocomplete="off"></div><button class="search-submit" type="submit" aria-label="ค้นหาหรือเปิดเว็บไซต์">${svg('arrow')}</button></form><p class="search-provider">ค้นหาด้วย ${engines[state.settings.searchEngine]} · แยกคำค้นและ URL ด้วยระบบเดิม</p></div></section>
  <section class="shortcut-section"><div class="home-section-head"><div><span>ทางลัด</span><small>Shortcuts</small></div><button class="text-button" data-action="new-shortcut">${svg('plus')}เพิ่มทางลัด</button></div><div class="quick-links">${state.shortcuts.slice(0,7).map(s=>`<div class="shortcut-chip"><button class="quick-link" data-url="${esc(s.url)}" title="เปิด ${esc(s.url)}"><span class="quick-icon quick-${esc(s.id)}">${quickIcon(s)}</span><span>${esc(s.title)}</span></button><button class="shortcut-edit" data-edit-shortcut="${esc(s.id)}" aria-label="แก้ไขทางลัด ${esc(s.title)}" title="แก้ไขทางลัด">${svg('edit')}</button></div>`).join('')}<button class="quick-link add-shortcut" data-action="new-shortcut">${svg('plus')}<span>เพิ่มทางลัด</span></button></div></section>
  <div class="home-layout"><div class="home-main"><div class="home-feature-grid">
    <section class="card continue-card"><div class="card-head"><h2>${svg('reader')}เปิดต่อจากครั้งล่าสุด <small>Continue browsing</small></h2><button class="text-button" data-page="history">ดูทั้งหมด ${svg('arrow')}</button></div>${recent.length?recent.map(r=>`<button class="recent-item" data-url="${esc(r.url)}">${site(r)}<div><strong>${esc(r.title)}</strong><small>${esc(host(r.url))} · ${date(r.visitedAt)}</small></div>${svg('arrow')}</button>`).join(''):empty('reader','ยังไม่มีรายการสำหรับเปิดต่อ','เว็บไซต์ที่คุณเปิดจริงจะปรากฏที่นี่')}</section>
    <section class="card recent-card"><div class="card-head"><h2>${svg('history')}แท็บในพื้นที่นี้ <small>Recent tabs</small></h2><button class="text-button" data-action="palette">ค้นหาแท็บ ${svg('arrow')}</button></div>${recentTabs.length?recentTabs.map(t=>`<div class="recent-item">${site(t)}<button data-activate="${t.id}"><strong>${esc(t.title)}</strong><small>${esc(host(t.url))}${t.suspended?' · พักอยู่':''}</small></button>${ib('close','ปิดแท็บ',`data-close="${t.id}"`)}</div>`).join(''):empty('globe','ยังไม่มีแท็บเว็บไซต์','ค้นหาหรือเปิดเว็บไซต์ในแท็บใหม่')}</section>
  </div><section class="card quick-actions-card"><div class="card-head"><h2>${svg('sparkles')}เครื่องมือด่วน <small>Quick actions</small></h2></div><div class="quick-action-grid"><button data-panel="ai">${svg('sparkles')}<span><strong>AI Assist</strong><small>ถาม สรุป และช่วยร่าง</small></span>${svg('arrow')}</button><button data-panel="notes">${svg('notes')}<span><strong>Notes & Clip</strong><small>เขียนและเก็บสิ่งสำคัญ</small></span>${svg('arrow')}</button><button data-page="bookmarks">${svg('bookmark')}<span><strong>Bookmarks</strong><small>กลับไปยังเว็บที่บันทึก</small></span>${svg('arrow')}</button><button data-page="themes">${svg('wand')}<span><strong>Theme Studio</strong><small>เลือกบรรยากาศของคุณ</small></span>${svg('arrow')}</button></div></section></div>
  <aside class="home-rail"><article class="card cyrvor-card"><img src="${art('cyrvor-brand')}" alt="CYRVOR — Autonomous Intelligence for Cyber Defense"><span>CYRVOR</span></article><section class="card assistant-card"><img src="${art('cherry-assistant-short')}" alt="Cherry ผู้ช่วยอนิเมะผมบ๊อบสั้นสีน้ำเงิน"><div><small>CHERRY AI</small><strong>พร้อมช่วยจัดระเบียบ<br>ความคิดของคุณ</strong><p class="assistant-status">${aiReady?'เชื่อมต่อ provider แล้ว':'ยังไม่ได้เชื่อมต่อ AI'}</p><button class="secondary-button" data-panel="ai">${aiReady?'เปิด AI Assist':'ดูวิธีเชื่อมต่อ'} ${svg('arrow')}</button></div></section><section class="card workspace-rail"><div class="card-head"><h2>${svg('grid')}Recent workspaces</h2><button class="text-button" data-page="workspaces">ดูทั้งหมด ${svg('arrow')}</button></div><div class="workspace-rail-list">${state.workspaces.slice(0,3).map(w=>`<button class="workspace-rail-item ${w.id===state.activeWorkspace?'active':''}" data-workspace="${esc(w.id)}"><span class="workspace-mark" style="color:${esc(w.color)}">${svg('briefcase')}</span><span><strong>${esc(w.name)}</strong><small>${state.tabs.filter(t=>t.workspaceId===w.id).length} แท็บ</small></span>${svg('arrow')}</button>`).join('')}<button class="workspace-rail-item workspace-create" data-action="new-workspace">${svg('plus')}<span><strong>สร้าง workspace</strong><small>แยกชุดแท็บสำหรับเรื่องใหม่</small></span></button></div></section></aside></div>
 <footer class="newtab-footer"><span>CHERRY BROWSER <i>·</i> PEOPLE <i>·</i> IDEAS <i>·</i> A BRIGHTER TOMORROW</span><span>ค้นหาด้วย ${engines[state.settings.searchEngine]} · ข้อมูลเก็บในเครื่อง</span></footer></div>`;
}

function renderHome(){
 const recent=state.history.filter((item,i,all)=>all.findIndex(other=>other.url===item.url)===i).slice(0,3);
 const recentTabs=state.tabs.filter(t=>!t.url.startsWith('cherry://')&&t.workspaceId===state.activeWorkspace).slice(-3).reverse();
 const quickIcon=s=>s.id==='google'?'<b class="google-g">G</b>':s.id==='youtube'?svg('youtube'):s.id==='github'?svg('github'):s.id==='figma'?'<span class="figma-mark"><i></i><i></i><i></i><i></i><i></i></span>':s.id==='notion'?'<b class="notion-n">N</b>':s.id==='chatgpt'?svg('sparkles'):esc(host(s.url).charAt(0).toUpperCase());
 const character=state.settings.theme.character;const alternate=character==='cherry'?'violet':character;
 const pendingReminders=state.reminders.filter(item=>!item.done).sort((a,b)=>a.dueAt-b.dueAt).slice(0,2);
 $('#content').innerHTML=`<div class="newtab">${active().private?'<div class="private-banner">Private session · ไม่เก็บประวัติหรือ restore แท็บนี้ · บุ๊กมาร์ก/ไฟล์ดาวน์โหลดที่สั่งเก็บยังคงอยู่ และเว็บไซต์/เครือข่ายยังเห็นการเชื่อมต่อได้</div>':''}
  <section class="hero"><div class="hero-scene"></div><img class="hero-character" src="${art('cherry-hero')}" alt="Cherry"><div class="hero-copy"><p class="eyebrow">CHERRY BROWSER</p><h1>Browse smarter.<br><span>Create faster.</span></h1><p class="hero-subtitle">มากกว่าการท่องเว็บ คือพื้นที่ให้ทุกไอเดียของคุณเติบโต</p><form id="home-search" class="hero-search">${svg('search')}<input id="search-input" aria-label="ค้นหาบนเว็บ" placeholder="ค้นหาหรือพิมพ์ URL ที่นี่…" autocomplete="off"><button class="search-submit" type="submit" aria-label="ค้นหา">${svg('arrow')}</button></form><div class="quick-links">${state.shortcuts.slice(0,7).map(s=>`<button class="quick-link" data-url="${esc(s.url)}" title="${esc(s.url)}"><span class="quick-icon quick-${esc(s.id)}">${quickIcon(s)}</span><span>${esc(s.title)}</span></button>`).join('')}<button class="quick-link" data-action="new-shortcut"><span class="quick-icon add">${svg('plus')}</span><span>เพิ่มทางลัด</span></button></div></div></section>
 <div class="home-cards"><section class="card"><div class="card-head"><h2>${svg('reader')}Continue Reading</h2><button class="text-button" data-page="history">ดูทั้งหมด ${svg('arrow')}</button></div>${recent.length?recent.map(r=>`<button class="recent-item" data-url="${esc(r.url)}">${site(r)}<div><strong>${esc(r.title)}</strong><small>${esc(host(r.url))} · ${date(r.visitedAt)}</small></div></button>`).join(''):empty('reader','การค้นพบครั้งต่อไป เริ่มที่นี่','เว็บไซต์ที่คุณเปิดจะปรากฏที่นี่ ให้กลับมาอ่านต่อได้ง่าย')}</section>
 <section class="card"><div class="card-head"><h2>${svg('history')}Recent Tabs</h2><button class="text-button" data-action="palette">ดูทั้งหมด ${svg('arrow')}</button></div>${recentTabs.length?recentTabs.map(t=>`<div class="recent-item">${site(t)}<button data-activate="${t.id}"><strong>${esc(t.title)}</strong><small>${esc(host(t.url))}${t.suspended?' · พักอยู่':''}</small></button>${ib('close','ปิดแท็บ',`data-close="${t.id}"`)}</div>`).join(''):empty('globe','ยังไม่มีแท็บเว็บไซต์','ค้นหาหรือเปิดเว็บไซต์ในแท็บใหม่')}</section>
 <section class="card ai-card"><div class="card-head"><h2>${svg('sparkles')}AI Assistant</h2></div><div class="ai-actions"><button data-ai="summarize">${svg('reader')}สรุปหน้าเว็บให้หน่อย ${svg('arrow')}</button><button data-ai="draft">${svg('edit')}ช่วยร่างข้อความ ${svg('arrow')}</button><button data-ai="ask">${svg('sparkles')}ถามเกี่ยวกับหน้านี้ ${svg('arrow')}</button><button data-ai="translate">${svg('globe')}แปลข้อความที่เลือก ${svg('arrow')}</button></div></section>
 <button class="card character-card" data-page="themes"><img src="${art(`portrait-${alternate}`)}" alt="${esc(alternate)}"><div><small>MAKE IT YOURS</small><strong>Small ideas.<br>Big possibilities.</strong><span>Theme Studio ${svg('arrow')}</span></div></button></div>
 <div class="home-bottom"><section class="card pinned-card"><div class="card-head"><h2>${svg('grid')}Pinned Workspaces</h2><button class="text-button" data-page="workspaces">จัดการ ${svg('arrow')}</button></div><div class="workspace-tiles">${state.workspaces.slice(0,4).map(w=>`<button data-workspace="${esc(w.id)}"><span style="color:${esc(w.color)}">${svg('briefcase')}</span><strong>${esc(w.name)}</strong><small>${state.tabs.filter(t=>t.workspaceId===w.id).length} tabs</small></button>`).join('')}<button data-action="new-workspace" class="workspace-add">${svg('plus')}<small>สร้างพื้นที่ใหม่</small></button></div></section>
 <section class="card team-banner"><img src="${art('team-banner')}" alt="Cherry, Violet, Ghost และ Nova"><div><p>Different skills.<br><em>Same curiosity.</em></p><button class="team-button" data-page="themes">พบทีม Cherry ${svg('arrow')}</button></div></section>
 <section class="card today-card"><div class="card-head"><h2>${svg('clock')}Your Today</h2><button class="text-button" data-panel="notes">Notes & Reminder</button></div><div class="today-top"><div><strong id="clock">${new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</strong><small>${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</small></div><button class="weather-widget" data-action="weather">${svg('cloud')}<span>${state.weather?`${state.weather.temperature}°C<br>${esc(state.weather.city)}`:state.settings.weather.provider==='none'?'ตั้งค่าอากาศ':'อัปเดตอากาศ'}</span></button></div><div class="mini-todos">${pendingReminders.length?pendingReminders.map(item=>`<button class="mini-reminder" data-organizer-tab="reminders">${svg('bell')}<span>${esc(item.title)}</span><small>${reminderTime(item.dueAt)}</small></button>`).join(''):state.todos.slice(0,2).map(t=>`<label><input type="checkbox" data-todo="${t.id}" ${t.done?'checked':''}><span>${esc(t.text)}</span></label>`).join('')}<button class="text-button" data-action="new-reminder">${svg('plus')}เพิ่มแจ้งเตือน</button></div></section></div>
 <footer class="newtab-footer"><span>CHERRY BROWSER <i>·</i> PEOPLE <i>·</i> IDEAS <i>·</i> A BRIGHTER TOMORROW</span><span>ค้นหาด้วย ${engines[state.settings.searchEngine]} · ข้อมูลเก็บในเครื่อง</span></footer></div>`;
}

function pageHeader(kicker,title,description){return `<div class="page-kicker">${kicker}</div><h1>${title}</h1><p class="page-description">${description}</p>`;}
function renderLibrary(page){
 const bookmarks=page==='bookmarks';const folders=[...new Set(state.bookmarks.map(b=>b.folder||'').filter(Boolean))];
 $('#content').innerHTML=`<section class="page">${pageHeader(bookmarks?'YOUR COLLECTION':'RECENT EXPLORATIONS',bookmarks?'เก็บสิ่งที่คุณชอบ':'ย้อนรอยการค้นพบ',bookmarks?'เว็บไซต์โปรดของคุณ · Ctrl+D เพื่อบันทึกเว็บปัจจุบัน':'ประวัติจากเว็บไซต์ที่เปิดจริงในแท็บปกติ')}<div class="page-tools"><input id="library-filter" class="filter-input" placeholder="ค้นหาในรายการ…" aria-label="ค้นหาในรายการ" value="${esc(filter)}">${bookmarks?`<select id="folder-filter" aria-label="โฟลเดอร์บุ๊กมาร์ก"><option value="">ทุกโฟลเดอร์</option>${folders.map(f=>`<option ${folderFilter===f?'selected':''}>${esc(f)}</option>`).join('')}</select>`:`<select id="history-period" aria-label="ช่วงเวลาที่ต้องการลบ"><option value="all">ทั้งหมด</option><option value="hour">ชั่วโมงล่าสุด</option><option value="day">24 ชั่วโมง</option><option value="week">7 วัน</option></select><button id="clear-history" class="secondary-button">ล้างประวัติ</button>`}</div><div id="library-items"></div></section>`;renderLibraryItems();
}
function renderLibraryItems(){
 const bookmarks=currentPage==='bookmarks';const items=(bookmarks?state.bookmarks:state.history).filter(i=>`${i.title} ${i.url}`.toLowerCase().includes(filter.toLowerCase())&&(!bookmarks||!folderFilter||i.folder===folderFilter));
 $('#library-items').innerHTML=items.length?items.map(i=>`<div class="library-row">${site(i)}<button class="library-link" data-url="${esc(i.url)}"><strong>${esc(i.title)}</strong><small>${esc(i.url)}${i.folder?` · ${esc(i.folder)}`:''}</small></button>${bookmarks?ib('edit','แก้ไขบุ๊กมาร์ก',`data-edit-bookmark="${i.id}"`):`<span class="row-time">${date(i.visitedAt)}</span>`}${ib('trash','ลบรายการ',`data-remove-${bookmarks?'bookmark':'history'}="${i.id}"`)}</div>`).join(''):empty(bookmarks?'bookmark':'history',filter?'ไม่พบรายการที่ค้นหา':bookmarks?'เว็บไซต์โปรดของคุณจะอยู่ที่นี่':'ยังไม่มีประวัติการเข้าชม',filter?'ลองชื่อหรือคำค้นอื่น':'เริ่มเปิดเว็บไซต์ แล้วกลับมาดูรายการได้ที่นี่');
}
function renderWorkspaces(){
 $('#content').innerHTML=`<section class="page">${pageHeader('A SPACE FOR EVERY IDEA','My Workspace','แยกชุดแท็บสำหรับแต่ละเรื่อง · Workspaces ใช้คุกกี้ร่วมกัน ไม่ใช่โปรไฟล์แยก')}<button class="primary-button" data-action="new-workspace">${svg('plus')}สร้าง workspace</button><div class="workspace-grid">${state.workspaces.map(w=>`<article class="card"><div class="card-head"><h2><span style="color:${w.color}">${svg('briefcase')}</span>${esc(w.name)}</h2>${ib('edit','แก้ไข workspace',`data-edit-workspace="${w.id}"`)}</div><p class="muted">${state.tabs.filter(t=>t.workspaceId===w.id).length} แท็บ</p><div class="button-row"><button class="primary-button" data-workspace="${w.id}">เปิดพื้นที่</button>${ib('trash','ลบ workspace และย้ายแท็บ',`data-remove-workspace="${w.id}"`)}</div></article>`).join('')}</div><h2>แท็บในพื้นที่นี้</h2>${state.tabs.filter(t=>t.workspaceId===state.activeWorkspace).map(t=>`<div class="library-row">${site(t)}<button class="library-link" data-activate="${t.id}">${esc(t.title)}</button><select data-move-tab="${t.id}" aria-label="ย้ายแท็บ ${esc(t.title)}">${state.workspaces.map(w=>`<option value="${w.id}" ${w.id===t.workspaceId?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div>`).join('')}</section>`;
}

function renderThemes(){ renderThemeStudio(); }

function aiSettingsMarkup(ai){
 const oauth=ai.provider==='oauth-openai-compatible';const connected=!!state.aiOAuth?.connected;
 return `<form id="ai-settings-form" class="settings-card"><h2>${svg('sparkles')}Cherry AI provider</h2><p class="muted">${ai.provider==='none'?'ยังไม่ได้เชื่อมต่อ AI':oauth?(connected?'เชื่อมบัญชี OAuth แล้ว':'ตั้งค่า OAuth แล้ว · ยังไม่ได้เชื่อมบัญชี'):'ตั้งค่าแล้ว · ทดสอบการเชื่อมต่อเพื่อยืนยัน'} · credential จัดเก็บด้วย Windows encryption</p><label class="field">Provider<select name="provider" id="ai-provider"><option value="none" ${ai.provider==='none'?'selected':''}>ยังไม่เชื่อมต่อ</option><option value="ollama" ${ai.provider==='ollama'?'selected':''}>Ollama</option><option value="openai-compatible" ${ai.provider==='openai-compatible'?'selected':''}>OpenAI-compatible + API key</option><option value="oauth-openai-compatible" ${oauth?'selected':''}>OpenAI-compatible + OAuth (PKCE)</option></select></label>${field('API base URL (Ollama: http://127.0.0.1:11434 / Compatible: https://host/v1)','endpoint',ai.endpoint,'url')}${field('Model','model',ai.model)}<div id="api-key-fields" data-ai-auth="key" ${oauth?'hidden':''}>${field(state.hasAIKey?'API key (มี key ที่บันทึกแล้ว; เว้นว่างเพื่อเก็บเดิม)':'API key (ถ้า provider ต้องการ)','apiKey','','password','autocomplete="new-password"')}<label class="check-label"><input type="checkbox" name="clearKey">ลบ key ที่บันทึกไว้</label></div><div id="oauth-fields" data-ai-auth="oauth" ${oauth?'':'hidden'}><div class="notice">สำหรับ AI backend ที่ประกาศ OAuth 2.0 Authorization Code + PKCE เท่านั้น ไม่ใช่การ Sign in ด้วยบัญชี ChatGPT และไม่ใช้ client secret ในแอป</div>${field('Authorization endpoint','oauthAuthorizationEndpoint',ai.oauthAuthorizationEndpoint||'','url','placeholder="https://accounts.example.com/oauth/authorize"')}${field('Token endpoint','oauthTokenEndpoint',ai.oauthTokenEndpoint||'','url','placeholder="https://accounts.example.com/oauth/token"')}${field('Client ID (public/native app)','oauthClientId',ai.oauthClientId||'','text','autocomplete="off"')}${field('Scopes (คั่นด้วยช่องว่าง)','oauthScopes',ai.oauthScopes||'','text','placeholder="openid profile offline_access" autocomplete="off"')}<div class="button-row"><button type="button" class="primary-button" data-action="ai-oauth-start">${connected?'เชื่อมบัญชีใหม่':'บันทึกและเชื่อมบัญชี'}</button>${connected?'<button type="button" class="secondary-button" data-action="ai-oauth-logout">ออกจากบัญชีใน Cherry</button>':''}</div></div><div class="button-row"><button class="primary-button" type="submit">บันทึก provider</button><button type="button" class="secondary-button" data-action="ai-check" ${oauth&&!connected?'disabled':''}>ทดสอบการเชื่อมต่อ</button></div><p id="provider-status" class="muted">${esc(state.providerStatus)}</p></form>`;
}

function renderSettings(){
 const s=state.settings;const ai=s.ai;
 $('#content').innerHTML=`<section class="page">${pageHeader('MAKE YOURSELF AT HOME','การตั้งค่า Cherry','ควบคุมการค้นหา ข้อมูล และเครื่องมือของคุณ')}<div class="settings-card"><div class="setting-row"><div><strong>เครื่องมือค้นหา</strong><p>ใช้กับช่องที่อยู่และหน้า New Tab</p></div><select id="search-engine" aria-label="เครื่องมือค้นหา">${Object.entries(engines).map(([id,label])=>`<option value="${id}" ${s.searchEngine===id?'selected':''}>${label}</option>`).join('')}</select></div><div class="setting-row"><div><strong>เปิดแท็บเดิมเมื่อเริ่มแอป</strong><p>บันทึกเฉพาะแท็บปกติ พร้อม workspace และธีม</p></div><input id="restore-tabs" type="checkbox" ${s.restoreTabs?'checked':''} aria-label="เปิดแท็บเดิมเมื่อเริ่มแอป"></div><div class="setting-row"><div><strong>Compact sidebar</strong><p>เพิ่มพื้นที่ให้เว็บไซต์ด้วย sidebar ขนาดเล็ก</p></div><input id="compact-sidebar" type="checkbox" ${s.compactSidebar?'checked':''} aria-label="Compact sidebar"></div><div class="setting-row"><div><strong>รูปลักษณ์</strong><p>เลือกตัวละคร ฉากหลัง และความเข้มแสง</p></div><button class="secondary-button" data-page="themes">Theme Studio</button></div><div class="setting-row"><div><strong>Memory Saver</strong><p>พักเฉพาะแท็บที่อนุญาตและไม่มีงานค้างที่ตรวจพบ</p></div><button class="secondary-button" data-page="memory">จัดการแท็บ</button></div></div>
 ${aiSettingsMarkup(ai)}
 <form id="weather-settings-form" class="settings-card"><h2>${svg('cloud')}Weather</h2><p class="muted">ส่งเฉพาะชื่อเมืองไปยัง Open-Meteo เมื่อคุณกดอัปเดตอากาศ ไม่มีการใช้ตำแหน่งอัตโนมัติ</p><label class="field">Provider<select name="provider"><option value="none">ยังไม่เชื่อมต่อ</option><option value="open-meteo" ${s.weather.provider==='open-meteo'?'selected':''}>Open-Meteo</option></select></label>${field('เมือง','city',s.weather.city)}<button class="primary-button">บันทึกอากาศ</button></form>
 <div class="settings-card"><h2>ข้อมูลและสิทธิ์เว็บไซต์</h2><p class="muted">ปุ่มข้อมูลข้างช่องที่อยู่ใช้จัดการสิทธิ์รายเว็บไซต์ การเปลี่ยนสิทธิ์มีผลกับคำขอครั้งถัดไป; โหลดหน้าใหม่เพื่อหยุดการใช้งานเดิม</p><div class="button-row"><button id="clear-site-data" class="secondary-button">ล้างคุกกี้และข้อมูลเว็บไซต์</button><button class="secondary-button" data-action="private-tab">เปิดแท็บ Private</button></div><p class="muted">Private ไม่เก็บประวัติและไม่ restore แท็บ แต่ไฟล์ดาวน์โหลด/บุ๊กมาร์กที่สั่งเก็บยังอยู่ ไม่ปิดบังการเชื่อมต่อจากเว็บไซต์หรือผู้ให้บริการเครือข่าย</p><p class="muted">ตัวบล็อกโฆษณา/Tracker: ยังไม่ได้ติดตั้ง rule engine จึงไม่มีการอ้างว่าบล็อกแล้ว</p></div>
 <div class="settings-card"><h2>อัปเดตแอป</h2><p class="muted">ตรวจสอบและติดตั้งเวอร์ชันใหม่จาก GitHub Releases การติดตั้งจะรีสตาร์ทแอป</p><div class="setting-row"><div><strong>ตรวจสอบอัปเดตอัตโนมัติเมื่อเปิดแอป</strong><p>จะตรวจหนึ่งครั้งหลังเปิดราว 30 วินาที โดยไม่ดาวน์โหลดอะไรเอง</p></div><input id="auto-update" type="checkbox" ${s.autoUpdate?'checked':''} aria-label="ตรวจสอบอัปเดตอัตโนมัติ"></div><div class="button-row"><button id="check-updates" class="secondary-button" ${state.update.state==='checking'||state.update.state==='downloading'?'disabled':''}>ตรวจสอบอัปเดต</button>${state.update.state==='available'?`<button id="update-download" class="primary-button">ดาวน์โหลด v${esc(state.update.version)}</button>`:''}${state.update.state==='ready'?`<button id="update-install" class="primary-button">รีสตาร์ทเพื่อติดตั้ง</button>`:''}<button id="update-open-releases" class="secondary-button">เปิดหน้า release</button></div><p class="muted" id="update-status">${esc(state.update.message||'')}</p></div>
 <div class="settings-card"><h2>ทางลัดหน้าแรก</h2>${state.shortcuts.map(s=>`<div class="setting-row"><span>${esc(s.title)}</span><div class="button-row">${ib('edit','แก้ทางลัด',`data-edit-shortcut="${s.id}"`)}${ib('trash','ลบทางลัด',`data-remove-shortcut="${s.id}"`)}</div></div>`).join('')}<button class="secondary-button" data-action="new-shortcut">เพิ่มทางลัด</button></div><p class="about">${esc(state.browserName)} v${esc(state.version)} · Chromium ${esc(state.runtime)} · ส่วนขยาย Chrome, DRM และ OAuth บางเว็บไซต์อาจไม่รองรับ</p></section>`;
}

function bytes(n){return n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;}
function downloadRows(){
 const statuses={progressing:'กำลังดาวน์โหลด',completed:'เสร็จสมบูรณ์',cancelled:'ยกเลิกแล้ว',interrupted:'สะดุด'};
 return state.downloads.length?state.downloads.map(d=>`<article class="download-row">${svg('download')}<div><strong>${esc(d.filename)}</strong><small>${d.paused?'พักอยู่':statuses[d.state]} · ${bytes(d.received)}${d.total?` / ${bytes(d.total)}`:''}</small><small class="path-text">${esc(d.path||'กำลังเลือกตำแหน่งบันทึก')}</small>${d.state==='progressing'?`<progress max="${d.total||1}" ${d.total?`value="${d.received}"`:''}></progress>`:''}<div class="button-row">${d.state==='completed'?`<button class="secondary-button" data-show-download="${d.id}">เปิดโฟลเดอร์</button>`:['progressing','interrupted'].includes(d.state)?`${d.paused||d.state==='interrupted'?`<button class="secondary-button" data-resume-download="${d.id}" ${d.canResume?'':'disabled'} title="ต้องมีการรองรับจากเซิร์ฟเวอร์">ดาวน์โหลดต่อ</button>`:`<button class="secondary-button" data-pause-download="${d.id}">พัก</button>`}<button class="text-button" data-cancel-download="${d.id}">ยกเลิก</button>`:''}</div></div></article>`).join(''):empty('download','ยังไม่มีรายการดาวน์โหลด','รายการในครั้งนี้จะแสดงชื่อไฟล์และความคืบหน้าจริง · รายการที่เสร็จแล้วจะเก็บไว้ข้ามการเปิดแอป');
}
function renderDownloads(){$('#content').innerHTML=`<section class="page">${pageHeader('YOUR DOWNLOAD HUB','ดาวน์โหลด','เลือกตำแหน่งบันทึกก่อนดาวน์โหลด · รายการที่เสร็จในโหมดปกติจะอยู่ในเครื่องข้ามการเปิดแอป · ลบไฟล์ในเครื่องแล้วรายการจะหายไปด้วย')}${downloadRows()}</section>`;}
function renderMemory(){
 $('#content').innerHTML=`<section class="page">${pageHeader('A LITTLE MORE ROOM','Tab Memory Saver','พักแท็บโดยปิด WebContents จริง · เมื่อตื่นจะโหลด URL ใหม่ และอาจคืนข้อมูลฟอร์มไม่ได้ทั้งหมด')}<div class="settings-card"><div class="setting-row"><div><strong>พักแท็บอัตโนมัติที่อนุญาต</strong><p>ไม่พักแท็บ active / split, เสียง, capture, downloads, iframe หรือแท็บที่ตรวจพบงานค้าง</p></div><input id="memory-enabled" type="checkbox" aria-label="Memory Saver" ${state.settings.memorySaver?'checked':''}></div><label class="field">พักหลังไม่ใช้งาน (นาที)<input id="memory-minutes" type="number" min="5" max="240" value="${state.settings.suspendMinutes}"></label><label class="field">ยกเว้นเว็บไซต์ (hostname คั่นด้วย comma)<input id="memory-exceptions" value="${esc(state.settings.memoryExceptions.join(', '))}" placeholder="example.com, mail.example.com"></label></div>${state.tabs.filter(t=>isWebsite(t.url)).map(t=>`<div class="library-row">${site(t)}<button class="library-link" data-activate="${t.id}"><strong>${esc(t.title)}</strong><small>${t.suspended?'พักอยู่ — กดเพื่อโหลดใหม่':t.id===state.activeId?'กำลังใช้งาน':'พร้อมใช้งาน'}${t.audible?' · มีเสียง':''}</small></button><label class="check-label"><input type="checkbox" data-auto-suspend="${t.id}" ${t.autoSuspend?'checked':''}>อนุญาตอัตโนมัติ</label><button class="secondary-button" data-suspend="${t.id}" ${t.suspended?'disabled':''}>พักแท็บ</button></div>`).join('')||empty('moon','ยังไม่มีแท็บเว็บไซต์','เปิดเว็บไซต์ก่อนจัดการการพักแท็บ')}</section>`;
}
function isWebsite(url){return /^https?:\/\//.test(url);}

let noteDraft={id:null,title:'',body:'',sourceURL:''};
function organizerTabsMarkup(){
 const pending=state.reminders.filter(item=>!item.done).length;
 return `<div class="organizer-tabs" role="tablist" aria-label="Notes, Post-it และการแจ้งเตือน"><button class="${organizerTab==='notes'?'active':''}" data-organizer-tab="notes" role="tab">${svg('notes')}Notes <span class="tab-count">${state.notes.length}</span></button><button class="${organizerTab==='postits'?'active':''}" data-organizer-tab="postits" role="tab">${svg('postit')}Post-it <span class="tab-count">${state.postIts.length}</span></button><button class="${organizerTab==='reminders'?'active':''}" data-organizer-tab="reminders" role="tab">${svg('bell')}เตือน <span class="tab-count">${pending}</span></button></div>`;
}
function notesMarkup(){
 if(!noteDraft.id&&!noteDirty&&state.notes.length){noteDraft={...state.notes[0]};selectedNoteId=noteDraft.id;}
 return `${organizerTabsMarkup()}<div class="notes-tools"><button class="secondary-button" data-action="new-note">${svg('plus')}โน้ตใหม่</button><button class="text-button" data-action="clip">${svg('clip')}เก็บข้อความที่เลือก</button></div><div class="note-list">${state.notes.map(n=>`<button class="${n.id===noteDraft.id?'active':''}" data-select-note="${n.id}"><strong>${esc(n.title||'โน้ตไม่มีชื่อ')}</strong><small>${date(n.updatedAt)}</small></button>`).join('')}</div><form id="note-form"><label class="field">ชื่อโน้ต<input id="note-title" value="${esc(noteDraft.title)}" placeholder="ไอเดียใหม่ของคุณ" maxlength="200"></label><label class="field">ข้อความ<textarea id="note-body" rows="12" maxlength="100000" placeholder="เขียนสิ่งที่อยากเก็บไว้…">${esc(noteDraft.body)}</textarea></label>${noteDraft.sourceURL?`<button type="button" class="note-source text-button" data-url="${esc(noteDraft.sourceURL)}">แหล่งที่มา: ${esc(noteDraft.sourceURL)}</button>`:''}<div class="button-row"><button class="primary-button" id="save-note">บันทึกโน้ต</button>${noteDraft.id?`<button type="button" class="secondary-button" data-delete-note="${noteDraft.id}">ลบ</button>`:''}</div><p id="note-status" class="muted">${noteDirty?'มีการแก้ไขที่ยังไม่บันทึก':'บันทึกไว้ในเครื่อง · ข้อความไม่ถูกส่งไป AI อัตโนมัติ'}</p></form>`;
}
function postItCards(){
 return state.postIts.length?`<div class="postit-board">${state.postIts.map(item=>`<article class="postit-card" data-color="${item.color}"><button class="postit-open" data-edit-postit="${item.id}"><strong>${esc(item.title||'Post-it')}</strong><p>${esc(item.body)}</p><small>${item.pinned?'ปักหมุด · ':''}${date(item.updatedAt)}</small></button><button class="postit-pin" data-pin-postit="${item.id}" title="${item.pinned?'เลิกปักหมุด':'ปักหมุด'}" aria-label="${item.pinned?'เลิกปักหมุด':'ปักหมุด'}">${svg('pin')}</button></article>`).join('')}</div>`:`<div class="organizer-empty">${empty('postit','ยังไม่มี Post-it','เขียนข้อความสั้น ๆ เลือกสี แล้วปักไว้บนบอร์ด')}</div>`;
}
function reminderRows(compact=false){
 const items=[...state.reminders].sort((a,b)=>Number(a.done)-Number(b.done)||a.dueAt-b.dueAt);
 if(compact)return items.filter(item=>!item.done).slice(0,8).map(item=>`<button class="panel-reminder" data-edit-reminder="${item.id}">${svg('bell')}<strong>${esc(item.title)}</strong><small>${reminderTime(item.dueAt)}</small></button>`).join('')||empty('bell','ยังไม่มีรายการเตือน','เพิ่มวันและเวลาให้ Cherry แจ้งผ่าน Windows');
 return items.length?`<div class="reminder-list">${items.map(item=>{const overdue=!item.done&&item.dueAt<Date.now();return `<article class="reminder-row ${overdue?'overdue':''} ${item.done?'done':''}"><input type="checkbox" data-reminder-done="${item.id}" ${item.done?'checked':''} aria-label="ทำรายการ ${esc(item.title)} เสร็จแล้ว"><div class="reminder-copy"><strong>${esc(item.title)}</strong>${item.details?`<p>${esc(item.details)}</p>`:''}<span class="reminder-time">${svg('clock')}${reminderTime(item.dueAt)}</span></div><div class="reminder-menu">${ib('edit','แก้ไขการแจ้งเตือน',`data-edit-reminder="${item.id}"`)}${ib('trash','ลบการแจ้งเตือน',`data-delete-reminder="${item.id}"`)}</div>${item.done?'':`<div class="reminder-snooze"><span>เลื่อนเตือน</span><select data-snooze-select="${item.id}" aria-label="ระยะเวลาเลื่อน"><option value="10">10 นาที</option><option value="30">30 นาที</option><option value="60">1 ชั่วโมง</option><option value="1440">พรุ่งนี้</option></select><button class="text-button" data-snooze-reminder="${item.id}">เลื่อน</button></div>`}</article>`;}).join('')}</div>`:`<div class="organizer-empty">${empty('bell','ยังไม่มีการแจ้งเตือน','กำหนดหัวข้อ วัน และเวลา แล้ว Cherry จะแจ้งผ่าน Windows')}</div>`;
}
function postItsPanelMarkup(){
 return `${organizerTabsMarkup()}<div class="organizer-actions"><button class="primary-button" data-action="new-postit">${svg('plus')}Post-it ใหม่</button><button class="text-button" data-page="notes">เปิดบอร์ดทั้งหมด</button></div><div class="panel-postit-list">${state.postIts.slice(0,10).map(item=>`<button class="panel-postit" data-color="${item.color}" data-edit-postit="${item.id}"><strong>${esc(item.title||'Post-it')}</strong><p>${esc(item.body.slice(0,120))}</p></button>`).join('')||empty('postit','ยังไม่มี Post-it','กดสร้าง Post-it ใหม่เพื่อเริ่มจด')}</div>`;
}
function remindersPanelMarkup(){
 return `${organizerTabsMarkup()}<div class="organizer-actions"><button class="primary-button" data-action="new-reminder">${svg('plus')}เพิ่มแจ้งเตือน</button><button class="text-button" data-page="notes">ดูทั้งหมด</button></div><p class="organizer-help">${state.notificationsSupported?'พร้อมแจ้งผ่าน Windows เมื่อถึงเวลา':'เครื่องนี้ไม่รองรับ native notification แต่รายการยังถูกเก็บและแสดงใน Cherry'}</p><div class="panel-reminder-list">${reminderRows(true)}</div>`;
}
function organizerPanelMarkup(){return organizerTab==='postits'?postItsPanelMarkup():organizerTab==='reminders'?remindersPanelMarkup():notesMarkup();}
function renderNotesPage(){
 const pending=state.reminders.filter(item=>!item.done).length;
 const stats=`<div class="organizer-stats"><div class="organizer-stat"><strong>${state.notes.length}</strong><small>โน้ตที่เก็บไว้</small></div><div class="organizer-stat"><strong>${state.postIts.length}</strong><small>Post-it บนบอร์ด</small></div><div class="organizer-stat"><strong>${pending}</strong><small>รายการเตือนที่รออยู่</small></div></div>`;
 let body='';
 if(organizerTab==='notes')body=`<div class="organizer-actions"><button class="primary-button" data-action="new-note">${svg('plus')}โน้ตใหม่</button><button class="secondary-button" data-action="clip">${svg('clip')}เก็บข้อความจากเว็บ</button></div><div class="workspace-grid">${state.notes.map(n=>`<button class="card library-link" data-select-note="${n.id}"><strong>${esc(n.title||'โน้ตไม่มีชื่อ')}</strong><p class="muted">${esc(n.body.slice(0,160))}</p><small>${date(n.updatedAt)}</small></button>`).join('')}</div>${state.notes.length?'':empty('notes','ยังไม่มีโน้ต','เก็บข้อความจากเว็บด้วย Clip หรือเขียนโน้ตใหม่')}`;
 if(organizerTab==='postits')body=`<div class="organizer-actions"><button class="primary-button" data-action="new-postit">${svg('plus')}Post-it ใหม่</button></div>${postItCards()}`;
 if(organizerTab==='reminders')body=`<div class="organizer-actions"><button class="primary-button" data-action="new-reminder">${svg('plus')}เพิ่มแจ้งเตือน</button></div><p class="organizer-help">${state.notificationsSupported?'Cherry จะส่ง Windows notification เมื่อถึงเวลา แม้คุณกำลังเปิดเว็บไซต์อยู่':'ระบบยังเก็บวันเวลาไว้ แต่ Windows notification ไม่พร้อมบนเครื่องนี้'}</p>${reminderRows()}`;
 $('#content').innerHTML=`<section class="page notes-page">${pageHeader('KEEP A LITTLE INSPIRATION','Notes, Post-it & Reminder','เก็บไอเดียลงเครื่อง จดข้อความสั้นบนบอร์ด และตั้งเวลาให้ Cherry เตือน')}${stats}${organizerTabsMarkup()}${body}</section>`;
}
async function saveNote(){
 const result=await command('note-save',noteDraft);if(result.ok){noteDraft.id=result.id;selectedNoteId=result.id;noteDirty=false;if($('#note-status'))$('#note-status').textContent='บันทึกแล้ว';toast('บันทึกโน้ตแล้ว');}return result.ok;
}
function renderPanel(){
 const panel=state.ui.panel;if(!panel){panelKey='';return;}
 const tab=active();const names={ai:'Cherry AI',notes:'Notes · Post-it · เตือน',downloads:'Download Hub',reader:'Reader',info:'ข้อมูลเว็บไซต์'};$('#panel-title').textContent=names[panel];
 const key=JSON.stringify([panel,panel==='ai'?[state.settings.ai,state.aiOAuth,state.aiPreview,state.aiResult,state.aiBusy,tab.url]:panel==='notes'?[organizerTab,state.notes,state.postIts,state.reminders,state.notificationsSupported]:panel==='downloads'?state.downloads:panel==='reader'?state.reader:[tab.url,tab.private,state.permissions]]);
 if(key===panelKey)return;
 if(panel==='notes'&&organizerTab==='notes'&&noteDirty&&$('#panel-content #note-form'))return;
 panelKey=key;const el=$('#panel-content');
 if(panel==='notes')el.innerHTML=organizerPanelMarkup();
 else if(panel==='downloads')el.innerHTML=downloadRows();
 else if(panel==='reader')el.innerHTML=state.reader?`<article class="reader"><small>READING MODE</small><h1>${esc(state.reader.title)}</h1><button class="note-source text-button" data-url="${esc(state.reader.url)}">${esc(state.reader.url)}</button>${state.reader.text.split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('')}<div class="button-row"><button class="secondary-button" data-action="reader-to-note">เก็บบทความเป็นโน้ต</button></div></article>`:empty('reader','เลือกบทความที่อยากอ่าน','เปิดเว็บไซต์ แล้วกด Reader ที่ toolbar');
 else if(panel==='ai'){
   const configured=state.settings.ai.provider!=='none'&&state.settings.ai.endpoint&&state.settings.ai.model&&(state.settings.ai.provider!=='oauth-openai-compatible'||state.aiOAuth?.connected);
   el.innerHTML=`<div class="ai-intro">${svg('sparkles')}<h3>ไอเดียดี ๆ เริ่มจากคำถาม</h3><p>${configured?`${esc(state.settings.ai.provider)} · ${esc(state.settings.ai.model)}`:state.settings.ai.provider==='oauth-openai-compatible'?'ตั้งค่าแล้ว · เชื่อมบัญชี OAuth ก่อนใช้ AI':'ยังไม่ได้เชื่อมต่อ AI'}</p><button class="secondary-button" data-page="settings">ตั้งค่า provider</button></div>${configured?`<div class="ai-actions"><button data-ai="summarize" ${isWebsite(tab.url)?'':'disabled'}>สรุปหน้าปัจจุบัน ${svg('arrow')}</button><button data-ai="translate" ${isWebsite(tab.url)?'':'disabled'}>แปลข้อความที่เลือก ${svg('arrow')}</button><button data-ai="ask" ${isWebsite(tab.url)?'':'disabled'}>ถามเกี่ยวกับหน้านี้ ${svg('arrow')}</button><button data-ai="draft">ช่วยร่างข้อความ ${svg('arrow')}</button></div>`:'<div class="notice">เลือก Ollama, API key หรือ OAuth พร้อม endpoint/model ในการตั้งค่า จึงจะสรุป แปล และถามได้ ไม่มีการสร้างคำตอบตัวอย่างแทน provider</div>'}
   ${state.aiPreview?`<form id="ai-send-form"><div class="ai-scope"><strong>ตรวจข้อความก่อนส่ง</strong><p>${esc(state.aiPreview.provider.provider)} · ${esc(state.aiPreview.provider.model)}</p><small>${esc(state.aiPreview.provider.endpoint)}</small><p>ส่งเฉพาะชื่อหน้า URL และข้อความด้านล่าง ${state.aiPreview.text.length.toLocaleString()} ตัวอักษร พร้อมคำถามของคุณ</p><details><summary>ดูเนื้อหาที่จะส่ง</summary><pre>${esc(state.aiPreview.text||'(ไม่มีเนื้อหาเว็บไซต์ — ช่วยร่างข้อความเท่านั้น)')}</pre></details></div><label class="field">คำถาม / ภาษาปลายทาง / คำขอ<textarea name="question" id="ai-question" rows="3" placeholder="สิ่งที่อยากให้ช่วย…"></textarea></label><label class="check-label"><input name="consent" type="checkbox" required>ยินยอมส่งข้อความนี้ไปยัง provider ที่แสดง</label><button class="primary-button" ${state.aiBusy?'disabled':''}>${state.aiBusy?'กำลังรอ provider…':'ส่งข้อความที่ตรวจแล้ว'}</button></form>`:''}${state.aiResult?`<div class="ai-response"><small>คำตอบจาก provider</small><pre>${esc(state.aiResult)}</pre><button class="secondary-button" data-action="ai-to-note">เก็บเป็นโน้ต</button></div>`:''}<p class="panel-footnote">ไม่ส่ง cookies, passwords หรือข้อมูลทุกแท็บ และ AI ไม่มีสิทธิ์ควบคุมเครื่องหรือทำงานภายนอก</p>`;
 }else if(panel==='info'){
   const origin=isWebsite(tab.url)?new URL(tab.url).origin:'';const choices={media:'กล้อง / ไมโครโฟน',geolocation:'ตำแหน่งที่ตั้ง',notifications:'การแจ้งเตือน'};
   el.innerHTML=origin?`<div class="site-info"><h3>${esc(host(tab.url))}</h3><p class="notice">${tab.url.startsWith('https:')?'HTTPS · ใช้การตรวจใบรับรองตามปกติ':'HTTP · การเชื่อมต่อนี้ไม่มีการเข้ารหัส'}</p><p class="muted">สิทธิ์มีผลกับคำขอใหม่ โหลดหน้าอีกครั้งหากกำลังใช้อุปกรณ์อยู่</p>${Object.entries(choices).map(([permission,label])=>`<label class="permission-row">${label}<select data-permission="${permission}" data-origin="${esc(origin)}" ${tab.private?'disabled':''}>${[['ask','ถามก่อน'],['allow','อนุญาต'],['deny','ปฏิเสธ']].map(([value,label])=>`<option value="${value}" ${state.permissions[origin]?.[permission]===value?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}${tab.private?'<p class="muted">Private ถามสิทธิ์เฉพาะครั้งนี้ ไม่บันทึกกฎถาวร</p>':''}<button class="secondary-button" data-clear-origin="${esc(origin)}">ล้างข้อมูลเว็บไซต์นี้</button><p class="muted">Tracker/ad blocking: ยังไม่มี rule engine</p></div>`:empty('info','หน้าใน Cherry','ข้อมูลเว็บไซต์จะแสดงเมื่อเปิด HTTP/HTTPS');
 }
}

const paletteCommands=[
 ['แท็บใหม่','new-tab','plus'],['เปิดแท็บที่ปิดล่าสุด','reopen-tab','history'],['แท็บ Private','private-tab','moon'],['ปักหมุด / เลิกปักหมุดแท็บ','pin-current','pin'],['ปิด / เปิดเสียงแท็บ','mute-current','volume'],['Split View','split','split'],['Reader อ่านหน้าเว็บ','reader','reader'],['เก็บข้อความที่เลือก','clip','clip'],['Cherry AI','panel-ai','sparkles'],['Notes & Clip','panel-notes','notes'],['Calendar ปฏิทิน','page-calendar','calendar'],['เพิ่มนัดหมาย','new-calendar-event','calendar'],['Post-it ใหม่','new-postit','postit'],['ตั้งเวลาแจ้งเตือน','new-reminder','bell'],['ดาวน์โหลด','page-downloads','download'],['บุ๊กมาร์ก','page-bookmarks','bookmark'],['ประวัติ','page-history','history'],['Workspaces','page-workspaces','grid'],['Theme Studio','page-themes','wand'],['Memory Saver','page-memory','moon'],['การตั้งค่า','page-settings','settings'],
];
async function openPalette(fromMain=false){
 openingDialog=true;closeDialogs();if(!fromMain)await command('overlay',true);$('#palette-input').value='';paletteIndex=0;renderPalette();$('#palette-dialog').showModal();$('#palette-input').focus();openingDialog=false;
}
function renderPalette(){
 const q=$('#palette-input').value.toLowerCase();
 const commands=paletteCommands.filter(([title])=>title.toLowerCase().includes(q)).map(([title,action,icon])=>`<button class="palette-result" data-palette-action="${action}">${svg(icon)}<span>${title}</span><small>คำสั่ง</small></button>`);
 const matches=state.tabs.filter(t=>`${t.title} ${t.url}`.toLowerCase().includes(q)).map(t=>`<button class="palette-result" data-palette-tab="${t.id}">${site(t)}<span>${esc(t.title)}</span><small>แท็บ</small></button>`);
 const bookmarks=state.bookmarks.filter(b=>`${b.title} ${b.url}`.toLowerCase().includes(q)).map(b=>`<button class="palette-result" data-palette-url="${esc(b.url)}">${svg('bookmark')}<span>${esc(b.title)}</span><small>บุ๊กมาร์ก</small></button>`);
 $('#palette-results').innerHTML=[...commands,...matches,...bookmarks].slice(0,60).join('')||'<p class="muted">ไม่พบรายการ</p>';highlightPalette();
}
function highlightPalette(){const rows=[...document.querySelectorAll('.palette-result')];paletteIndex=Math.max(0,Math.min(rows.length-1,paletteIndex));rows.forEach((r,i)=>r.classList.toggle('selected',i===paletteIndex));rows[paletteIndex]?.scrollIntoView({block:'nearest'});}

async function editWorkspace(id){const w=state.workspaces.find(w=>w.id===id)||{};await showForm(id?'แก้ไข workspace':'สร้าง workspace',field('ชื่อ','name',w.name||'','text','required maxlength="60"')+field('สี','color',w.color||'#2f6bff','color'),async data=>(await command('workspace-save',{id,...data})).ok);}
async function editShortcut(id){const s=state.shortcuts.find(s=>s.id===id)||{};await showForm(id?'แก้ไขทางลัด':'เพิ่มทางลัด',field('ชื่อ','title',s.title||'','text','required')+field('เว็บไซต์','url',s.url||'https://','text','required'),async data=>(await command('shortcut-save',{id,...data})).ok);}
async function editPostIt(id){
 const item=state.postIts.find(item=>item.id===id)||{title:'',body:'',color:'yellow',pinned:false};
 const colors=['yellow','blue','pink','mint','purple'];
 await showForm(id?'แก้ไข Post-it':'Post-it ใหม่',`${field('หัวข้อ','title',item.title,'text','maxlength="120" placeholder="เช่น ไอเดียวันนี้"')}<label class="field">ข้อความ<textarea name="body" rows="7" maxlength="4000" required placeholder="จดสั้น ๆ แล้วปักไว้บนบอร์ด…">${esc(item.body)}</textarea></label><span class="field">สีของ Post-it</span><div class="postit-color-row">${colors.map(color=>`<label class="postit-color" data-color="${color}" title="${color}"><input type="radio" name="color" value="${color}" ${item.color===color?'checked':''}><span></span></label>`).join('')}</div><label class="check-label"><input type="checkbox" name="pinned" ${item.pinned?'checked':''}>ปัก Post-it ใบนี้ไว้ด้านบน</label>`,async data=>{data.pinned=data.pinned==='on';const result=await command('postit-save',{id,...data});if(result.ok){organizerTab='postits';toast('บันทึก Post-it แล้ว');}return result.ok;},'บันทึก Post-it');
}
async function editReminder(id){
 const item=state.reminders.find(item=>item.id===id)||{title:'',details:'',dueAt:Date.now()+3600000,done:false};
 await showForm(id?'แก้ไขการแจ้งเตือน':'เพิ่มการแจ้งเตือน',`${field('หัวข้อที่ต้องการให้เตือน','title',item.title,'text','required maxlength="200" placeholder="เช่น ส่งรายงาน"')}<label class="field">รายละเอียด<textarea name="details" rows="4" maxlength="2000" placeholder="ข้อมูลที่อยากเห็นตอนแจ้งเตือน…">${esc(item.details)}</textarea></label>${field('วันและเวลา','dueAt',localDateTimeValue(item.dueAt),'datetime-local','required')}`,async data=>{const result=await command('reminder-save',{id,...data,done:item.done});if(result.ok){organizerTab='reminders';toast('ตั้งเวลาแจ้งเตือนแล้ว');}return result.ok;},'ตั้งเวลาเตือน');
}
async function openSplit(){if(state.ui.split){await command('split-close');return;}if(!isWebsite(active().url)){toast('เปิดเว็บไซต์ก่อนใช้ Split View');return;}const candidates=state.tabs.filter(t=>t.id!==state.activeId&&t.workspaceId===state.activeWorkspace&&isWebsite(t.url));await showForm('เปิดสองเว็บไซต์พร้อมกัน',`<label class="field">เลือกแท็บด้านขวา<select name="id"><option value="">เปิด URL ใหม่</option>${candidates.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select></label>${field('หรือ URL อีกเว็บไซต์','url','https://example.com/')}<p class="muted">คลิกเว็บแต่ละด้านเพื่อเลือกด้านที่ช่องที่อยู่ควบคุม</p>`,async data=>(await command('split-open',data)).ok,'เปิด Split View');}

async function saveAISettingsForm(){
 const form=$('#ai-settings-form');if(!form)return {ok:false};
 const data=Object.fromEntries(new FormData(form));data.clearKey=data.clearKey==='on';
 const result=await command('ai-settings',data);
 if(result.ok&&form.elements.apiKey)form.elements.apiKey.value='';
 return result;
}

function syncAIAuthFields(){
 const provider=$('#ai-provider')?.value;const oauth=provider==='oauth-openai-compatible';
 if($('#oauth-fields'))$('#oauth-fields').hidden=!oauth;
 if($('#api-key-fields'))$('#api-key-fields').hidden=oauth;
}

async function perform(action){
 if(action==='palette')return openPalette();if(action==='split')return openSplit();if(action==='close-dialog'){closeDialogs();return;}
 if(action==='new-workspace')return editWorkspace();if(action==='new-shortcut')return editShortcut();
 if(action==='pin-current')return command('pin-tab',state.activeId);if(action==='mute-current')return command('mute-tab',state.activeId);
 if(action.startsWith('page-'))return command('internal',action.slice(5));if(action.startsWith('panel-'))return command('panel',action.slice(6));
 if(action==='new-note'){organizerTab='notes';if(noteDirty&&!await saveNote())return;noteDraft={id:null,title:'',body:'',sourceURL:''};selectedNoteId=null;noteDirty=true;panelKey='';if(state.ui.panel==='notes')$('#panel-content').innerHTML=notesMarkup();else{await command('panel','notes');}return;}
 if(action==='new-postit')return editPostIt();
 if(action==='new-reminder')return editReminder();
 if(action==='new-calendar-event'){await command('internal','calendar');return editCalendarEvent();}
 if(action==='new-todo')return showForm('เพิ่มสิ่งที่อยากทำ',field('รายการ','text','','text','required'),async data=>(await command('todo-save',data)).ok);
 if(action==='weather'){if(state.settings.weather.provider==='none'){await command('internal','settings');toast('เลือก Open-Meteo และเมืองในส่วน Weather');}else{const r=await command('weather-refresh');if(r.ok)toast('อัปเดตอากาศจาก Open-Meteo แล้ว');}return;}
 if(action==='reader-to-note'||action==='ai-to-note'){const content=action==='reader-to-note'?state.reader:{title:'Cherry AI',text:state.aiResult,url:state.aiPreview?.url};if(!content)return;const r=await command('note-save',{title:content.title,body:content.text,sourceURL:content.url});if(r.ok)toast('เก็บเป็นโน้ตแล้ว');return;}
 if(action==='ai-check'){const r=await command('ai-check');if(r.ok){toast(`เชื่อมต่อ provider ได้ · ${r.models.length} models`);if($('#provider-status'))$('#provider-status').textContent=r.models.join(', ')||'เชื่อมต่อได้ ไม่มีรายการ model';}return;}
 if(action==='ai-oauth-start'){if(!(await saveAISettingsForm()).ok)return;const r=await command('ai-oauth-start');if(r.ok)toast('เชื่อมบัญชี OAuth แล้ว');return;}
 if(action==='ai-oauth-logout'){const r=await command('ai-oauth-logout');if(r.ok)toast('ออกจากบัญชี OAuth ใน Cherry แล้ว');return;}
 const result=await command(action);if(result.ok&&action==='new-tab')focusAddress();
}

document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;const d=button.dataset;
 if(d.paletteAction||d.paletteTab||d.paletteUrl){closeDialogs();if(d.paletteAction)await perform(d.paletteAction);if(d.paletteTab)await command('activate-tab',d.paletteTab);if(d.paletteUrl)await command('navigate',d.paletteUrl);return;}
 if(d.organizerTab){if(organizerTab==='notes'&&d.organizerTab!=='notes'&&noteDirty&&!await saveNote())return;organizerTab=d.organizerTab;panelKey='';pageKey='';if(state.ui.panel==='notes')renderPanel();else if(currentPage==='notes')renderNotesPage();return;}
 if(d.page){await command('internal',d.page);if(state.ui.panel&&['notes','settings','themes','calendar'].includes(d.page))await command('panel',null);}
 else if(d.panel)await command('panel',state.ui.panel===d.panel?null:d.panel);
 else if(d.action)await perform(d.action);
 else if(d.activate)await command('activate-tab',d.activate);
 else if(d.close)await command('close-tab',d.close);
 else if(d.mute)await command('mute-tab',d.mute);
 else if(d.url)await command('navigate',d.url);
 else if(d.workspace)await command('workspace-switch',d.workspace);
 else if(d.editWorkspace)await editWorkspace(d.editWorkspace);
 else if(d.removeWorkspace)await confirmAction('ลบ workspace?','แท็บจะย้ายไปพื้นที่อื่น ไม่ลบประวัติหรือบุ๊กมาร์ก',()=>command('workspace-remove',d.removeWorkspace));
 else if(d.editShortcut)await editShortcut(d.editShortcut);
 else if(d.removeShortcut)await command('shortcut-remove',d.removeShortcut);
 else if(d.removeBookmark)await command('remove-bookmark',d.removeBookmark);
 else if(d.removeHistory)await command('remove-history',d.removeHistory);
 else if(d.editBookmark){const b=state.bookmarks.find(b=>b.id===d.editBookmark);await showForm('แก้ไขบุ๊กมาร์ก',field('ชื่อ','title',b.title)+field('URL','url',b.url)+field('โฟลเดอร์','folder',b.folder||''),async data=>(await command('bookmark-edit',{id:b.id,...data})).ok);}
 else if(d.themeChoice){const selected=themeCatalog.find(([id])=>id===d.themeChoice);if(selected){const novel=themeScene(selected[0]);await command('theme-save',{variant:selected[0],background:selected[2],...(novel?{character:novel.character}:{})});}}
 else if(d.character)await command('theme-save',{character:d.character});
 else if(d.ai){if(state.settings.ai.provider==='none'){await command('panel','ai');return;}if(d.ai!=='draft'&&!isWebsite(active().url)){await command('panel','ai');toast('เปิดเว็บไซต์ก่อนใช้คำสั่งนี้');return;}await command('ai-preview',d.ai);}
 else if(d.selectNote){organizerTab='notes';if(noteDirty&&!await saveNote())return;noteDraft={...state.notes.find(n=>n.id===d.selectNote)};selectedNoteId=noteDraft.id;noteDirty=false;panelKey='';if(state.ui.panel==='notes')renderPanel();else await command('panel','notes');}
 else if(d.deleteNote)await confirmAction('ลบโน้ตนี้?','ข้อความและ URL แหล่งที่มาของโน้ตนี้จะถูกลบ',async()=>{await command('note-delete',d.deleteNote);noteDraft={id:null,title:'',body:'',sourceURL:''};noteDirty=false;panelKey='';pageKey='';});
 else if(d.editPostit)await editPostIt(d.editPostit);
 else if(d.pinPostit){const item=state.postIts.find(item=>item.id===d.pinPostit);if(item)await command('postit-save',{...item,pinned:!item.pinned});}
 else if(d.deletePostit)await confirmAction('ลบ Post-it ใบนี้?','ข้อความบนบอร์ดจะถูกลบออกจากเครื่อง',()=>command('postit-delete',d.deletePostit));
 else if(d.editReminder)await editReminder(d.editReminder);
 else if(d.deleteReminder)await confirmAction('ลบการแจ้งเตือนนี้?','รายการและวันเวลาที่ตั้งไว้จะถูกลบ',()=>command('reminder-delete',d.deleteReminder));
 else if(d.snoozeReminder){const select=button.closest('.reminder-snooze')?.querySelector('select');if((await command('reminder-snooze',{id:d.snoozeReminder,minutes:Number(select?.value)||10})).ok)toast('เลื่อนเวลาแจ้งเตือนแล้ว');}
 else if(d.suspend)await confirmAction('พักแท็บนี้?','หน้าเว็บจะถูกปิดและโหลดใหม่เมื่อกลับมา ข้อมูลฟอร์มอาจสูญหาย แท็บที่มีเสียง ดาวน์โหลด capture หรือ iframe จะไม่ถูกพัก',()=>command('suspend-tab',{id:d.suspend,confirmed:true}));
 else if(d.clearOrigin)await confirmAction('ล้างข้อมูลเว็บไซต์นี้?','อาจออกจากระบบเว็บไซต์นี้ โดยไม่ล้างข้อมูลเว็บไซต์อื่น',()=>command('clear-origin-data',d.clearOrigin));
 else {for(const [key,action]of Object.entries({showDownload:'show-download',cancelDownload:'cancel-download',pauseDownload:'pause-download',resumeDownload:'resume-download'}))if(d[key])await command(action,d[key]);}
});

$('#address-form').addEventListener('submit',async e=>{e.preventDefault();const value=$('#address').value;$('#address').blur();await command('navigate',value);});
$('#address').addEventListener('keydown',e=>{if(e.key==='Escape'){$('#address').blur();render(state);}});
$('#back').onclick=()=>command('back');$('#forward').onclick=()=>command('forward');$('#reload').onclick=()=>command(active()?.loading?'stop':'reload');$('#new-tab').onclick=async()=>{if((await command('new-tab')).ok)focusAddress();};
$('#bookmark-toggle').onclick=async()=>{if((await command('bookmark')).ok)toast('อัปเดตบุ๊กมาร์กแล้ว');};$('#compact-toggle').onclick=()=>command('settings',{compactSidebar:!state.settings.compactSidebar});
$('#page-info').onclick=()=>command('panel',state.ui.panel==='info'?null:'info');$('#close-panel').onclick=()=>command('panel',null);
$('#modal-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const ok=await formSubmit?.(data);if(ok!==false)closeDialogs();});
for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',()=>{if(!openingDialog&&!document.querySelector('dialog[open]'))command('overlay',false);});
$('#palette-input').addEventListener('input',()=>{paletteIndex=0;renderPalette();});$('#palette-input').addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();paletteIndex+=e.key==='ArrowDown'?1:-1;highlightPalette();}if(e.key==='Enter'){e.preventDefault();document.querySelectorAll('.palette-result')[paletteIndex]?.click();}});

document.addEventListener('submit',async e=>{
 if(e.target.id==='home-search'){e.preventDefault();if($('#search-input').value.trim())await command('navigate',$('#search-input').value);}
 if(e.target.id==='note-form'){e.preventDefault();await saveNote();}
 if(e.target.id==='ai-settings-form'){e.preventDefault();const r=await saveAISettingsForm();if(r.ok)toast('บันทึก provider แล้ว');}
 if(e.target.id==='weather-settings-form'){e.preventDefault();if((await command('weather-config',Object.fromEntries(new FormData(e.target)))).ok)toast('บันทึกเมืองและ provider แล้ว');}
 if(e.target.id==='ai-send-form'){e.preventDefault();const data=Object.fromEntries(new FormData(e.target));await command('ai-send',{id:state.aiPreview.id,question:data.question,consent:data.consent==='on'});}
});
document.addEventListener('input',e=>{
 if(e.target.id==='library-filter'){filter=e.target.value;renderLibraryItems();}
 if(['note-title','note-body'].includes(e.target.id)){noteDraft[e.target.id==='note-title'?'title':'body']=e.target.value;noteDirty=true;if($('#note-status'))$('#note-status').textContent='มีการแก้ไขที่ยังไม่บันทึก';}
});
document.addEventListener('change',async e=>{
 const el=e.target;const id=el.id;const d=el.dataset;
 if(id==='search-engine')await command('settings',{searchEngine:el.value});
 if(id==='restore-tabs')await command('settings',{restoreTabs:el.checked});
 if(id==='compact-sidebar')await command('settings',{compactSidebar:el.checked});
 if(id==='graphics-enabled')await command('theme-save',{graphics:el.checked});
 if(id==='motion-enabled')await command('theme-save',{motion:el.checked});
 if(id==='art-intensity')await command('theme-save',{art:Number(el.value)});
 if(id==='glow-intensity')await command('theme-save',{glow:Number(el.value)});
 if(id==='theme-background')await command('theme-save',{background:el.value});
 if(id==='split-ratio')await command('split-ratio',Number(el.value)/100);
 if(id==='folder-filter'){folderFilter=el.value;renderLibraryItems();}
 if(id==='memory-enabled')await command('settings',{memorySaver:el.checked});
 if(id==='memory-minutes')await command('settings',{suspendMinutes:Number(el.value)});
  if(id==='memory-exceptions')await command('settings',{memoryExceptions:el.value.split(',')});
  if(id==='auto-update')await command('settings',{autoUpdate:el.checked});
 if(id==='ai-provider'){if(el.value==='ollama'&&!$('#ai-settings-form').elements.endpoint.value)$('#ai-settings-form').elements.endpoint.value='http://127.0.0.1:11434';syncAIAuthFields();}
 if(d.todo)await command('todo-save',{id:d.todo,done:el.checked});
 if(d.reminderDone)await command('reminder-done',{id:d.reminderDone,done:el.checked});
 if(d.autoSuspend)await command('tab-auto-suspend',{id:d.autoSuspend,enabled:el.checked});
 if(d.moveTab)await command('move-tab',{id:d.moveTab,workspaceId:el.value});
 if(d.permission)await command('permission-set',{origin:d.origin,permission:d.permission,value:el.value});
});
document.addEventListener('click',async e=>{
 if(e.target.closest('#clear-history')){const period=$('#history-period').value;await confirmAction('ล้างประวัติการเข้าชม?','ลบรายการในช่วงเวลาที่เลือก บุ๊กมาร์กและข้อมูลเว็บไซต์ยังคงอยู่',()=>command('clear-history',period));}
  if(e.target.closest('#clear-site-data'))await confirmAction('ล้างข้อมูลเว็บไซต์ทั้งหมด?','จะออกจากระบบเว็บไซต์ และลบคุกกี้/แคชของแท็บปกติ',()=>command('clear-site-data'));
  if(e.target.closest('#check-updates'))await command('update-check');
  if(e.target.closest('#update-download'))await command('update-download');
  if(e.target.closest('#update-install'))await confirmAction('ติดตั้งอัปเดตเลย?','แอปจะปิดและเปิดใหม่เพื่อติดตั้งเวอร์ชันที่ดาวน์โหลดไว้',()=>command('update-install'));
  if(e.target.closest('#update-open-releases'))await command('update-open-releases');
});
let draggedTab;
$('#tabs').addEventListener('dragstart',e=>{draggedTab=e.target.closest('[data-tab-id]')?.dataset.tabId;e.dataTransfer.setData('text/plain',draggedTab||'');});
$('#tabs').addEventListener('dragover',e=>e.preventDefault());$('#tabs').addEventListener('drop',async e=>{e.preventDefault();const beforeId=e.target.closest('[data-tab-id]')?.dataset.tabId;if(draggedTab&&beforeId&&draggedTab!==beforeId)await command('reorder-tab',{id:draggedTab,beforeId});draggedTab=null;});
$('#tabs').addEventListener('contextmenu',async e=>{const id=e.target.closest('[data-tab-id]')?.dataset.tabId;if(!id)return;e.preventDefault();await command('activate-tab',id);await showForm('จัดการแท็บ',`<div class="menu-actions"><button type="button" data-action="pin-current">${svg('pin')}ปักหมุด / เลิกปักหมุด</button><button type="button" data-action="mute-current">${svg('volume')}ปิด / เปิดเสียง</button><button type="button" data-page="workspaces">${svg('grid')}ย้ายไป workspace</button><button type="button" data-action="reopen-tab">${svg('history')}เปิดแท็บที่ปิดล่าสุด</button></div>`,()=>true,'เสร็จ');});
window.cherry.onState(render);window.cherry.onFocusAddress(focusAddress);window.cherry.onPalette(()=>openPalette(true));
window.cherry.getState().then(render).catch(()=>toast('เริ่มต้น Cherry ไม่สำเร็จ'));
setInterval(()=>{if($('#clock'))$('#clock').textContent=new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});},30000);
