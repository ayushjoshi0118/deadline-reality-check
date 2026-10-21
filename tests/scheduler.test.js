const { suite, test, expect } = require('./test-helper.js');
const DateUtils = require('../js/date-utils.js');
const Tasks = require('../js/tasks.js');
const Scheduler = require('../js/scheduler.js');

suite('Deterministic Scheduler Engine Unit Tests', () => {
  const refDate = '2026-10-21'; // Wednesday

  // Standard student settings: Mon: 2, Tue: 3, Wed: 2, Thu: 2, Fri: 3, Sat: 4, Sun: 0
  const standardSettings = {
    weeklyAvailability: {
      mon: 2,
      tue: 3,
      wed: 2,
      thu: 2,
      fri: 3,
      sat: 4,
      sun: 0
    },
    dailyBufferPercent: 0, // start with 0 buffer for raw capacity test
    dailyMaxHours: 8,
    planningStartDate: refDate
  };

  test('A task that fits comfortably before its deadline reports On Track', () => {
    // Wed has 2h (120m). Task is 60m due Friday (2026-10-23).
    const task = Tasks.createTask({
      title: 'Easy Assignment',
      estimatedMinutes: 60,
      deadlineDate: '2026-10-23',
      priority: 'medium'
    }, refDate);

    const result = Scheduler.analyzeSchedule([task], standardSettings, refDate);

    expect(result.overallStatus).toBe(Scheduler.STATUS.ON_TRACK);
    expect(result.taskResults[task.id].fitsOnTime).toBe(true);
    expect(result.taskResults[task.id].deficitMinutes).toBe(0);
    expect(result.taskResults[task.id].daysLate).toBe(0);
  });

  test('A task that cannot fit before its deadline reports Overloaded with accurate deficit', () => {
    // Today is Wed (2h capacity). Thu has 2h. Total capacity before Thu night is 4h (240m).
    // Task requires 6h (360m) due Thursday (2026-10-22).
    const heavyTask = Tasks.createTask({
      title: 'Heavy Project',
      estimatedMinutes: 360,
      deadlineDate: '2026-10-22',
      priority: 'high'
    }, refDate);

    const result = Scheduler.analyzeSchedule([heavyTask], standardSettings, refDate);

    expect(result.overallStatus).toBe(Scheduler.STATUS.OVERLOADED);
    expect(result.taskResults[heavyTask.id].fitsOnTime).toBe(false);
    expect(result.taskResults[heavyTask.id].deficitMinutes).toBe(120); // 360 - 240 = 120m short (2h)
    expect(result.taskResults[heavyTask.id].daysLate).toBeGreaterThan(0);
  });

  test('Multiple tasks sharing one deadline are consistently scheduled', () => {
    // Wed 2h (120m), Thu 2h (120m). Total 240m.
    // Two tasks due Thu: Task A (120m, urgent), Task B (180m, low).
    // Total required: 300m. Exceeds 240m by 60m.
    const taskUrgent = Tasks.createTask({
      title: 'Urgent Task',
      estimatedMinutes: 120,
      deadlineDate: '2026-10-22',
      priority: 'urgent'
    }, refDate);

    const taskLow = Tasks.createTask({
      title: 'Low Task',
      estimatedMinutes: 180,
      deadlineDate: '2026-10-22',
      priority: 'low'
    }, refDate);

    const result = Scheduler.analyzeSchedule([taskUrgent, taskLow], standardSettings, refDate);

    // Urgent task should be prioritized and fit
    expect(result.taskResults[taskUrgent.id].fitsOnTime).toBe(true);
    // Low task should bear the deficit
    expect(result.taskResults[taskLow.id].fitsOnTime).toBe(false);
    expect(result.taskResults[taskLow.id].deficitMinutes).toBe(60);
  });

  test('A task due today fits if effort <= today available capacity', () => {
    // Wed 2h (120m) available. Task is 90m due today.
    const todayTask = Tasks.createTask({
      title: 'Today Task',
      estimatedMinutes: 90,
      deadlineDate: refDate,
      priority: 'high'
    }, refDate);

    const result = Scheduler.analyzeSchedule([todayTask], standardSettings, refDate);
    expect(result.taskResults[todayTask.id].fitsOnTime).toBe(true);
  });

  test('An overdue unfinished task reports Overdue status', () => {
    const overdueTask = Tasks.createTask({
      title: 'Past Task',
      estimatedMinutes: 60,
      deadlineDate: '2026-10-19', // 2 days ago
      priority: 'urgent'
    }, refDate);

    const result = Scheduler.analyzeSchedule([overdueTask], standardSettings, refDate);
    expect(result.overallStatus).toBe(Scheduler.STATUS.OVERDUE);
    expect(result.overdueCount).toBe(1);
  });

  test('A completed task does not count toward remaining workload', () => {
    const completedTask = Tasks.createTask({
      title: 'Done Task',
      estimatedMinutes: 180,
      remainingMinutes: 0,
      deadlineDate: '2026-10-23',
      completed: true
    }, refDate);

    const activeTask = Tasks.createTask({
      title: 'Active Task',
      estimatedMinutes: 60,
      deadlineDate: '2026-10-23'
    }, refDate);

    const result = Scheduler.analyzeSchedule([completedTask, activeTask], standardSettings, refDate);
    expect(result.totalRemainingMinutes).toBe(60);
    expect(result.completedCount).toBe(1);
    expect(result.activeCount).toBe(1);
  });

  test('A day with zero availability (e.g. Sunday) receives zero scheduled minutes', () => {
    // Sunday 2026-10-25 has 0 availability in standardSettings
    const longTask = Tasks.createTask({
      title: 'Week-long Task',
      estimatedMinutes: 600, // 10h
      deadlineDate: '2026-10-28'
    }, refDate);

    const result = Scheduler.analyzeSchedule([longTask], standardSettings, refDate);
    const sunday = result.calendar['2026-10-25'];
    expect(sunday.grossHours).toBe(0);
    expect(sunday.scheduledMinutes).toBe(0);
    expect(sunday.isNonWorkingDay).toBe(true);
  });

  test('A schedule with a configured daily buffer reduces usable capacity', () => {
    // 20% buffer on 2h (120m) = 24m buffer, 96m usable
    const bufferSettings = {
      ...standardSettings,
      dailyBufferPercent: 20
    };

    const task = Tasks.createTask({
      title: 'Buffer Test Task',
      estimatedMinutes: 100,
      deadlineDate: refDate // Due today (Wed)
    }, refDate);

    const result = Scheduler.analyzeSchedule([task], bufferSettings, refDate);
    const wed = result.calendar[refDate];
    expect(wed.grossMinutes).toBe(120);
    expect(wed.bufferMinutes).toBe(24);
    expect(wed.usableMinutes).toBe(96);
    // Task requires 100m, but usable is 96m -> deficit!
    expect(result.taskResults[task.id].fitsOnTime).toBe(false);
  });

  test('Scheduler produces identical, deterministic results for identical inputs', () => {
    const tasks = [
      Tasks.createTask({ title: 'Task 1', estimatedMinutes: 90, deadlineDate: '2026-10-24' }, refDate),
      Tasks.createTask({ title: 'Task 2', estimatedMinutes: 150, deadlineDate: '2026-10-23' }, refDate)
    ];

    const run1 = Scheduler.analyzeSchedule(tasks, standardSettings, refDate);
    const run2 = Scheduler.analyzeSchedule(tasks, standardSettings, refDate);

    expect(run1.overallStatus).toBe(run2.overallStatus);
    expect(run1.totalRemainingMinutes).toBe(run2.totalRemainingMinutes);
    expect(run1.taskResults[tasks[0].id].fitsOnTime).toBe(run2.taskResults[tasks[0].id].fitsOnTime);
    expect(run1.nextTaskRecommendation.task.id).toBe(run2.nextTaskRecommendation.task.id);
  });
});
