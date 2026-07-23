/**
 * Companion App - Main Application Logic
 * Handles UI, routing, state, and API calls
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwuDAd42gcX83_fHFZoj1OQmPkC1RJ1KAxNKORD6CQ2ao8ToZ2ZkFEVX7DeombC755T8w/exec';

const USERS = {
  his: {
    id: 'user1',
    name: 'Him',
    emoji: '👨',
    theme: 'his'
  },
  her: {
    id: 'user2',
    name: 'Her',
    emoji: '👩',
    theme: 'her'
  }
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const State = {
  currentUser: null,
  currentTheme: 'his',
  currentPage: 'home',
  tasks: [],
  milestones: [],
  notifications: [],
  categories: [],
  filterStatus: 'all',

  init() {
    const saved = localStorage.getItem('companion-user');
    if (saved) {
      this.currentUser = JSON.parse(saved);
      this.currentTheme = this.currentUser.theme;
    }
  },

  setUser(theme) {
    this.currentUser = USERS[theme];
    this.currentTheme = theme;
    localStorage.setItem('companion-user', JSON.stringify(this.currentUser));
  },

  setPage(page) {
    this.currentPage = page;
  },

  setFilterStatus(status) {
    this.filterStatus = status;
  },

  addTask(task) {
    this.tasks.push(task);
  },

  removeTask(taskId) {
    this.tasks = this.tasks.filter(t => t.TaskID !== taskId);
  },

  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.TaskID === taskId);
    if (task) {
      Object.assign(task, updates);
    }
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Companion App Initializing...');
  
  State.init();
  
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch(err => console.error('❌ SW error:', err));
  }

  // Show person selector or main app
  if (State.currentUser) {
    showMainApp();
    loadAllData();
  } else {
    showPersonSelector();
  }

  // Hide loading screen
  setTimeout(() => {
    document.querySelector('.app-loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  }, 500);
});

// ============================================================================
// PERSON SELECTION
// ============================================================================

function showPersonSelector() {
  document.getElementById('personSelector').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
  document.getElementById('personSelector').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  updateTheme();
  updateProfileButton();
}

function selectPerson(theme) {
  State.setUser(theme);
  showMainApp();
  loadAllData();
  goToPage('home');
  closeProfileMenu();
}

// ============================================================================
// THEME & UI
// ============================================================================

function updateTheme() {
  document.body.className = `theme-${State.currentTheme}`;
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.textContent = State.currentTheme === 'his' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  State.currentTheme = State.currentTheme === 'his' ? 'her' : 'his';
  updateTheme();
}

function updateProfileButton() {
  document.getElementById('profileEmoji').textContent = State.currentUser.emoji;
}

function toggleProfileMenu() {
  const menu = document.getElementById('profileMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function closeProfileMenu() {
  document.getElementById('profileMenu').style.display = 'none';
}

// ============================================================================
// PAGE ROUTING
// ============================================================================

const Pages = {
  home: 'homePage',
  tasks: 'tasksPage',
  timeline: 'timelinePage',
  notifications: 'notificationsPage',
  settings: 'settingsPage'
};

function goToPage(page) {
  // Hide all pages
  Object.values(Pages).forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  // Show selected page
  document.getElementById(Pages[page]).style.display = 'block';

  // Update nav active state
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.page === page) {
      btn.classList.add('active');
    }
  });

  // Update state and load data
  State.setPage(page);

  if (page === 'home') {
    loadHomePage();
  } else if (page === 'tasks') {
    loadTasksPage();
  } else if (page === 'timeline') {
    loadTimelinePage();
  } else if (page === 'notifications') {
    loadNotificationsPage();
  }
}

// ============================================================================
// API CALLS
// ============================================================================

async function apiCall(action, data = {}) {
  try {
    console.log(`📤 ${action}:`, data);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...data })
    });

    const result = await response.json();
    
    if (result.error) {
      console.error(`❌ ${action} error:`, result.error);
      return { error: result.error };
    }

    console.log(`✅ ${action}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ ${action} failed:`, error);
    return { error: error.message };
  }
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadAllData() {
  console.log('📂 Loading all data...');
  
  // Load tasks
  const tasksResult = await apiCall('getTasks', {
    filters: {}
  });
  
  if (tasksResult.data) {
    State.tasks = tasksResult.data;
  }

  // Load categories
  const catResult = await apiCall('getCategories');
  if (catResult.data) {
    State.categories = catResult.data;
  }

  console.log(`✅ Loaded ${State.tasks.length} tasks`);
}

// ============================================================================
// HOME PAGE
// ============================================================================

function loadHomePage() {
  console.log('🏠 Loading home page...');
  
  // Display today's tasks
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = State.tasks.filter(t => t.DueDate === today && t.Status !== 'completed');
  
  const tasksHtml = todayTasks.length > 0
    ? todayTasks.map(task => `
        <div class="task-card" style="margin-bottom: 12px;">
          <input type="checkbox" class="task-checkbox" onchange="completeTask('${task.TaskID}')">
          <div class="task-info">
            <div class="task-title">${escapeHtml(task.Title)}</div>
            <div class="task-meta">${task.Priority} • ${task.Category}</div>
          </div>
        </div>
      `).join('')
    : '<div class="empty-state">No tasks for today! 🎉</div>';
  
  document.getElementById('homeTasks').innerHTML = tasksHtml;

  // Display milestones (placeholder)
  document.getElementById('homeMilestones').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">💫</div>
      <div class="empty-state-title">No milestones yet</div>
      <p style="font-size: 12px;">Create your first milestone on the timeline!</p>
    </div>
  `;
}

// ============================================================================
// TASKS PAGE
// ============================================================================

function loadTasksPage() {
  console.log('📋 Loading tasks page...');
  renderTasksList();
}

function filterTasks(status) {
  State.setFilterStatus(status);
  
  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.toLowerCase().includes(status) || 
        (status === 'all' && btn.textContent.includes('All'))) {
      btn.classList.add('active');
    }
  });

  renderTasksList();
}

function renderTasksList() {
  let filteredTasks = State.tasks;

  if (State.filterStatus === 'open') {
    filteredTasks = filteredTasks.filter(t => t.Status !== 'completed');
  } else if (State.filterStatus === 'completed') {
    filteredTasks = filteredTasks.filter(t => t.Status === 'completed');
  }

  if (filteredTasks.length === 0) {
    document.getElementById('tasksList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-title">No tasks</div>
        <p>Create your first task to get started!</p>
      </div>
    `;
    return;
  }

  const html = filteredTasks.map(task => `
    <div class="task-card animate-slide-in-up">
      <input 
        type="checkbox" 
        class="task-checkbox" 
        ${task.Status === 'completed' ? 'checked' : ''}
        onchange="completeTask('${task.TaskID}')"
      >
      <div class="task-info">
        <div class="task-title" style="${task.Status === 'completed' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
          ${escapeHtml(task.Title)}
        </div>
        <div class="task-meta">
          ${task.DueDate ? `📅 ${task.DueDate}` : 'No date'}
          • ${task.Priority}
          • ${task.Category}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn" onclick="deleteTask('${task.TaskID}')" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');

  document.getElementById('tasksList').innerHTML = html;
}

// ============================================================================
// TIMELINE PAGE
// ============================================================================

function loadTimelinePage() {
  console.log('❤️ Loading timeline page...');
  
  document.getElementById('timeline').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🕐</div>
      <div class="empty-state-title">Timeline Coming Soon</div>
      <p>Your milestones and memories will appear here!</p>
    </div>
  `;
}

// ============================================================================
// NOTIFICATIONS PAGE
// ============================================================================

function loadNotificationsPage() {
  console.log('🔔 Loading notifications page...');
  
  document.getElementById('notificationsList').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📬</div>
      <div class="empty-state-title">No notifications</div>
      <p>You're all caught up!</p>
    </div>
  `;
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

function openCreateTaskModal() {
  document.getElementById('createTaskModal').style.display = 'flex';
  document.getElementById('taskTitle').focus();
}

function closeCreateTaskModal() {
  document.getElementById('createTaskModal').style.display = 'none';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskCategory').value = '';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskDueDate').value = '';
  document.getElementById('taskPrivate').checked = false;
}

async function createTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const category = document.getElementById('taskCategory').value || 'Together';
  const priority = document.getElementById('taskPriority').value;
  const dueDate = document.getElementById('taskDueDate').value;
  const isPrivate = document.getElementById('taskPrivate').checked;

  if (!title) {
    alert('Please enter a task title');
    return;
  }

  console.log('➕ Creating task...');

  const result = await apiCall('createTask', {
    Title: title,
    Description: description,
    Category: category,
    Priority: priority,
    DueDate: dueDate,
    IsPrivate: isPrivate ? 'TRUE' : 'FALSE',
    AssignedTo: State.currentUser.id,
    CreatedBy: State.currentUser.id
  });

  if (result.success) {
    State.addTask(result.data);
    closeCreateTaskModal();
    renderTasksList();
    alert('✅ Task created!');
  } else {
    alert('❌ Failed to create task: ' + result.error);
  }
}

async function completeTask(taskId) {
  console.log('✅ Completing task:', taskId);
  
  const task = State.tasks.find(t => t.TaskID === taskId);
  if (!task) return;

  const newStatus = task.Status === 'completed' ? 'open' : 'completed';
  const now = new Date().toISOString();

  // Update in backend (you'll need to add updateTask to backend)
  State.updateTask(taskId, {
    Status: newStatus,
    CompletedAt: newStatus === 'completed' ? now : '',
    CompletedBy: newStatus === 'completed' ? State.currentUser.id : ''
  });

  renderTasksList();
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;

  console.log('🗑️ Deleting task:', taskId);
  
  State.removeTask(taskId);
  renderTasksList();
  // Backend delete call would go here
}

// ============================================================================
// SETTINGS
// ============================================================================

function clearData() {
  if (confirm('⚠️ Clear all data and start fresh?')) {
    localStorage.removeItem('companion-user');
    State.currentUser = null;
    location.reload();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

document.addEventListener('keydown', (e) => {
  // Escape to close modal
  if (e.key === 'Escape') {
    closeCreateTaskModal();
    closeProfileMenu();
  }

  // Cmd/Ctrl + K to create task
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openCreateTaskModal();
  }
});
