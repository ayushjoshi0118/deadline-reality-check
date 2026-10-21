/**
 * Deadline Reality Check - Date Utilities
 * Robust date and time calculation functions without external dependencies.
 * Avoids timezone drift and off-by-one errors by operating on local calendar dates.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    root.DRC = root.DRC || {};
    root.DRC.DateUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /**
   * Parse a YYYY-MM-DD string into a local Date object set at 00:00:00.
   * Avoids the UTC-parsing bug in `new Date("YYYY-MM-DD")`.
   */
  function parseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.trim().split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    const d = new Date(year, month, day, 0, 0, 0, 0);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
      return null; // invalid calendar date like Feb 30
    }
    return d;
  }

  /**
   * Format a Date object as YYYY-MM-DD local date string.
   */
  function formatLocalDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Get today's local date as YYYY-MM-DD string.
   */
  function getTodayString(refDate = new Date()) {
    return formatLocalDate(refDate);
  }

  /**
   * Add calendar days to a YYYY-MM-DD string or Date, returning YYYY-MM-DD.
   */
  function addDays(dateInput, daysToAdd) {
    const d = typeof dateInput === 'string' ? parseLocalDate(dateInput) : new Date(dateInput);
    if (!d) return '';
    d.setDate(d.getDate() + daysToAdd);
    return formatLocalDate(d);
  }

  /**
   * Calculate calendar days difference (dateB - dateA).
   * Positive if dateB is in the future relative to dateA.
   */
  function daysBetween(dateAStr, dateBStr) {
    const da = typeof dateAStr === 'string' ? parseLocalDate(dateAStr) : dateAStr;
    const db = typeof dateBStr === 'string' ? parseLocalDate(dateBStr) : dateBStr;
    if (!da || !db) return 0;
    const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
    const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
    return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get lowercase 3-letter weekday key ('mon', 'tue', etc.) from dateStr or Date.
   */
  function getDayKey(dateInput) {
    const d = typeof dateInput === 'string' ? parseLocalDate(dateInput) : dateInput;
    if (!d) return 'mon';
    return DAY_KEYS[d.getDay()];
  }

  /**
   * Human friendly date format e.g. "Wed, Oct 21" or "Oct 21, 2026".
   */
  function formatDisplayDate(dateInput, includeYear = false) {
    const d = typeof dateInput === 'string' ? parseLocalDate(dateInput) : dateInput;
    if (!d) return 'Invalid date';
    const dayName = DAY_SHORT[d.getDay()];
    const month = MONTH_SHORT[d.getMonth()];
    const dateNum = d.getDate();
    if (includeYear) {
      return `${dayName}, ${month} ${dateNum}, ${d.getFullYear()}`;
    }
    return `${dayName}, ${month} ${dateNum}`;
  }

  /**
   * Relative date label relative to a reference today:
   * "Today", "Tomorrow", "Yesterday", "In 3 days", "2 days ago", or "Past due"
   */
  function getRelativeDateLabel(targetDateStr, todayStr = getTodayString()) {
    const diff = daysBetween(todayStr, targetDateStr);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff <= 7) return `In ${diff} days`;
    if (diff > 7) return `In ${diff} days (${formatDisplayDate(targetDateStr)})`;
    if (diff < -1) return `${Math.abs(diff)} days ago`;
    return formatDisplayDate(targetDateStr);
  }

  /**
   * Format minutes into readable "Xh Ym" or "Xh" or "Ym".
   */
  function formatMinutes(minutes) {
    if (minutes == null || isNaN(minutes) || minutes <= 0) return '0m';
    const totalMins = Math.round(minutes);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }

  /**
   * Format hours (decimal like 2.5) to readable string or "2h 30m".
   */
  function formatHours(hours) {
    if (hours == null || isNaN(hours)) return '0h';
    const totalMinutes = Math.round(hours * 60);
    return formatMinutes(totalMinutes);
  }

  /**
   * Format 24hr time 'HH:mm' to 12hr 'h:mm AM/PM'
   */
  function formatTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return '';
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parts[1].padStart(2, '0');
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  /**
   * Check if dateStr is strictly in the past relative to todayStr.
   */
  function isPast(dateStr, todayStr = getTodayString()) {
    return daysBetween(todayStr, dateStr) < 0;
  }

  /**
   * Check if dateStr is today relative to todayStr.
   */
  function isToday(dateStr, todayStr = getTodayString()) {
    return daysBetween(todayStr, dateStr) === 0;
  }

  /**
   * Generate an array of YYYY-MM-DD date strings for range [start, end].
   */
  function getDateRange(startStr, endStr) {
    const list = [];
    let cur = startStr;
    let safety = 0;
    while (daysBetween(cur, endStr) >= 0 && safety < 365) {
      list.push(cur);
      cur = addDays(cur, 1);
      safety++;
    }
    return list;
  }

  return {
    DAY_KEYS,
    DAY_NAMES,
    DAY_SHORT,
    MONTH_NAMES,
    MONTH_SHORT,
    parseLocalDate,
    formatLocalDate,
    getTodayString,
    addDays,
    daysBetween,
    getDayKey,
    formatDisplayDate,
    getRelativeDateLabel,
    formatMinutes,
    formatHours,
    formatTime,
    isPast,
    isToday,
    getDateRange
  };
});
