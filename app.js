/**
 * Companion App - Complete Application Logic v2
 * With PIN-based device linking, passcode protection, and photo attachments
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbzY7xAh9eQHl6idW4W6i--7YIRjp7IbFGQ4a1k3IXxrnry1X1b7lRjmpUGMWpkUy1NCQg/exec';

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
  currentPage: 'home',
  tasks: [],
  filterStatus: 'all',
  filterContext: 'home',
  selectedTaskId: null,
  pendingPasscodeTaskId: null,

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

  getTask(taskId) {
    return this.tasks.find(t => t.TaskID === taskId);
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
  },

  getAllTasks(status = 'all') {
    let filtered = this.tasks;
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
  document.getElementById('setupStep1').classList.remove('active');
  document.getElementById('setupStep2').classList.remove('active');

  if (stepNumber === 1) {
    document.getElementById('setupStep1').classList.add('active');
    setTimeout(() => document.getElementById('yourName').focus(), 100);
  } else if (stepNumber === 2) {
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
    const newPin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    pinInput.value = newPin;
    pinInput.disabled = true;
    pinMessage.textContent = '👆 Share this code with your partner';
    pinInputDiv.style.display = 'block';
  } else if (pinOption === 'join') {
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

  State.setUser(yourName, partnerName, syncPin);

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
  if (!State.user || !State.user.name) return;

  document.getElementById('userEmoji').textContent = State.user.id === 'user1' ? '👨' : '👩';
  
  const assignToPartnerOption = document.getElementById('assignToPartnerOption');
  if (assignToPartnerOption) {
    assignToPartnerOption.textContent = `${State.user.partnerName}`;
  }

  const partnerNameShort = State.user.partnerName ? State.user.partnerName.substring(0, 8) : 'Partner';

  const assignedTitle = document.getElementById('assignedToPartnerTitle');
  if (assignedTitle) assignedTitle.textContent = `Assigned to ${State.user.partnerName}`;

  const navLabel = document.getElementById('navAssignedLabel');
  if (navLabel) navLabel.textContent = partnerNameShort;

  document.getElementById('settingYourName').textContent = State.user.name;
  document.getElementById('settingPartnerName').textContent = State.user.partnerName;
  document.getElementById('settingSyncPin').textContent = State.user.syncPin;
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
  settings: 'settingsPage'
};

function goToPage(page) {
  Object.values(Pages).forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  document.getElementById(Pages[page]).style.display = 'block';

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.page === page) {
      btn.classList.add('active');
    }
  });

  State.currentPage = page;

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
}

// ============================================================================
// HOME PAGE (All Tasks)
// ============================================================================

function loadHomePage() {
  console.log('🏠 Loading home page...');
  State.filterContext = 'home';
  State.filterStatus = 'all';
  renderHomeTasksList();
  updateFilterButtons('all');
}

function filterHome(type) {
  if (type === 'all') {
    State.filterStatus = 'all';
  } else if (type === 'myTasks') {
    State.filterContext = 'homeMyTasks';
  } else if (type === 'assigned') {
    State.filterContext = 'homeAssigned';
  }
  renderHomeTasksList();
  updateFilterButtons(type);
}

function renderHomeTasksList() {
  let tasks = [];

  if (State.filterContext === 'homeMyTasks') {
    tasks = State.getMyTasks(State.filterStatus);
  } else if (State.filterContext === 'homeAssigned') {
    tasks = State.getAssignedToPartner(State.filterStatus);
  } else {
    tasks = State.getAllTasks(State.filterStatus);
  }

  if (tasks.length === 0) {
    document.getElementById('homeTasksList').innerHTML = `
      <div class="empty-state-compact">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-title">No tasks</div>
      </div>
    `;
    return;
  }

  const html = tasks.map(task => renderTaskCard(task)).join('');
  document.getElementById('homeTasksList').innerHTML = html;
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
        <div class="empty-state-title">No tasks</div>
      </div>
    `;
    return;
  }

  const html = tasks.map(task => renderTaskCard(task)).join('');
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
        <div class="empty-state-title">No tasks assigned</div>
      </div>
    `;
    return;
  }

  const html = tasks.map(task => renderTaskCard(task)).join('');
  document.getElementById('assignedTasksList').innerHTML = html;
}

// ============================================================================
// TASK CARD RENDERING
// ============================================================================

function renderTaskCard(task) {
  const statusEmoji = task.Status === 'completed' ? '✅' : '⏳';
  const lockEmoji = task.IsPrivate === 'TRUE' ? '🔒 ' : '';

  return `
    <div class="task-card" onclick="openTaskDetails('${task.TaskID}')">
      <div style="font-size: 18px; margin-right: 8px; flex-shrink: 0;">${statusEmoji}</div>
      <div class="task-info">
        <div class="task-title" style="${task.Status === 'completed' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
          ${lockEmoji}${escapeHtml(task.Title)}
        </div>
        <div class="task-meta">
          ${task.DueDate ? `📅 ${task.DueDate}` : ''}
          ${task.Priority ? `• ${task.Priority}` : ''}
          ${task.Category ? `• ${task.Category}` : ''}
        </div>
      </div>
    </div>
  `;
}

function updateFilterButtons(active) {
  document.querySelectorAll('.filter-btn').forEach((btn, idx) => {
    btn.classList.remove('active');
    const dataType = btn.getAttribute('data-type') || btn.textContent.trim();
    
    if ((active === 'all' && idx === 0) ||
        (active === 'open' && idx === 1) ||
        (active === 'completed' && idx === 2) ||
        (active === 'myTasks' && dataType.includes('My')) ||
        (active === 'assigned' && dataType.includes('Assigned'))) {
      btn.classList.add('active');
    }
  });
}

// ============================================================================
// TASK DETAILS MODAL
// ============================================================================

function openTaskDetails(taskId) {
  const task = State.getTask(taskId);
  if (!task) return;

  State.selectedTaskId = taskId;

  // Check if private
  if (task.IsPrivate === 'TRUE') {
    State.pendingPasscodeTaskId = taskId;
    document.getElementById('passcodeModal').style.display = 'flex';
    document.getElementById('passcodeInput').value = '';
    setTimeout(() => document.getElementById('passcodeInput').focus(), 100);
    return;
  }

  showTaskDetails(task);
}

function showTaskDetails(task) {
  document.getElementById('detailTaskTitle').textContent = escapeHtml(task.Title);

  const detailBtn = document.getElementById('detailCompleteBtn');
  detailBtn.textContent = task.Status === 'completed' ? 'Mark Incomplete' : 'Mark Complete';

  let html = `
    <div class="task-detail-section">
      <h3>Description</h3>
      <p>${escapeHtml(task.Description) || 'No description'}</p>
    </div>

    <div class="task-detail-section">
      <h3>Details</h3>
      <div class="detail-row">
        <span class="detail-label">Assigned to:</span>
        <span class="detail-value">${task.AssignedTo === State.user.id ? 'Me' : State.user.partnerName}</span>
      </div>
      ${task.Category ? `
      <div class="detail-row">
        <span class="detail-label">Category:</span>
        <span class="detail-value">${escapeHtml(task.Category)}</span>
      </div>
      ` : ''}
      ${task.Priority ? `
      <div class="detail-row">
        <span class="detail-label">Priority:</span>
        <span class="detail-value">${escapeHtml(task.Priority)}</span>
      </div>
      ` : ''}
      ${task.DueDate ? `
      <div class="detail-row">
        <span class="detail-label">Due Date:</span>
        <span class="detail-value">${escapeHtml(task.DueDate)}</span>
      </div>
      ` : ''}
      ${task.Status ? `
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">${escapeHtml(task.Status)}</span>
      </div>
      ` : ''}
    </div>

    ${task.AttachmentURLs ? `
    <div class="task-detail-section">
      <h3>Attachments</h3>
      <p>${escapeHtml(task.AttachmentURLs)}</p>
    </div>
    ` : ''}
  `;

  document.getElementById('detailTaskContent').innerHTML = html;
  document.getElementById('taskDetailsModal').style.display = 'flex';
}

function closeTaskDetailsModal() {
  document.getElementById('taskDetailsModal').style.display = 'none';
  State.selectedTaskId = null;
}

function completeDetailTask() {
  if (!State.selectedTaskId) return;

  const task = State.getTask(State.selectedTaskId);
  if (!task) return;

  const newStatus = task.Status === 'completed' ? 'open' : 'completed';
  State.updateTask(State.selectedTaskId, { Status: newStatus });

  // Re-render current view
  if (State.currentPage === 'home') {
    renderHomeTasksList();
  } else if (State.currentPage === 'myTasks') {
    renderMyTasks();
  } else if (State.currentPage === 'assignedToPartner') {
    renderAssignedTasks();
  }

  closeTaskDetailsModal();
}

function deleteDetailTask() {
  if (!State.selectedTaskId) return;
  if (!confirm('Delete this task?')) return;

  State.removeTask(State.selectedTaskId);

  if (State.currentPage === 'home') {
    renderHomeTasksList();
  } else if (State.currentPage === 'myTasks') {
    renderMyTasks();
  } else if (State.currentPage === 'assignedToPartner') {
    renderAssignedTasks();
  }

  closeTaskDetailsModal();
}

// ============================================================================
// PASSCODE PROTECTION
// ============================================================================

function verifyPasscode() {
  const passcode = document.getElementById('passcodeInput').value.trim();

  if (!passcode || passcode.length !== 4) {
    alert('Please enter a 4-digit passcode');
    return;
  }

  const task = State.getTask(State.pendingPasscodeTaskId);
  if (!task) return;

  // Check if passcode matches (stored in AttachmentURLs field as safety measure)
  const storedPasscode = task.AttachmentURLs ? task.AttachmentURLs.split('::')[0] : '';

  if (passcode !== storedPasscode) {
    alert('❌ Incorrect passcode');
    document.getElementById('passcodeInput').value = '';
    return;
  }

  closePasscodeModal();
  showTaskDetails(task);
}

function closePasscodeModal() {
  document.getElementById('passcodeModal').style.display = 'none';
  document.getElementById('passcodeInput').value = '';
  State.pendingPasscodeTaskId = null;
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

function togglePrivateFields() {
  const isPrivate = document.getElementById('taskPrivate').checked;
  document.getElementById('privateFields').style.display = isPrivate ? 'block' : 'none';
}

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
  document.getElementById('taskPasscode').value = '';
  document.getElementById('taskPhoto').value = '';
  document.getElementById('privateFields').style.display = 'none';
}

async function createTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const assignedToValue = document.getElementById('taskAssignedTo').value;
  const category = document.getElementById('taskCategory').value || 'Together';
  const priority = document.getElementById('taskPriority').value;
  const dueDate = document.getElementById('taskDueDate').value;
  const isPrivate = document.getElementById('taskPrivate').checked;
  const passcode = document.getElementById('taskPasscode').value.trim();
  const photoInput = document.getElementById('taskPhoto');

  if (!title) {
    alert('Please enter a task title');
    return;
  }

  if (!assignedToValue) {
    alert('Please select who this is for');
    return;
  }

  if (isPrivate) {
    if (!passcode || passcode.length !== 4 || !/^\d{4}$/.test(passcode)) {
      alert('Please enter a valid 4-digit passcode for private task');
      return;
    }
  }

  const assignedToId = assignedToValue === 'me' ? State.user.id : State.user.partnerId;

  let attachmentData = '';
  if (photoInput.files && photoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      attachmentData = e.target.result;
      await submitTask(title, description, assignedToId, category, priority, dueDate, isPrivate, passcode, attachmentData);
    };
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    await submitTask(title, description, assignedToId, category, priority, dueDate, isPrivate, passcode, attachmentData);
  }
}

async function submitTask(title, description, assignedToId, category, priority, dueDate, isPrivate, passcode, attachmentData) {
  console.log('➕ Creating task...');

  const attachmentField = isPrivate ? `${passcode}::${attachmentData}` : attachmentData;

  const result = await apiCall('createTask', {
    Title: title,
    Description: description,
    Category: category,
    Priority: priority,
    DueDate: dueDate,
    IsPrivate: isPrivate ? 'TRUE' : 'FALSE',
    AssignedTo: assignedToId,
    CreatedBy: State.user.id,
    Status: 'open',
    AttachmentURLs: attachmentField
  });

  if (result.success) {
    State.addTask(result.data);
    closeCreateTaskModal();

    if (State.currentPage === 'home') {
      renderHomeTasksList();
    } else if (State.currentPage === 'myTasks') {
      renderMyTasks();
    } else if (State.currentPage === 'assignedToPartner') {
      renderAssignedTasks();
    }

    console.log('✅ Task created successfully!');
  } else {
    console.error('❌ Failed to create task:', result.error);
    alert('❌ Failed to create task: ' + (result.error || 'Unknown error'));
  }
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
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCreateTaskModal();
    closeTaskDetailsModal();
    closePasscodeModal();
    closeProfileMenu();
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openCreateTaskModal();
  }
});
