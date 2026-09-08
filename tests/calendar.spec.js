const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { dateKey } = require('../src/calendar');
let app, page, profile, errors;
async function launch() {
  app = await electron.launch({ ...(process.env.ELYSIUM_EXECUTABLE ? { executablePath: process.env.ELYSIUM_EXECUTABLE, args: [] } : { args: [path.resolve('.')] }), env: { ...process.env, ELYSIUM_TEST_PROFILE: profile } });
  await app.firstWindow();
  await expect.poll(() => app.windows().some(p => p.url().endsWith('/index.html'))).toBe(true);
  page = app.windows().find(p => p.url().endsWith('/index.html'));
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('#tabs .tab').first()).toBeVisible();
}
const state = () => page.evaluate(() => window.elysium.getState());
const call = (action, payload) => page.evaluate(([a, p]) => window.elysium.command(a, p), [action, payload]);
const field = name => page.locator(`#modal-form [name="${name}"]`);
async function openCalendar() { await page.locator('.navigation [data-page="calendar"]').click(); await expect(page.locator('.calendar-grid')).toBeVisible(); }
async function newEvent() { await page.locator('.calendar-heading [data-calendar-action="new"]').click(); await expect(page.locator('#form-dialog')).toBeVisible(); }
async function save() { await page.locator('#confirm-accept').click(); await expect(page.locator('#form-dialog')).not.toBeVisible(); }
test.beforeEach(async () => { profile = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-calendar-e2e-')); errors = []; await launch(); });
test.afterEach(async () => { if (app) { await app.close(); app = null; } expect(errors).toEqual([]); });

test('local Calendar creates, validates, edits, searches, persists and deletes appointments', async () => {
  await openCalendar();
  await expect(page.locator('.calendar-cell')).toHaveCount(42);
  await expect(page.locator('#calendar-count')).toHaveText('0 นัดหมายในเดือนนี้');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const key = dateKey(tomorrow);
  await page.locator('#calendar-month-picker').fill(key.slice(0, 7));
  await newEvent();
  await field('title').fill('ทดสอบประชุม <img src=x onerror=alert(1)>');
  await field('startDate').fill(key); await field('endDate').fill(key);
  await field('startTime').fill('10:00'); await field('endTime').fill('09:00');
  await page.locator('#confirm-accept').click();
  await expect(page.locator('#calendar-form-error')).toContainText('เวลาสิ้นสุดต้องหลัง');
  expect((await state()).calendarEvents).toHaveLength(0);
  await field('endTime').fill('11:30'); await field('location').fill('ห้องทดสอบ'); await field('details').fill('ข้อมูลทดสอบเท่านั้น');
  await field('color').selectOption('purple'); await field('reminderMinutes').selectOption('15');
  await save();
  await expect(page.locator('.calendar-selected-events .calendar-event-card')).toContainText('ทดสอบประชุม <img');
  expect(await page.locator('.calendar-page img').count()).toBe(0);
  await page.locator('.calendar-selected-events .calendar-event-card').click();
  await field('title').fill('ทดสอบประชุมที่แก้ไข'); await save();
  await page.locator('[data-calendar-view="agenda"]').click();
  await expect(page.locator('.calendar-agenda')).toContainText('ทดสอบประชุมที่แก้ไข');
  await page.locator('#calendar-search').fill('ไม่ตรงกัน');
  await expect(page.locator('#calendar-count')).toHaveText('0 นัดหมายในเดือนนี้');
  await page.locator('#calendar-search').fill('ห้องทดสอบ');
  await expect(page.locator('#calendar-count')).toHaveText('1 นัดหมายในเดือนนี้');
  await app.close(); app = null; await launch(); await openCalendar();
  const events = (await state()).calendarEvents;
  expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ title: 'ทดสอบประชุมที่แก้ไข', color: 'purple', reminderMinutes: 15 });
  await page.locator('#calendar-month-picker').fill(key.slice(0, 7));
  await page.locator(`[data-calendar-edit="${events[0].id}"]`).first().click();
  await page.locator('[data-calendar-delete]').click();
  await page.locator('#confirm-cancel').click();
  expect((await state()).calendarEvents).toHaveLength(1);
  await page.locator(`[data-calendar-edit="${events[0].id}"]`).first().click();
  await page.locator('[data-calendar-delete]').click(); await save();
  await expect.poll(async () => (await state()).calendarEvents.length).toBe(0);
  await app.close(); app = null; await launch();
  expect((await state()).calendarEvents).toHaveLength(0);
});

