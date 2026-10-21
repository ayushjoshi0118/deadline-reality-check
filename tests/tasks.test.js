const { suite, test, expect } = require('./test-helper.js');
const DateUtils = require('../js/date-utils.js');
const Tasks = require('../js/tasks.js');

suite('Tasks Management Unit Tests', () => {
  const todayStr = '2026-10-21';

  test('validateTaskInput rejects empty title', () => {
    const val = Tasks.validateTaskInput({ title: '   ', estimatedMinutes: 60, deadlineDate: '2026-10-25' }, todayStr);
    expect(val.isValid).toBe(false);
    expect(val.errors.some(e => e.includes('title'))).toBe(true);
  });

  test('validateTaskInput rejects non-positive effort', () => {
    const valZero = Tasks.validateTaskInput({ title: 'Study', estimatedMinutes: 0, deadlineDate: '2026-10-25' }, todayStr);
    expect(valZero.isValid).toBe(false);

    const valNeg = Tasks.validateTaskInput({ title: 'Study', estimatedMinutes: -30, deadlineDate: '2026-10-25' }, todayStr);
    expect(valNeg.isValid).toBe(false);
  });

  test('validateTaskInput warns about past deadlines without failing validation', () => {
    const val = Tasks.validateTaskInput({
      title: 'Old Assignment',
      estimatedMinutes: 60,
      deadlineDate: '2026-10-10' // past
    }, todayStr);
    expect(val.isValid).toBe(true);
    expect(val.warnings.length).toBeGreaterThan(0);
    expect(val.warnings[0]).toContain('past');
  });

  test('createTask creates valid task object with sensible defaults', () => {
    const task = Tasks.createTask({
      title: 'History Paper',
      estimatedHours: 2.5,
      deadlineDate: '2026-10-24',
      priority: 'urgent'
    }, todayStr);

    expect(task.title).toBe('History Paper');
    expect(task.estimatedMinutes).toBe(150);
    expect(task.remainingMinutes).toBe(150);
    expect(task.priority).toBe('urgent');
    expect(task.completed).toBe(false);
    expect(task.id.startsWith('task_')).toBe(true);
  });

  test('toggleTaskCompletion toggles completed status and restores/clears remaining minutes', () => {
    const task = Tasks.createTask({
      title: 'Math Quiz',
      estimatedMinutes: 60,
      deadlineDate: '2026-10-22'
    }, todayStr);

    const completed = Tasks.toggleTaskCompletion(task);
    expect(completed.completed).toBe(true);
    expect(completed.remainingMinutes).toBe(0);
    expect(completed.completedAt).toBeTruthy();

    const reopened = Tasks.toggleTaskCompletion(completed);
    expect(reopened.completed).toBe(false);
    expect(reopened.remainingMinutes).toBe(60);
    expect(reopened.completedAt).toBe(null);
  });

  test('updateTask updates estimate and checks validation', () => {
    const task = Tasks.createTask({
      title: 'Coding Project',
      estimatedMinutes: 120,
      deadlineDate: '2026-10-23'
    }, todayStr);

    const res = Tasks.updateTask(task, { remainingMinutes: 180 }, todayStr);
    expect(res.success).toBe(true);
    expect(res.task.remainingMinutes).toBe(180);

    const badRes = Tasks.updateTask(task, { remainingMinutes: -10 }, todayStr);
    expect(badRes.success).toBe(false);
  });

  test('sortTasks sorts by deadline, priority, and completed state', () => {
    const t1 = Tasks.createTask({ title: 'Later High', deadlineDate: '2026-10-25', priority: 'high', estimatedMinutes: 60 }, todayStr);
    const t2 = Tasks.createTask({ title: 'Earlier Urgent', deadlineDate: '2026-10-22', priority: 'urgent', estimatedMinutes: 60 }, todayStr);
    const t3 = Tasks.createTask({ title: 'Earlier Low', deadlineDate: '2026-10-22', priority: 'low', estimatedMinutes: 60 }, todayStr);
    const t4 = Tasks.createTask({ title: 'Completed Past', deadlineDate: '2026-10-20', priority: 'urgent', estimatedMinutes: 60, completed: true }, todayStr);

    const sorted = Tasks.sortTasks([t1, t4, t3, t2], 'deadline');
    // Active tasks first, then sorted by date and priority
    expect(sorted[0].title).toBe('Earlier Urgent');
    expect(sorted[1].title).toBe('Earlier Low');
    expect(sorted[2].title).toBe('Later High');
    expect(sorted[3].title).toBe('Completed Past');
  });
});
