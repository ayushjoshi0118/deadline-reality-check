const { suite, test, expect } = require('./test-helper.js');
const DateUtils = require('../js/date-utils.js');
const Tasks = require('../js/tasks.js');
const Scheduler = require('../js/scheduler.js');
const Recommendations = require('../js/recommendations.js');
const Storage = require('../js/storage.js');

suite('Edge Cases & Resiliency Tests', () => {
  const refDate = '2026-10-21'; // Wednesday

  test('Task due today with zero availability today reports Overloaded immediately', () => {
    const zeroWedSettings = {
      weeklyAvailability: { mon: 2, tue: 2, wed: 0, thu: 2, fri: 2, sat: 2, sun: 0 },
      dailyBufferPercent: 0,
      dailyMaxHours: 8,
      planningStartDate: refDate
    };

    const task = Tasks.createTask({
      title: 'Due Today But Off-Day',
      estimatedMinutes: 60,
      deadlineDate: refDate
    }, refDate);

    const result = Scheduler.analyzeSchedule([task], zeroWedSettings, refDate);
    expect(result.overallStatus).toBe(Scheduler.STATUS.OVERLOADED);
    expect(result.taskResults[task.id].fitsOnTime).toBe(false);
    expect(result.taskResults[task.id].deficitMinutes).toBe(60);
  });

  test('All tasks completed reports On Track with congratulatory explanation', () => {
    const settings = Storage.DEFAULT_SETTINGS;
    const task1 = Tasks.createTask({ title: 'Task 1', estimatedMinutes: 60, deadlineDate: '2026-10-25', completed: true }, refDate);
    const task2 = Tasks.createTask({ title: 'Task 2', estimatedMinutes: 90, deadlineDate: '2026-10-26', completed: true }, refDate);

    const result = Scheduler.analyzeSchedule([task1, task2], settings, refDate);
    expect(result.overallStatus).toBe(Scheduler.STATUS.ON_TRACK);
    expect(result.totalRemainingMinutes).toBe(0);
    expect(result.progressPercent).toBe(100);
    expect(result.statusExplanation).toContain('completed');
  });

  test('No tasks in system reports On Track with guidance explanation', () => {
    const settings = Storage.DEFAULT_SETTINGS;
    const result = Scheduler.analyzeSchedule([], settings, refDate);
    expect(result.overallStatus).toBe(Scheduler.STATUS.ON_TRACK);
    expect(result.totalRemainingMinutes).toBe(0);
    expect(result.activeCount).toBe(0);
    expect(result.statusExplanation).toContain('No tasks');
  });

  test('Zero availability across the entire week reports infeasible forecast', () => {
    const zeroSettings = {
      weeklyAvailability: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
      dailyBufferPercent: 0,
      dailyMaxHours: 8,
      planningStartDate: refDate
    };

    const task = Tasks.createTask({
      title: 'Impossible Task',
      estimatedMinutes: 120,
      deadlineDate: '2026-10-25'
    }, refDate);

    const result = Scheduler.analyzeSchedule([task], zeroSettings, refDate);
    expect(result.overallStatus).toBe(Scheduler.STATUS.OVERLOADED);
    expect(result.isFullyCompletableInHorizon).toBe(false);
    expect(result.taskResults[task.id].forecastFinishDate).toBe(null);
  });

  test('Extreme estimate (>240 hours) triggers validation warning but does not crash', () => {
    const val = Tasks.validateTaskInput({
      title: 'Mega Thesis',
      estimatedHours: 250,
      deadlineDate: '2026-12-01'
    }, refDate);

    expect(val.isValid).toBe(true);
    expect(val.warnings.some(w => w.includes('240 hours'))).toBe(true);
  });

  test('Reopening an overdue completed task correctly restores deficit and overdue status', () => {
    const task = Tasks.createTask({
      title: 'Past Due Milestone',
      estimatedMinutes: 120,
      deadlineDate: '2026-10-18', // 3 days ago
      completed: true
    }, refDate);

    const reopened = Tasks.toggleTaskCompletion(task);
    expect(reopened.completed).toBe(false);
    expect(reopened.remainingMinutes).toBe(120);

    const result = Scheduler.analyzeSchedule([reopened], Storage.DEFAULT_SETTINGS, refDate);
    expect(result.overallStatus).toBe(Scheduler.STATUS.OVERDUE);
    expect(result.overdueCount).toBe(1);
  });

  test('Importing JSON with XSS attempt preserves text safely as string without execution', () => {
    const dangerousJSON = JSON.stringify({
      app: 'Deadline Reality Check',
      settings: Storage.DEFAULT_SETTINGS,
      tasks: [
        {
          title: '<script>alert("xss")</script> Research Paper',
          description: '<img src=x onerror=alert(1)>',
          estimatedMinutes: 60,
          deadlineDate: '2026-10-28'
        }
      ]
    });

    const res = Storage.importData(dangerousJSON);
    expect(res.success).toBe(true);
    expect(res.tasks[0].title).toBe('<script>alert("xss")</script> Research Paper');
    expect(res.tasks[0].description).toBe('<img src=x onerror=alert(1)>');
  });
});
