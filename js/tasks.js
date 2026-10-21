/**
 * Deadline Reality Check - Task Management
 * Task model, validation, filtering, sorting, and state transitions.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    const DateUtils = require('./date-utils.js');
    module.exports = factory(DateUtils);
  } else {
    root.DRC = root.DRC || {};
    root.DRC.Tasks = factory(root.DRC.DateUtils);
  }
})(typeof self !== 'undefined' ? self : this, function (DateUtils) {
  'use strict';

  const PRIORITIES = {
    urgent: { id: 'urgent', label: 'Urgent', rank: 4, badgeClass: 'badge-urgent' },
    high: { id: 'high', label: 'High', rank: 3, badgeClass: 'badge-high' },
    medium: { id: 'medium', label: 'Medium', rank: 2, badgeClass: 'badge-medium' },
    low: { id: 'low', label: 'Low', rank: 1, badgeClass: 'badge-low' }
  };

  const CATEGORIES = {
    assignment: { id: 'assignment', label: 'Assignment', icon: '📝' },
    exam: { id: 'exam', label: 'Exam Prep', icon: '🎯' },
    project: { id: 'project', label: 'Project', icon: '🚀' },
    personal: { id: 'personal', label: 'Personal', icon: '🌱' },
    other: { id: 'other', label: 'Other', icon: '📌' }
  };

  const IMPORTANCE = {
    mandatory: { id: 'mandatory', label: 'Strict / Mandatory', weight: 3 },
    important: { id: 'important', label: 'Important', weight: 2 },
    flexible: { id: 'flexible', label: 'Flexible / Stretch', weight: 1 }
  };

  function generateId() {
    return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }

  /**
   * Validate raw task input before creation or update.
   */
  function validateTaskInput(input, todayStr = DateUtils.getTodayString()) {
    const errors = [];
    const warnings = [];

    // Title validation
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) {
      errors.push('Task title cannot be empty.');
    } else if (title.length > 200) {
      errors.push('Task title cannot exceed 200 characters.');
    }

    // Effort validation: accept minutes or hours
    let estimatedMinutes = 0;
    if (input.estimatedMinutes != null) {
      estimatedMinutes = Number(input.estimatedMinutes);
    } else if (input.estimatedHours != null) {
      estimatedMinutes = Math.round(Number(input.estimatedHours) * 60);
    }

    if (isNaN(estimatedMinutes) || estimatedMinutes <= 0) {
      errors.push('Estimated effort must be greater than zero.');
    } else if (estimatedMinutes > 14400) { // > 240 hours
      warnings.push('Task estimate is over 240 hours. Consider breaking it down into smaller milestones.');
    }

    // Remaining minutes validation
    let remainingMinutes = estimatedMinutes;
    if (input.remainingMinutes != null) {
      const rm = Number(input.remainingMinutes);
      if (isNaN(rm) || rm < 0) {
        errors.push('Remaining effort cannot be negative.');
      } else {
        remainingMinutes = rm;
      }
    }

    // Deadline validation
    const deadlineDate = typeof input.deadlineDate === 'string' ? input.deadlineDate.trim() : '';
    if (!deadlineDate) {
      errors.push('Deadline date is required.');
    } else {
      const parsed = DateUtils.parseLocalDate(deadlineDate);
      if (!parsed) {
        errors.push('Deadline date format must be YYYY-MM-DD and a valid calendar day.');
      } else if (DateUtils.daysBetween(todayStr, deadlineDate) < 0) {
        warnings.push('Deadline date is already in the past.');
      }
    }

    // Time validation (optional)
    let deadlineTime = '';
    if (input.deadlineTime) {
      const timeStr = String(input.deadlineTime).trim();
      const timeParts = timeStr.split(':');
      if (timeParts.length === 2) {
        const h = parseInt(timeParts[0], 10);
        const m = parseInt(timeParts[1], 10);
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
          deadlineTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        } else {
          warnings.push('Deadline time is invalid; default 23:59 will be assumed.');
        }
      }
    }

    // Priority
    const priority = input.priority && PRIORITIES[input.priority] ? input.priority : 'medium';

    // Category
    const category = input.category && CATEGORIES[input.category] ? input.category : 'assignment';

    // Importance
    const importance = input.importance && IMPORTANCE[input.importance] ? input.importance : 'important';

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: {
        title,
        description: typeof input.description === 'string' ? input.description.trim() : '',
        estimatedMinutes: Math.round(estimatedMinutes),
        remainingMinutes: Math.round(remainingMinutes),
        deadlineDate,
        deadlineTime,
        priority,
        category,
        importance,
        notes: typeof input.notes === 'string' ? input.notes.trim() : ''
      }
    };
  }

  /**
   * Factory function to create a new Task object.
   */
  function createTask(input, todayStr = DateUtils.getTodayString()) {
    const val = validateTaskInput(input, todayStr);
    if (!val.isValid) {
      throw new Error('Validation failed: ' + val.errors.join(', '));
    }
    const nowIso = new Date().toISOString();
    return {
      id: input.id || generateId(),
      title: val.sanitized.title,
      description: val.sanitized.description,
      estimatedMinutes: val.sanitized.estimatedMinutes,
      remainingMinutes: val.sanitized.remainingMinutes,
      deadlineDate: val.sanitized.deadlineDate,
      deadlineTime: val.sanitized.deadlineTime,
      priority: val.sanitized.priority,
      category: val.sanitized.category,
      importance: val.sanitized.importance,
      notes: val.sanitized.notes,
      completed: Boolean(input.completed),
      completedAt: input.completed ? (input.completedAt || nowIso) : null,
      createdAt: input.createdAt || nowIso,
      updatedAt: nowIso
    };
  }

  /**
   * Update an existing task.
   */
  function updateTask(task, updates, todayStr = DateUtils.getTodayString()) {
    const merged = { ...task, ...updates };
    const val = validateTaskInput(merged, todayStr);
    if (!val.isValid) {
      return { success: false, errors: val.errors, warnings: val.warnings };
    }
    const updated = {
      ...task,
      ...val.sanitized,
      completed: Boolean(updates.completed !== undefined ? updates.completed : task.completed),
      completedAt: updates.completed !== undefined
        ? (updates.completed ? (task.completedAt || new Date().toISOString()) : null)
        : task.completedAt,
      updatedAt: new Date().toISOString()
    };
    return { success: true, task: updated, warnings: val.warnings };
  }

  /**
   * Toggle completion state of a task.
   * Completing sets remainingMinutes to 0 and records completedAt.
   * Reopening restores remainingMinutes (to estimatedMinutes if remaining was 0).
   */
  function toggleTaskCompletion(task) {
    const now = new Date().toISOString();
    if (!task.completed) {
      return {
        ...task,
        completed: true,
        completedAt: now,
        remainingMinutes: 0,
        updatedAt: now
      };
    } else {
      return {
        ...task,
        completed: false,
        completedAt: null,
        remainingMinutes: task.remainingMinutes > 0 ? task.remainingMinutes : task.estimatedMinutes,
        updatedAt: now
      };
    }
  }

  /**
   * Sort tasks by deadline, priority rank (descending), and creation date.
   */
  function sortTasks(tasks, sortBy = 'deadline') {
    return [...tasks].sort((a, b) => {
      // Completed tasks always sink to bottom if mixed
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      if (sortBy === 'deadline') {
        const diff = a.deadlineDate.localeCompare(b.deadlineDate);
        if (diff !== 0) return diff;
        // Tie-breaker: deadline time
        const timeA = a.deadlineTime || '23:59';
        const timeB = b.deadlineTime || '23:59';
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        // Tie-breaker: priority
        const rankDiff = PRIORITIES[b.priority].rank - PRIORITIES[a.priority].rank;
        if (rankDiff !== 0) return rankDiff;
        return a.title.localeCompare(b.title);
      }

      if (sortBy === 'priority') {
        const rankDiff = PRIORITIES[b.priority].rank - PRIORITIES[a.priority].rank;
        if (rankDiff !== 0) return rankDiff;
        return a.deadlineDate.localeCompare(b.deadlineDate);
      }

      if (sortBy === 'duration') {
        return b.remainingMinutes - a.remainingMinutes;
      }

      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }

  /**
   * Filter tasks by query criteria.
   */
  function filterTasks(tasks, criteria = {}) {
    return tasks.filter(task => {
      if (criteria.status === 'active' && task.completed) return false;
      if (criteria.status === 'completed' && !task.completed) return false;
      if (criteria.priority && criteria.priority !== 'all' && task.priority !== criteria.priority) return false;
      if (criteria.category && criteria.category !== 'all' && task.category !== criteria.category) return false;
      if (criteria.search) {
        const q = criteria.search.toLowerCase().trim();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = (task.description || '').toLowerCase().includes(q);
        const matchNotes = (task.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchNotes) return false;
      }
      return true;
    });
  }

  return {
    PRIORITIES,
    CATEGORIES,
    IMPORTANCE,
    generateId,
    validateTaskInput,
    createTask,
    updateTask,
    toggleTaskCompletion,
    sortTasks,
    filterTasks
  };
});
