# Deadline Reality Check

> **"Your ambition has a schedule. Does it fit?"**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests: 47 Passing](https://img.shields.io/badge/Tests-47%20passing-brightgreen.svg)](tests/)
[![Vanilla JavaScript](https://img.shields.io/badge/Stack-Vanilla%20JS%20%7C%20HTML5%20%7C%20CSS3-orange.svg)](js/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg)](#tech-stack)

**Deadline Reality Check** is a client-side web application designed to solve a fundamental planning dilemma: **people routinely construct schedules based on what they want to accomplish rather than the actual hours they have available.**

Instead of acting as a passive to-do list, Deadline Reality Check functions as a **deterministic scheduling engine**. You input your deliverables, deadlines, estimated effort, and realistic daily availability. The application then calculates capacity feasibility, detects overloaded bottleneck days before they become crises, and generates concrete, actionable rescheduling suggestions.

---

## The Problem

Traditional calendar and task management tools are unopinionated: they let you schedule 14 hours of work into a 3-hour evening without a single warning. As a consequence:
1. Students and knowledge workers overcommit based on wishful thinking.
2. The cumulative deficit remains invisible until 24–48 hours before high-stakes deadlines.
3. Overloaded planners experience burnout, guilt, and emergency all-nighters.

Deadline Reality Check replaces wishful planning with **mathematical reality**, delivering practical, honest feedback without shaming the user.

---

## Key Features

- **Deterministic Scheduling Engine**: Simulates day-by-day effort allocation against usable hours (with automatic buffer subtraction for breaks and interruptions).
- **Signature Reality Check Panel**: Classifies schedules into five distinct, calculated states:
  - `On Track`: Workload comfortably fits within available capacity with ample buffer.
  - `Tight`: The workload fits, but schedule slack is minimal; any delay will cascade.
  - `At Risk`: Upcoming deadlines show high vulnerability or severe day bottlenecks.
  - `Overloaded`: Workload strictly exceeds usable hours before deadlines.
  - `Overdue`: Deliverables that missed their deadline date and demand immediate attention.
- **Dynamic Plain-Language Diagnoses**: Transparent explanations calculated directly from user data (e.g., *"You have 11.5 hours of unfinished work, but only 7.0 usable hours before Friday. Your current plan is short by 4.5 hours."*).
- **Actionable Rescheduling Recommendations**: Proposes concrete changes that the user can accept or dismiss with one click:
  - *Alternative A*: Adjust workload or availability (e.g., postpone a flexible task, time-box/trim scope, add targeted hours on specific low-availability days).
  - *Alternative B*: Move flexible deadlines to their realistic forecast completion dates.
  - *Granularity*: Split large (>3.5h) tasks into manageable sessions.
- **"What Should I Work on Next?" Selector**: Deterministically prioritizes the single best next action based on urgency, deadline crunch, and today's schedule allocation, accompanied by an explicit rationale.
- **Dual Planning Views**:
  - **7-Day Overview**: Visual CSS progress bars displaying scheduled effort vs. usable capacity for each day, identifying overloaded days at a glance.
  - **Daily Detail View**: Step-by-step breakdown of gross hours, buffer reserved, and specific tasks allocated to each calendar day.
- **Comprehensive Task Management**: Full CRUD support, priority levels (Urgent, High, Medium, Low), categories (Assignment, Exam Prep, Project, Personal, Other), deadline date/time, and flexibility levels (Mandatory, Important, Flexible).
- **Configurable Daily Availability & Buffer**:
  - Independent hours for each day of the week (Monday through Sunday).
  - Configurable daily buffer percentage (e.g., 15–20% deducted for interruptions and rest).
  - Daily maximum hour cap to prevent implausible burnout schedules.
- **Privacy & Offline First**: 100% client-side persistence via `localStorage`. No accounts, no cookies, no third-party APIs, and zero tracking. Full JSON backup export and validated import.
- **Calm, Modern Aesthetic**: Accessible color contrast, responsive layout, subtle typography, and instant Light/Dark mode toggle.

---

## Visual Preview & Interface

```
+------------------------------------------------------------------------------------+
| [⏱️] Deadline Reality Check           Today, Oct 21, 2026   [💾 Data] [⚙️ Hours] [🌙] |
+------------------------------------------------------------------------------------+
|  REMAINING WORKLOAD  |  USABLE CAPACITY  |    REALITY CHECK   |  OVERALL PROGRESS  |
|       14.5h          |       16.2h       |     ⚠️ Tight       |        42%         |
|   4 active tasks     |   Next 7 days     |   Slim buffer (1h) |  3 of 7 completed  |
+------------------------------------------------------------------------------------+
|  REALITY CHECK ASSESSMENT: [⚠️ Tight Schedule]                                     |
|  "Your workload of 14.5h fits into your 16.2h usable capacity, but leaves only     |
|   1.7 hours of buffer across the week. Any interruption may cause late work."      |
|  --------------------------------------------------------------------------------  |
|  Next Deadline: Tomorrow (CS Lab)  | Margin: +1h 42m  | Forecast Finish: Oct 26    |
|  [========================================================-------------] 89% Cap  |
+------------------------------------------------------------------------------------+
|  NEXT PRIORITY ACTION                      |  ACTIONABLE RESCHEDULING SUGGESTIONS  |
|  🎯 CS Lab 4 (3h remaining)                |  💡 Add +1.5h on Thursday             |
|  Due tomorrow at 5:00 PM.                  |     Saves 1.5h before Friday exam.    |
|  Why: Earliest deadline, books today's cap |     [Accept Suggestion]  [Dismiss]    |
+------------------------------------------------------------------------------------+
|  7-DAY WORKLOAD & CAPACITY TIMELINE                                                |
|  [Mon: 2h/2.5h] [Tue: 3h/3h !] [Wed: 1.5h/2h] [Thu: 2h/2h] [Fri: 3h/3h] ...       |
+------------------------------------------------------------------------------------+
|  TASKS & DELIVERABLES                                             [+ Add New Task] |
|  [Search / Filters: All | Active | Urgent | Assignments]                          |
|  [ ] CS Lab 4 ............ Due Tomorrow 5:00 PM ..... 3h rem ..... [Fits on time]  |
|  [ ] Midterm Prep ........ Due Friday 2:00 PM ....... 4h rem ..... [Deficit: 1.5h] |
+------------------------------------------------------------------------------------+
```

---

## How the Scheduling Algorithm Works

The core engine is located in [`js/scheduler.js`](js/scheduler.js). It runs deterministically using local calendar dates without timezone skew.

### Step 1: Daily Usable Capacity Calculation
For each date $d$ in the planning window:
$$\text{Gross Hours}_d = \min(\text{WeeklyHours}(\text{DayOfWeek}_d), \text{DailyMaxHours})$$
$$\text{Buffer Minutes}_d = \text{round}\left(\text{Gross Minutes}_d \times \frac{\text{BufferPercent}}{100}\right)$$
$$\text{Usable Minutes}_d = \max(0, \text{Gross Minutes}_d - \text{Buffer Minutes}_d)$$

### Step 2: Deterministic Task Sorting
Active tasks are prioritized in the following order:
1. **Overdue tasks** ($T_{\text{deadline}} < \text{PlanningDate}$) sorted first.
2. **Earliest Deadline First (EDF)**: Tasks with earlier deadline dates take precedence.
3. **Deadline Time**: Earlier submission time breaks ties.
4. **Priority Rank**: Urgent ($4$) > High ($3$) > Medium ($2$) > Low ($1$).
5. **Flexibility Weight**: Mandatory ($3$) > Important ($2$) > Flexible ($1$).
6. **Shortest Processing Time (SPT)**: Shorter remaining durations break ties.
7. **Task Title**: Lexicographical tie-breaker for deterministic stability.

### Step 3: Forward Capacity Simulation
For each task $T$ with remaining effort $R$:
- The algorithm searches forward through calendar days from the planning date up to $T_{\text{deadline}}$.
- For each day with unused usable capacity $C_{\text{remaining}}$, it allocates $\min(R, C_{\text{remaining}})$.
- If $R$ reaches $0$ on or before $T_{\text{deadline}}$, $T$ is marked **On Time**, and the remaining unused capacity before the deadline constitutes **Schedule Slack**.
- If $R > 0$ after reaching $T_{\text{deadline}}$, the remaining effort is marked as a **Deficit**. The engine continues simulating into subsequent days to determine the task's **Projected Completion Date** and exact days late.

### Step 4: Feasibility and Status Classification
- **`Overdue`**: At least one active task has passed its deadline date.
- **`Overloaded`**: One or more tasks experience a capacity deficit before their deadlines.
- **`At Risk`**: No deficit, but one or more tasks have $<20\%$ slack margin or rely on bottleneck days.
- **`Tight`**: The schedule fits, but spare capacity across the entire planning window is $<2$ hours.
- **`On Track`**: All tasks fit comfortably with ample buffer.

---

## Algorithm Assumptions & Limitations

1. **Greedy Earliest-Deadline Allocation**: The scheduler uses an Earliest Deadline First (EDF) heuristic. While optimal for single-resource scheduling under preemptive conditions, it may not find the global theoretical optimum in non-preemptive setups with arbitrary precedence constraints.
2. **Task Preemption**: The simulation allows dividing a multi-hour task across consecutive days (e.g., working 2 hours on Wednesday and 1 hour on Thursday for a 3-hour project).
3. **No External Calendar Sync**: The engine does not inspect Google Calendar or Outlook directly; non-academic commitments are accounted for by setting realistic daily availability in the settings.
4. **Deterministic Local Time**: Date arithmetic relies on local calendar days (`YYYY-MM-DD`), preventing timezone shifts and daylight-saving drift.

---

## Tech Stack

- **HTML5**: Semantic elements (`<header>`, `<main>`, `<section>`, `<dialog>`, semantic forms).
- **CSS3**: Modern CSS variables, responsive CSS Grid / Flexbox, accessible color contrast, light/dark themes.
- **Vanilla JavaScript (ES6+)**: Clean modular design without build tools or external npm dependencies.
- **Storage**: Native `window.localStorage` with in-memory fallback for private browsing modes.
- **Testing**: Zero-dependency automated test suite runnable via Node.js (`node tests/run-tests.js`).

---

## Project Structure

```
deadline-reality-check/
├── index.html                  # Main application interface and modal structures
├── css/
│   └── styles.css              # Design system, themes, cards, bars, responsive rules
├── js/
│   ├── app.js                  # Main controller, state management, event orchestration
│   ├── date-utils.js           # Date arithmetic, formatting, daylight-saving safe utils
│   ├── tasks.js                # Task model, validation, filtering, sorting
│   ├── scheduler.js            # Deterministic scheduling engine & capacity simulation
│   ├── recommendations.js      # Rescheduling suggestion generator and applier
│   ├── storage.js              # LocalStorage persistence, backup export/import, demo seed
│   └── ui.js                   # Safe DOM rendering, meters, modals, toast alerts
├── tests/
│   ├── test-helper.js          # Lightweight test runner and assertion library
│   ├── date-utils.test.js      # Unit tests for date arithmetic and formatting
│   ├── tasks.test.js           # Unit tests for task validation, state transitions
│   ├── scheduler.test.js       # Unit tests for capacity, overloads, and slack
│   ├── recommendations.test.js # Unit tests for rescheduling suggestions
│   ├── storage.test.js         # Unit tests for persistence, import/export validation
│   ├── edge-cases.test.js      # Edge cases (zero availability, past due, extreme hours)
│   ├── dom-integration.test.js # Integration test verifying DOM markup and script hooks
│   └── run-tests.js            # Main test execution entry point
├── assets/
│   └── icons/
│       └── icon.svg            # Application vector badge icon
├── .gitignore                  # Git ignore rules for node, editors, and OS files
├── LICENSE                     # MIT License
└── README.md                   # Documentation and user guide
```

---

## How to Run Locally

### Option 1: Direct File Opening (No Server Required)
Simply double-click `index.html` or open it directly in any modern browser:
```bash
# On Windows:
start index.html

# On macOS:
open index.html

# On Linux:
xdg-open index.html
```

### Option 2: Using a Lightweight Local Development Server
If you prefer running through an HTTP server:
```bash
# Using Python 3:
python -m http.server 8000

# Using Node.js (npx):
npx serve .
```
Then navigate to `http://localhost:8000` in your browser.

---

## Running the Automated Test Suite

The project includes an automated test suite containing **47 unit and integration tests** covering core scheduling logic, date arithmetic, edge cases, and storage validation.

To run the test suite:
```bash
node tests/run-tests.js
```

### Expected Output:
```text
====================================================
  Deadline Reality Check - Test Suite Execution
====================================================

[SUITE] DateUtils Unit Tests
  ✔ parseLocalDate correctly parses YYYY-MM-DD without timezone drift
  ✔ parseLocalDate rejects invalid dates like Feb 30
  ✔ formatLocalDate outputs exact YYYY-MM-DD
  ✔ addDays adds calendar days properly
  ✔ daysBetween calculates positive, zero, and negative differences
  ✔ getDayKey maps dates to mon, tue, wed, etc.
  ✔ formatMinutes handles zero, minutes only, and hours+minutes
  ✔ formatTime formats 24hr to 12hr AM/PM

[SUITE] Tasks Management Unit Tests
  ✔ validateTaskInput rejects empty title
  ✔ validateTaskInput rejects non-positive effort
  ✔ validateTaskInput warns about past deadlines without failing validation
  ✔ createTask creates valid task object with sensible defaults
  ✔ toggleTaskCompletion toggles completed status and restores/clears remaining minutes
  ✔ updateTask updates estimate and checks validation
  ✔ sortTasks sorts by deadline, priority, and completed state

[SUITE] Deterministic Scheduler Engine Unit Tests
  ✔ A task that fits comfortably before its deadline reports On Track
  ✔ A task that cannot fit before its deadline reports Overloaded with accurate deficit
  ✔ Multiple tasks sharing one deadline are consistently scheduled
  ✔ A task due today fits if effort <= today available capacity
  ✔ An overdue unfinished task reports Overdue status
  ✔ A completed task does not count toward remaining workload
  ✔ A day with zero availability (e.g. Sunday) receives zero scheduled minutes
  ✔ A schedule with a configured daily buffer reduces usable capacity
  ✔ Scheduler produces identical, deterministic results for identical inputs

[SUITE] Recommendations Engine Unit Tests
  ✔ Generates recommendations when schedule is overloaded
  ✔ Accepting an extend_deadline recommendation updates the task deadline
  ✔ Rejecting/dismissing a recommendation leaves task data unmodified
  ✔ Accepting an increase_availability recommendation updates weekly settings
  ✔ Splitting a large task creates two balanced subtasks

[SUITE] Storage and Serialization Unit Tests
  ✔ loadSettings returns default settings if empty
  ✔ saveSettings and loadSettings roundtrip correctly
  ✔ saveTasks and loadTasks persist and validate objects
  ✔ exportData produces valid formatted JSON string
  ✔ importData handles malformed JSON string safely
  ✔ importData rejects payload without tasks array
  ✔ importData sanitizes and validates valid JSON backup

[SUITE] Edge Cases & Resiliency Tests
  ✔ Task due today with zero availability today reports Overloaded immediately
  ✔ All tasks completed reports On Track with congratulatory explanation
  ✔ No tasks in system reports On Track with guidance explanation
  ✔ Zero availability across the entire week reports infeasible forecast
  ✔ Extreme estimate (>240 hours) triggers validation warning but does not crash
  ✔ Reopening an overdue completed task correctly restores deficit and overdue status
  ✔ Importing JSON with XSS attempt preserves text safely as string without execution

[SUITE] DOM & Markup Verification
  ✔ index.html exists and is well-formed HTML5
  ✔ index.html contains all critical interactive element IDs
  ✔ All required script files are referenced in index.html in correct dependency order
  ✔ CSS stylesheet is linked

====================================================
  Test Summary
====================================================
  Passed: 47
  Failed: 0

✔ ALL TESTS PASSED SUCCESSFULLY!
```

---

## Example Scenarios

### Scenario 1: The Midterms Overload
- **User Availability**: Monday: 2.5h, Tuesday: 3h, Wednesday: 1.5h, Thursday: 2.5h, Friday: 3h.
- **Tasks**:
  1. CS Lab 4: 3h due Thursday 5:00 PM (Urgent).
  2. Microeconomics Reading: 2h due Thursday 11:59 PM (High).
  3. History Term Paper: 5h due Friday 2:00 PM (Urgent).
  4. Statistics Midterm Prep: 4h due Friday 5:00 PM (Urgent).
- **Reality Check**: Total work due before Friday is 14.0h. Total usable capacity (with 15% buffer) is only 8.1h.
- **System Diagnosis**: **Overloaded (Deficit of 5.9h)**.
- **Recommendations**:
  - *Alternative A*: Increase Thursday availability by +2h and trim optional reading.
  - *Alternative B*: Postpone History Paper draft to Saturday morning if professor allows extensions.

### Scenario 2: The Healthy Sprint
- **User Availability**: 3h daily across the week.
- **Tasks**: Two assignments (1.5h each) due in 3 days.
- **Reality Check**: **On Track**. Usable capacity (7.6h) comfortably exceeds demand (3.0h) with 4.6h of free slack.

---

## Privacy Statement

Deadline Reality Check is designed with a strict **Local-First Privacy Architecture**:
- All tasks, notes, and availability settings remain exclusively in your browser's `localStorage`.
- No analytics trackers, cookies, or remote logging.
- No network requests are made during normal operation.
- Works 100% offline.

---

## Known Limitations

- **Single User / Local Browser Scope**: Because data is stored in browser `localStorage`, tasks do not automatically sync across different browsers or devices without exporting/importing a JSON backup.
- **Sub-Day Granularity**: Work is allocated in minutes per calendar day; it does not assign specific clock-hour slots (e.g., 2:00 PM–3:30 PM) like a calendar block scheduler.

---

## Future Roadmap

- [ ] Export schedule to `.ics` format for import into Google Calendar or Apple Calendar.
- [ ] Drag-and-drop manual task reordering for fine-tuned priority overrides.
- [ ] Recurring availability schedules (e.g. Week A / Week B university timetable alternation).
- [ ] Pomodoro session timer directly inside the "What to work on next" card.

---

## Contributing

Contributions, bug reports, and suggestions are welcome!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Ensure all tests pass (`node tests/run-tests.js`).
4. Commit your changes (`git commit -m 'Add amazing feature'`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
