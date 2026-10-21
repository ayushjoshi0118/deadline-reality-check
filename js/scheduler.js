/**
 * Deadline Reality Check - Deterministic Scheduling Engine
 * Simulates day-by-day workload allocation against usable daily capacity,
 * identifies overloads, calculates deadline feasibility, forecast completion,
 * and slack/deficit metrics.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const DateUtils = require('./date-utils.js');
    const Tasks = require('./tasks.js');
    module.exports = factory(DateUtils, Tasks);
  } else {
    root.DRC = root.DRC || {};
    root.DRC.Scheduler = factory(root.DRC.DateUtils, root.DRC.Tasks);
  }
})(typeof self !== 'undefined' ? self : this, function (DateUtils, Tasks) {
  'use strict';

  /**
   * Status constants for Reality Check
   */
  const STATUS = {
    ON_TRACK: 'on_track',
    TIGHT: 'tight',
    AT_RISK: 'at_risk',
    OVERLOADED: 'overloaded',
    OVERDUE: 'overdue'
  };

  const STATUS_DETAILS = {
    [STATUS.ON_TRACK]: {
      label: 'On Track',
      badgeClass: 'status-on-track',
      icon: '✅',
      description: 'Your workload comfortably fits into your available hours with healthy slack.'
    },
    [STATUS.TIGHT]: {
      label: 'Tight',
      badgeClass: 'status-tight',
      icon: '⚠️',
      description: 'Your workload fits, but buffer time is slim. Delays may cause a cascade of missed deadlines.'
    },
    [STATUS.AT_RISK]: {
      label: 'At Risk',
      badgeClass: 'status-at-risk',
      icon: '⚡',
      description: 'One or more upcoming deadlines have high vulnerability or severe day bottlenecks.'
    },
    [STATUS.OVERLOADED]: {
      label: 'Overloaded',
      badgeClass: 'status-overloaded',
      icon: '🚨',
      description: 'Required work exceeds available usable hours before your deadlines. Immediate adjustments needed.'
    },
    [STATUS.OVERDUE]: {
      label: 'Overdue',
      badgeClass: 'status-overdue',
      icon: '⏰',
      description: 'You have unfinished work past its deadline date.'
    }
  };

  /**
   * Build daily capacity lookup for a date range [startDate, endDate].
   */
  function buildDailyCalendar(startDateStr, endDateStr, settings) {
    const calendar = {};
    const dates = DateUtils.getDateRange(startDateStr, endDateStr);
    const weekly = settings.weeklyAvailability || {};
    const bufferPercent = Math.min(60, Math.max(0, settings.dailyBufferPercent || 0));
    const maxDailyHours = settings.dailyMaxHours || 24;

    dates.forEach(dateStr => {
      const dayKey = DateUtils.getDayKey(dateStr);
      let grossHours = weekly[dayKey] != null ? Number(weekly[dayKey]) : 0;
      grossHours = Math.min(maxDailyHours, Math.max(0, grossHours));

      const grossMinutes = Math.round(grossHours * 60);
      const bufferMinutes = Math.round(grossMinutes * (bufferPercent / 100));
      const usableMinutes = Math.max(0, grossMinutes - bufferMinutes);

      calendar[dateStr] = {
        dateStr,
        dayKey,
        dayName: DateUtils.DAY_SHORT[DateUtils.parseLocalDate(dateStr).getDay()],
        isToday: false,
        grossHours,
        grossMinutes,
        bufferMinutes,
        usableMinutes,
        usableHours: usableMinutes / 60,
        scheduledMinutes: 0,
        scheduledHours: 0,
        spilloverMinutes: 0, // work placed here that was due earlier
        assignedTasks: [],
        isNonWorkingDay: grossMinutes === 0
      };
    });

    return calendar;
  }

  /**
   * Deterministic sort order for scheduler:
   * 1. Overdue tasks first
   * 2. Earliest deadline date
   * 3. Earliest deadline time
   * 4. Priority rank (urgent > high > medium > low)
   * 5. Importance weight (mandatory > important > flexible)
   * 6. Shorter remaining duration first (EDF with SPT tie-breaker)
   * 7. Deterministic title tie-breaker
   */
  function sortTasksForScheduling(tasks, planningDateStr) {
    return [...tasks].sort((a, b) => {
      const aPast = DateUtils.daysBetween(planningDateStr, a.deadlineDate) < 0;
      const bPast = DateUtils.daysBetween(planningDateStr, b.deadlineDate) < 0;
      if (aPast && !bPast) return -1;
      if (!aPast && bPast) return 1;

      const dateDiff = a.deadlineDate.localeCompare(b.deadlineDate);
      if (dateDiff !== 0) return dateDiff;

      const timeA = a.deadlineTime || '23:59';
      const timeB = b.deadlineTime || '23:59';
      if (timeA !== timeB) return timeA.localeCompare(timeB);

      const rankA = Tasks.PRIORITIES[a.priority] ? Tasks.PRIORITIES[a.priority].rank : 2;
      const rankB = Tasks.PRIORITIES[b.priority] ? Tasks.PRIORITIES[b.priority].rank : 2;
      if (rankB !== rankA) return rankB - rankA;

      const impA = Tasks.IMPORTANCE[a.importance] ? Tasks.IMPORTANCE[a.importance].weight : 2;
      const impB = Tasks.IMPORTANCE[b.importance] ? Tasks.IMPORTANCE[b.importance].weight : 2;
      if (impB !== impA) return impB - impA;

      if (a.remainingMinutes !== b.remainingMinutes) {
        return a.remainingMinutes - b.remainingMinutes;
      }

      return (a.title || '').localeCompare(b.title || '');
    });
  }

  /**
   * Main Scheduling and Reality Check Analysis.
   *
   * @param {Array} allTasks - List of all tasks.
   * @param {Object} settings - Availability settings.
   * @param {string} [referenceDateStr] - Planning reference date (YYYY-MM-DD), default today.
   * @returns {Object} Full schedule analysis result.
   */
  function analyzeSchedule(allTasks, settings, referenceDateStr) {
    const planningDate = settings.planningStartDate || referenceDateStr || DateUtils.getTodayString();
    const activeTasks = allTasks.filter(t => !t.completed);
    const completedTasks = allTasks.filter(t => t.completed);

    // Baseline metrics
    const totalRemainingMinutes = activeTasks.reduce((sum, t) => sum + (t.remainingMinutes || 0), 0);
    const totalRemainingHours = totalRemainingMinutes / 60;
    const totalEstimatedMinutes = allTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
    const completedMinutes = totalEstimatedMinutes - totalRemainingMinutes;
    const progressPercent = totalEstimatedMinutes > 0
      ? Math.min(100, Math.round((completedMinutes / totalEstimatedMinutes) * 100))
      : 0;

    // Check overdue tasks
    const overdueTasks = activeTasks.filter(t => DateUtils.daysBetween(planningDate, t.deadlineDate) < 0);
    const hasOverdue = overdueTasks.length > 0;

    // Determine horizon date for calendar (at least 14 days, or 14 days past the latest deadline)
    let maxDeadline = planningDate;
    activeTasks.forEach(t => {
      if (DateUtils.daysBetween(maxDeadline, t.deadlineDate) > 0) {
        maxDeadline = t.deadlineDate;
      }
    });

    // Calendar horizon spans up to maxDeadline + 7 days, min 14 days, max 90 days
    const daysToMax = Math.max(14, DateUtils.daysBetween(planningDate, maxDeadline) + 7);
    const horizonDays = Math.min(90, Math.max(14, daysToMax));
    const horizonEndDate = DateUtils.addDays(planningDate, horizonDays);

    const calendar = buildDailyCalendar(planningDate, horizonEndDate, settings);
    const calendarDates = Object.keys(calendar).sort();

    // Mark today
    if (calendar[planningDate]) {
      calendar[planningDate].isToday = true;
    }

    // Sorted active tasks for simulation
    const sortedTasks = sortTasksForScheduling(activeTasks, planningDate);

    // Track per-task simulation results
    const taskResults = {};
    activeTasks.forEach(t => {
      taskResults[t.id] = {
        taskId: t.id,
        task: t,
        allocatedMinutes: 0,
        unallocatedMinutes: t.remainingMinutes,
        onTimeMinutes: 0,
        lateMinutes: 0,
        isOverdue: DateUtils.daysBetween(planningDate, t.deadlineDate) < 0,
        fitsOnTime: false,
        forecastFinishDate: null,
        daysLate: 0,
        slackMinutesBeforeDeadline: 0,
        deficitMinutes: 0,
        allocatedDays: []
      };
    });

    // Forward simulation:
    // For each task, allocate its remaining effort onto days.
    // Days <= deadline are "on-time".
    // If work remains after deadline, allocate to subsequent days as "late spillover"
    // to forecast when it could realistically finish.
    sortedTasks.forEach(t => {
      const res = taskResults[t.id];
      let workLeft = t.remainingMinutes;
      if (workLeft <= 0) {
        res.fitsOnTime = true;
        res.forecastFinishDate = planningDate;
        res.unallocatedMinutes = 0;
        return;
      }

      for (let i = 0; i < calendarDates.length; i++) {
        const dStr = calendarDates[i];
        const day = calendar[dStr];
        const remainingCapacity = Math.max(0, day.usableMinutes - day.scheduledMinutes);

        if (remainingCapacity > 0) {
          const allocate = Math.min(workLeft, remainingCapacity);
          const isDayOnTime = DateUtils.daysBetween(dStr, t.deadlineDate) >= 0 && !res.isOverdue;

          day.scheduledMinutes += allocate;
          day.scheduledHours = day.scheduledMinutes / 60;
          day.assignedTasks.push({
            taskId: t.id,
            title: t.title,
            priority: t.priority,
            category: t.category,
            minutes: allocate,
            hours: allocate / 60,
            isOnTime: isDayOnTime,
            isOverdueTask: res.isOverdue
          });

          if (!isDayOnTime) {
            day.spilloverMinutes += allocate;
          }

          res.allocatedMinutes += allocate;
          res.allocatedDays.push({ date: dStr, minutes: allocate, isOnTime: isDayOnTime });

          if (isDayOnTime) {
            res.onTimeMinutes += allocate;
          } else {
            res.lateMinutes += allocate;
          }

          workLeft -= allocate;
          res.unallocatedMinutes = workLeft;

          if (workLeft === 0) {
            res.forecastFinishDate = dStr;
            const diffDays = DateUtils.daysBetween(t.deadlineDate, dStr);
            res.daysLate = Math.max(0, diffDays);
            break;
          }
        }
      }

      // If workLeft still > 0 after running through entire horizon
      if (workLeft > 0) {
        res.unallocatedMinutes = workLeft;
        res.forecastFinishDate = null; // Cannot finish even within horizon!
      }

      res.fitsOnTime = (res.unallocatedMinutes === 0 && res.lateMinutes === 0 && !res.isOverdue);
      if (!res.fitsOnTime) {
        res.deficitMinutes = res.unallocatedMinutes + res.lateMinutes;
      }
    });

    // Calculate slack and bottleneck metrics for each task
    // Slack = total unused usable minutes across all days from planningDate to task deadline
    activeTasks.forEach(t => {
      const res = taskResults[t.id];
      if (res.isOverdue) {
        res.slackMinutesBeforeDeadline = 0;
        return;
      }

      let unusedUsable = 0;
      for (const dStr of calendarDates) {
        if (DateUtils.daysBetween(dStr, t.deadlineDate) < 0) break;
        const day = calendar[dStr];
        unusedUsable += Math.max(0, day.usableMinutes - day.scheduledMinutes);
      }
      res.slackMinutesBeforeDeadline = unusedUsable;
    });

    // Identify overloaded days in the calendar
    const overloadedDays = [];
    const bottleneckDates = [];
    calendarDates.forEach(dStr => {
      const day = calendar[dStr];
      // A day is marked as capacity-exhausted if 100% of usable capacity is booked
      if (day.usableMinutes > 0 && day.scheduledMinutes >= day.usableMinutes) {
        bottleneckDates.push(dStr);
      }
      // If spillover occurred on this day
      if (day.spilloverMinutes > 0) {
        overloadedDays.push({
          dateStr: dStr,
          dayName: day.dayName,
          spilloverMinutes: day.spilloverMinutes,
          scheduledMinutes: day.scheduledMinutes,
          usableMinutes: day.usableMinutes
        });
      }
    });

    // Cumulative Capacity vs Demand Curve up to distinct deadlines
    const deadlineAnalysis = [];
    const distinctDeadlines = [...new Set(activeTasks.map(t => t.deadlineDate))].sort();

    distinctDeadlines.forEach(deadDate => {
      // Work due on or before this date
      const tasksDue = activeTasks.filter(t => DateUtils.daysBetween(t.deadlineDate, deadDate) >= 0);
      const totalDueMinutes = tasksDue.reduce((sum, t) => sum + t.remainingMinutes, 0);

      // Usable capacity from planningDate up to deadDate
      let cumulativeUsableMinutes = 0;
      calendarDates.forEach(dStr => {
        if (DateUtils.daysBetween(dStr, deadDate) >= 0 && DateUtils.daysBetween(planningDate, dStr) >= 0) {
          cumulativeUsableMinutes += calendar[dStr].usableMinutes;
        }
      });

      const netDifferenceMinutes = cumulativeUsableMinutes - totalDueMinutes;
      const isDeficit = netDifferenceMinutes < 0;

      deadlineAnalysis.push({
        deadlineDate: deadDate,
        totalDueMinutes,
        totalDueHours: totalDueMinutes / 60,
        cumulativeUsableMinutes,
        cumulativeUsableHours: cumulativeUsableMinutes / 60,
        netMinutes: netDifferenceMinutes,
        netHours: netDifferenceMinutes / 60,
        isDeficit,
        tasksCount: tasksDue.length
      });
    });

    // Next upcoming deadline among active tasks
    const upcomingDeadlines = activeTasks
      .filter(t => DateUtils.daysBetween(planningDate, t.deadlineDate) >= 0)
      .map(t => t.deadlineDate)
      .sort();
    const nextUpcomingDeadline = upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

    // Available usable hours before the next upcoming deadline
    let usableMinutesBeforeNextDeadline = 0;
    if (nextUpcomingDeadline) {
      calendarDates.forEach(dStr => {
        if (DateUtils.daysBetween(planningDate, dStr) >= 0 && DateUtils.daysBetween(dStr, nextUpcomingDeadline) >= 0) {
          usableMinutesBeforeNextDeadline += calendar[dStr].usableMinutes;
        }
      });
    }

    // Available usable hours across the primary window (e.g. next 7 days or up to furthest deadline)
    const primaryWindowDays = Math.max(7, DateUtils.daysBetween(planningDate, maxDeadline) + 1);
    const primaryWindowEndDate = DateUtils.addDays(planningDate, Math.min(30, primaryWindowDays));
    let usableMinutesInPlanningWindow = 0;
    calendarDates.forEach(dStr => {
      if (DateUtils.daysBetween(planningDate, dStr) >= 0 && DateUtils.daysBetween(dStr, primaryWindowEndDate) >= 0) {
        usableMinutesInPlanningWindow += calendar[dStr].usableMinutes;
      }
    });

    // Identify at-risk tasks
    // Deficit tasks, overdue tasks, or tasks with < 20% slack before deadline
    const atRiskTasks = [];
    const deficitTasks = [];

    activeTasks.forEach(t => {
      const res = taskResults[t.id];
      if (res.isOverdue || !res.fitsOnTime) {
        deficitTasks.push(t);
        atRiskTasks.push({
          task: t,
          reason: res.isOverdue
            ? 'Deadline has already passed.'
            : `Deficit of ${DateUtils.formatMinutes(res.deficitMinutes)}; forecast ${res.daysLate} day(s) late.`,
          severity: 'critical'
        });
      } else {
        // Fits, but check slack
        const totalAvailBefore = res.allocatedMinutes + res.slackMinutesBeforeDeadline;
        const slackRatio = totalAvailBefore > 0 ? res.slackMinutesBeforeDeadline / totalAvailBefore : 0;
        if (slackRatio < 0.20 && res.allocatedMinutes > 60) {
          atRiskTasks.push({
            task: t,
            reason: `Tight schedule: only ${DateUtils.formatMinutes(res.slackMinutesBeforeDeadline)} unused slack before deadline.`,
            severity: 'warning'
          });
        }
      }
    });

    // Overall Status Determination
    let overallStatus = STATUS.ON_TRACK;
    let statusExplanation = '';

    if (activeTasks.length === 0) {
      overallStatus = STATUS.ON_TRACK;
      statusExplanation = completedTasks.length > 0
        ? 'All scheduled tasks have been completed. Great job staying on top of your deadlines!'
        : 'No tasks scheduled yet. Add tasks or load demo data to check your schedule feasibility.';
    } else if (hasOverdue) {
      overallStatus = STATUS.OVERDUE;
      const overdueTitles = overdueTasks.slice(0, 2).map(t => `"${t.title}"`).join(', ');
      statusExplanation = `You have ${overdueTasks.length} overdue task(s) (${overdueTitles}) that missed their deadline. Reschedule or complete them immediately.`;
    } else if (deficitTasks.length > 0) {
      overallStatus = STATUS.OVERLOADED;
      const worstDeficit = deficitTasks[0];
      const res = taskResults[worstDeficit.id];
      const deadLabel = DateUtils.formatDisplayDate(worstDeficit.deadlineDate);
      const defHours = Math.round((res.deficitMinutes / 60) * 10) / 10;
      statusExplanation = `You have ${DateUtils.formatHours(totalRemainingHours)} of unfinished work, but available capacity is short by ${DateUtils.formatHours(defHours)} before ${deadLabel}. Adjust deadlines or increase daily hours.`;
    } else if (atRiskTasks.length > 0) {
      overallStatus = STATUS.AT_RISK;
      statusExplanation = `${atRiskTasks.length} task(s) have very slim buffer time. A single unexpected interruption could trigger late submissions.`;
    } else {
      // Check overall slack in planning window
      const windowNetMins = usableMinutesInPlanningWindow - totalRemainingMinutes;
      if (windowNetMins < 120 && totalRemainingMinutes > 180) { // less than 2 hours cushion
        overallStatus = STATUS.TIGHT;
        statusExplanation = `Your schedule is tight. Total workload (${DateUtils.formatHours(totalRemainingHours)}) fits, but leaves only ${DateUtils.formatMinutes(windowNetMins)} of spare time across the planning window.`;
      } else {
        overallStatus = STATUS.ON_TRACK;
        statusExplanation = `Your workload of ${DateUtils.formatHours(totalRemainingHours)} comfortably fits into your ${DateUtils.formatHours(usableMinutesInPlanningWindow / 60)} usable hours with healthy buffer.`;
      }
    }

    // Determine Estimated Overall Completion Forecast
    let overallForecastDate = null;
    let isFullyCompletableInHorizon = true;

    if (activeTasks.length > 0) {
      for (let i = calendarDates.length - 1; i >= 0; i--) {
        const dStr = calendarDates[i];
        if (calendar[dStr].scheduledMinutes > 0) {
          overallForecastDate = dStr;
          break;
        }
      }
      // Check if any task still has unallocated work
      const unallocatedTotal = Object.values(taskResults).reduce((sum, r) => sum + r.unallocatedMinutes, 0);
      if (unallocatedTotal > 0) {
        isFullyCompletableInHorizon = false;
      }
    }

    // Pick "What Should I Work On Next?"
    const nextTaskRecommendation = pickNextTaskToWorkOn(activeTasks, taskResults, planningDate, calendar);

    return {
      planningDate,
      overallStatus,
      statusDetails: STATUS_DETAILS[overallStatus],
      statusExplanation,
      totalRemainingMinutes,
      totalRemainingHours,
      totalEstimatedMinutes,
      completedMinutes,
      progressPercent,
      activeCount: activeTasks.length,
      completedCount: completedTasks.length,
      overdueCount: overdueTasks.length,
      atRiskCount: atRiskTasks.length,
      nextUpcomingDeadline,
      usableMinutesBeforeNextDeadline,
      usableMinutesInPlanningWindow,
      usableHoursInPlanningWindow: usableMinutesInPlanningWindow / 60,
      overallForecastDate,
      isFullyCompletableInHorizon,
      calendar,
      calendarDates,
      taskResults,
      overloadedDays,
      deadlineAnalysis,
      atRiskTasks,
      nextTaskRecommendation
    };
  }

  /**
   * Deterministically select the single best task to work on right now.
   */
  function pickNextTaskToWorkOn(activeTasks, taskResults, planningDate, calendar) {
    if (!activeTasks || activeTasks.length === 0) return null;

    // 1. If overdue tasks exist, pick the highest priority overdue task
    const overdue = activeTasks.filter(t => DateUtils.daysBetween(planningDate, t.deadlineDate) < 0);
    if (overdue.length > 0) {
      const sortedOverdue = sortTasksForScheduling(overdue, planningDate);
      const chosen = sortedOverdue[0];
      const diff = Math.abs(DateUtils.daysBetween(planningDate, chosen.deadlineDate));
      return {
        task: chosen,
        reason: `Overdue by ${diff} day(s). Immediate priority to clear past-due deliverables before starting new work.`,
        urgency: 'critical',
        allocatedTodayMinutes: calendar[planningDate]
          ? (calendar[planningDate].assignedTasks.find(a => a.taskId === chosen.id)?.minutes || 0)
          : 0
      };
    }

    // 2. Check tasks assigned work on today's calendar
    const todayAssigned = (calendar[planningDate]?.assignedTasks || [])
      .map(a => activeTasks.find(t => t.id === a.taskId))
      .filter(Boolean);

    if (todayAssigned.length > 0) {
      const sorted = sortTasksForScheduling(todayAssigned, planningDate);
      const chosen = sorted[0];
      const res = taskResults[chosen.id];
      const dayDiff = DateUtils.daysBetween(planningDate, chosen.deadlineDate);
      const deadlineText = dayDiff === 0 ? 'today' : (dayDiff === 1 ? 'tomorrow' : `in ${dayDiff} days`);

      let reasonText = `Due ${deadlineText} (${DateUtils.formatDisplayDate(chosen.deadlineDate)}). Scheduled for active progress today.`;
      if (res && !res.fitsOnTime) {
        reasonText = `Critical deadline risk: Currently facing a deficit. Needs immediate focused attention to avoid missing deadline.`;
      }

      return {
        task: chosen,
        reason: reasonText,
        urgency: chosen.priority === 'urgent' || dayDiff <= 1 ? 'high' : 'normal',
        allocatedTodayMinutes: calendar[planningDate]?.assignedTasks.find(a => a.taskId === chosen.id)?.minutes || 0
      };
    }

    // 3. Fallback to earliest deadline active task
    const fallbackSorted = sortTasksForScheduling(activeTasks, planningDate);
    const chosen = fallbackSorted[0];
    const dayDiff = DateUtils.daysBetween(planningDate, chosen.deadlineDate);

    return {
      task: chosen,
      reason: `Earliest upcoming deadline (${DateUtils.formatDisplayDate(chosen.deadlineDate)}). Start early to build schedule slack.`,
      urgency: 'normal',
      allocatedTodayMinutes: 0
    };
  }

  return {
    STATUS,
    STATUS_DETAILS,
    buildDailyCalendar,
    sortTasksForScheduling,
    analyzeSchedule,
    pickNextTaskToWorkOn
  };
});
