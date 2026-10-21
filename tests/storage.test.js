const { suite, test, expect } = require('./test-helper.js');
const DateUtils = require('../js/date-utils.js');
const Tasks = require('../js/tasks.js');
const Storage = require('../js/storage.js');

suite('Storage and Serialization Unit Tests', () => {
  const refDate = '2026-10-21';

  test('loadSettings returns default settings if empty', () => {
    Storage.clearAllData();
    const settings = Storage.loadSettings();
    expect(settings.weeklyAvailability.mon).toBeGreaterThan(0);
    expect(settings.dailyBufferPercent).toBe(15);
  });

  test('saveSettings and loadSettings roundtrip correctly', () => {
    const custom = {
      weeklyAvailability: { mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 0, sun: 0 },
      dailyBufferPercent: 20,
      dailyMaxHours: 10,
      planningStartDate: '2026-10-21'
    };
    Storage.saveSettings(custom);
    const loaded = Storage.loadSettings();
    expect(loaded.weeklyAvailability.mon).toBe(4);
    expect(loaded.dailyBufferPercent).toBe(20);
    expect(loaded.dailyMaxHours).toBe(10);
    expect(loaded.planningStartDate).toBe('2026-10-21');
  });

  test('saveTasks and loadTasks persist and validate objects', () => {
    const task = Tasks.createTask({
      title: 'Persisted Task',
      estimatedMinutes: 90,
      deadlineDate: '2026-10-25'
    }, refDate);

    Storage.saveTasks([task]);
    const loaded = Storage.loadTasks();
    expect(loaded.length).toBe(1);
    expect(loaded[0].title).toBe('Persisted Task');
    expect(loaded[0].estimatedMinutes).toBe(90);
  });

  test('exportData produces valid formatted JSON string', () => {
    const task = Tasks.createTask({ title: 'Export Me', estimatedMinutes: 45, deadlineDate: '2026-10-22' }, refDate);
    const settings = Storage.loadSettings();
    const jsonStr = Storage.exportData([task], settings);

    expect(typeof jsonStr).toBe('string');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.app).toBe('Deadline Reality Check');
    expect(parsed.tasks.length).toBe(1);
  });

  test('importData handles malformed JSON string safely', () => {
    const res = Storage.importData('{ malformed json');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid JSON');
  });

  test('importData rejects payload without tasks array', () => {
    const res = Storage.importData('{"hello": "world"}');
    expect(res.success).toBe(false);
    expect(res.error).toContain('missing a valid "tasks" array');
  });

  test('importData sanitizes and validates valid JSON backup', () => {
    const sample = JSON.stringify({
      app: 'Deadline Reality Check',
      settings: {
        weeklyAvailability: { mon: 3, tue: 3, wed: 3, thu: 3, fri: 3, sat: 3, sun: 3 },
        dailyBufferPercent: 10
      },
      tasks: [
        {
          title: 'Imported Assignment',
          estimatedMinutes: 120,
          deadlineDate: '2026-10-28',
          priority: 'urgent'
        }
      ]
    });

    const res = Storage.importData(sample);
    expect(res.success).toBe(true);
    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].title).toBe('Imported Assignment');
    expect(res.settings.weeklyAvailability.mon).toBe(3);
  });
});
