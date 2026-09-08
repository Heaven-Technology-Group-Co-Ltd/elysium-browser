const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BrowserStore, resolveAddress } = require('../src/core');
const { normalizeEvent, parseDate, dateKey, eventsOnDate, eventRange, reminderAt, dueEvents } = require('../src/calendar');
const timed = (extra = {}) => normalizeEvent({ title: 'ประชุม', allDay: false, startAt: new Date(2028, 1, 28, 23).getTime(), endAt: new Date(2028, 1, 29).getTime(), reminderMinutes: 15, ...extra });

test('calendar validates leap days, ranges, supported reminders and text fields', () => {
  assert.equal(resolveAddress('cherry://calendar'), 'cherry://calendar');
  assert.ok(parseDate('2028-02-29'));
  for (const key of ['2027-02-29', '2028-02-30', '2028-13-01', '0099-01-01', '2028-2-01']) assert.equal(parseDate(key), null);
  for (const extra of [{ title: '  ' }, { startAt: NaN }, { endAt: Infinity }, { startAt: '2028-01-01' }, { endAt: 0 }, { reminderMinutes: -5 }, { reminderMinutes: '15' }]) assert.throws(() => timed(extra));
  assert.throws(() => normalizeEvent({ title: 'a', allDay: true, startDate: '2028-03-01', endDate: '2028-02-29' }));
  const sanitized = timed({ title: '  นัดหมาย  ', color: '<script>', details: 'x'.repeat(5000) });
  assert.equal(sanitized.title, 'นัดหมาย'); assert.equal(sanitized.color, 'blue'); assert.equal(sanitized.details.length, 4000);
});

test('all-day ranges include the end date; midnight endings do not spill into the next day', () => {
  const event = timed();
  assert.equal(eventsOnDate([event], '2028-02-28').length, 1);
  assert.equal(eventsOnDate([event], '2028-02-29').length, 0);
  const allDay = normalizeEvent({ title: 'วันหยุด', allDay: true, startDate: '2028-02-28', endDate: '2028-03-01' });
  for (const key of ['2028-02-28', '2028-02-29', '2028-03-01']) assert.equal(eventsOnDate([allDay], key).length, 1);
  assert.equal(eventsOnDate([allDay], '2028-03-02').length, 0);
  assert.equal(eventsOnDate([event, allDay], '2028-02-28')[0], allDay);
});

test('calendar uses local day boundaries across daylight-saving changes', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    const event = normalizeEvent({ title: 'DST', allDay: true, startDate: '2028-03-12', endDate: '2028-03-12', reminderMinutes: 0 });
    const range = eventRange(event);
    assert.equal(range.end - range.start, 23 * 3600000);
    assert.equal(dateKey(reminderAt(event)), '2028-03-12');
    assert.equal(new Date(reminderAt(event)).getHours(), 9);
    assert.equal(eventsOnDate([event], '2028-03-13').length, 0);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('calendar reminders fire once, catch ongoing events, and skip disabled or ended events', () => {
  const event = { ...timed(), id: 'a', notifiedAt: 0 };
  const due = reminderAt(event);
  assert.equal(dueEvents([event], due - 1).length, 0);
  assert.equal(dueEvents([event], due).length, 1);
  assert.equal(dueEvents([event], event.startAt + 1).length, 1);
  assert.equal(dueEvents([event], event.endAt).length, 0);
  assert.equal(dueEvents([{ ...event, notifiedAt: due }], due + 1).length, 0);
  assert.equal(dueEvents([{ ...event, reminderMinutes: null }], due).length, 0);
});

test('schema 4 preserves organizer data and calendar state across restarts, ignoring corrupt events', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-calendar-core-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('cherry-calendar-core-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, 'cherry-data.json');
  const old = JSON.stringify({ schemaVersion: 3, notes: [{ id: 'n', title: 'เดิม', body: 'อย่าหาย' }], reminders: [{ id: 'r', title: 'งานเก่า', dueAt: 1234 }], bookmarks: [{ id: 'b', title: 'เว็บ', url: 'https://example.com/' }] });
  fs.writeFileSync(file, old);
  const store = new BrowserStore(directory);
  assert.equal(fs.readFileSync(`${file}.before-schema-4`, 'utf8'), old);
  const event = { ...timed(), id: 'a', notifiedAt: 123, createdAt: 1, updatedAt: 2 };
  store.data.calendarEvents.push(event, { ...event }, { id: 'bad', title: 'bad', allDay: true, startDate: 'oops' });
  store.data.sessionTabs.push({ id: 'c', title: 'Calendar', url: 'cherry://calendar' });
  store.save();
  const restored = new BrowserStore(directory);
  assert.deepEqual(restored.data.calendarEvents, [event]);
  assert.equal(restored.data.notes[0].body, 'อย่าหาย');
  assert.equal(restored.data.reminders[0].title, 'งานเก่า');
  assert.equal(restored.data.bookmarks[0].title, 'เว็บ');
  assert.equal(restored.data.sessionTabs[0].url, 'cherry://calendar');
});
