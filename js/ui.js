/**
 * Deadline Reality Check - UI Rendering & View Components
 * Safe DOM rendering (textContent), responsive layouts, visual progress bars,
 * modals, and interactive widgets.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const DateUtils = require('./date-utils.js');
    const Tasks = require('./tasks.js');
    const Scheduler = require('./scheduler.js');
    module.exports = factory(DateUtils, Tasks, Scheduler);
  } else {
    root.DRC = root.DRC || {};
    root.DRC.UI = factory(root.DRC.DateUtils, root.DRC.Tasks, root.DRC.Scheduler);
  }
})(typeof self !== 'undefined' ? self : this, function (DateUtils, Tasks, Scheduler) {
  'use strict';

  // Helper for safe element creation
  function el(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') {
        element.className = val;
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, val);
      } else if (key === 'onclick' && typeof val === 'function') {
        element.addEventListener('click', val);
      } else {
        element.setAttribute(key, val);
      }
    }
    if (typeof children === 'string' || typeof children === 'number') {
      element.textContent = String(children);
    } else if (Array.isArray(children)) {
      children.forEach(child => {
        if (!child) return;
        if (typeof child === 'string' || typeof child === 'number') {
          element.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof Node) {
          element.appendChild(child);
        }
      });
    }
    return element;
  }

  /**
   * Render Top Metric Summary Cards
   */
  function renderMetricsGrid(container, schedule) {
    container.innerHTML = '';

    const remainingHours = Math.round((schedule.totalRemainingMinutes / 60) * 10) / 10;
    const usableHours = Math.round((schedule.usableHoursInPlanningWindow) * 10) / 10;

    // Remaining Workload Card
    const workCard = el('div', { className: 'metric-card' }, [
      el('div', { className: 'metric-header' }, [
        el('span', { className: 'metric-title' }, 'Remaining Workload'),
        el('span', { className: 'metric-icon' }, '⏱️')
      ]),
      el('div', { className: 'metric-value' }, DateUtils.formatHours(remainingHours)),
      el('div', { className: 'metric-subtitle' }, `${schedule.activeCount} active task(s) to finish`)
    ]);

    // Available Usable Capacity Card
    const capCard = el('div', { className: 'metric-card' }, [
      el('div', { className: 'metric-header' }, [
        el('span', { className: 'metric-title' }, 'Usable Work Capacity'),
        el('span', { className: 'metric-icon' }, '⚡')
      ]),
      el('div', { className: 'metric-value' }, DateUtils.formatHours(usableHours)),
      el('div', { className: 'metric-subtitle' }, `Next ${Math.max(7, Math.round(schedule.usableMinutesInPlanningWindow / 180))} days (buffer deducted)`)
    ]);

    // Schedule Reality State Card
    const statusCard = el('div', { className: `metric-card ${schedule.statusDetails.badgeClass}` }, [
      el('div', { className: 'metric-header' }, [
        el('span', { className: 'metric-title' }, 'Reality Check'),
        el('span', { className: 'metric-icon' }, schedule.statusDetails.icon)
      ]),
      el('div', { className: 'metric-value' }, schedule.statusDetails.label),
      el('div', { className: 'metric-subtitle' },
        schedule.overdueCount > 0
          ? `${schedule.overdueCount} task(s) overdue`
          : (schedule.atRiskCount > 0 ? `${schedule.atRiskCount} task(s) at risk` : 'Schedule is feasible')
      )
    ]);

    // Completion Progress Card
    const progCard = el('div', { className: 'metric-card' }, [
      el('div', { className: 'metric-header' }, [
        el('span', { className: 'metric-title' }, 'Overall Progress'),
        el('span', { className: 'metric-icon' }, '🎯')
      ]),
      el('div', { className: 'metric-value' }, `${schedule.progressPercent}%`),
      el('div', { className: 'metric-subtitle' }, `${schedule.completedCount} completed of ${schedule.activeCount + schedule.completedCount} total`)
    ]);

    container.appendChild(workCard);
    container.appendChild(capCard);
    container.appendChild(statusCard);
    container.appendChild(progCard);
  }

  /**
   * Render the Signature Reality Check Hero Panel
   */
  function renderRealityCheckHero(container, schedule) {
    container.innerHTML = '';
    container.className = `reality-check-hero ${schedule.statusDetails.badgeClass}`;

    // Top row
    const topRow = el('div', { className: 'hero-top-row' }, [
      el('div', { className: 'hero-title-group' }, [
        el('h2', {}, 'Reality Check Assessment'),
        el('span', { className: `status-pill ${schedule.statusDetails.badgeClass}` }, [
          schedule.statusDetails.icon + ' ' + schedule.statusDetails.label
        ])
      ])
    ]);

    // Plain language explanation
    const explanation = el('div', { className: 'hero-explanation' }, schedule.statusExplanation);

    // Calculated Stats Row
    const nextDeadLabel = schedule.nextUpcomingDeadline
      ? DateUtils.getRelativeDateLabel(schedule.nextUpcomingDeadline, schedule.planningDate)
      : 'None scheduled';

    const finishForecastLabel = schedule.overallForecastDate
      ? DateUtils.formatDisplayDate(schedule.overallForecastDate, true)
      : (schedule.activeCount === 0 ? 'All finished!' : 'Infeasible under current hours');

    // Slack vs Deficit calculation in planning window
    const windowNetMinutes = schedule.usableMinutesInPlanningWindow - schedule.totalRemainingMinutes;
    const isWindowDeficit = windowNetMinutes < 0;
    const netLabel = isWindowDeficit
      ? `-${DateUtils.formatMinutes(Math.abs(windowNetMinutes))} (Deficit)`
      : `+${DateUtils.formatMinutes(windowNetMinutes)} (Free Slack)`;

    const statsRow = el('div', { className: 'hero-stats-row' }, [
      el('div', { className: 'hero-stat-item' }, [
        el('div', { className: 'hero-stat-label' }, 'Next Deadline'),
        el('div', { className: 'hero-stat-value' }, nextDeadLabel),
        el('div', { className: 'hero-stat-note' }, schedule.nextUpcomingDeadline ? DateUtils.formatDisplayDate(schedule.nextUpcomingDeadline) : '-')
      ]),
      el('div', { className: 'hero-stat-item' }, [
        el('div', { className: 'hero-stat-label' }, 'Schedule Margin'),
        el('div', {
          className: 'hero-stat-value',
          style: isWindowDeficit ? 'color: var(--status-overloaded-accent);' : 'color: var(--status-on-track-accent);'
        }, netLabel),
        el('div', { className: 'hero-stat-note' }, isWindowDeficit ? 'Hours short before deadlines' : 'Cushion for delays')
      ]),
      el('div', { className: 'hero-stat-item' }, [
        el('div', { className: 'hero-stat-label' }, 'Realistic Finish Date'),
        el('div', { className: 'hero-stat-value' }, finishForecastLabel),
        el('div', { className: 'hero-stat-note' }, 'Based on your daily hours')
      ]),
      el('div', { className: 'hero-stat-item' }, [
        el('div', { className: 'hero-stat-label' }, 'Vulnerable Deadlines'),
        el('div', { className: 'hero-stat-value' }, `${schedule.atRiskCount} at-risk`),
        el('div', { className: 'hero-stat-note' }, `${schedule.overdueCount} already overdue`)
      ])
    ]);

    // Capacity Gauge Bar
    const totalAvail = Math.max(1, schedule.usableMinutesInPlanningWindow);
    const capacityRatio = Math.min(1.5, schedule.totalRemainingMinutes / totalAvail);
    const gaugePercent = Math.min(100, Math.round(capacityRatio * 100));

    let fillClass = 'fill-healthy';
    if (capacityRatio > 1.0) fillClass = 'fill-overloaded';
    else if (capacityRatio > 0.8) fillClass = 'fill-tight';

    const gaugeWrapper = el('div', { className: 'capacity-gauge-wrapper' }, [
      el('div', { className: 'gauge-label-row' }, [
        el('span', {}, `Planning Window Capacity Utilization: ${gaugePercent}%`),
        el('span', {}, `${DateUtils.formatMinutes(schedule.totalRemainingMinutes)} booked of ${DateUtils.formatMinutes(schedule.usableMinutesInPlanningWindow)} usable`)
      ]),
      el('div', { className: 'gauge-bar-track' }, [
        el('div', {
          className: `gauge-bar-fill ${fillClass}`,
          style: `width: ${gaugePercent}%;`
        })
      ])
    ]);

    container.appendChild(topRow);
    container.appendChild(explanation);
    container.appendChild(statsRow);
    container.appendChild(gaugeWrapper);
  }

  /**
   * Render "What Should I Work On Next?" Focus Card
   */
  function renderFocusCard(container, recommendation, onComplete, onEdit) {
    container.innerHTML = '';

    const header = el('div', { className: 'focus-card-header' }, [
      el('h3', {}, [
        el('span', {}, '🎯 Next Priority Action')
      ]),
      recommendation ? el('span', { className: `badge ${Tasks.PRIORITIES[recommendation.task.priority].badgeClass}` },
        Tasks.PRIORITIES[recommendation.task.priority].label) : null
    ]);

    if (!recommendation) {
      const emptyBox = el('div', { className: 'empty-state', style: 'padding: 1.5rem;' }, [
        el('div', { className: 'empty-icon' }, '🎉'),
        el('div', { className: 'empty-title' }, 'No active tasks!'),
        el('div', { className: 'empty-desc' }, 'You have cleared all scheduled deliverables or have not added tasks yet.')
      ]);
      container.appendChild(header);
      container.appendChild(emptyBox);
      return;
    }

    const { task, reason, allocatedTodayMinutes } = recommendation;
    const cat = Tasks.CATEGORIES[task.category] || Tasks.CATEGORIES.assignment;

    const content = el('div', { className: 'focus-task-content' }, [
      el('div', { className: 'focus-task-title' }, `${cat.icon} ${task.title}`),
      el('div', { className: 'focus-task-meta' }, [
        el('span', { className: 'badge badge-category' }, cat.label),
        el('span', { className: 'badge badge-deadline' }, `Due: ${DateUtils.formatDisplayDate(task.deadlineDate)}${task.deadlineTime ? ' ' + DateUtils.formatTime(task.deadlineTime) : ''}`),
        el('span', { className: 'task-effort-pill' }, `${DateUtils.formatMinutes(task.remainingMinutes)} remaining`),
        allocatedTodayMinutes > 0 ? el('span', { className: 'badge badge-feasibility feasible' }, `${DateUtils.formatMinutes(allocatedTodayMinutes)} allocated today`) : null
      ]),
      el('div', { className: 'focus-reason-box' }, [
        el('strong', {}, 'Why this now: '),
        reason
      ])
    ]);

    const actions = el('div', { className: 'focus-actions' }, [
      el('button', {
        className: 'btn btn-primary',
        onclick: () => onComplete(task.id)
      }, '✓ Mark as Finished'),
      el('button', {
        className: 'btn btn-secondary',
        onclick: () => onEdit(task.id)
      }, '✎ Edit Task')
    ]);

    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(actions);
  }

  /**
   * Render Recommendations Panel
   */
  function renderRecommendations(container, recs, onAccept, onDismiss) {
    container.innerHTML = '';

    const header = el('div', { className: 'recommendations-header' }, [
      el('h3', {}, [
        el('span', {}, '💡 Actionable Rescheduling Suggestions'),
        recs.length > 0 ? el('span', { className: 'badge badge-urgent' }, `${recs.length} suggestions`) : null
      ])
    ]);

    if (recs.length === 0) {
      const allGood = el('div', { className: 'empty-state', style: 'padding: 1.5rem;' }, [
        el('div', { className: 'empty-icon' }, '✨'),
        el('div', { className: 'empty-title' }, 'No adjustments required'),
        el('div', { className: 'empty-desc' }, 'Your current schedule has sufficient capacity to handle upcoming deadlines comfortably.')
      ]);
      container.appendChild(header);
      container.appendChild(allGood);
      return;
    }

    const list = el('div', { className: 'recs-list' });

    recs.forEach(rec => {
      let badgeLabel = 'Alternative A (Adjust Workload)';
      let badgeClass = 'alt-a';
      if (rec.category === 'alternative_b') {
        badgeLabel = 'Alternative B (Move Deadline)';
        badgeClass = 'alt-b';
      } else if (rec.category === 'deadline') {
        badgeLabel = 'Overdue Fix';
        badgeClass = 'alt-b';
      } else if (rec.category === 'structuring') {
        badgeLabel = 'Granularity';
        badgeClass = 'alt-a';
      }

      const item = el('div', { className: 'rec-item' }, [
        el('div', { className: 'rec-item-header' }, [
          el('div', { className: 'rec-item-title' }, rec.title),
          el('span', { className: `rec-badge ${badgeClass}` }, badgeLabel)
        ]),
        el('div', { className: 'rec-item-summary' }, rec.summary),
        el('div', { className: 'rec-item-why' }, [
          el('strong', {}, 'Why: '),
          rec.why
        ]),
        el('div', { className: 'rec-item-impact' }, `⚡ Impact: ${rec.impact}`),
        el('div', { className: 'rec-item-actions' }, [
          el('button', {
            className: 'btn btn-primary btn-sm',
            onclick: () => onAccept(rec)
          }, 'Accept Suggestion'),
          el('button', {
            className: 'btn btn-outline btn-sm',
            onclick: () => onDismiss(rec.id)
          }, 'Dismiss')
        ])
      ]);

      list.appendChild(item);
    });

    container.appendChild(header);
    container.appendChild(list);
  }

  /**
   * Render Planning Views (Weekly vs Daily)
   */
  function renderPlanningSection(container, schedule, activeView = 'weekly', selectedDayStr = null, onSelectDay, onToggleView) {
    container.innerHTML = '';

    const header = el('div', { className: 'planning-header' }, [
      el('div', { className: 'planning-title-group' }, [
        el('h3', {}, 'Workload & Capacity Timeline'),
        el('p', {}, 'Visualized daily capacity vs scheduled effort (buffer accounted for)')
      ]),
      el('div', { className: 'view-tabs' }, [
        el('button', {
          className: `tab-btn ${activeView === 'weekly' ? 'active' : ''}`,
          onclick: () => onToggleView('weekly')
        }, '7-Day View'),
        el('button', {
          className: `tab-btn ${activeView === 'daily' ? 'active' : ''}`,
          onclick: () => onToggleView('daily')
        }, 'Daily Detail View')
      ])
    ]);

    container.appendChild(header);

    if (activeView === 'weekly') {
      renderWeeklyGrid(container, schedule, onSelectDay);
    } else {
      renderDailyDetail(container, schedule, selectedDayStr || schedule.planningDate, onSelectDay);
    }
  }

  function renderWeeklyGrid(container, schedule, onSelectDay) {
    const grid = el('div', { className: 'weekly-grid' });
    const dates = schedule.calendarDates.slice(0, 7);

    dates.forEach(dStr => {
      const day = schedule.calendar[dStr];
      const isToday = day.isToday;
      const parsedDate = DateUtils.parseLocalDate(dStr);
      const isOverloaded = day.scheduledMinutes > day.usableMinutes;

      const fillPercent = day.usableMinutes > 0
        ? Math.min(100, Math.round((day.scheduledMinutes / day.usableMinutes) * 100))
        : (day.scheduledMinutes > 0 ? 100 : 0);

      const col = el('div', {
        className: `day-column ${isToday ? 'is-today' : ''}`,
        onclick: () => onSelectDay(dStr)
      }, [
        el('div', { className: 'day-header' }, [
          el('span', { className: 'day-header-name' }, day.dayName),
          el('span', { className: 'day-header-date' }, `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}`)
        ]),
        el('div', { className: 'day-capacity-info' }, [
          el('div', { className: 'day-hours-text' }, [
            el('span', {}, `${DateUtils.formatMinutes(day.scheduledMinutes)} sched`),
            el('span', {}, `${DateUtils.formatMinutes(day.usableMinutes)} usable`)
          ]),
          el('div', { className: 'day-progress-bar' }, [
            el('div', {
              className: `day-progress-fill ${isOverloaded ? 'overload' : ''}`,
              style: `width: ${fillPercent}%;`
            })
          ])
        ]),
        el('div', { className: 'day-tasks-mini' },
          day.assignedTasks.length > 0
            ? day.assignedTasks.map(a => el('div', {
              className: `day-task-chip ${!a.isOnTime ? 'spillover' : ''}`
            }, [
              el('span', { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, a.title),
              el('span', { className: 'day-task-chip-duration' }, DateUtils.formatMinutes(a.minutes))
            ]))
            : [el('div', { style: 'font-size: 0.72rem; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 1rem;' },
                day.isNonWorkingDay ? 'Off Day' : 'Free Capacity')]
        )
      ]);

      grid.appendChild(col);
    });

    container.appendChild(grid);
  }

  function renderDailyDetail(container, schedule, selectedDateStr, onSelectDay) {
    const day = schedule.calendar[selectedDateStr] || schedule.calendar[schedule.planningDate];
    if (!day) return;

    const wrapper = el('div', { className: 'daily-view-container' });

    // Date selector row
    const prevDate = DateUtils.addDays(day.dateStr, -1);
    const nextDate = DateUtils.addDays(day.dateStr, 1);

    const selectorRow = el('div', { className: 'daily-selector-row' }, [
      el('button', {
        className: 'btn btn-secondary btn-sm',
        disabled: !schedule.calendar[prevDate],
        onclick: () => onSelectDay(prevDate)
      }, '◀ Previous Day'),
      el('div', { style: 'font-weight: 700; text-align: center;' }, [
        el('div', { style: 'font-size: 1.05rem;' }, `${day.dayName}, ${DateUtils.formatDisplayDate(day.dateStr)}`),
        day.isToday ? el('span', { className: 'badge badge-urgent' }, 'Today') : null
      ]),
      el('button', {
        className: 'btn btn-secondary btn-sm',
        disabled: !schedule.calendar[nextDate],
        onclick: () => onSelectDay(nextDate)
      }, 'Next Day ▶')
    ]);

    // Detail Breakdown
    const isExhausted = day.usableMinutes > 0 && day.scheduledMinutes >= day.usableMinutes;
    const remainingDaySlack = Math.max(0, day.usableMinutes - day.scheduledMinutes);

    const detailCard = el('div', { className: 'daily-detail-card' }, [
      el('div', { style: 'display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem;' }, [
        el('div', {}, [
          el('div', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, 'Day Capacity Profile'),
          el('div', { style: 'font-size: 1.25rem; font-weight: 700;' }, `${DateUtils.formatHours(day.usableHours)} Usable Time`),
          el('div', { style: 'font-size: 0.78rem; color: var(--text-secondary);' },
            `Gross: ${DateUtils.formatHours(day.grossHours)} | Buffer: ${DateUtils.formatMinutes(day.bufferMinutes)} reserved`)
        ]),
        el('div', { style: 'text-align: right;' }, [
          el('div', { style: 'font-size: 0.8rem; color: var(--text-muted);' }, 'Scheduled Workload'),
          el('div', { style: 'font-size: 1.25rem; font-weight: 700;' }, DateUtils.formatMinutes(day.scheduledMinutes)),
          el('div', { style: 'font-size: 0.78rem; color: var(--text-secondary);' },
            remainingDaySlack > 0 ? `${DateUtils.formatMinutes(remainingDaySlack)} free spare time` : 'Capacity fully utilized')
        ])
      ]),
      el('div', { style: 'margin-top: 0.5rem;' }, [
        el('div', { style: 'font-weight: 600; font-size: 0.88rem; margin-bottom: 0.5rem;' }, 'Allocated Task Work for this Day:'),
        el('div', { className: 'daily-schedule-list' },
          day.assignedTasks.length > 0
            ? day.assignedTasks.map(t => el('div', {
              style: 'display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--bg-surface-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);'
            }, [
              el('div', {}, [
                el('div', { style: 'font-weight: 600; font-size: 0.9rem;' }, t.title),
                el('div', { style: 'font-size: 0.75rem; color: var(--text-muted);' },
                  t.isOnTime ? '✓ On-time scheduled progress' : '⚠️ Late work spillover')
              ]),
              el('span', { className: 'task-effort-pill' }, DateUtils.formatMinutes(t.minutes))
            ]))
            : [el('div', { style: 'color: var(--text-muted); font-style: italic; padding: 0.5rem 0;' }, 'No tasks allocated on this date.')]
        )
      ])
    ]);

    wrapper.appendChild(selectorRow);
    wrapper.appendChild(detailCard);
    container.appendChild(wrapper);
  }

  /**
   * Render Tasks List Table / Cards
   */
  function renderTaskList(container, tasks, schedule, filters, callbacks) {
    container.innerHTML = '';

    const { onToggle, onEdit, onDelete } = callbacks;
    const filtered = Tasks.filterTasks(tasks, filters);
    const sorted = Tasks.sortTasks(filtered, filters.sort || 'deadline');

    if (sorted.length === 0) {
      const empty = el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-icon' }, '📋'),
        el('div', { className: 'empty-title' }, tasks.length === 0 ? 'No tasks created yet' : 'No tasks match current filters'),
        el('div', { className: 'empty-desc' },
          tasks.length === 0
            ? 'Add your assignments, exam reviews, and projects to see whether your workload fits.'
            : 'Try adjusting your search query, priority, or category filters.'),
        tasks.length === 0
          ? el('div', { className: 'empty-actions' }, [
              el('button', {
                className: 'btn btn-primary',
                onclick: callbacks.onAddNew
              }, '+ Add Your First Task'),
              el('button', {
                className: 'btn btn-secondary',
                onclick: callbacks.onLoadDemo
              }, 'Load Demo Scenario')
            ])
          : null
      ]);
      container.appendChild(empty);
      return;
    }

    const list = el('div', { className: 'task-list' });

    sorted.forEach(task => {
      const res = schedule.taskResults ? schedule.taskResults[task.id] : null;
      const isPast = DateUtils.isPast(task.deadlineDate, schedule.planningDate);
      const cat = Tasks.CATEGORIES[task.category] || Tasks.CATEGORIES.assignment;
      const prio = Tasks.PRIORITIES[task.priority] || Tasks.PRIORITIES.medium;

      // Feasibility badge
      let feasBadge = null;
      if (!task.completed && res) {
        if (res.isOverdue) {
          feasBadge = el('span', { className: 'badge badge-feasibility deficit' }, '⚠️ Overdue');
        } else if (!res.fitsOnTime) {
          feasBadge = el('span', { className: 'badge badge-feasibility deficit' }, `Deficit: ${DateUtils.formatMinutes(res.deficitMinutes)}`);
        } else if (res.slackMinutesBeforeDeadline < 60) {
          feasBadge = el('span', { className: 'badge badge-feasibility tight' }, `Slack: ${DateUtils.formatMinutes(res.slackMinutesBeforeDeadline)}`);
        } else {
          feasBadge = el('span', { className: 'badge badge-feasibility feasible' }, 'Fits on time');
        }
      }

      const card = el('div', { className: `task-card ${task.completed ? 'is-completed' : ''}` }, [
        el('div', { className: 'task-card-left' }, [
          el('button', {
            className: `task-checkbox-btn ${task.completed ? 'checked' : ''}`,
            title: task.completed ? 'Reopen task' : 'Mark task complete',
            onclick: () => onToggle(task.id)
          }, task.completed ? '✓' : ''),
          el('div', { className: 'task-card-details' }, [
            el('div', { className: 'task-card-title' }, task.title),
            task.description ? el('div', { className: 'task-card-desc' }, task.description) : null,
            el('div', { className: 'task-card-tags' }, [
              el('span', { className: `badge ${prio.badgeClass}` }, prio.label),
              el('span', { className: 'badge badge-category' }, `${cat.icon} ${cat.label}`),
              el('span', { className: `badge badge-deadline ${isPast && !task.completed ? 'past' : ''}` },
                `📅 ${DateUtils.getRelativeDateLabel(task.deadlineDate, schedule.planningDate)}${task.deadlineTime ? ' @ ' + DateUtils.formatTime(task.deadlineTime) : ''}`
              ),
              feasBadge
            ])
          ])
        ]),
        el('div', { className: 'task-card-right' }, [
          el('span', { className: 'task-effort-pill' },
            task.completed
              ? `Done (${DateUtils.formatMinutes(task.estimatedMinutes)})`
              : `${DateUtils.formatMinutes(task.remainingMinutes)} / ${DateUtils.formatMinutes(task.estimatedMinutes)}`
          ),
          el('button', {
            className: 'btn btn-outline btn-icon',
            title: 'Edit Task',
            onclick: () => onEdit(task.id)
          }, '✎'),
          el('button', {
            className: 'btn btn-outline btn-icon',
            title: 'Delete Task',
            onclick: () => onDelete(task.id)
          }, '🗑')
        ])
      ]);

      list.appendChild(card);
    });

    container.appendChild(list);
  }

  /**
   * Toast Notification Controller
   */
  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = el('div', { id: 'toast-container', className: 'toast-container' });
      document.body.appendChild(container);
    }

    const toast = el('div', { className: `toast toast-${type}` }, [
      el('span', {}, type === 'success' ? '✓' : (type === 'error' ? '✘' : 'ℹ')),
      el('span', {}, message)
    ]);

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  return {
    el,
    renderMetricsGrid,
    renderRealityCheckHero,
    renderFocusCard,
    renderRecommendations,
    renderPlanningSection,
    renderTaskList,
    showToast
  };
});
