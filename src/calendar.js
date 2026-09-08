// Shared calendar rules for the local store and the isolated app renderer.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.cherryCalendar = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  const COLORS = { blue: 'งาน', purple: 'ส่วนตัว', mint: 'สุขภาพ', pink: 'ครอบครัว', yellow: 'อื่น ๆ' };
  const REMINDERS = [0, 5, 15, 30, 60, 1440];
  function dateKey(value) {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const result = new Date(year, month - 1, day);
    return year >= 1900 && year <= 2100 && dateKey(result) === value ? result : null;
  }
  function addDays(key, count) {
    const d = parseDate(key);
    if (!d) return '';
    d.setDate(d.getDate() + count);
    return dateKey(d);
  }
  function eventRange(event) {
    if (!event.allDay) return { start: event.startAt, end: event.endAt };
    const end = parseDate(event.endDate);
    end.setDate(end.getDate() + 1);
    return { start: parseDate(event.startDate).getTime(), end: end.getTime() };
  }
  function eventsOnDate(events, key) {
    const date = parseDate(key);
    if (!date) return [];
    const start = date.getTime();
    date.setDate(date.getDate() + 1);
    const end = date.getTime();
    return events.filter(event => { const r = eventRange(event); return r.start < end && r.end > start; })
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || eventRange(a).start - eventRange(b).start || a.title.localeCompare(b.title));
  }
  function reminderAt(event) {
    if (event.reminderMinutes === null) return null;
    const day = event.allDay ? parseDate(event.startDate) : null;
    if (day) day.setHours(9);
    return (day ? day.getTime() : event.startAt) - event.reminderMinutes * 60000;
  }
  function dueEvents(events, now) {
    return events.filter(event => {
      const due = reminderAt(event);
      return due !== null && due <= now && eventRange(event).end > now && !event.notifiedAt;
    }).sort((a, b) => reminderAt(a) - reminderAt(b));
  }
  function normalizeEvent(input) {
    if (!input || typeof input !== 'object' || typeof input.title !== 'string' || !input.title.trim()) throw new Error('ใส่ชื่อนัดหมายก่อนบันทึก');
    if (typeof input.allDay !== 'boolean') throw new Error('รูปแบบนัดหมายไม่ถูกต้อง');
    const result = {
      title: input.title.trim().slice(0, 200), details: String(input.details || '').trim().slice(0, 4000),
      location: String(input.location || '').trim().slice(0, 300),
      color: Object.hasOwn(COLORS, input.color) ? input.color : 'blue', allDay: input.allDay,
      reminderMinutes: input.reminderMinutes == null ? null : input.reminderMinutes,
    };
    if (result.reminderMinutes !== null && !REMINDERS.includes(result.reminderMinutes)) throw new Error('เลือกเวลาแจ้งเตือนที่รองรับ');
    if (result.allDay) {
      if (!parseDate(input.startDate) || !parseDate(input.endDate) || input.endDate < input.startDate) throw new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น');
      Object.assign(result, { startDate: input.startDate, endDate: input.endDate });
    } else {
      if (![input.startAt, input.endAt].every(t => typeof t === 'number' && Number.isFinite(t) && parseDate(dateKey(t)))) throw new Error('เลือกวันและเวลานัดหมายให้ถูกต้อง');
      if (input.endAt <= input.startAt) throw new Error('เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น');
      Object.assign(result, { startAt: input.startAt, endAt: input.endAt });
    }
    return result;
  }
  return { COLORS, REMINDERS, dateKey, parseDate, addDays, eventRange, eventsOnDate, reminderAt, dueEvents, normalizeEvent };
});
