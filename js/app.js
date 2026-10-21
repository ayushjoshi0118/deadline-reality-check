/**
 * Deadline Reality Check - Main Application Controller
 * Orchestrates storage, tasks, scheduling analysis, recommendations,
 * and user interactions.
 */
(function (root) {
  'use strict';

  const DRC = root.DRC || {};
  const DateUtils = DRC.DateUtils;
  const Tasks = DRC.Tasks;
  const Scheduler = DRC.Scheduler;
  const Recommendations = DRC.Recommendations;
  const Storage = DRC.Storage;
  const UI = DRC.UI;

  // Application State
  const state = {
    tasks: [],
    settings: {},
    theme: 'light',
    schedule: null,
    recommendations: [],
    dismissedRecIds: new Set(),
    planningView: 'weekly',
    selectedDayStr: null,
    editingTaskId: null,
    pendingDeleteTaskId: null,
    isDemoActive: false,
    filters: {
      status: 'all',
      priority: 'all',
      category: 'all',
      search: '',
      sort: 'deadline'
    }
  };

  /**
   * Initialize the application
   */
  function init() {
    // 1. Load theme
    state.theme = Storage.loadTheme();
    applyTheme(state.theme);

    // 2. Load settings and tasks
    state.settings = Storage.loadSettings();
    state.tasks = Storage.loadTasks();

    // 3. Setup event listeners
    bindEvents();

    // 4. Update Header Date
    const todayStr = DateUtils.getTodayString();
    const headerDateEl = document.getElementById('header-today-date');
    if (headerDateEl) {
      headerDateEl.textContent = DateUtils.formatDisplayDate(todayStr, true);
    }

    // 5. Run initial schedule calculation and render
    recalculateAndRender();
  }

  /**
   * Core reactive calculation loop: updates schedule, recommendations, and UI
   */
  function recalculateAndRender() {
    const todayStr = DateUtils.getTodayString();

    // Deterministic scheduling engine analysis
    state.schedule = Scheduler.analyzeSchedule(state.tasks, state.settings, todayStr);

    // Generate actionable recommendations
    const allRecs = Recommendations.generateRecommendations(state.schedule, state.tasks, state.settings);
    // Filter out user-dismissed recommendations
    state.recommendations = allRecs.filter(r => !state.dismissedRecIds.has(r.id));

    // Save tasks to storage
    Storage.saveTasks(state.tasks);

    // Render all components
    renderAll();
  }

  /**
   * Render all UI sections
   */
  function renderAll() {
    // 1. Notice / Welcome Banner
    renderNoticeBanner();

    // 2. Top Metrics Grid
    const metricsGrid = document.getElementById('metrics-grid');
    if (metricsGrid) {
      UI.renderMetricsGrid(metricsGrid, state.schedule);
    }

    // 3. Reality Check Hero Card
    const heroCard = document.getElementById('reality-check-hero');
    if (heroCard) {
      UI.renderRealityCheckHero(heroCard, state.schedule);
    }

    // 4. Focus Card ("What to work on next")
    const focusContainer = document.getElementById('focus-card-container');
    if (focusContainer) {
      UI.renderFocusCard(
        focusContainer,
        state.schedule.nextTaskRecommendation,
        handleToggleComplete,
        openEditTaskModal
      );
    }

    // 5. Recommendations Panel
    const recsContainer = document.getElementById('recommendations-container');
    if (recsContainer) {
      UI.renderRecommendations(
        recsContainer,
        state.recommendations,
        handleAcceptRecommendation,
        handleDismissRecommendation
      );
    }

    // 6. Planning Timeline Section
    const planningContainer = document.getElementById('planning-container');
    if (planningContainer) {
      UI.renderPlanningSection(
        planningContainer,
        state.schedule,
        state.planningView,
        state.selectedDayStr,
        handleSelectDay,
        handleTogglePlanningView
      );
    }

    // 7. Task Management List
    const taskListContainer = document.getElementById('task-list-container');
    if (taskListContainer) {
      UI.renderTaskList(
        taskListContainer,
        state.tasks,
        state.schedule,
        state.filters,
        {
          onToggle: handleToggleComplete,
          onEdit: openEditTaskModal,
          onDelete: confirmDeleteTask,
          onAddNew: () => openTaskModal(),
          onLoadDemo: loadDemoData
        }
      );
    }
  }

  /**
   * Render Notice Banner (Demo Data notice or Empty Onboarding notice)
   */
  function renderNoticeBanner() {
    const bannerContainer = document.getElementById('notice-banner-container');
    if (!bannerContainer) return;

    bannerContainer.innerHTML = '';

    if (state.isDemoActive) {
      const banner = UI.el('div', { className: 'notice-banner' }, [
        UI.el('p', {}, [
          UI.el('strong', {}, 'Previewing Demo Scenario: '),
          'Showing an authentic college midterms workload with realistic daily capacity limits and overload alerts.'
        ]),
        UI.el('div', { className: 'notice-actions' }, [
          UI.el('button', {
            className: 'btn btn-secondary btn-sm',
            onclick: clearDemoData
          }, 'Clear Demo Data')
        ])
      ]);
      bannerContainer.appendChild(banner);
    }
  }

  /**
   * Event Binding
   */
  function bindEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }

    // Settings open/close
    const settingsBtn = document.getElementById('open-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', openSettingsModal);
    }

    const closeSettingsBtn = document.getElementById('close-settings-btn');
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', closeSettingsModal);
    }

    const saveSettingsForm = document.getElementById('settings-form');
    if (saveSettingsForm) {
      saveSettingsForm.addEventListener('submit', handleSaveSettings);
    }

    // Add Task modal
    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => openTaskModal());
    }

    const closeTaskModalBtn = document.getElementById('close-task-modal-btn');
    if (closeTaskModalBtn) {
      closeTaskModalBtn.addEventListener('click', closeTaskModal);
    }

    const taskForm = document.getElementById('task-form');
    if (taskForm) {
      taskForm.addEventListener('submit', handleSaveTask);
    }

    // Backup & Restore
    const openDataModalBtn = document.getElementById('open-data-modal-btn');
    if (openDataModalBtn) {
      openDataModalBtn.addEventListener('click', openDataModal);
    }

    const closeDataModalBtn = document.getElementById('close-data-modal-btn');
    if (closeDataModalBtn) {
      closeDataModalBtn.addEventListener('click', closeDataModal);
    }

    const exportBtn = document.getElementById('export-json-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', handleExportJSON);
    }

    const importFileInput = document.getElementById('import-file-input');
    if (importFileInput) {
      importFileInput.addEventListener('change', handleImportFile);
    }

    const resetAllBtn = document.getElementById('reset-all-data-btn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', handleResetAllData);
    }

    // Confirmation Modal
    const cancelConfirmBtn = document.getElementById('confirm-modal-cancel');
    if (cancelConfirmBtn) {
      cancelConfirmBtn.addEventListener('click', closeConfirmModal);
    }

    // Toolbar filters
    const searchInput = document.getElementById('task-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        recalculateAndRender();
      });
    }

    const statusFilter = document.getElementById('task-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        state.filters.status = e.target.value;
        recalculateAndRender();
      });
    }

    const categoryFilter = document.getElementById('task-category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        recalculateAndRender();
      });
    }

    const priorityFilter = document.getElementById('task-priority-filter');
    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        state.filters.priority = e.target.value;
        recalculateAndRender();
      });
    }

    const sortFilter = document.getElementById('task-sort-filter');
    if (sortFilter) {
      sortFilter.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        recalculateAndRender();
      });
    }

    // Keyboard ESC to close any open modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    });

    // Close modal on background click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeAllModals();
        }
      });
    });
  }

  /**
   * Theme Management
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    Storage.saveTheme(state.theme);
    applyTheme(state.theme);
  }

  /**
   * Task Actions
   */
  function handleToggleComplete(taskId) {
    const idx = state.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;

    state.tasks[idx] = Tasks.toggleTaskCompletion(state.tasks[idx]);
    const isCompletedNow = state.tasks[idx].completed;

    UI.showToast(
      isCompletedNow ? 'Task marked as completed! 🎉' : 'Task reopened.',
      'success'
    );
    recalculateAndRender();
  }

  function openTaskModal(taskId = null) {
    state.editingTaskId = taskId;
    const modal = document.getElementById('task-modal');
    const titleEl = document.getElementById('task-modal-title');
    const form = document.getElementById('task-form');
    const errorBox = document.getElementById('task-form-errors');

    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }

    if (taskId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;
      titleEl.textContent = 'Edit Task';
      form.title.value = task.title;
      form.description.value = task.description || '';
      form.estimatedHours.value = (task.estimatedMinutes / 60).toFixed(1);
      form.remainingHours.value = (task.remainingMinutes / 60).toFixed(1);
      form.deadlineDate.value = task.deadlineDate;
      form.deadlineTime.value = task.deadlineTime || '';
      form.priority.value = task.priority;
      form.category.value = task.category;
      form.importance.value = task.importance || 'important';
      form.notes.value = task.notes || '';
    } else {
      titleEl.textContent = 'Add New Task';
      form.reset();
      // Set sensible defaults: deadline tomorrow
      form.deadlineDate.value = DateUtils.addDays(DateUtils.getTodayString(), 1);
      form.estimatedHours.value = '2.0';
      form.remainingHours.value = '2.0';
      form.priority.value = 'medium';
      form.category.value = 'assignment';
      form.importance.value = 'important';
    }

    modal.classList.add('active');
    form.title.focus();
  }

  function openEditTaskModal(taskId) {
    openTaskModal(taskId);
  }

  function closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('active');
    state.editingTaskId = null;
  }

  function handleSaveTask(e) {
    e.preventDefault();
    const form = e.target;
    const errorBox = document.getElementById('task-form-errors');

    const inputData = {
      title: form.title.value,
      description: form.description.value,
      estimatedHours: parseFloat(form.estimatedHours.value) || 0,
      remainingHours: parseFloat(form.remainingHours.value) || 0,
      deadlineDate: form.deadlineDate.value,
      deadlineTime: form.deadlineTime.value,
      priority: form.priority.value,
      category: form.category.value,
      importance: form.importance.value,
      notes: form.notes.value
    };

    const todayStr = DateUtils.getTodayString();
    const validation = Tasks.validateTaskInput(inputData, todayStr);

    if (!validation.isValid) {
      if (errorBox) {
        errorBox.textContent = validation.errors.join(' ');
        errorBox.style.display = 'block';
      }
      return;
    }

    if (state.editingTaskId) {
      const res = Tasks.updateTask(
        state.tasks.find(t => t.id === state.editingTaskId),
        validation.sanitized,
        todayStr
      );
      if (res.success) {
        const idx = state.tasks.findIndex(t => t.id === state.editingTaskId);
        state.tasks[idx] = res.task;
        UI.showToast(`Updated "${res.task.title}".`, 'success');
      }
    } else {
      const newTask = Tasks.createTask(validation.sanitized, todayStr);
      state.tasks.push(newTask);
      UI.showToast(`Added "${newTask.title}".`, 'success');
    }

    closeTaskModal();
    recalculateAndRender();
  }

  function confirmDeleteTask(taskId) {
    state.pendingDeleteTaskId = taskId;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    openConfirmModal(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"? This cannot be undone.`,
      () => {
        state.tasks = state.tasks.filter(t => t.id === taskId);
        UI.showToast(`Deleted "${task.title}".`, 'info');
        recalculateAndRender();
      }
    );
  }

  /**
   * Generic Confirmation Modal
   */
  let pendingConfirmAction = null;

  function openConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    pendingConfirmAction = onConfirm;

    const confirmBtn = document.getElementById('confirm-modal-ok');
    confirmBtn.onclick = () => {
      if (pendingConfirmAction) pendingConfirmAction();
      closeConfirmModal();
    };

    modal.classList.add('active');
  }

  function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('active');
    pendingConfirmAction = null;
  }

  /**
   * Recommendations Handlers
   */
  function handleAcceptRecommendation(rec) {
    const result = Recommendations.applyRecommendation(rec, state.tasks, state.settings);
    if (result.success) {
      state.tasks = result.tasks;
      state.settings = result.settings;
      Storage.saveSettings(state.settings);
      state.dismissedRecIds.add(rec.id);
      UI.showToast(result.message || 'Recommendation accepted and applied.', 'success');
      recalculateAndRender();
    } else {
      UI.showToast(result.error || 'Failed to apply recommendation.', 'error');
    }
  }

  function handleDismissRecommendation(recId) {
    state.dismissedRecIds.add(recId);
    state.recommendations = state.recommendations.filter(r => r.id !== recId);
    UI.showToast('Recommendation dismissed.', 'info');
    recalculateAndRender();
  }

  /**
   * Planning View Handlers
   */
  function handleTogglePlanningView(view) {
    state.planningView = view;
    recalculateAndRender();
  }

  function handleSelectDay(dateStr) {
    state.selectedDayStr = dateStr;
    state.planningView = 'daily';
    recalculateAndRender();
  }

  /**
   * Settings Modal Handlers
   */
  function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const form = document.getElementById('settings-form');
    const weekly = state.settings.weeklyAvailability || {};

    DateUtils.DAY_KEYS.forEach(day => {
      if (form[day]) {
        form[day].value = weekly[day] != null ? weekly[day] : 0;
      }
    });

    form.dailyBufferPercent.value = state.settings.dailyBufferPercent || 15;
    document.getElementById('buffer-val-label').textContent = `${state.settings.dailyBufferPercent || 15}%`;

    form.dailyMaxHours.value = state.settings.dailyMaxHours || 8;

    modal.classList.add('active');
  }

  function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
  }

  function handleSaveSettings(e) {
    e.preventDefault();
    const form = e.target;
    const weekly = {};

    DateUtils.DAY_KEYS.forEach(day => {
      const val = parseFloat(form[day].value);
      weekly[day] = (!isNaN(val) && val >= 0) ? Math.min(24, Math.max(0, val)) : 0;
    });

    const buffer = parseInt(form.dailyBufferPercent.value, 10);
    const maxH = parseFloat(form.dailyMaxHours.value);

    state.settings = Storage.saveSettings({
      ...state.settings,
      weeklyAvailability: weekly,
      dailyBufferPercent: !isNaN(buffer) ? Math.min(60, Math.max(0, buffer)) : 15,
      dailyMaxHours: !isNaN(maxH) ? Math.min(24, Math.max(1, maxH)) : 8
    });

    closeSettingsModal();
    UI.showToast('Availability settings updated.', 'success');
    recalculateAndRender();
  }

  /**
   * Data Backup & Restore
   */
  function openDataModal() {
    document.getElementById('data-modal').classList.add('active');
  }

  function closeDataModal() {
    document.getElementById('data-modal').classList.remove('active');
  }

  function handleExportJSON() {
    const jsonStr = Storage.exportData(state.tasks, state.settings);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deadline-reality-check-${DateUtils.getTodayString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.showToast('Backup JSON exported successfully!', 'success');
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const content = evt.target.result;
      const res = Storage.importData(content);

      if (!res.success) {
        UI.showToast(res.error, 'error');
        return;
      }

      openConfirmModal(
        'Confirm Data Import',
        `Importing will replace your current ${state.tasks.length} task(s) with ${res.tasks.length} task(s) from the backup file. Proceed?`,
        () => {
          state.tasks = res.tasks;
          state.settings = Storage.saveSettings(res.settings);
          Storage.saveTasks(state.tasks);
          closeDataModal();
          UI.showToast(`Imported ${res.tasks.length} tasks successfully!`, 'success');
          recalculateAndRender();
        }
      );
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset input
  }

  function handleResetAllData() {
    openConfirmModal(
      'Reset All Data',
      'Are you sure you want to erase all tasks and reset availability settings to default? This cannot be undone.',
      () => {
        Storage.clearAllData();
        state.tasks = [];
        state.settings = Storage.loadSettings();
        state.isDemoActive = false;
        closeDataModal();
        UI.showToast('All data has been reset.', 'info');
        recalculateAndRender();
      }
    );
  }

  /**
   * Demo Data
   */
  function loadDemoData() {
    const demo = Storage.generateDemoTasks(DateUtils.getTodayString());
    state.tasks = demo;
    state.isDemoActive = true;
    UI.showToast('Demo scenario loaded! Explore the Reality Check dashboard.', 'success');
    recalculateAndRender();
  }

  function clearDemoData() {
    state.tasks = [];
    state.isDemoActive = false;
    UI.showToast('Demo data cleared.', 'info');
    recalculateAndRender();
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    state.editingTaskId = null;
    pendingConfirmAction = null;
  }

  // Self start on DOMContentLoaded
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  // Export for testing if needed
  root.DRC = DRC;
  DRC.App = {
    state,
    init,
    recalculateAndRender,
    handleAcceptRecommendation,
    handleDismissRecommendation,
    loadDemoData,
    clearDemoData
  };
})(typeof self !== 'undefined' ? self : this);
