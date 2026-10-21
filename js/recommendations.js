/**
 * Deadline Reality Check - Actionable Recommendations Engine
 * Generates concrete, user-reviewable rescheduling suggestions when
 * schedules are overloaded, tight, or at risk.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const DateUtils = require('./date-utils.js');
    const Tasks = require('./tasks.js');
    module.exports = factory(DateUtils, Tasks);
  } else {
    root.DRC = root.DRC || {};
    root.DRC.Recommendations = factory(root.DRC.DateUtils, root.DRC.Tasks);
  }
})(typeof self !== 'undefined' ? self : this, function (DateUtils, Tasks) {
  'use strict';

  /**
   * Generate prioritized actionable recommendations based on schedule analysis.
   *
   * @param {Object} scheduleAnalysis - Output from Scheduler.analyzeSchedule
   * @param {Array} allTasks - Full tasks list
   * @param {Object} settings - Availability settings
   * @returns {Array} List of actionable recommendation objects
   */
  function generateRecommendations(scheduleAnalysis, allTasks, settings) {
    const recommendations = [];
    if (!scheduleAnalysis) return recommendations;

    const {
      overallStatus,
      planningDate,
      taskResults,
      calendar,
      overloadedDays,
      deadlineAnalysis
    } = scheduleAnalysis;

    const activeTasks = allTasks.filter(t => !t.completed);
    if (activeTasks.length === 0) return recommendations;

    // 1. Overdue Tasks: Suggest rescheduling deadline to today or tomorrow
    const overdueTasks = activeTasks.filter(t => DateUtils.daysBetween(planningDate, t.deadlineDate) < 0);
    overdueTasks.forEach(task => {
      const suggestedDate = DateUtils.addDays(planningDate, 1);
      recommendations.push({
        id: `rec_overdue_${task.id}`,
        type: 'reschedule_overdue',
        category: 'deadline',
        severity: 'critical',
        taskTitle: task.title,
        taskId: task.id,
        title: `Reschedule overdue task "${task.title}"`,
        summary: `Reset deadline from ${DateUtils.formatDisplayDate(task.deadlineDate)} to tomorrow (${DateUtils.formatDisplayDate(suggestedDate)})`,
        why: 'This task missed its deadline and creates immediate schedule distortion. Updating the deadline allows the scheduler to accurately allocate your available time.',
        impact: `Restores realistic planning for ${DateUtils.formatMinutes(task.remainingMinutes)} of uncompleted work.`,
        affectsDeadline: suggestedDate,
        actionType: 'UPDATE_TASK',
        actionPayload: {
          taskId: task.id,
          updates: { deadlineDate: suggestedDate }
        }
      });
    });

    // 2. Identify Deficit Tasks and Propose Concrete Solutions
    const deficitTasks = activeTasks.filter(t => {
      const res = taskResults[t.id];
      return res && !res.fitsOnTime && !res.isOverdue;
    });

    deficitTasks.forEach(task => {
      const res = taskResults[task.id];
      const deficitMinutes = res.deficitMinutes || 60;
      const deficitHours = Math.round((deficitMinutes / 60) * 10) / 10;
      const forecastDate = res.forecastFinishDate;

      // Alternative A (Workload/Availability):
      // Option A1: If user has a flexible or low priority task due BEFORE or on the same day as this critical task,
      // suggest moving the flexible task forward to free up hours.
      const flexibleTasks = activeTasks.filter(other =>
        other.id !== task.id &&
        (other.importance === 'flexible' || other.priority === 'low') &&
        DateUtils.daysBetween(planningDate, other.deadlineDate) >= 0 &&
        DateUtils.daysBetween(other.deadlineDate, task.deadlineDate) <= 0
      );

      if (flexibleTasks.length > 0) {
        const flex = flexibleTasks[0];
        const newFlexDeadline = DateUtils.addDays(task.deadlineDate, 3);
        recommendations.push({
          id: `rec_postpone_flex_${flex.id}_for_${task.id}`,
          type: 'postpone_flexible',
          category: 'alternative_a',
          severity: 'high',
          taskTitle: flex.title,
          taskId: flex.id,
          title: `Postpone flexible task "${flex.title}" to ${DateUtils.formatDisplayDate(newFlexDeadline)}`,
          summary: `Move "${flex.title}" to free up ${DateUtils.formatMinutes(flex.remainingMinutes)} before "${task.title}" is due.`,
          why: `"${task.title}" is high-stakes and short by ${DateUtils.formatHours(deficitHours)}. Shifting low-priority work out of this bottleneck window gives high-priority work the required focus.`,
          impact: `Frees ${DateUtils.formatMinutes(flex.remainingMinutes)} of capacity prior to ${DateUtils.formatDisplayDate(task.deadlineDate)}.`,
          affectsDeadline: task.deadlineDate,
          actionType: 'UPDATE_TASK',
          actionPayload: {
            taskId: flex.id,
            updates: { deadlineDate: newFlexDeadline }
          }
        });
      }

      // Option A2: If no flexible task, suggest trimming estimated effort or scoping down
      if (task.importance !== 'mandatory') {
        const trimmedMinutes = Math.max(30, Math.round(task.remainingMinutes * 0.75));
        const savedMinutes = task.remainingMinutes - trimmedMinutes;
        recommendations.push({
          id: `rec_trim_scope_${task.id}`,
          type: 'reduce_scope',
          category: 'alternative_a',
          severity: 'medium',
          taskTitle: task.title,
          taskId: task.id,
          title: `Time-box "${task.title}" to ${DateUtils.formatMinutes(trimmedMinutes)}`,
          summary: `Reduce remaining estimate from ${DateUtils.formatMinutes(task.remainingMinutes)} to ${DateUtils.formatMinutes(trimmedMinutes)} (saves ${DateUtils.formatMinutes(savedMinutes)})`,
          why: 'Trade perfectionism for submission. Delivering an 80% polished draft on time is vastly better than missing the deadline entirely.',
          impact: `Reduces deficit by ${DateUtils.formatMinutes(savedMinutes)}.`,
          affectsDeadline: task.deadlineDate,
          actionType: 'UPDATE_TASK',
          actionPayload: {
            taskId: task.id,
            updates: { remainingMinutes: trimmedMinutes }
          }
        });
      }

      // Alternative B (Deadlines):
      // Move this task's deadline to its realistic forecast finish date!
      if (forecastDate) {
        recommendations.push({
          id: `rec_extend_deadline_${task.id}`,
          type: 'extend_deadline',
          category: 'alternative_b',
          severity: 'high',
          taskTitle: task.title,
          taskId: task.id,
          title: `Shift deadline of "${task.title}" to ${DateUtils.formatDisplayDate(forecastDate)}`,
          summary: `Extend deadline by ${res.daysLate} day(s) to match your actual work pace`,
          why: `Under your current daily hours, this task cannot finish before ${DateUtils.formatDisplayDate(task.deadlineDate)}. It will realistically complete on ${DateUtils.formatDisplayDate(forecastDate)}.`,
          impact: `Eliminates the ${DateUtils.formatHours(deficitHours)} deficit completely and restores an On Track schedule.`,
          affectsDeadline: forecastDate,
          actionType: 'UPDATE_TASK',
          actionPayload: {
            taskId: task.id,
            updates: { deadlineDate: forecastDate }
          }
        });
      }

      // Capacity Alternative: Increase daily availability
      // Find days between planningDate and task.deadlineDate with low availability
      const lowDays = [];
      DateUtils.getDateRange(planningDate, task.deadlineDate).forEach(dStr => {
        const day = calendar[dStr];
        if (day && day.grossHours < (settings.dailyMaxHours || 8)) {
          lowDays.push({ dStr, dayKey: day.dayKey, dayName: day.dayName, currentGross: day.grossHours });
        }
      });

      if (lowDays.length > 0 && deficitHours <= 3) {
        const targetDay = lowDays[0];
        const addedHours = Math.min(2.0, Math.ceil(deficitHours * 2) / 2);
        const newDayHours = targetDay.currentGross + addedHours;
        recommendations.push({
          id: `rec_boost_hours_${targetDay.dayKey}_for_${task.id}`,
          type: 'increase_availability',
          category: 'alternative_a',
          severity: 'medium',
          title: `Add +${addedHours}h working time on ${targetDay.dayName}s`,
          summary: `Increase ${targetDay.dayName} availability from ${targetDay.currentGross}h to ${newDayHours}h`,
          why: `Your workload fits if you can commit ${addedHours} additional hour(s) before ${DateUtils.formatDisplayDate(task.deadlineDate)}.`,
          impact: `Adds +${addedHours}h usable time (minus buffer) into your upcoming window.`,
          affectsDeadline: task.deadlineDate,
          actionType: 'UPDATE_AVAILABILITY',
          actionPayload: {
            dayKey: targetDay.dayKey,
            newHours: newDayHours
          }
        });
      }
    });

    // 3. Break down large tasks (> 3.5 hours remaining)
    activeTasks.forEach(task => {
      if (task.remainingMinutes >= 210 && !taskResults[task.id]?.isOverdue) { // >= 3.5 hrs
        const halfMinutes = Math.round(task.remainingMinutes / 2);
        recommendations.push({
          id: `rec_split_task_${task.id}`,
          type: 'split_task',
          category: 'structuring',
          severity: 'low',
          taskTitle: task.title,
          taskId: task.id,
          title: `Split "${task.title}" into two smaller sessions`,
          summary: `Divide this ${DateUtils.formatMinutes(task.remainingMinutes)} task into Part 1 and Part 2 (${DateUtils.formatMinutes(halfMinutes)} each)`,
          why: 'Large multi-hour blocks often cause procrastination and are hard to fit into daily schedules. Two shorter sessions are much easier to complete.',
          impact: 'Improves daily scheduling granularity and psychological momentum.',
          affectsDeadline: task.deadlineDate,
          actionType: 'SPLIT_TASK',
          actionPayload: {
            taskId: task.id,
            part1Minutes: halfMinutes,
            part2Minutes: task.remainingMinutes - halfMinutes
          }
        });
      }
    });

    // Sort recommendations by severity (critical > high > medium > low)
    const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => (severityRank[b.severity] || 1) - (severityRank[a.severity] || 1));

    return recommendations.slice(0, 6); // Return top 6 most relevant
  }

  /**
   * Apply an accepted recommendation to the application state.
   *
   * @param {Object} recommendation - The recommendation to apply
   * @param {Array} tasks - Current tasks array
   * @param {Object} settings - Current settings
   * @returns {Object} Updated { tasks, settings, success, message }
   */
  function applyRecommendation(recommendation, tasks, settings) {
    if (!recommendation || !recommendation.actionType) {
      return { success: false, error: 'Invalid recommendation format.' };
    }

    const { actionType, actionPayload } = recommendation;
    let newTasks = [...tasks];
    let newSettings = { ...settings };

    if (actionType === 'UPDATE_TASK') {
      const idx = newTasks.findIndex(t => t.id === actionPayload.taskId);
      if (idx === -1) {
        return { success: false, error: 'Target task not found.' };
      }
      const existing = newTasks[idx];
      const updated = {
        ...existing,
        ...actionPayload.updates,
        updatedAt: new Date().toISOString()
      };
      newTasks[idx] = updated;
      return {
        success: true,
        tasks: newTasks,
        settings: newSettings,
        message: `Applied update to "${existing.title}".`
      };
    }

    if (actionType === 'UPDATE_AVAILABILITY') {
      const weekly = { ...(newSettings.weeklyAvailability || {}) };
      weekly[actionPayload.dayKey] = actionPayload.newHours;
      newSettings.weeklyAvailability = weekly;
      return {
        success: true,
        tasks: newTasks,
        settings: newSettings,
        message: `Updated ${actionPayload.dayKey.toUpperCase()} availability to ${actionPayload.newHours} hours.`
      };
    }

    if (actionType === 'SPLIT_TASK') {
      const idx = newTasks.findIndex(t => t.id === actionPayload.taskId);
      if (idx === -1) {
        return { success: false, error: 'Target task not found.' };
      }
      const orig = newTasks[idx];
      const part1 = {
        ...orig,
        title: `${orig.title} (Part 1 - Draft / Prep)`,
        estimatedMinutes: actionPayload.part1Minutes,
        remainingMinutes: actionPayload.part1Minutes,
        updatedAt: new Date().toISOString()
      };
      const part2 = Tasks.createTask({
        title: `${orig.title} (Part 2 - Finalize / Polish)`,
        description: orig.description,
        estimatedMinutes: actionPayload.part2Minutes,
        remainingMinutes: actionPayload.part2Minutes,
        deadlineDate: orig.deadlineDate,
        deadlineTime: orig.deadlineTime,
        priority: orig.priority,
        category: orig.category,
        importance: orig.importance,
        notes: orig.notes
      });
      newTasks.splice(idx, 1, part1, part2);
      return {
        success: true,
        tasks: newTasks,
        settings: newSettings,
        message: `Split "${orig.title}" into two manageable tasks.`
      };
    }

    return { success: false, error: 'Unknown recommendation action type.' };
  }

  return {
    generateRecommendations,
    applyRecommendation
  };
});
