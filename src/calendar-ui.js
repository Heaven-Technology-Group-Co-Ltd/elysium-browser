const cal = window.elysiumCalendar;
let calendarSelected = cal.dateKey(new Date());
let calendarMonth = calendarSelected.slice(0, 7);
let calendarView = 'month';
let calendarQuery = '';
let calendarTodayKey = calendarSelected;
const calendarDateLabel = key => (cal.parseDate(key) || new Date(`${key}T00:00:00`)).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
const calendarClock = timestamp => new Date(timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

function calendarEventTime(event, detailed = false) {
  if (event.allDay) return event.startDate === event.endDate ? 'ทั้งวัน' : `ทั้งวัน · ${calendarDateLabel(event.startDate)} – ${calendarDateLabel(event.endDate)}`;
  const sameDay = cal.dateKey(event.startAt) === cal.dateKey(event.endAt);
  if (!detailed && sameDay) return `${calendarClock(event.startAt)} – ${calendarClock(event.endAt)}`;
  return `${date(event.startAt)} – ${sameDay ? calendarClock(event.endAt) : date(event.endAt)}`;
}

function calendarItems() {
  const q = calendarQuery.trim().toLocaleLowerCase();
  return state.calendarEvents.filter(event => !q || `${event.title} ${event.location} ${event.details}`.toLocaleLowerCase().includes(q));
}

function calendarEventCard(event) {
  return `<button class="calendar-event-card" data-calendar-edit="${esc(event.id)}" data-color="${event.color}">
    <span class="calendar-event-category">${esc(cal.COLORS[event.color])}${event.reminderMinutes === null ? '' : ` · ${svg('bell')}`}</span>
    <strong>${esc(event.title)}</strong><span class="calendar-event-time">${esc(calendarEventTime(event, true))}</span>
    ${event.location ? `<span class="calendar-event-location">${esc(event.location)}</span>` : ''}
  </button>`;
}

function calendarDayPanelMarkup(items, today) {
  const selectedEvents = cal.eventsOnDate(items, calendarSelected);
  return `<aside class="calendar-day-panel" aria-label="นัดหมายวันที่เลือก"><div class="calendar-panel-kicker">${calendarSelected === today ? 'TODAY · วันนี้' : 'YOUR DAY · วันที่เลือก'}</div><h2>${esc(calendarDateLabel(calendarSelected))}</h2><p class="muted">${selectedEvents.length} นัดหมาย${calendarQuery ? 'ที่ตรงกับการค้นหา' : ''}</p><button class="secondary-button calendar-add-day" data-calendar-action="new">${svg('plus')}เพิ่มในวันที่เลือก</button><div class="calendar-selected-events">${selectedEvents.map(calendarEventCard).join('') || empty('calendar', calendarQuery ? 'ไม่พบรายการที่ตรงกัน' : 'ยังไม่มีนัดหมาย', 'เผื่อเวลาให้สิ่งที่สำคัญกับคุณ')}</div><div class="calendar-legend">${Object.entries(cal.COLORS).map(([color, label]) => `<span data-color="${color}"><i></i>${esc(label)}</span>`).join('')}</div></aside>`;
}

function renderCalendarBody() {
  if (!$('#calendar-body')) return;
  const items = calendarItems();
  const first = cal.parseDate(`${calendarMonth}-01`);
  const today = cal.dateKey(new Date());
  calendarTodayKey = today;
  const visibleEventCount = innerHeight < 820 ? 1 : innerHeight < 1050 ? 2 : 3;
  const monthEnd = new Date(first.getFullYear(), first.getMonth() + 1, 1).getTime();
  const inMonth = items.filter(event => { const range = cal.eventRange(event); return range.start < monthEnd && range.end > first.getTime(); });
  $('#calendar-count').textContent = `${inMonth.length} นัดหมายในเดือนนี้`;
  let body = '';
  if (calendarView === 'month') {
    const start = new Date(first);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = cal.dateKey(d);
      const events = cal.eventsOnDate(items, key);
      return `<div class="calendar-cell ${key.slice(0, 7) !== calendarMonth ? 'outside' : ''} ${key === calendarSelected ? 'selected' : ''} ${key === today ? 'today' : ''}">
        <button class="calendar-day" data-calendar-day="${key}" ${cal.parseDate(key) ? '' : 'disabled'} aria-label="${esc(calendarDateLabel(key))} · ${events.length} นัดหมาย" aria-pressed="${key === calendarSelected}" ${key === today ? 'aria-current="date"' : ''}><small>${events.length > visibleEventCount ? `+${events.length - visibleEventCount}` : ''}</small><span>${d.getDate()}</span></button>
        <div class="calendar-day-events">${events.slice(0, visibleEventCount).map(event => `<button class="calendar-chip" data-calendar-edit="${esc(event.id)}" data-color="${event.color}" title="${esc(event.title)} · ${esc(calendarEventTime(event))}"><span>${event.allDay ? '' : calendarClock(event.startAt)}</span><strong>${esc(event.title)}</strong></button>`).join('')}</div>
      </div>`;
    }).join('');
    body = `<section class="calendar-month-board" aria-label="ปฏิทินรายเดือน"><div class="calendar-weekdays">${['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${days}</div></section>`;
  } else {
    const days = [];
    for (let day = new Date(first); day.getTime() < monthEnd; day.setDate(day.getDate() + 1)) {
      const key = cal.dateKey(day);
      const events = cal.eventsOnDate(items, key);
      if (events.length) days.push(`<section class="calendar-agenda-day"><button class="calendar-agenda-date ${key === today ? 'today' : ''}" data-calendar-day="${key}"><strong>${day.getDate()}</strong><span>${day.toLocaleDateString('th-TH', { weekday: 'short', month: 'short' })}</span></button><div class="calendar-agenda-events">${events.map(calendarEventCard).join('')}</div></section>`);
    }
    body = `<section class="calendar-agenda" aria-label="รายการนัดหมายรายเดือน">${days.join('') || empty('calendar', calendarQuery ? 'ไม่พบนัดหมายที่ค้นหา' : 'เดือนนี้ยังว่างอยู่', 'กด “เพิ่มนัดหมาย” เพื่อวางแผนสิ่งที่อยากทำ')}</section>`;
  }
  $('#calendar-body').innerHTML = `${body}${calendarDayPanelMarkup(items, today)}`;
}

