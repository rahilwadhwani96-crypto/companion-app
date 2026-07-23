/**
 * Companion App - Complete Application Logic
 * With PIN-based device linking system
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwJJeWH4dgS6pJep1ieufBQ3bcEkLGdsH_BmGpCxH9Q_S3ckxg6V8soQTeSE2T0oIjulg/exec';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const State = {
  user: {
    id: null,
    name: null,
    partnerName: null,
    partnerId: null,
    syncPin: null
  },

  currentTheme: 'his',
  currentPage: 'myTasks',
  tasks: [],
  filterStatus: 'all',
  filterContext: 'myTasks',

  init() {
    const saved = localStorage.getItem('companion-user');
    if (saved) {
      this.user = JSON.parse(saved);
      this.currentTheme = this.user.id === 'user1' ? 'his' : 'her';
    }
  },

  setUser(name, partnerName, syncPin) {
    const userId = 'user1';
    const partnerId = 'user2';

    this.user = {
      id: userId,
      name: name,
      partnerName: partnerName,
      partnerId: partnerId,
      syncPin: syncPin
    };

    this.currentTheme = 'his';
    localStorage.setItem('companion-user', JSON.stringify(this.user));
  },

  switchToPartner() {
    const isCurrent = this.user.id === 'user1';
    const newUser = {
      id: isCurrent ? 'user2' : 'user1',
      name: isCurrent ? this.user.partnerName : this.user.name,
      partnerName: isCurrent ? this.user.name : this.user.partnerName,
      partnerId: isCurrent ? 'user1' : 'user2',
      syncPin: this.user.syncPin
    };

    this.user = newUser;
    this.currentTheme = newUser.id === 'user1' ? 'his' : 'her';
    localStorage.setItem('companion-user', JSON.stringify(this.user));
  },

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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch(err => console.error('❌ SW error:', err));
  }

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
// SETUP WIZARD - STEPS
// ============================================================================

function showSetupWizard() {
  document.getElementById('setupWizard').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
  goToStep(1);
}

function goToStep(stepNumber) {
  // Hide all steps
  document.getElementById('setupStep1').classList.remove('active');
  document.getElementById('setupStep2').classList.remove('active');

  // Show requested step
  if (stepNumber === 1) {
    document.getElementById('setupStep1').classList.add('active');
    setTimeout(() => document.getElementById('yourName').focus(), 100);
  } else if (stepNumber === 2) {
    // Validate step 1 first
    const yourName = document.getElementById('yourName').value.trim();
    const partnerName = document.getElementById('partnerName').value.trim();

    if (!yourName || !partnerName) {
      alert('Please enter both names');
      return;
    }

    document.getElementById('setupStep2').classList.add('active');
    updatePinForm();
  }
}

function updatePinForm() {
  const pinOption = document.getElementById('pinOption').value;
  const pinInputDiv = document.getElementById('pinInputDiv');
  const pinInput = document.getElementById('syncPin');
  const pinMessage = document.getElementById('pinMessage');

  if (pinOption === 'create') {
    // Generate random PIN
    const newPin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    pinInput.value = newPin;
    pinInput.disabled = true;
    pinMessage.textContent = '👆 Share this code with your partner';
    pinInputDiv.style.display = 'block';
  } else if (pinOption === 'join') {
    // Allow user to enter PIN
    pinInput.value = '';
    pinInput.disabled = false;
    pinInput.focus();
    pinMessage.textContent = 'Enter the code your partner created';
    pinInputDiv.style.display = 'block';
  } else {
    pinInputDiv.style.display = 'none';
  }
}

async function completeSetup() {
  const yourName = document.getElementById('yourName').value.trim();
  const partnerName = document.getElementById('partnerName').value.trim();
  const pinOption = document.getElementById('pinOption').value;
  const syncPin = document.getElementById('syncPin').value.trim();

  if (!yourName || !partnerName) {
    alert('Please enter both names');
    return;
  }

  if (!pinOption) {
    alert('Please select how to sync');
    return;
  }

  if (!syncPin || syncPin.length !== 4) {
    alert('Please enter a valid 4-digit code');
    return;
  }

  if (!/^\d{4}$/.test(syncPin)) {
    alert('Code must be 4 digits only');
    return;
  }

  console.log(`✅ Setup complete: ${yourName} & ${partnerName} with PIN: ${syncPin}`);

  // Save user data
  State.setUser(yourName, partnerName, syncPin);

  // Initialize users in Google Sheet
  console.log('📝 Saving user data to Google Sheet...');
  
  const initResult = await apiCall('initializeUsers', {
    user1Name: yourName,
    user2Name: partnerName
  });

  if (initResult.success) {
    console.log('✅ Users saved to Google Sheet!');
  } else {
    console.warn('⚠️ Could not save users:', initResult.error);
  }

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
  document.getElementById('userEmoji').textContent = State.user.id === 'user1' ? '👨' : '👩';
  
  const assignToPartnerOption = document.getElementById('assignToPartnerOption');
  if (assignToPartnerOption) {
    assignToPartnerOption.textContent = `${State.user.partnerName}`;
  }

  document.getElementById('assignedToPartnerTitle').textContent = `Assigned to ${State.user.partnerName}`;
  document.getElementById('navAssignedLabel').textContent = State.user.partnerName.substring(0, 8);
  document.getElementById('assignedActionText').textContent = State.user.partnerName.substring(0, 10);
  document.getElementById('partnerTaskLabel').textContent = `For ${State.user.partnerName}`;

  document.getElementById('settingYourName').textContent = State.user.name;
  document.getElementById('settingPartnerName').textContent = State.user.partnerName;
  document.getElementById('settingSyncPin').textContent = State.user.syncPin;
  document.getElementById('assignedToLabel').textContent = `Waiting for ${State.user.partnerName}`;
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

  // Show FAB only on task pages
  const fab = document.getElementById('fabAddTask');
  if (page === 'myTasks' || page === 'assignedToPartner') {
    fab.style.display = 'flex';
  } else {
    fab.style.display = 'none';
  }

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
  const myTasks = State.getMyTasks('open');
  const assignedTasks = State.getAssignedToPartner('open');

  document.getElementById('myTaskCount').textContent = myTasks.length;
  document.getElementById('assignedToPartnerCount').textContent = assignedTasks.length;
}

// ============================================================================
// HOME PAGE (DASHBOARD)
// ============================================================================

function loadHomePage() {
  console.log('🏠 Loading home page...');
  updateStats();
  
  const myCompletedToday = State.tasks.filter(t => 
    t.AssignedTo === State.user.id && 
    t.Status === 'completed'
  ).length;

  const partnerCompletedToday = State.tasks.filter(t => 
    t.AssignedTo === State.user.partnerId && 
    t.Status === 'completed'
  ).length;

  let recentHtml = '';
  if (myCompletedToday > 0 || partnerCompletedToday > 0) {
    recentHtml = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${myCompletedToday > 0 ? `<div style="font-size: 13px;">✅ You completed ${myCompletedToday} task${myCompletedToday > 1 ? 's' : ''}</div>` : ''}
        ${partnerCompletedToday > 0 ? `<div style="font-size: 13px;">✅ ${State.user.partnerName} completed ${partnerCompletedToday} task${partnerCompletedToday > 1 ? 's' : ''}</div>` : ''}
      </div>
    `;
  } else {
    recentHtml = '<div style="font-size: 13px; color: var(--color-text-tertiary);">No activity yet</div>';
  }

  document.getElementById('recentActivity').innerHTML = recentHtml;
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
      <div class="empty-state-compact">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-title">No tasks yet</div>
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
          ${task.DueDate ? `📅 ${task.DueDate}` : ''}
          ${task.Priority ? `${task.Priority}` : ''}
          ${task.Category ? `${task.Category}` : ''}
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
      <div class="empty-state-compact">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">No tasks assigned yet</div>
      </div>
    `;
    return;
  }

  const html = tasks.map(task => {
    const statusEmoji = task.Status === 'completed' ? '✅' : '⏳';
    return `
    <div class="task-card animate-slide-in-up">
      <div style="font-size: 18px; margin-right: 8px; min-width: 18px; flex-shrink: 0;">${statusEmoji}</div>
      <div class="task-info">
        <div class="task-title" style="${task.Status === 'completed' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
          ${escapeHtml(task.Title)}
        </div>
        <div class="task-meta">
          ${task.DueDate ? `📅 ${task.DueDate}` : ''}
          ${task.Priority ? `${task.Priority}` : ''}
          ${task.Category ? `${task.Category}` : ''}
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
  setTimeout(() => {
    document.getElementById('taskTitle').focus();
  }, 100);
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
  const assignedToValue = document.getElementById('taskAssignedTo').value;
  const category = document.getElementById('taskCategory').value || 'Together';
  const priority = document.getElementById('taskPriority').value;
  const dueDate = document.getElementById('taskDueDate').value;
  const isPrivate = document.getElementById('taskPrivate').checked;

  if (!title) {
    alert('Please enter a task title');
    return;
  }

  if (!assignedToValue) {
    alert('Please select who this is for');
    return;
  }

  const assignedToId = assignedToValue === 'me' ? State.user.id : State.user.partnerId;

  console.log('➕ Creating task...', {
    title,
    assignedToId,
    createdBy: State.user.id
  });

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
    console.log('✅ Task created successfully!');
  } else {
    console.error('❌ Failed to create task:', result.error);
    alert('❌ Failed to create task: ' + (result.error || 'Unknown error'));
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
