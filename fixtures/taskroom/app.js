// Taskroom fixture: deterministic seeded task list with a working filter.
// Demo data only. No network, no timers, no randomness, no persistence.
"use strict";

const SEED_TASKS = [
  {"id": "t1", "title": "Write release notes", "completed": true},
  {"id": "t2", "title": "Review onboarding checklist", "completed": false},
  {"id": "t3", "title": "Fix login page spacing", "completed": true},
  {"id": "t4", "title": "Update dependency lockfile", "completed": false},
  {"id": "t5", "title": "Record demo footage", "completed": false},
  {"id": "t6", "title": "Add filter tests", "completed": true},
  {"id": "t7", "title": "Prepare sprint summary", "completed": false},
  {"id": "t8", "title": "Archive old tickets", "completed": false}
];

const FILTERS = {
  all: (task) => true,
  active: (task) => !task.completed,
  completed: (task) => task.completed
};

function countLabel(filter, count) {
  const noun = count === 1 ? "task" : "tasks";
  if (filter === "completed") return count + " completed " + noun;
  if (filter === "active") return count + " active " + noun;
  return count + " " + noun + " in total";
}

function render(filter) {
  const list = document.querySelector('[data-testid="task-list"]');
  const countEl = document.querySelector('[data-testid="task-count"]');
  const visible = SEED_TASKS.filter(FILTERS[filter]);

  list.textContent = "";
  for (const task of visible) {
    const item = document.createElement("li");
    item.className = "task" + (task.completed ? " is-completed" : "");
    item.setAttribute("data-testid", "task-item");
    item.setAttribute("data-task-id", task.id);
    item.setAttribute("data-completed", String(task.completed));

    const mark = document.createElement("span");
    mark.className = "mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = task.completed ? "\u2713" : "";

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = task.title;

    item.appendChild(mark);
    item.appendChild(title);
    list.appendChild(item);
  }

  countEl.textContent = countLabel(filter, visible.length);

  for (const button of document.querySelectorAll(".filter")) {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  document.body.setAttribute("data-filter", filter);
}

function init() {
  for (const button of document.querySelectorAll(".filter")) {
    button.addEventListener("click", () => render(button.dataset.filter));
  }
  render("all");
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SEED_TASKS, FILTERS, countLabel };
}
