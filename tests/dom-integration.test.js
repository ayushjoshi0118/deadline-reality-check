const { suite, test, expect } = require('./test-helper.js');
const fs = require('fs');
const path = require('path');

suite('DOM & Markup Verification', () => {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  test('index.html exists and is well-formed HTML5', () => {
    expect(htmlContent.includes('<!DOCTYPE html>')).toBe(true);
    expect(htmlContent.includes('lang="en"')).toBe(true);
    expect(htmlContent.includes('<title>Deadline Reality Check')).toBe(true);
  });

  test('index.html contains all critical interactive element IDs', () => {
    const requiredIds = [
      'header-today-date',
      'open-data-modal-btn',
      'open-settings-btn',
      'theme-toggle-btn',
      'theme-toggle-icon',
      'notice-banner-container',
      'metrics-grid',
      'reality-check-hero',
      'focus-card-container',
      'recommendations-container',
      'planning-container',
      'task-list-container',
      'add-task-btn',
      'task-search-input',
      'task-status-filter',
      'task-category-filter',
      'task-priority-filter',
      'task-sort-filter',
      'task-modal',
      'task-form',
      'settings-modal',
      'settings-form',
      'data-modal',
      'confirm-modal'
    ];

    requiredIds.forEach(id => {
      const hasId = htmlContent.includes(`id="${id}"`);
      expect(hasId).toBe(true);
    });
  });

  test('All required script files are referenced in index.html in correct dependency order', () => {
    const expectedScripts = [
      'js/date-utils.js',
      'js/tasks.js',
      'js/storage.js',
      'js/scheduler.js',
      'js/recommendations.js',
      'js/ui.js',
      'js/app.js'
    ];

    let lastIndex = -1;
    expectedScripts.forEach(src => {
      const idx = htmlContent.indexOf(`src="${src}"`);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    });
  });

  test('CSS stylesheet is linked', () => {
    expect(htmlContent.includes('href="css/styles.css"')).toBe(true);
  });
});