function renderCalendar() {
  const month = cal.parseDate(`${calendarMonth}-01`);
  $('#content').innerHTML = `<section class="page calendar-page">
    <header class="calendar-heading"><div><div class="page-kicker">MAKE ROOM FOR YOUR DAY</div><h1>Calendar <span>ปฏิทินของคุณ</span></h1><p class="page-description">นัดหมาย แผนเล็ก ๆ และเวลาสำหรับตัวเอง · บันทึกในเครื่อง</p></div><button class="primary-button" data-calendar-action="new">${svg('plus')}เพิ่มนัดหมาย</button></header>
    <div class="calendar-toolbar"><div class="calendar-month-controls"><button class="secondary-button" data-calendar-action="today">วันนี้</button>${ib('back', 'เดือนก่อนหน้า', 'data-calendar-action="previous"')}${ib('forward', 'เดือนถัดไป', 'data-calendar-action="next"')}<h2 id="calendar-month-title">${month.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</h2><input id="calendar-month-picker" type="month" value="${calendarMonth}" min="1900-01" max="2100-12" aria-label="ไปยังเดือน"></div><div class="calendar-view-switch" aria-label="มุมมองปฏิทิน"><button data-calendar-view="month" aria-pressed="${calendarView === 'month'}">เดือน</button><button data-calendar-view="agenda" aria-pressed="${calendarView === 'agenda'}">รายการ</button></div></div>
    <div class="calendar-search-row"><label class="calendar-search">${svg('search')}<input id="calendar-search" type="search" value="${esc(calendarQuery)}" placeholder="ค้นหานัดหมาย สถานที่ หรือรายละเอียด" aria-label="ค้นหานัดหมาย"></label><span id="calendar-count" aria-live="polite"></span></div>
    <div id="calendar-body" class="calendar-body"></div>
    <p class="calendar-footnote">${svg('bell')}${state.notificationsSupported ? 'แจ้งเตือนผ่าน Windows ขณะ elysium-browser เปิดอยู่ · เมื่อเปิดแอปอีกครั้ง จะเตือนนัดหมายที่ยังไม่สิ้นสุด' : 'Windows notification ไม่พร้อมบนเครื่องนี้ · นัดหมายยังบันทึกและเปิดดูได้ตามปกติ'}</p>
  </section>`;
  renderCalendarBody();
}