test('all-day Calendar spans leap day and month boundaries; dialogs keep unsaved input during updates', async () => {
  await openCalendar(); await newEvent();
  await field('title').fill('ทดสอบวันหยุดข้ามเดือน'); await field('calendarAllDay').check();
  await expect(field('startTime')).toBeHidden();
  await field('startDate').fill('2028-02-28'); await field('endDate').fill('2028-03-01');
  await save();
  await expect(page.locator('.calendar-cell:has([data-calendar-day="2028-02-29"]) .calendar-chip')).toContainText('ทดสอบวันหยุดข้ามเดือน');
  await page.locator('[data-calendar-action="next"]').click();
  await expect(page.locator('.calendar-cell:has([data-calendar-day="2028-03-01"]) .calendar-chip')).toHaveCount(1);
  await expect(page.locator('.calendar-cell:has([data-calendar-day="2028-03-02"]) .calendar-chip')).toHaveCount(0);
  await page.locator('.calendar-day[data-calendar-day="2028-03-01"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.calendar-day[data-calendar-day="2028-03-02"]')).toBeFocused();
  await newEvent(); await field('title').fill('ร่างที่ยังไม่บันทึก'); await field('details').fill('คงข้อความนี้ไว้');
  await call('postit-save', { title: 'background update', body: 'test fixture', color: 'blue' });
  await expect(field('title')).toHaveValue('ร่างที่ยังไม่บันทึก'); await expect(field('details')).toHaveValue('คงข้อความนี้ไว้');
  await page.locator('#confirm-cancel').click();
  const invalid = await call('calendar-save', { title: 'invalid', allDay: false, startAt: 5, endAt: 4 });
  expect(invalid.ok).toBe(false); expect((await state()).calendarEvents).toHaveLength(1);
  await page.locator('#calendar-month-picker').fill('2100-12');
  await expect(page.locator('.calendar-cell')).toHaveCount(42);
  await expect(page.locator('.calendar-day[data-calendar-day="2101-01-01"]')).toBeDisabled();
});

test('calendar reminder scheduler records one notification and preserves it after restart', async () => {
  const now = Date.now();
  const result = await call('calendar-save', { title: 'ทดสอบ Calendar notification', allDay: false, startAt: now - 1000, endAt: now + 3600000, reminderMinutes: 0, color: 'blue' });
  expect(result.ok).toBe(true);
  await expect.poll(async () => (await state()).calendarEvents[0].notifiedAt).toBeGreaterThan(0);
  const notifiedAt = (await state()).calendarEvents[0].notifiedAt;
  expect((await call('calendar-check')).notified).toBe(0);
  await app.close(); app = null; await launch();
  expect((await state()).calendarEvents[0].notifiedAt).toBe(notifiedAt);
  expect((await call('calendar-check')).notified).toBe(0);
});

