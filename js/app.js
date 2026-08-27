/* ============================================================
   LIFE DASHBOARD — app.js
   Features:
     - Greeting with time & date
     - Custom name (Challenge)
     - Focus Timer with configurable Pomodoro length (Challenge)
     - To-Do List: add, edit, delete, mark done, LocalStorage,
       prevent duplicates (Challenge), sort
     - Quick Links: add, delete, LocalStorage
     - Light / Dark mode (Challenge)
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */

function $(id) { return document.getElementById(id); }

function loadLS(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch { return fallback; }
}

function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ─────────────────────────────────────────
   GREETING  (time, date, name)
───────────────────────────────────────── */

const greetingText = $('greeting-text');
const greetingName = $('greeting-name');
const timeDisplay  = $('current-time');
const dateDisplay  = $('current-date');
const nameInput    = $('name-input');
const saveNameBtn  = $('save-name-btn');

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function getGreeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function updateClock() {
  const now  = new Date();
  const h    = now.getHours();
  const m    = now.getMinutes().toString().padStart(2, '0');
  const s    = now.getSeconds().toString().padStart(2, '0');
  const hh   = now.getHours().toString().padStart(2, '0');

  timeDisplay.textContent = `${hh}:${m}:${s}`;
  dateDisplay.textContent =
    `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  greetingText.textContent = getGreeting(h) + '!';
}

function applyName() {
  const name = loadLS('userName', '');
  greetingName.textContent = name ? `Welcome back, ${name} 👋` : 'Welcome back';
  if (name) nameInput.value = name;
}

saveNameBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  saveLS('userName', name);
  applyName();
  nameInput.blur();
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveNameBtn.click();
});

applyName();
updateClock();
setInterval(updateClock, 1000);

/* ─────────────────────────────────────────
   FOCUS TIMER
───────────────────────────────────────── */

const timerDisplay = $('timer-display');
const startBtn     = $('timer-start');
const stopBtn      = $('timer-stop');
const resetBtn     = $('timer-reset');
const pomoInput    = $('pomo-minutes');
const applyPomoBtn = $('apply-pomo-btn');

let pomoMinutes   = loadLS('pomoMinutes', 25);
let totalSeconds  = pomoMinutes * 60;
let remainSeconds = totalSeconds;
let timerInterval = null;
let timerRunning  = false;

// Restore saved custom length in input
pomoInput.value = pomoMinutes;

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderTimer() {
  timerDisplay.textContent = formatTime(remainSeconds);

  timerDisplay.classList.remove('running', 'finished');
  if (timerRunning) {
    timerDisplay.classList.add('running');
  } else if (remainSeconds === 0) {
    timerDisplay.classList.add('finished');
  }
}

function tick() {
  if (remainSeconds <= 0) {
    clearInterval(timerInterval);
    timerRunning = false;
    timerDisplay.classList.remove('running');
    timerDisplay.classList.add('finished');
    timerDisplay.textContent = '00:00';
    // Notify user
    if (Notification.permission === 'granted') {
      new Notification('Focus session complete! Take a break 🎉');
    } else {
      alert('Focus session complete! Take a break 🎉');
    }
    return;
  }
  remainSeconds--;
  renderTimer();
}

startBtn.addEventListener('click', () => {
  if (timerRunning) return;
  if (remainSeconds === 0) remainSeconds = totalSeconds; // auto-reset if done
  timerRunning = true;
  timerInterval = setInterval(tick, 1000);
  renderTimer();

  // Request notification permission
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
});

stopBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  renderTimer();
});

resetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning  = false;
  remainSeconds = totalSeconds;
  renderTimer();
});

applyPomoBtn.addEventListener('click', () => {
  const mins = parseInt(pomoInput.value, 10);
  if (!mins || mins < 1 || mins > 120) {
    pomoInput.focus();
    return;
  }
  clearInterval(timerInterval);
  timerRunning  = false;
  pomoMinutes   = mins;
  totalSeconds  = mins * 60;
  remainSeconds = totalSeconds;
  saveLS('pomoMinutes', pomoMinutes);
  renderTimer();
});

renderTimer();

/* ─────────────────────────────────────────
   TO-DO LIST
───────────────────────────────────────── */

const todoForm   = $('todo-form');
const todoInput  = $('todo-input');
const todoList   = $('todo-list');
const todoEmpty  = $('todo-empty');
const sortSelect = $('sort-select');

// modal
const modalBackdrop  = $('modal-backdrop');
const editInput      = $('edit-input');
const modalSaveBtn   = $('modal-save-btn');
const modalCancelBtn = $('modal-cancel-btn');

let tasks         = loadLS('tasks', []);
let editingTaskId = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function saveTasks() {
  saveLS('tasks', tasks);
}

function getSortedTasks() {
  const mode  = sortSelect.value;
  const clone = [...tasks];
  if (mode === 'az')   return clone.sort((a, b) => a.text.localeCompare(b.text));
  if (mode === 'za')   return clone.sort((a, b) => b.text.localeCompare(a.text));
  if (mode === 'done') return clone.sort((a, b) => Number(a.done) - Number(b.done));
  return clone; // default: insertion order
}

function renderTasks() {
  todoList.innerHTML = '';
  const sorted = getSortedTasks();

  if (sorted.length === 0) {
    todoEmpty.hidden = false;
    return;
  }
  todoEmpty.hidden = true;

  sorted.forEach((task) => {
    const li = document.createElement('li');
    li.className = `todo-item${task.done ? ' done' : ''}`;
    li.dataset.id = task.id;
    li.innerHTML = `
      <input
        type="checkbox"
        class="todo-checkbox"
        aria-label="Mark task done"
        ${task.done ? 'checked' : ''}
      />
      <span class="todo-text">${escapeHtml(task.text)}</span>
      <div class="todo-actions">
        <button class="btn-edit"   aria-label="Edit task">✏️</button>
        <button class="btn-danger" aria-label="Delete task">🗑️</button>
      </div>
    `;

    // Toggle done
    li.querySelector('.todo-checkbox').addEventListener('change', (e) => {
      const t = tasks.find((t) => t.id === task.id);
      if (t) { t.done = e.target.checked; saveTasks(); renderTasks(); }
    });

    // Edit
    li.querySelector('.btn-edit').addEventListener('click', () => {
      openEditModal(task.id, task.text);
    });

    // Delete
    li.querySelector('.btn-danger').addEventListener('click', () => {
      tasks = tasks.filter((t) => t.id !== task.id);
      saveTasks();
      renderTasks();
    });

    todoList.appendChild(li);
  });
}

// Prevent duplicates: case-insensitive check
function isDuplicate(text, excludeId = null) {
  return tasks.some(
    (t) => t.text.toLowerCase() === text.toLowerCase() && t.id !== excludeId
  );
}

todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  if (isDuplicate(text)) {
    todoInput.setCustomValidity('This task already exists!');
    todoInput.reportValidity();
    // Clear validity after short delay so user can type again
    setTimeout(() => todoInput.setCustomValidity(''), 2500);
    return;
  }

  tasks.push({ id: generateId(), text, done: false });
  saveTasks();
  renderTasks();
  todoInput.value = '';
  todoInput.setCustomValidity('');
});

todoInput.addEventListener('input', () => todoInput.setCustomValidity(''));

sortSelect.addEventListener('change', renderTasks);

/* Edit Modal */
function openEditModal(id, currentText) {
  editingTaskId      = id;
  editInput.value    = currentText;
  modalBackdrop.hidden = false;
  editInput.focus();
}

function closeEditModal() {
  editingTaskId        = null;
  modalBackdrop.hidden = true;
}

modalSaveBtn.addEventListener('click', () => {
  const newText = editInput.value.trim();
  if (!newText) return;

  if (isDuplicate(newText, editingTaskId)) {
    editInput.setCustomValidity('This task already exists!');
    editInput.reportValidity();
    setTimeout(() => editInput.setCustomValidity(''), 2500);
    return;
  }

  const t = tasks.find((t) => t.id === editingTaskId);
  if (t) { t.text = newText; saveTasks(); renderTasks(); }
  closeEditModal();
});

modalCancelBtn.addEventListener('click', closeEditModal);

modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeEditModal();
});

editInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') modalSaveBtn.click();
  if (e.key === 'Escape') closeEditModal();
});

// Sanitize text to prevent XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

renderTasks();

/* ─────────────────────────────────────────
   QUICK LINKS
───────────────────────────────────────── */

const linkForm   = $('link-form');
const linkLabel  = $('link-label');
const linkUrl    = $('link-url');
const linksGrid  = $('links-grid');
const linksEmpty = $('links-empty');

let links = loadLS('quickLinks', []);

function saveLinks() {
  saveLS('quickLinks', links);
}

function renderLinks() {
  linksGrid.innerHTML = '';

  if (links.length === 0) {
    linksEmpty.hidden = false;
    return;
  }
  linksEmpty.hidden = true;

  links.forEach((link) => {
    const wrap = document.createElement('div');
    wrap.style.display = 'inline-flex';

    const a = document.createElement('a');
    a.href            = link.url;
    a.target          = '_blank';
    a.rel             = 'noopener noreferrer';
    a.className       = 'link-chip';
    a.textContent     = link.label;

    const del = document.createElement('button');
    del.className     = 'link-delete';
    del.title         = 'Remove link';
    del.textContent   = '✕';
    del.setAttribute('aria-label', `Remove ${link.label}`);
    del.addEventListener('click', (e) => {
      e.preventDefault();
      links = links.filter((l) => l.id !== link.id);
      saveLinks();
      renderLinks();
    });

    a.appendChild(del);
    wrap.appendChild(a);
    linksGrid.appendChild(wrap);
  });
}

linkForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const label = linkLabel.value.trim();
  let   url   = linkUrl.value.trim();

  if (!label || !url) return;

  // Auto-prepend protocol if missing
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  links.push({ id: generateId(), label, url });
  saveLinks();
  renderLinks();
  linkLabel.value = '';
  linkUrl.value   = '';
});

renderLinks();

/* ─────────────────────────────────────────
   LIGHT / DARK MODE
───────────────────────────────────────── */

const themeToggle = $('theme-toggle');
let darkMode = loadLS('darkMode', false);

function applyTheme() {
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  themeToggle.textContent = darkMode ? '☀️' : '🌙';
  themeToggle.title = darkMode ? 'Switch to light mode' : 'Switch to dark mode';
}

themeToggle.addEventListener('click', () => {
  darkMode = !darkMode;
  saveLS('darkMode', darkMode);
  applyTheme();
});

applyTheme();
