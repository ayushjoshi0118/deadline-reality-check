/**
 * Deadline Reality Check - Storage & Settings
 * LocalStorage wrapper, JSON export/import validation, and demo presets.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const DateUtils = require('./date-utils.js');
    const Tasks = require('./tasks.js');
    module.exports = factory(DateUtils, Tasks);
  } else {
    root.DRC = root.DRC || {};
    root.DRC.Storage = factory(root.DRC.DateUtils, root.DRC.Tasks);
  }
})(typeof self !== 'undefined' ? self : this, function (DateUtils, Tasks) {
  'use strict';

  const STORAGE_KEYS = {
    TASKS: 'drc_tasks_v1',
    SETTINGS: 'drc_settings_v1',
    THEME: 'drc_theme_v1'
  };

  const DEFAULT_SETTINGS = {
    weeklyAvailability: {
      mon: 2.5,
      tue: 3.0,
      wed: 1.5,
      thu: 2.5,
      fri: 3.0,
      sat: 4.0,
      sun: 2.0
    },
    dailyBufferPercent: 15, // 15% reserved for breaks and interruptions
    dailyMaxHours: 8,       // Cap daily capacity to prevent burnout
    planningStartDate: null // null means dynamic 'today'
  };

  /**
   * Safe localStorage wrapper with memory fallback if cookies/storage blocked.
   */
  let memoryStore = {};

  function isLocalStorageAvailable() {
    try {
      const testKey = '__drc_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  const hasStorage = isLocalStorageAvailable();

  function getItem(key) {
    if (hasStorage) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn('Failed to read from localStorage:', e);
        return memoryStore[key] || null;
      }
    }
    return memoryStore[key] || null;
  }

  function setItem(key, value) {
    if (hasStorage) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn('Failed to write to localStorage:', e);
        memoryStore[key] = value;
        return false;
      }
    }
    memoryStore[key] = value;
    return true;
  }

  function removeItem(key) {
    if (hasStorage) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Failed to delete from localStorage:', e);
      }
    }
    delete memoryStore[key];
  }

  /**
   * Load tasks from storage.
   */
  function loadTasks() {
    const raw = getItem(STORAGE_KEYS.TASKS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Sanitize each task
      return parsed.map(item => {
        try {
          return Tasks.createTask(item);
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    } catch (e) {
      console.error('Error parsing stored tasks:', e);
      return [];
    }
  }

  /**
   * Save tasks array to storage.
   */
  function saveTasks(tasks) {
    if (!Array.isArray(tasks)) return false;
    try {
      const serialized = JSON.stringify(tasks);
      return setItem(STORAGE_KEYS.TASKS, serialized);
    } catch (e) {
      console.error('Error serializing tasks:', e);
      return false;
    }
  }

  /**
   * Load settings with fallback to defaults.
   */
  function loadSettings() {
    const raw = getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw);
      return sanitizeSettings(parsed);
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Validate and sanitize settings object.
   */
  function sanitizeSettings(input) {
    const output = { ...DEFAULT_SETTINGS };
    if (!input || typeof input !== 'object') return output;

    // Weekly availability
    if (input.weeklyAvailability && typeof input.weeklyAvailability === 'object') {
      const validWeek = {};
      DateUtils.DAY_KEYS.forEach(day => {
        const val = Number(input.weeklyAvailability[day]);
        validWeek[day] = (!isNaN(val) && val >= 0) ? Math.min(24, Math.max(0, val)) : DEFAULT_SETTINGS.weeklyAvailability[day];
      });
      output.weeklyAvailability = validWeek;
    }

    // Daily buffer
    if (input.dailyBufferPercent != null) {
      const buf = Number(input.dailyBufferPercent);
      output.dailyBufferPercent = (!isNaN(buf) && buf >= 0 && buf <= 60) ? buf : 15;
    }

    // Daily max hours
    if (input.dailyMaxHours != null) {
      const maxH = Number(input.dailyMaxHours);
      output.dailyMaxHours = (!isNaN(maxH) && maxH >= 1 && maxH <= 24) ? maxH : 8;
    }

    // Planning start date
    if (input.planningStartDate) {
      const parsed = DateUtils.parseLocalDate(String(input.planningStartDate));
      output.planningStartDate = parsed ? DateUtils.formatLocalDate(parsed) : null;
    } else {
      output.planningStartDate = null;
    }

    return output;
  }

  /**
   * Save settings to storage.
   */
  function saveSettings(settings) {
    const sanitized = sanitizeSettings(settings);
    try {
      setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(sanitized));
      return sanitized;
    } catch (e) {
      console.error('Error saving settings:', e);
      return sanitized;
    }
  }

  /**
   * Theme persistence (light | dark).
   */
  function loadTheme() {
    const saved = getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function saveTheme(theme) {
    const valid = theme === 'dark' ? 'dark' : 'light';
    setItem(STORAGE_KEYS.THEME, valid);
    return valid;
  }

  /**
   * Export all user data as formatted JSON string.
   */
  function exportData(tasks, settings) {
    const data = {
      app: 'Deadline Reality Check',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: sanitizeSettings(settings),
      tasks: tasks || []
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Validate and parse imported JSON string.
   */
  function importData(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      return { success: false, error: 'Empty or invalid import file.' };
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return { success: false, error: 'Invalid JSON file. Please check syntax.' };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Imported file does not contain a valid configuration object.' };
    }

    if (!Array.isArray(parsed.tasks)) {
      return { success: false, error: 'Imported file is missing a valid "tasks" array.' };
    }

    const validatedTasks = [];
    const errors = [];

    parsed.tasks.forEach((t, idx) => {
      try {
        const validated = Tasks.createTask(t);
        validatedTasks.push(validated);
      } catch (err) {
        errors.push(`Task #${idx + 1} (${t.title || 'untitled'}): ${err.message}`);
      }
    });

    if (validatedTasks.length === 0 && parsed.tasks.length > 0) {
      return {
        success: false,
        error: `Could not import any tasks. Errors: ${errors.slice(0, 3).join('; ')}`
      };
    }

    const sanitizedSettings = parsed.settings ? sanitizeSettings(parsed.settings) : DEFAULT_SETTINGS;

    return {
      success: true,
      tasks: validatedTasks,
      settings: sanitizedSettings,
      skippedCount: errors.length,
      warning: errors.length > 0 ? `${errors.length} tasks were skipped due to invalid fields.` : null
    };
  }

  /**
   * Clear all stored data.
   */
  function clearAllData() {
    removeItem(STORAGE_KEYS.TASKS);
    removeItem(STORAGE_KEYS.SETTINGS);
    memoryStore = {};
  }

  /**
   * Generate realistic demo tasks relative to today.
   */
  function generateDemoTasks(todayStr = DateUtils.getTodayString()) {
    return [
      {
        title: 'Complete Computer Science Lab 4',
        description: 'Implement binary search tree rotations and test edge cases.',
        estimatedMinutes: 180, // 3h
        remainingMinutes: 180,
        deadlineDate: DateUtils.addDays(todayStr, 1),
        deadlineTime: '17:00',
        priority: 'urgent',
        category: 'assignment',
        importance: 'mandatory',
        notes: 'Prof mentioned this is 15% of course grade.'
      },
      {
        title: 'Read Microeconomics Chapters 7 & 8',
        description: 'Read game theory and monopoly pricing chapters.',
        estimatedMinutes: 120, // 2h
        remainingMinutes: 120,
        deadlineDate: DateUtils.addDays(todayStr, 2),
        deadlineTime: '23:59',
        priority: 'high',
        category: 'assignment',
        importance: 'important',
        notes: 'Take notes on Nash Equilibrium.'
      },
      {
        title: 'Draft History Research Paper (First 4 pages)',
        description: 'Primary source analysis on the Industrial Revolution.',
        estimatedMinutes: 300, // 5h
        remainingMinutes: 300,
        deadlineDate: DateUtils.addDays(todayStr, 3),
        deadlineTime: '18:00',
        priority: 'high',
        category: 'project',
        importance: 'mandatory',
        notes: 'Need at least 5 scholarly citations.'
      },
      {
        title: 'Statistics Midterm Practice Problems',
        description: 'Complete practice exams from 2024 and 2025.',
        estimatedMinutes: 240, // 4h
        remainingMinutes: 150, // 2.5h remaining
        deadlineDate: DateUtils.addDays(todayStr, 4),
        deadlineTime: '14:00',
        priority: 'urgent',
        category: 'exam',
        importance: 'mandatory',
        notes: 'Focus on Chi-square test and hypothesis testing.'
      },
      {
        title: 'Clean and Organize Study Desk & Digital Files',
        description: 'Archive last semester notes and clean physical workspace.',
        estimatedMinutes: 60, // 1h
        remainingMinutes: 60,
        deadlineDate: DateUtils.addDays(todayStr, 5),
        deadlineTime: '20:00',
        priority: 'low',
        category: 'personal',
        importance: 'flexible',
        notes: 'Nice to have, not urgent.'
      },
      {
        title: 'Peer Review Sarah\'s Essay',
        description: 'Provide constructive feedback on introduction and thesis statement.',
        estimatedMinutes: 45,
        remainingMinutes: 0,
        completed: true,
        completedAt: new Date().toISOString(),
        deadlineDate: todayStr,
        deadlineTime: '12:00',
        priority: 'medium',
        category: 'assignment',
        importance: 'important',
        notes: 'Done early this morning.'
      }
    ].map(t => Tasks.createTask(t, todayStr));
  }

  return {
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    isLocalStorageAvailable,
    loadTasks,
    saveTasks,
    loadSettings,
    saveSettings,
    loadTheme,
    saveTheme,
    exportData,
    importData,
    clearAllData,
    generateDemoTasks,
    sanitizeSettings
  };
});