test('calendar clicks open immediately and selecting a day keeps the page mounted', async () => {
  await openCalendar();
  const immediate = await page.evaluate(() => {
    const root = document.querySelector('.calendar-page');
    const grid = document.querySelector('.calendar-grid');
    document.querySelector('.calendar-heading [data-calendar-action="new"]').click();
    return { dialogOpen: document.querySelector('#form-dialog').open, sameRoot: root === document.querySelector('.calendar-page'), sameGrid: grid === document.querySelector('.calendar-grid') };
  });
  expect(immediate).toEqual({ dialogOpen: true, sameRoot: true, sameGrid: true });
  await page.locator('#confirm-cancel').click();
  const selection = await page.evaluate(() => {
    const root = document.querySelector('.calendar-page');
    const grid = document.querySelector('.calendar-grid');
    const current = document.querySelector('.calendar-cell.selected .calendar-day')?.dataset.calendarDay;
    const target = [...document.querySelectorAll('.calendar-cell:not(.outside) .calendar-day')].find(button => button.dataset.calendarDay !== current);
    target.click();
    return {
      selected: document.querySelector('.calendar-cell.selected .calendar-day')?.dataset.calendarDay,
      target: target.dataset.calendarDay,
      sameRoot: root === document.querySelector('.calendar-page'),
      sameGrid: grid === document.querySelector('.calendar-grid'),
    };
  });
  expect(selection).toMatchObject({ selected: selection.target, sameRoot: true, sameGrid: true });
  const emptyCell = page.locator('.calendar-cell:not(.outside):not(.selected)').first();
  const emptyCellDate = await emptyCell.locator('.calendar-day').getAttribute('data-calendar-day');
  const hitArea = await emptyCell.evaluate(cell => {
    const day = cell.querySelector('.calendar-day');
    const cellRect = cell.getBoundingClientRect(); const dayRect = day.getBoundingClientRect();
    return { left: dayRect.left - cellRect.left, top: dayRect.top - cellRect.top, right: cellRect.right - dayRect.right, bottom: cellRect.bottom - dayRect.bottom };
  });
  expect(Object.values(hitArea).every(gap => gap >= 0 && gap <= 1)).toBe(true);
  const box = await emptyCell.boundingBox();
  await page.mouse.click(box.x + 8, box.y + box.height - 8);
  await expect(page.locator(`.calendar-cell:has(.calendar-day[data-calendar-day="${emptyCellDate}"])`)).toHaveClass(/selected/);
});

test('calendar native layout stays inside the window at desktop and compact sizes', async () => {
  await openCalendar();
  const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
  for (const [day, title, color] of [[7, 'ตัวอย่างทดสอบ · วางแผนสัปดาห์', 'blue'], [7, 'ตัวอย่างทดสอบ · อ่านหนังสือ', 'yellow'], [7, 'ตัวอย่างทดสอบ · สรุปงาน', 'purple'], [9, 'ตัวอย่างทดสอบ · เวลาพักของฉัน', 'purple'], [12, 'ตัวอย่างทดสอบ · ออกกำลังกาย', 'mint'], [18, 'ตัวอย่างทดสอบ · นัดครอบครัว', 'pink']]) {
    expect((await call('calendar-save', { title, allDay: false, startAt: new Date(year, month, day, 10).getTime(), endAt: new Date(year, month, day, 11).getTime(), color, reminderMinutes: null })).ok).toBe(true);
  }
  const eventCell = page.locator(`.calendar-cell:has(.calendar-day[data-calendar-day="${dateKey(new Date(year, month, 7))}"])`);
  await eventCell.locator('.calendar-day').click({ position: { x: 8, y: 8 } });
  await expect(eventCell).toHaveClass(/selected/);
  const directory = path.resolve('work/calendar-qa'); fs.mkdirSync(directory, { recursive: true });
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768]]) {
    await app.evaluate(({ BrowserWindow }, size) => { const w = BrowserWindow.getAllWindows()[0]; w.setBounds({ x: 20, y: 20, ...size }); w.show(); w.focus(); }, { width, height });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
    await page.waitForTimeout(300);
    expect(await page.locator('#content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.locator('.sidebar').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.locator('.calendar-grid').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
    const overflowingCells = await page.locator('.calendar-cell').evaluateAll(cells => cells.map((el, index) => ({ index, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight })).filter(item => item.scrollHeight > item.clientHeight));
    expect(overflowingCells).toEqual([]);
    const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(directory, `calendar-${width}.png`), Buffer.from(png, 'base64'));
  }
  await page.locator('[data-calendar-view="agenda"]').click();
  await expect(page.locator('.calendar-agenda')).toBeVisible();
  await page.waitForTimeout(150);
  let png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  fs.writeFileSync(path.join(directory, 'calendar-agenda.png'), Buffer.from(png, 'base64'));
  await newEvent();
  await field('title').fill('ตัวอย่างทดสอบ · นัดหมายใหม่');
  await page.locator('#confirm-accept').scrollIntoViewIfNeeded();
  png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  fs.writeFileSync(path.join(directory, 'calendar-form.png'), Buffer.from(png, 'base64'));
});
