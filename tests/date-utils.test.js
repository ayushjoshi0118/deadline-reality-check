const { suite, test, expect } = require('./test-helper.js');
const DateUtils = require('../js/date-utils.js');

suite('DateUtils Unit Tests', () => {
  test('parseLocalDate correctly parses YYYY-MM-DD without timezone drift', () => {
    const d = DateUtils.parseLocalDate('2026-10-21');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // 0-indexed October
    expect(d.getDate()).toBe(21);
    expect(d.getHours()).toBe(0);
  });

  test('parseLocalDate rejects invalid dates like Feb 30', () => {
    const d = DateUtils.parseLocalDate('2026-02-30');
    expect(d).toBe(null);
  });

  test('formatLocalDate outputs exact YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 21, 15, 30);
    expect(DateUtils.formatLocalDate(d)).toBe('2026-10-21');
  });

  test('addDays adds calendar days properly', () => {
    expect(DateUtils.addDays('2026-10-21', 1)).toBe('2026-10-22');
    expect(DateUtils.addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(DateUtils.addDays('2026-10-21', -2)).toBe('2026-10-19');
  });

  test('daysBetween calculates positive, zero, and negative differences', () => {
    expect(DateUtils.daysBetween('2026-10-21', '2026-10-21')).toBe(0);
    expect(DateUtils.daysBetween('2026-10-21', '2026-10-25')).toBe(4);
    expect(DateUtils.daysBetween('2026-10-25', '2026-10-21')).toBe(-4);
  });

  test('getDayKey maps dates to mon, tue, wed, etc.', () => {
    // 2026-10-21 is a Wednesday
    expect(DateUtils.getDayKey('2026-10-21')).toBe('wed');
    // 2026-10-25 is Sunday
    expect(DateUtils.getDayKey('2026-10-25')).toBe('sun');
  });

  test('formatMinutes handles zero, minutes only, and hours+minutes', () => {
    expect(DateUtils.formatMinutes(0)).toBe('0m');
    expect(DateUtils.formatMinutes(45)).toBe('45m');
    expect(DateUtils.formatMinutes(60)).toBe('1h');
    expect(DateUtils.formatMinutes(150)).toBe('2h 30m');
  });

  test('formatTime formats 24hr to 12hr AM/PM', () => {
    expect(DateUtils.formatTime('14:30')).toBe('2:30 PM');
    expect(DateUtils.formatTime('09:05')).toBe('9:05 AM');
    expect(DateUtils.formatTime('00:00')).toBe('12:00 AM');
    expect(DateUtils.formatTime('23:59')).toBe('11:59 PM');
  });
});
