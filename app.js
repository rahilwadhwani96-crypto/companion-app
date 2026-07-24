/**
 * Companion App - v3 Complete Redesign
 * Architecture: Google Sheet is Source of Truth
 * 
 * 3-Step Process:
 * 1. SAVE to Google Sheet (validate first)
 * 2. FETCH fresh data from sheet
 * 3. RENDER updated UI
 * 
 * NO caching. NO polling. NO assumptions.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbzY7xAh9eQHl6idW4W6i--7YIRjp7IbFGQ4a1k3IXxrnry1X1b7lRjmpUGMWpkUy1NCQg/exec';

// ============================================================================
// STORAGE - Single Source of Truth: Google Sheet
// ============================================================================

const StorageManager = {
  // localStorage keys
  KEYS: {
    USER: 'companion-user',
    PHOTO_PREFIX: 'photo_'
  },

  // Get current user from localStorage
  getUser() {
    const stored = localStorage.getItem(this.KEYS.USER);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('❌ Failed to parse user from localStorage:', e);
      return null;
    }
  },

  // Set user (only on initial setup)
  setUser(userId, userName, partnerUserId, partnerName, theme = 'his') {
    const user = {
      userId: userId,
      userName: userName,
      partnerUserId: partnerUserId,
      partnerName: partnerName,
      theme: theme
    };
    localStorage.setItem(this.KEYS.USER, JSON.stringify(user));
    console.log('✅ User stored:', user);
    return user;
  },

  // Store photo in localStorage
  storePhoto(taskId, base64Data) {
    try {
      const key = this.KEYS.PHOTO_PREFIX + taskId;
      localStorage.setItem(key, base64Data);
      console.log('📸 Photo stored locally:', key);
      return true;
    } catch (e) {
      console.error('❌ Photo storage failed (might be too large):', e);
      return false;
    }
  },

  // Get photo from localStorage
  getPhoto(taskId) {
    try {
      const key = this.KEYS.PHOTO_PREFIX + taskId;
      return localStorage.getItem(key);
    } catch (e) {
      console.error('❌ Photo retrieval failed:', e);
      return null;
    }
  },

  // Delete photo
  deletePhoto(taskId) {
    try {
      const key = this.KEYS.PHOTO_PREFIX + taskId;
      localStorage.removeItem(key);
    } catch (e) {
      console.error('⚠️ Photo deletion failed:', e);
    }
  },

  // Clear all app data (reset app)
  clearAll() {
    if (confirm('⚠️ Clear all data and reset app? This cannot be undone.')) {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('companion-')) {
          localStorage.removeItem(key);
        }
      });
      console.log('🗑️ All app data cleared');
      location.reload();
    }
  }
};

// ============================================================================
// STATE MANAGEMENT - In-Memory Only (Never Trusted as Source of Truth)
// ============================================================================

const AppState = {
  user: null,
  tasks: [],
  currentPage: 'home',
  selectedTaskId: null,
  pendingPasscodeTaskId: null,

  init() {
    this.user = StorageManager.getUser();
    console.log('🚀 App initialized with user:', this.user);
  },

  // Clear all in-memory state (when switching users)
  clearTasks() {
    this.tasks = [];
    console.log('🧹 Tasks cleared from memory');
  },

  // Update tasks from sheet (source of truth)
  setTasksFromSheet(sheetData) {
    if (!Array.isArray(sheetData)) {
      console.error('❌ Invalid tasks data:', sheetData);
      this.tasks = [];
      return;
    }
    this.tasks = sheetData;
    console.log('📥 Tasks updated from sheet:', this.tasks.length, 'tasks');
  },

  // Get tasks assigned to current user
  getMyTasks(filterStatus = 'all') {
    let filtered = this.tasks.filter(t => t.AssignedTo === this.user.userId);
    
    if (filterStatus === 'open') {
      filtered = filtered.filter(t => t.Status !== 'completed');
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(t => t.Status === 'completed');
    }
    
    return filtered;
  },

  // Get tasks assigned to partner (created by current user, assigned to partner)
  getAssignedToPartner(filterStatus = 'all') {
    let filtered = this.tasks.filter(
      t => t.CreatedBy === this.user.userId && t.AssignedTo === this.user.partnerUserId
    );
    
    if (filterStatus === 'open') {
      filtered = filtered.filter(t => t.Status !== 'completed');
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(t => t.Status === 'completed');
    }
    
    return filtered;
  },

  // Get all tasks
  getAllTasks(filterStatus = 'all') {
    let filtered = this.tasks;
    
    if (filterStatus === 'open') {
      filtered = filtered.filter(t => t.Status !== 'completed');
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(t => t.Status === 'completed');
    }
    
    return filtered;
  },

  getTask(taskId) {
    return this.tasks.find(t => t.TaskID === taskId);
  }
};

// ============================================================================
// API LAYER - Direct Sheet Communication
// ============================================================================

const API = {
  async call(action, payload = {}) {
    try {
      console.log(`📤 API Call: ${action}`, payload);
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload })
      });

      const result = await response.json();
      console.log(`📥 API Response: ${action}`, result);
      
      return result;
    } catch (error) {
      console.error(`❌ API Error (${action}):`, error);
      return { success: false, error: error.message };
    }
  },

  // Fetch all tasks from sheet (always fresh)
  async getTasks() {
    return this.call('getTasks');
  },

  // Create task in sheet
  async createTask(taskData) {
    return this.call('createTask', taskData);
  },

  // Update task in sheet
  async updateTask(taskId, updates) {
    return this.call('updateTask', { TaskID: taskId, ...updates });
  },

  // Delete task (soft delete - set DeletedAt)
  async deleteTask(taskId) {
    return this.call('deleteTask', { TaskID: taskId });
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Companion App v3 Initializing...');

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch(err => console.error('❌ SW error:', err));
  }

  // Hide loading screen
  setTimeout(() => {
    document.querySelector('.app-loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    // Check if user is set up
    AppState.init();
    if (!AppState.user) {
      showSetupWizard();
    } else {
      showMainApp();
      loadTasksFromSheet(); // Fetch fresh data
    }
  }, 500);

  // Setup touch gestures
  setupTouchGestures();
});

// ============================================================================
// SETUP WIZARD
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

  if (!syncPin || syncPin.length !== 4 || !/^\d{4}$/.test(syncPin)) {
    alert('Please enter a valid 4-digit code');
    return;
  }

  console.log(`✅ Setup: ${yourName} & ${partnerName} with PIN: ${syncPin}`);

  // Determine user role (first user is user1, second is user2)
  const userId = pinOption === 'create' ? 'user1' : 'user2';
  const partnerUserId = userId === 'user1' ? 'user2' : 'user1';
  const theme = userId === 'user1' ? 'his' : 'her';

  // Save user to localStorage
  StorageManager.setUser(
    userId,
    yourName,
    partnerUserId,
    partnerName,
    theme
  );

  AppState.init();
  showMainApp();
  updateUI();
  loadTasksFromSheet();
  goToPage('home');
}

// ============================================================================
// MAIN APP DISPLAY
// ============================================================================

function showMainApp() {
  document.getElementById('setupWizard').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  applyTheme();
}

function updateUI() {
  if (!AppState.user) return;

  // Update settings display
  document.getElementById('settingYourName').textContent = AppState.user.userName || '-';
  document.getElementById('settingPartnerName').textContent = AppState.user.partnerName || '-';

  // Update theme selector
  document.getElementById('themeSelector').value = AppState.user.theme;

  // Update partner name in "Assigned to Partner" label
  const navAssignedLabel = document.getElementById('navAssignedLabel');
  if (navAssignedLabel) {
    navAssignedLabel.textContent = AppState.user.partnerName ? `${AppState.user.partnerName}'s` : 'Assigned';
  }

  const assignToPartnerOption = document.getElementById('assignToPartnerOption');
  if (assignToPartnerOption) {
    assignToPartnerOption.textContent = AppState.user.partnerName || 'Partner';
  }

  console.log('✅ UI updated for:', AppState.user.userName);
}

function applyTheme() {
  const body = document.body;
  body.classList.remove('theme-his', 'theme-her');
  body.classList.add(`theme-${AppState.user.theme}`);
  console.log('🎨 Theme applied:', AppState.user.theme);
}

// ============================================================================
// PAGE NAVIGATION
// ============================================================================

function goToPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = 'none';
  });

  // Show selected page
  const pageElement = document.getElementById(`${pageName}Page`);
  if (pageElement) {
    pageElement.style.display = 'block';
  }

  // Update nav active state
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  const activeTab = document.querySelector(`.nav-tab[data-page="${pageName}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  AppState.currentPage = pageName;

  // Render page content
  if (pageName === 'home') renderHomePageTasks();
  if (pageName === 'myTasks') renderMyTasks();
  if (pageName === 'assignedToPartner') renderAssignedTasks();
}

// ============================================================================
// TASK LOADING - FETCH FRESH FROM SHEET (Step 1 of 3-Step Process)
// ============================================================================

async function loadTasksFromSheet() {
  console.log('⏳ Fetching tasks from sheet...');
  showLoadingIndicator(true);

  try {
    const result = await API.getTasks();

    if (result.success && result.data) {
      // Update AppState with fresh data from sheet
      AppState.setTasksFromSheet(result.data);
      console.log('✅ Tasks loaded from sheet');

      // Re-render current page
      renderCurrentPage();
      showSyncIndicator();
    } else {
      console.error('❌ Failed to load tasks:', result.error);
      showError('Failed to load tasks: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('❌ Load tasks error:', error);
    showError('Connection error: ' + error.message);
  } finally {
    showLoadingIndicator(false);
  }
}

function renderCurrentPage() {
  if (AppState.currentPage === 'home') renderHomePageTasks();
  if (AppState.currentPage === 'myTasks') renderMyTasks();
  if (AppState.currentPage === 'assignedToPartner') renderAssignedTasks();
}

// ============================================================================
// TASK RENDERING
// ============================================================================

function renderHomePageTasks() {
  const filterStatus = document.querySelector('.home-filters .filter-btn.active')?.textContent.toLowerCase() || 'all';
  let tasks = AppState.getAllTasks(filterStatus === 'all' ? 'all' : filterStatus === 'open' ? 'open' : 'completed');

  const container = document.getElementById('homeTasksList');
  
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state-compact">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-title">No tasks</div>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
  attachTaskCardListeners();
}

function renderMyTasks() {
  const filterStatus = document.querySelector('.my-tasks-filters .filter-btn.active')?.textContent.toLowerCase() || 'all';
  let tasks = AppState.getMyTasks(filterStatus === 'all' ? 'all' : filterStatus === 'open' ? 'open' : 'completed');

  const container = document.getElementById('myTasksList');
  
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state-compact">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No tasks</div>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
  attachTaskCardListeners();
}

function renderAssignedTasks() {
  const filterStatus = document.querySelector('.assigned-filters .filter-btn.active')?.textContent.toLowerCase() || 'all';
  let tasks = AppState.getAssignedToPartner(filterStatus === 'all' ? 'all' : filterStatus === 'open' ? 'open' : 'completed');

  const container = document.getElementById('assignedTasksList');
  
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state-compact">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">No tasks assigned</div>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
  attachTaskCardListeners();
}

function renderTaskCard(task) {
  const isCompleted = task.Status === 'completed';
  const isPrivate = task.IsPrivate === 'TRUE' || task.IsPrivate === true;
  const category = task.Category || 'Task';
  
  return `
    <div class="task-card ${isCompleted ? 'completed' : ''}" data-task-id="${escapeHtml(task.TaskID)}">
      <div class="task-info">
        <div class="task-title ${isCompleted ? 'line-through' : ''}">${escapeHtml(task.Title || 'Untitled')}</div>
        <div class="task-meta">
          ${isPrivate ? '🔐' : ''}
          ${category ? `<span>${escapeHtml(category)}</span>` : ''}
          ${task.DueDate ? `<span>📅 ${escapeHtml(task.DueDate)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function attachTaskCardListeners() {
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
      const taskId = card.dataset.taskId;
      handleTaskClick(taskId);
    });
  });
}

// ============================================================================
// TASK INTERACTIONS - 3-STEP PROCESS
// ============================================================================

async function handleTaskClick(taskId) {
  const task = AppState.getTask(taskId);
  if (!task) {
    console.error('❌ Task not found:', taskId);
    return;
  }

  // Check if private task needs passcode
  const isPrivate = task.IsPrivate === 'TRUE' || task.IsPrivate === true;
  const hasPasscode = (task.ContentHash || '').trim().length > 0;

  console.log('🔍 Task clicked:', { taskId, isPrivate, hasPasscode, contentHash: task.ContentHash });

  if (isPrivate && hasPasscode) {
    AppState.pendingPasscodeTaskId = taskId;
    document.getElementById('passcodeModal').style.display = 'flex';
    setTimeout(() => document.getElementById('passcodeInput').focus(), 100);
  } else {
    showTaskDetails(task);
  }
}

function showTaskDetails(task) {
  AppState.selectedTaskId = task.TaskID;
  document.getElementById('detailTaskTitle').textContent = escapeHtml(task.Title);

  // Check for photo in localStorage
  const photo = StorageManager.getPhoto(task.TaskID);
  const hasPhoto = photo && photo.length > 0;

  const html = `
    <div class="task-detail-section">
      <h3>Description</h3>
      <p>${escapeHtml(task.Description) || 'No description'}</p>
    </div>

    ${hasPhoto ? `
      <div class="task-detail-section">
        <h3>📸 Photo</h3>
        <img src="${photo}" style="width: 100%; max-height: 300px; border-radius: 8px; object-fit: cover; margin-top: 8px;" alt="Task photo">
      </div>
    ` : ''}

    <div class="task-detail-section">
      <h3>Details</h3>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">${task.Status === 'completed' ? '✅ Completed' : '⏳ Open'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Priority:</span>
        <span class="detail-value">${escapeHtml(task.Priority || 'Medium')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Category:</span>
        <span class="detail-value">${escapeHtml(task.Category || 'Task')}</span>
      </div>
      ${task.DueDate ? `
        <div class="detail-row">
          <span class="detail-label">Due Date:</span>
          <span class="detail-value">${escapeHtml(task.DueDate)}</span>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('detailTaskContent').innerHTML = html;
  document.getElementById('taskDetailsModal').style.display = 'flex';
}

function closeTaskDetailsModal() {
  document.getElementById('taskDetailsModal').style.display = 'none';
  AppState.selectedTaskId = null;
}

async function completeDetailTask() {
  if (!AppState.selectedTaskId) return;

  showLoadingIndicator(true);
  const task = AppState.getTask(AppState.selectedTaskId);
  const newStatus = task.Status === 'completed' ? 'open' : 'completed';

  try {
    // STEP 2: SAVE to sheet
    const result = await API.updateTask(AppState.selectedTaskId, { Status: newStatus });

    if (result.success) {
      // STEP 1: FETCH fresh data
      await loadTasksFromSheet();
      // STEP 3: RENDER (done by loadTasksFromSheet)
      closeTaskDetailsModal();
      showSuccess('Task updated');
    } else {
      showError('Failed to update task: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    showError('Error: ' + error.message);
  } finally {
    showLoadingIndicator(false);
  }
}

async function deleteDetailTask() {
  if (!AppState.selectedTaskId) return;
  if (!confirm('Delete this task?')) return;

  showLoadingIndicator(true);

  try {
    // STEP 2: SAVE to sheet (soft delete)
    const result = await API.deleteTask(AppState.selectedTaskId);

    if (result.success) {
      // Delete photo from localStorage
      StorageManager.deletePhoto(AppState.selectedTaskId);

      // STEP 1: FETCH fresh data
      await loadTasksFromSheet();
      // STEP 3: RENDER (done by loadTasksFromSheet)
      closeTaskDetailsModal();
      showSuccess('Task deleted');
    } else {
      showError('Failed to delete task: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    showError('Error: ' + error.message);
  } finally {
    showLoadingIndicator(false);
  }
}

// ============================================================================
// PASSCODE VERIFICATION
// ============================================================================

function verifyPasscode() {
  const enteredPasscode = document.getElementById('passcodeInput').value.trim();

  if (!enteredPasscode || enteredPasscode.length !== 4) {
    alert('Please enter a 4-digit passcode');
    return;
  }

  const task = AppState.getTask(AppState.pendingPasscodeTaskId);
  if (!task) {
    alert('Task not found');
    return;
  }

  const storedPasscode = (task.ContentHash || '').trim();

  console.log('🔐 Passcode verification:', {
    entered: enteredPasscode,
    stored: storedPasscode,
    match: enteredPasscode === storedPasscode
  });

  if (enteredPasscode !== storedPasscode) {
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
  AppState.pendingPasscodeTaskId = null;
}

// ============================================================================
// TASK CREATION - 3-STEP PROCESS
// ============================================================================

function openCreateTaskModal() {
  document.getElementById('createTaskModal').style.display = 'flex';
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
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

function togglePrivateFields() {
  const isPrivate = document.getElementById('taskPrivate').checked;
  document.getElementById('privateFields').style.display = isPrivate ? 'block' : 'none';
}

async function createTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const assignedToValue = document.getElementById('taskAssignedTo').value;
  const category = document.getElementById('taskCategory').value || 'Together';
  const priority = document.getElementById('taskPriority').value || 'medium';
  const dueDate = document.getElementById('taskDueDate').value;
  const isPrivate = document.getElementById('taskPrivate').checked;
  const passcode = document.getElementById('taskPasscode').value.trim();
  const photoInput = document.getElementById('taskPhoto');

  // VALIDATE
  if (!title) {
    alert('Please enter a task title');
    return;
  }

  if (!assignedToValue) {
    alert('Please select who this is for');
    return;
  }

  if (isPrivate && !passcode) {
    alert('Please enter a 4-digit passcode for private task');
    return;
  }

  if (isPrivate && (passcode.length !== 4 || !/^\d{4}$/.test(passcode))) {
    alert('Passcode must be exactly 4 digits');
    return;
  }

  showLoadingIndicator(true);

  try {
    const assignedToId = assignedToValue === 'me' ? AppState.user.userId : AppState.user.partnerUserId;

    // STEP 2: SAVE to sheet
    const taskData = {
      Title: title,
      Description: description,
      AssignedTo: assignedToId,
      CreatedBy: AppState.user.userId,
      Category: category,
      Priority: priority,
      DueDate: dueDate,
      Status: 'open',
      IsPrivate: isPrivate ? 'TRUE' : 'FALSE',
      ContentHash: isPrivate ? passcode.trim() : ''
    };

    console.log('📝 Creating task:', taskData);

    const result = await API.createTask(taskData);

    if (!result.success) {
      showError('Failed to create task: ' + (result.error || 'Unknown error'));
      return;
    }

    // Store photo if exists (in localStorage, NOT in sheet)
    if (photoInput.files && photoInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        StorageManager.storePhoto(result.data.TaskID, e.target.result);
      };
      reader.readAsDataURL(photoInput.files[0]);
    }

    // STEP 1: FETCH fresh data
    await loadTasksFromSheet();
    // STEP 3: RENDER (done by loadTasksFromSheet)

    closeCreateTaskModal();
    showSuccess('Task created!');
  } catch (error) {
    showError('Error: ' + error.message);
  } finally {
    showLoadingIndicator(false);
  }
}

// ============================================================================
// SETTINGS & USER MANAGEMENT
// ============================================================================

function changeTheme(newTheme) {
  if (!AppState.user) return;
  AppState.user.theme = newTheme;
  StorageManager.setUser(
    AppState.user.userId,
    AppState.user.userName,
    AppState.user.partnerUserId,
    AppState.user.partnerName,
    newTheme
  );
  applyTheme();
  console.log('✅ Theme changed to:', newTheme);
}

function switchUser() {
  if (!confirm('Switch to ' + AppState.user.partnerName + "'s profile?")) {
    return;
  }

  // Swap user IDs
  const oldUserId = AppState.user.userId;
  const newUserId = AppState.user.partnerUserId;
  const newTheme = newUserId === 'user1' ? 'his' : 'her';

  // Update user
  StorageManager.setUser(
    newUserId,
    AppState.user.partnerName,
    oldUserId,
    AppState.user.userName,
    newTheme
  );

  AppState.init();
  AppState.clearTasks(); // Clear old user's tasks

  // Reload everything
  updateUI();
  applyTheme();
  goToPage('home');
  loadTasksFromSheet();

  showSuccess('Switched to ' + AppState.user.userName);
}

function resetAllData() {
  StorageManager.clearAll();
}

// ============================================================================
// FILTERING
// ============================================================================

function filterHome(filterType) {
  document.querySelectorAll('.home-filters .filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  renderHomePageTasks();
}

function filterMyTasks(filterType) {
  document.querySelectorAll('.my-tasks-filters .filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  renderMyTasks();
}

function filterAssignedTasks(filterType) {
  document.querySelectorAll('.assigned-filters .filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  renderAssignedTasks();
}

// ============================================================================
// UI FEEDBACK
// ============================================================================

function showLoadingIndicator(show) {
  const indicator = document.getElementById('loadingIndicator');
  if (!indicator) {
    const div = document.createElement('div');
    div.id = 'loadingIndicator';
    div.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      z-index: 999;
      font-size: 14px;
      display: none;
    `;
    div.textContent = 'Loading...';
    document.body.appendChild(div);
  }
  document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

function showError(message) {
  console.error('❌ Error:', message);
  alert('❌ ' + message);
}

function showSuccess(message) {
  console.log('✅ Success:', message);
  // Could show toast notification instead
  const toast = document.createElement('div');
  toast.textContent = '✅ ' + message;
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 16px;
    background: var(--color-primary);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 999;
    font-size: 14px;
    font-weight: 600;
    animation: slideInUp 300ms ease-out, slideOutDown 300ms ease-out 2700ms forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showSyncIndicator() {
  // Brief visual feedback that sync happened
  const icon = document.getElementById('syncIcon');
  if (icon) {
    icon.textContent = '✓';
    setTimeout(() => { icon.textContent = ''; }, 1000);
  }
}

// ============================================================================
// TOUCH GESTURES - Pull to Refresh & Swipe
// ============================================================================

let touchStartY = 0;
let touchStartX = 0;

function setupTouchGestures() {
  const pageContainer = document.querySelector('.page-container');
  if (!pageContainer) return;

  pageContainer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  });

  pageContainer.addEventListener('touchend', (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const diffY = touchEndY - touchStartY;
    const diffX = touchEndX - touchStartX;

    // Pull to refresh (drag down from top)
    if (pageContainer.scrollTop === 0 && diffY > 80) {
      console.log('🔄 Pull to refresh');
      loadTasksFromSheet();
      return;
    }

    // Swipe navigation (swipe left/right)
    if (Math.abs(diffX) > 50 && Math.abs(diffY) < 50) {
      handleSwipeNavigation(diffX);
    }
  });
}

function handleSwipeNavigation(diffX) {
  const navTabs = document.querySelectorAll('.nav-tab');
  const activeTab = document.querySelector('.nav-tab.active');
  if (!activeTab) return;

  const currentIndex = Array.from(navTabs).indexOf(activeTab);
  let nextIndex;

  if (diffX > 0) {
    // Swipe right - previous tab
    nextIndex = currentIndex > 0 ? currentIndex - 1 : navTabs.length - 1;
  } else {
    // Swipe left - next tab
    nextIndex = currentIndex < navTabs.length - 1 ? currentIndex + 1 : 0;
  }

  console.log('👆 Swipe:', diffX > 0 ? 'right' : 'left');
  navTabs[nextIndex].click();
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('createTaskModal').style.display = 'none';
    document.getElementById('taskDetailsModal').style.display = 'none';
    document.getElementById('passcodeModal').style.display = 'none';
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openCreateTaskModal();
  }
});