function selectCalendarDay(key) {
  if (!cal.parseDate(key)) return;
  const nextMonth = key.slice(0, 7);
  const monthChanged = calendarMonth !== nextMonth;
  calendarSelected = key;
  calendarMonth = nextMonth;
  if (monthChanged) { renderCalendar(); return; }
  if (calendarView !== 'month') { renderCalendarBody(); return; }
  for (const button of document.querySelectorAll('.calendar-day[data-calendar-day]')) {
    const selected = button.dataset.calendarDay === calendarSelected;
    button.setAttribute('aria-pressed', String(selected));
    button.closest('.calendar-cell')?.classList.toggle('selected', selected);
  }
  const panel = $('.calendar-day-panel');
  if (panel) panel.outerHTML = calendarDayPanelMarkup(calendarItems(), cal.dateKey(new Date()));
}

function syncCalendarForm() {
  const form = $('#modal-form');
  if (!form.elements.calendarAllDay) return;
  const allDay = form.elements.calendarAllDay.checked;
  for (const input of form.querySelectorAll('[data-calendar-time]')) { input.disabled = allDay; input.closest('label').hidden = allDay; }
  $('#calendar-all-day-help').hidden = !allDay;
}

async function editCalendarEvent(id) {
  const existing = id ? state.calendarEvents.find(event => event.id === id) : null;
  if (id && !existing) { toast('ไม่พบนัดหมายนี้'); return; }
  const start = cal.parseDate(calendarSelected); start.setHours(9);
  const event = existing || { title: '', details: '', location: '', allDay: false, startAt: start.getTime(), endAt: start.getTime() + 3600000, color: 'blue', reminderMinutes: null };
  const startDate = event.allDay ? event.startDate : cal.dateKey(event.startAt);
  const endDate = event.allDay ? event.endDate : cal.dateKey(event.endAt);
  const timeValue = time => { const d = new Date(time); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const reminderLabels = { 0: 'เมื่อถึงเวลา', 5: 'ก่อน 5 นาที', 15: 'ก่อน 15 นาที', 30: 'ก่อน 30 นาที', 60: 'ก่อน 1 ชั่วโมง', 1440: 'ก่อน 1 วัน' };
  await showForm(existing ? 'แก้ไขนัดหมาย' : 'เพิ่มนัดหมาย', `<div class="calendar-form">
    ${field('ชื่อนัดหมาย', 'title', event.title, 'text', 'required maxlength="200" placeholder="เช่น ประชุมทีม หรือเวลาพักของฉัน"')}
    <label class="check-label"><input name="calendarAllDay" type="checkbox" ${event.allDay ? 'checked' : ''}>ทั้งวัน</label>
    <div class="calendar-form-row">${field('วันเริ่มต้น', 'startDate', startDate, 'date', 'required min="1900-01-01" max="2100-12-31"')}${field('เวลาเริ่มต้น', 'startTime', event.allDay ? '09:00' : timeValue(event.startAt), 'time', 'required data-calendar-time')}</div>
    <div class="calendar-form-row">${field('วันสิ้นสุด', 'endDate', endDate, 'date', 'required min="1900-01-01" max="2100-12-31"')}${field('เวลาสิ้นสุด', 'endTime', event.allDay ? '10:00' : timeValue(event.endAt), 'time', 'required data-calendar-time')}</div>
    ${field('สถานที่', 'location', event.location, 'text', 'maxlength="300" placeholder="เช่น ห้องประชุม หรือออนไลน์"')}
    <div class="calendar-form-row"><label class="field">หมวด / สี<select name="color">${Object.entries(cal.COLORS).map(([color, label]) => `<option value="${color}" ${event.color === color ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field">แจ้งเตือน<select name="reminderMinutes"><option value="" ${event.reminderMinutes === null ? 'selected' : ''}>ไม่เตือน</option>${cal.REMINDERS.map(minutes => `<option value="${minutes}" ${event.reminderMinutes === minutes ? 'selected' : ''}>${reminderLabels[minutes]}</option>`).join('')}</select></label></div>
    <p id="calendar-all-day-help" class="muted">นัดหมายทั้งวันรวมวันสิ้นสุดด้วย · เวลาเตือนนับจาก 09:00 น. ของวันเริ่มต้น</p>
    <label class="field">รายละเอียด<textarea name="details" rows="3" maxlength="4000" placeholder="สิ่งที่อยากเตรียมหรือจดไว้…">${esc(event.details)}</textarea></label>
    <p id="calendar-form-error" role="alert" hidden></p>
    ${existing ? `<button class="text-button calendar-delete" type="button" data-calendar-delete="${esc(id)}">${svg('trash')}ลบนัดหมาย</button>` : ''}</div>`, async data => {
      const payload = { id, title: data.title, location: data.location, details: data.details, allDay: data.calendarAllDay === 'on', color: data.color, reminderMinutes: data.reminderMinutes === '' ? null : Number(data.reminderMinutes) };
      if (payload.allDay) Object.assign(payload, { startDate: data.startDate, endDate: data.endDate });
      else Object.assign(payload, { startAt: new Date(`${data.startDate}T${data.startTime}`).getTime(), endAt: new Date(`${data.endDate}T${data.endTime}`).getTime() });
      try { cal.normalizeEvent(payload); } catch (error) { $('#calendar-form-error').hidden = false; $('#calendar-form-error').textContent = error.message; return false; }
      const result = await command('calendar-save', payload);
      if (!result.ok) { $('#calendar-form-error').hidden = false; $('#calendar-form-error').textContent = result.error || 'บันทึกไม่สำเร็จ'; return false; }
      calendarSelected = data.startDate; calendarMonth = data.startDate.slice(0, 7);
      render(await window.elysium.getState());
      toast('บันทึกนัดหมายแล้ว'); return true;
    });
  syncCalendarForm();
}

document.addEventListener('click', async e => {
  const button = e.target.closest('button'); if (!button || button.disabled) return;
  const d = button.dataset;
  if (d.calendarDay) selectCalendarDay(d.calendarDay);
  else if (d.calendarEdit) await editCalendarEvent(d.calendarEdit);
  else if (d.calendarDelete) {
    await showForm('ลบนัดหมายนี้?', `<p class="muted">${esc(state.calendarEvents.find(event => event.id === d.calendarDelete)?.title || '')} จะถูกลบออกจากปฏิทินในเครื่อง</p>`, async () => {
      const result = await command('calendar-delete', d.calendarDelete);
      if (result.ok) { render(await window.elysium.getState()); toast('ลบนัดหมายแล้ว'); }
      return result.ok;
    }, 'ลบนัดหมาย');
  } else if (d.calendarView) {
    calendarView = d.calendarView;
    for (const view of document.querySelectorAll('[data-calendar-view]')) view.setAttribute('aria-pressed', String(view.dataset.calendarView === calendarView));
    renderCalendarBody();
  }
  else if (d.calendarAction === 'new') await editCalendarEvent();
  else if (d.calendarAction === 'today') selectCalendarDay(cal.dateKey(new Date()));
  else if (['previous', 'next'].includes(d.calendarAction)) {
    const month = cal.parseDate(`${calendarMonth}-01`);
    month.setMonth(month.getMonth() + (d.calendarAction === 'next' ? 1 : -1));
    if (cal.parseDate(cal.dateKey(month))) selectCalendarDay(cal.dateKey(month));
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'calendar-search') { calendarQuery = e.target.value; renderCalendarBody(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'calendar-month-picker' && cal.parseDate(`${e.target.value}-01`)) selectCalendarDay(`${e.target.value}-01`);
  if (e.target.name === 'calendarAllDay') syncCalendarForm();
  if (e.target.name === 'startDate' && e.target.closest('.calendar-form')) {
    const end = $('#modal-form').elements.endDate;
    if (end.value < e.target.value) end.value = e.target.value;
  }
});
document.addEventListener('keydown', e => {
  const key = e.target.dataset?.calendarDay;
  if (!key || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const target = cal.addDays(key, { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]);
  if (!cal.parseDate(target)) return;
  selectCalendarDay(target);
  document.querySelector(`.calendar-day[data-calendar-day="${target}"]`)?.focus();
});
window.elysium.onCalendarEvent(async id => {
  const next = await window.elysium.getState();
  const event = next.calendarEvents.find(item => item.id === id);
  if (!event) return;
  calendarSelected = event.allDay ? event.startDate : cal.dateKey(event.startAt);
  calendarMonth = calendarSelected.slice(0, 7);
  render(next); renderCalendar(); await editCalendarEvent(id);
});
setInterval(() => {
  if (currentPage === 'calendar' && calendarTodayKey !== cal.dateKey(new Date())) renderCalendar();
}, 30000);
let calendarResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(calendarResizeTimer);
  calendarResizeTimer = setTimeout(() => { if (currentPage === 'calendar') renderCalendarBody(); }, 80);
});
