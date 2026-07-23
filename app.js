/**
 * Companion App - Complete Application Logic
 * Handles setup, routing, tasks, and real-time sync
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwuDAd42gcX83_fHFZoj1OQmPkC1RJ1KAxNKORD6CQ2ao8ToZ2ZkFEVX7DeombC755T8w/exec';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const State = {
  // User identity (from localStorage)
  user: {
    id: null,           // 'user1' or 'user2'
    name: null,         // 'Lean', 'Sarah', etc.
    partnerName: null,  // Partner's name
    partnerId: null     // 'user2' or 'user1'
  },

  // App state
  currentTheme: 'his',
  currentPage: 'home',
  tasks: [],
  filterStatus: 'all',
  filterContext: 'myTasks', // 'myTasks' or 'assignedToPartner'

  // Initialize from localStorage
  init() {
    const saved = localStorage.getItem('companion-user');
    if (saved) {
      this.user = JSON.parse(saved);
      this.currentTheme = this.user.id === 'user1' ? 'his' : 'her';
    }
  },

  // Save user to localStorage
  setUser(name, partnerName) {
    const userId = 'user1'; // First user gets user1
    const partnerId = 'user2';

    this.user = {
      id: userId,
      name: name,
      partnerName: partnerName,
      partnerId: partnerId
    };

    this.currentTheme = 'his'; // user1 gets his theme

    localStorage.setItem('companion-user', JSON.stringify(this.user));
  },

  // Switch to partner view (for testing on same device)
  switchToPartner() {
    const isCurrent = this.user.id === 'user1';
    const newUser = {
      id: isCurrent ? 'user2' : 'user1',
      name: isCurrent ? this.user.partnerName : this.user.name,
      partnerName: isCurrent ? this.user.name : this.user.partnerName,
      partnerId: isCurrent ? 'user1' : 'user2'
    };

    this.user = newUser;
    this.currentTheme = newUser.id === 'user1' ? 'his' : 'her';
    localStorage.setItem('companion-user', JSON.stringify(this.user));
  },

  // Add/update tasks
  setTasks(tasks) {
    this.tasks = tasks || [];
  },

  addTask(task) {
    this.tasks.push(task);
  },

  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.TaskID === taskId);
    if (task) {
      Object.assign(task, updates);
    }
  },

  removeTask(taskId) {
    this.tasks = this.tasks.filter(t => t.TaskID !== taskId);
  },

  // Get filtered tasks
  getMyTasks(status = 'all') {
    let filtered = this.tasks.filter(t => t.AssignedTo === this.user.id);
    if (status === 'open') filtered = filtered.filter(t => t.Status !== 'completed');
    if (status === 'completed') filtered = filtered.filter(t => t.Status === 'completed');
    return filtered;
  },

  getAssignedToPartner(status = 'all') {
    let filtered = this.tasks.filter(t => t.CreatedBy === this.user.id && t.AssignedTo !== this.user.id);
    if (status === 'open') filtered = filtered.filter(t => t.Status !== 'completed');
    if (status === 'completed') filtered = filtered.filter(t => t.Status === 'completed');
    return filtered;
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
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch(err => console.error('❌ SW error:', err));
  }

  // Show setup or main app
  setTimeout(() => {
    document.querySelector('.app-loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    if (!State.user.id) {
      showSetupWizard();
    } else {
      showMainApp();
      loadAllData();
    }
  }, 500);
});

// ============================================================================
// SETUP WIZARD
// ============================================================================

function showSetupWizard() {
  document.getElementById('setupWizard').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('yourName').focus();
}

function completeSetup() {
  const yourName = document.getElementById('yourName').value.trim();
  const partnerName = document.getElementById('partnerName').value.trim();

  if (!yourName || !partnerName) {
    alert('Please enter both names');
    return;
  }

  console.log(`✅ Setup complete: ${yourName} & ${partnerName}`);

  State.setUser(yourName, partnerName);
  showMainApp();
  loadAllData();
  goToPage('home');
}

// ============================================================================
// MAIN APP DISPLAY
// ============================================================================

function showMainApp() {
  document.getElementById('setupWizard').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  updateTheme();
  updateUI();
}

function updateUI() {
  // Update header
  document.getElementById('userEmoji').textContent = State.user.id === 'user1' ? '👨' : '👩';
  
  // Update nav labels
  document.getElementById('assignedToPartnerTitle').textContent = `Assigned to ${State.user.partnerName}`;
  document.getElementById('assignToPartnerOption').textContent = State.user.partnerName;
  document.getElementById('assignToMeOption').textContent = 'Me';
  document.getElementById('navAssignedLabel').textContent = State.user.partnerName.substring(0, 10);

  // Update settings
  document.getElementById('settingYourName').textContent = State.user.name;
  document.getElementById('settingPartnerName').textContent = State.user.partnerName;
  document.getElementById('homeUserName').textContent = State.user.name;
  document.getElementById('assignedToLabel').textContent = `Assigned to ${State.user.partnerName}`;
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

function toggleProfileMenu() {
  const menu = document.getElementById('profileMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function closeProfileMenu() {
  document.getElementById('profileMenu').style.display = 'none';
}

function goToSettings() {
  closeProfileMenu();
  goToPage('settings');
}

// ============================================================================
// PAGE ROUTING
// ============================================================================

const Pages = {
  home: 'homePage',
  myTasks: 'myTasksPage',
  assignedToPartner: 'assignedToPartnerPage',
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

  State.currentPage = page;

  // Load page data
  if (page === 'home') {
    loadHomePage();
  } else if (page === 'myTasks') {
    loadMyTasksPage();
  } else if (page === 'assignedToPartner') {
    loadAssignedToPartnerPage();
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

  const tasksResult = await apiCall('getTasks', { filters: {} });

  if (tasksResult.data) {
    State.setTasks(tasksResult.data);
    console.log(`✅ Loaded ${State.tasks.length} tasks`);
  } else {
    State.setTasks([]);
  }

  updateStats();
}

function updateStats() {
  const myTasks = State.getMyTasks();
  const assignedTasks = State.getAssignedToPartner();

  document.getElementById('myTaskCount').textContent = myTasks.length;
  document.getElementById('assignedToPartnerCount').textContent = assignedTasks.length;
}

// ============================================================================
// HOME PAGE
// ============================================================================

function loadHomePage() {
  console.log('🏠 Loading home page...');
  updateStats();
}

// ============================================================================
// MY TASKS PAGE
// ============================================================================

function loadMyTasksPage() {
  console.log('📋 Loading my tasks page...');
  State.filterContext = 'myTasks';
  State.filterStatus = 'all';
  renderMyTasks();
  updateFilterButtons('all');
}

function filterMyTasks(status) {
  State.filterStatus = status;
  renderMyTasks();
  updateFilterButtons(status);
}

function renderMyTasks() {
  const tasks = State.getMyTasks(State.filterStatus);

  if (tasks.length === 0) {
    document.getElementById('myTasksList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-title">No tasks yet</div>
        <p>Create your first task to get started!</p>
      </div>
    `;
    return;
  }

  const html = tasks.map(task => `
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

  document.getElementById('myTasksList').innerHTML = html;
}

// ============================================================================
// ASSIGNED TO PARTNER PAGE
// ============================================================================

function loadAssignedToPartnerPage() {
  console.log(`👥 Loading assigned to ${State.user.partnerName} page...`);
  State.filterContext = 'assignedToPartner';
  State.filterStatus = 'all';
  renderAssignedTasks();
  updateFilterButtons('all');
}

function filterAssignedTasks(status) {
  State.filterStatus = status;
  renderAssignedTasks();
  updateFilterButtons(status);
}

function renderAssignedTasks() {
  const tasks = State.getAssignedToPartner(State.filterStatus);

  if (tasks.length === 0) {
    document.getElementById('assignedTasksList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">No tasks assigned yet</div>
        <p>Create a task for ${State.user.partnerName}!</p>
      </div>
    `;
    return;
  }

  const html = tasks.map(task => {
    const statusEmoji = task.Status === 'completed' ? '✅' : '⏳';
    return `
    <div class="task-card animate-slide-in-up">
      <div style="font-size: 20px; margin-right: 8px;">${statusEmoji}</div>
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
  `;
  }).join('');

  document.getElementById('assignedTasksList').innerHTML = html;
}

function updateFilterButtons(active) {
  document.querySelectorAll('.filter-btn').forEach((btn, idx) => {
    btn.classList.remove('active');
    if ((active === 'all' && idx === 0) ||
        (active === 'open' && idx === 1) ||
        (active === 'completed' && idx === 2)) {
      btn.classList.add('active');
    }
  });
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
  document.getElementById('taskAssignedTo').value = '';
  document.getElementById('taskCategory').value = '';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskDueDate').value = '';
  document.getElementById('taskPrivate').checked = false;
}

async function createTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const assignedTo = document.getElementById('taskAssignedTo').value;
  const category = document.getElementById('taskCategory').value || 'Together';
  const priority = document.getElementById('taskPriority').value;
  const dueDate = document.getElementById('taskDueDate').value;
  const isPrivate = document.getElementById('taskPrivate').checked;

  if (!title) {
    alert('Please enter a task title');
    return;
  }

  if (!assignedTo) {
    alert('Please select who this is for');
    return;
  }

  const assignedToId = assignedTo === 'me' ? State.user.id : State.user.partnerId;

  console.log('➕ Creating task...');

  const result = await apiCall('createTask', {
    Title: title,
    Description: description,
    Category: category,
    Priority: priority,
    DueDate: dueDate,
    IsPrivate: isPrivate ? 'TRUE' : 'FALSE',
    AssignedTo: assignedToId,
    CreatedBy: State.user.id,
    Status: 'open'
  });

  if (result.success) {
    State.addTask(result.data);
    closeCreateTaskModal();

    if (State.currentPage === 'myTasks') {
      renderMyTasks();
    } else if (State.currentPage === 'assignedToPartner') {
      renderAssignedTasks();
    }

    updateStats();
    alert('✅ Task created!');
  } else {
    alert('❌ Failed to create task: ' + result.error);
  }
}

async function completeTask(taskId) {
  console.log('✅ Toggling task:', taskId);

  const task = State.tasks.find(t => t.TaskID === taskId);
  if (!task) return;

  const newStatus = task.Status === 'completed' ? 'open' : 'completed';

  State.updateTask(taskId, { Status: newStatus });

  if (State.filterContext === 'myTasks') {
    renderMyTasks();
  } else {
    renderAssignedTasks();
  }

  updateStats();
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;

  console.log('🗑️ Deleting task:', taskId);

  State.removeTask(taskId);

  if (State.filterContext === 'myTasks') {
    renderMyTasks();
  } else {
    renderAssignedTasks();
  }

  updateStats();
}

// ============================================================================
// SETTINGS
// ============================================================================

function resetSetup() {
  if (confirm('Switch to ' + State.user.partnerName + "'s profile?\n\n(This switches the theme and perspective)")) {
    State.switchToPartner();
    updateTheme();
    updateUI();
    goToPage('home');
    loadAllData();
  }
}

function clearAllData() {
  if (confirm('⚠️ Clear all data and reset app?\n\nYou will need to set up again.')) {
    localStorage.removeItem('companion-user');
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
  if (e.key === 'Escape') {
    closeCreateTaskModal();
    closeProfileMenu();
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openCreateTaskModal();
  }
});
