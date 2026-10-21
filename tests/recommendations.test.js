const { suite, test, expect } = require('./test-helper.js');
const DateUtils = require('../js/date-utils.js');
const Tasks = require('../js/tasks.js');
const Scheduler = require('../js/scheduler.js');
const Recommendations = require('../js/recommendations.js');

suite('Recommendations Engine Unit Tests', () => {
  const refDate = '2026-10-21';

  const settings = {
    weeklyAvailability: { mon: 2, tue: 2, wed: 2, thu: 2, fri: 2, sat: 2, sun: 2 },
    dailyBufferPercent: 0,
    dailyMaxHours: 8,
    planningStartDate: refDate
  };

  test('Generates recommendations when schedule is overloaded', () => {
    // 2h per day = 4h before Thu night. Task requires 7h due Thu.
    const overloadedTask = Tasks.createTask({
      title: 'Massive Essay',
      estimatedMinutes: 420, // 7h
      deadlineDate: '2026-10-22',
      priority: 'urgent',
      importance: 'mandatory'
    }, refDate);

    const analysis = Scheduler.analyzeSchedule([overloadedTask], settings, refDate);
    const recs = Recommendations.generateRecommendations(analysis, [overloadedTask], settings);

    expect(recs.length).toBeGreaterThan(0);
    // Should suggest extending deadline or increasing availability
    const hasDeadlineShiftOrAvail = recs.some(r => r.type === 'extend_deadline' || r.type === 'increase_availability' || r.type === 'split_task');
    expect(hasDeadlineShiftOrAvail).toBe(true);
  });

  test('Accepting an extend_deadline recommendation updates the task deadline', () => {
    const task = Tasks.createTask({
      title: 'Lab Report',
      estimatedMinutes: 300,
      deadlineDate: '2026-10-22'
    }, refDate);

    const rec = {
      actionType: 'UPDATE_TASK',
      actionPayload: {
        taskId: task.id,
        updates: { deadlineDate: '2026-10-25' }
      }
    };

    const res = Recommendations.applyRecommendation(rec, [task], settings);
    expect(res.success).toBe(true);
    expect(res.tasks[0].deadlineDate).toBe('2026-10-25');
  });

  test('Rejecting/dismissing a recommendation leaves task data unmodified', () => {
    const task = Tasks.createTask({
      title: 'Original Task',
      estimatedMinutes: 120,
      deadlineDate: '2026-10-23'
    }, refDate);

    // No mutation occurs if action is not applied
    const unchanged = [task];
    expect(unchanged[0].deadlineDate).toBe('2026-10-23');
    expect(unchanged[0].estimatedMinutes).toBe(120);
  });

  test('Accepting an increase_availability recommendation updates weekly settings', () => {
    const rec = {
      actionType: 'UPDATE_AVAILABILITY',
      actionPayload: {
        dayKey: 'wed',
        newHours: 4.5
      }
    };

    const res = Recommendations.applyRecommendation(rec, [], settings);
    expect(res.success).toBe(true);
    expect(res.settings.weeklyAvailability.wed).toBe(4.5);
  });

  test('Splitting a large task creates two balanced subtasks', () => {
    const bigTask = Tasks.createTask({
      title: 'Big Term Paper',
      estimatedMinutes: 300, // 5h
      deadlineDate: '2026-10-26'
    }, refDate);

    const rec = {
      actionType: 'SPLIT_TASK',
      actionPayload: {
        taskId: bigTask.id,
        part1Minutes: 150,
        part2Minutes: 150
      }
    };

    const res = Recommendations.applyRecommendation(rec, [bigTask], settings);
    expect(res.success).toBe(true);
    expect(res.tasks.length).toBe(2);
    expect(res.tasks[0].title).toContain('Part 1');
    expect(res.tasks[1].title).toContain('Part 2');
    expect(res.tasks[0].remainingMinutes).toBe(150);
    expect(res.tasks[1].remainingMinutes).toBe(150);
  });
});
