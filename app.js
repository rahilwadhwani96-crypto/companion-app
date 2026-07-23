/**
 * Companion App - Complete Application Logic v3
 * With PIN-based device linking, passcode protection, and photo attachments
 * FIXES: Passcode verification, photo display, theme selector in settings
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbzY7xAh9eQHl6idW4W6i--7YIRjp7IbFGQ4a1k3IXxrnry1X1b7lRjmpUGMWpkUy1NCQg/exec';

// ============================================================================
// PHOTO STORAGE (localStorage)
// ============================================================================

const PhotoStorage = {
  store(taskId, photoData) {
    try {
      localStorage.setItem(`photo_${taskId}`, photoData);
      console.log('📸 Photo stored locally for task:', taskId);
      return taskId;
    } catch (e) {
      console.error('❌ Photo storage failed:', e);
      return null;
    }
  },

  retrieve(taskId) {
    try {
      const photo = localStorage.getItem(`photo_${taskId}`);
      return photo || null;
    } catch (e) {
      console.error('❌ Photo retrieval failed:', e);
      return null;
    }
  },

  delete(taskId) {
    try {
      localStorage.removeItem(`photo_${taskId}`);
    } catch (e) {
      console.error('❌ Photo delete failed:', e);
    }
  }
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const State = {
  user: {
    id: null,
    name: null,
    partnerName: null,
    partnerId: null,
    syncPin: null,
    theme: 'his'
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
      this.currentTheme = this.user.theme || (this.user.id === 'user1' ? 'his' : 'her');
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
      syncPin: syncPin,
      theme: 'his'
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
      syncPin: this.user.syncPin,
      theme: isCurrent ? 'her' : 'his'
    };

    this.user = newUser;
    this.currentTheme = newUser.theme;
    localStorage.setItem('companion-user', JSON.stringify(this.user));
  },

  setTheme(theme) {
    this.currentTheme = theme;
    this.user.theme = theme;
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
  
  const assignToPartnerOption = document.getElementById('assignToPartnerOption');
  if (assignToPartnerOption) {
    assignToPartnerOption.textContent = State.user.partnerName || 'Partner';
  }

  const navAssignedLabel = document.getElementById('navAssignedLabel');
  if (navAssignedLabel) {
    navAssignedLabel.textContent = `${State.user.partnerName}'s`;
  }

  const assignedToPartnerTitle = document.getElementById('assignedToPartnerTitle');
  if (assignedToPartnerTitle) {
    assignedToPartnerTitle.textContent = `Assigned to ${State.user.partnerName || 'undefined'}`;
  }

  // Update settings
  document.getElementById('settingYourName').textContent = State.user.name || '-';
  document.getElementById('settingPartnerName').textContent = State.user.partnerName || '-';
  document.getElementById('settingSyncPin').textContent = State.user.syncPin || '-';

  // Set theme selector
  document.getElementById('themeSelector').value = State.currentTheme;
}

function updateTheme() {
  const body = document.body;
  body.classList.remove('theme-his', 'theme-her');
  body.classList.add(`theme-${State.currentTheme}`);
  console.log('🎨 Theme updated to:', State.currentTheme);
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
  const pageId = `${pageName}Page`;
  const pageElement = document.getElementById(pageId);
  if (pageElement) {
    pageElement.style.display = 'block';
  }

  // Update navigation active state
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  const activeTab = document.querySelector(`.nav-tab[data-page="${pageName}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  State.currentPage = pageName;

  // Render page content
  if (pageName === 'home') renderHomeTasksList();
  if (pageName === 'myTasks') renderMyTasks();
  if (pageName === 'assignedToPartner') renderAssignedTasks();
}

function goToSettings() {
  goToPage('settings');
}



// ============================================================================
// THEME MANAGEMENT - MOVED FROM HEADER TO SETTINGS
// ============================================================================

function changeTheme(newTheme) {
  State.setTheme(newTheme);
  updateTheme();
  console.log('✅ Theme changed to:', newTheme);
}

// ============================================================================
// API CALLS
// ============================================================================

async function apiCall(action, data = {}) {
  try {
    const payload = { action, ...data };
    console.log('📤 API Call:', action);

    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('📥 API Response:', result);
    return result;
  } catch (error) {
    console.error('❌ API Error:', error);
    return { error: error.message };
  }
}

async function loadAllData() {
  console.log('⏳ Loading data...');
  const tasksResult = await apiCall('getTasks', {});

  if (tasksResult.success && tasksResult.data) {
    State.setTasks(tasksResult.data);
    console.log('✅ Tasks loaded:', tasksResult.data.length);
    renderHomeTasksList();
  } else {
    console.warn('⚠️ Could not load tasks:', tasksResult.error);
  }
}

// ============================================================================
// RENDERING
// ============================================================================

function renderHomeTasksList() {
  let tasks = State.getAllTasks('all');
  
  if (State.filterStatus === 'open') {
    tasks = State.getAllTasks('open');
  } else if (State.filterStatus === 'completed') {
    tasks = State.getAllTasks('completed');
  }

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

  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
      const taskId = card.dataset.taskId;
      handleTaskClick(taskId);
    });
  });
}

function renderMyTasks() {
  let tasks = State.getMyTasks('all');

  if (State.filterStatus === 'open') {
    tasks = State.getMyTasks('open');
  } else if (State.filterStatus === 'completed') {
    tasks = State.getMyTasks('completed');
  }

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

  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
      const taskId = card.dataset.taskId;
      handleTaskClick(taskId);
    });
  });
}

function renderAssignedTasks() {
  let tasks = State.getAssignedToPartner('all');

  if (State.filterStatus === 'open') {
    tasks = State.getAssignedToPartner('open');
  } else if (State.filterStatus === 'completed') {
    tasks = State.getAssignedToPartner('completed');
  }

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

  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
      const taskId = card.dataset.taskId;
      handleTaskClick(taskId);
    });
  });
}

function renderTaskCard(task) {
  const isCompleted = task.Status === 'completed';
  const isPrivate = task.IsPrivate === 'TRUE' || task.IsPrivate === true;
  const priority = task.Priority || 'medium';
  const category = task.Category || 'Task';

  return `
    <div class="task-card ${isCompleted ? 'completed' : ''}" data-task-id="${escapeHtml(task.TaskID)}">
      <div class="task-info">
        <div class="task-title ${isCompleted ? 'line-through' : ''}">${escapeHtml(task.Title)}</div>
        <div class="task-meta">
          ${isPrivate ? '🔐 Private' : ''}
          ${category ? `<span>${escapeHtml(category)}</span>` : ''}
          ${task.DueDate ? `<span>📅 ${escapeHtml(task.DueDate)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// FILTERING
// ============================================================================

function filterHome(type) {
  if (type === 'all') State.filterStatus = 'all';
  else if (type === 'myTasks') State.filterStatus = 'open';
  else if (type === 'assigned') State.filterStatus = 'open';

  updateFilterButtons('.filters');
  renderHomeTasksList();
}

function filterMyTasks(status) {
  State.filterStatus = status;
  updateFilterButtons('.filters');
  renderMyTasks();
}

function filterAssignedTasks(status) {
  State.filterStatus = status;
  updateFilterButtons('.filters');
  renderAssignedTasks();
}

function updateFilterButtons(selector) {
  const buttons = document.querySelectorAll(selector + ' .filter-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  buttons.forEach(btn => {
    if (btn.textContent.toLowerCase().includes(State.filterStatus.toLowerCase()) ||
        (State.filterStatus === 'all' && btn.textContent === 'All')) {
      btn.classList.add('active');
    }
  });
}

// ============================================================================
// TASK DETAILS MODAL
// ============================================================================

async function handleTaskClick(taskId) {
  const task = State.getTask(taskId);
  if (!task) {
    console.error('❌ Task not found:', taskId);
    return;
  }

  // Check if task is private and has passcode
  const isPrivate = task.IsPrivate === 'TRUE' || task.IsPrivate === true || task.IsPrivate === 1;
  const storedPasscode = (task.ContentHash || '').trim();
  const hasPasscode = storedPasscode.length > 0;

  console.log('🔍 Task clicked:', {
    taskId: taskId,
    isPrivate: isPrivate,
    hasPasscode: hasPasscode,
    storedPasscode: storedPasscode,
    IsPrivate: task.IsPrivate,
    ContentHash: task.ContentHash
  });

  if (isPrivate && hasPasscode) {
    console.log('🔐 Showing passcode modal for task:', taskId);
    State.pendingPasscodeTaskId = taskId;
    document.getElementById('passcodeModal').style.display = 'flex';
    setTimeout(() => document.getElementById('passcodeInput').focus(), 100);
  } else {
    showTaskDetails(task);
  }
}

function showTaskDetails(task) {
  State.selectedTaskId = task.TaskID;

  document.getElementById('detailTaskTitle').textContent = escapeHtml(task.Title);

  // Check for photo in localStorage
  const photoData = PhotoStorage.retrieve(task.TaskID);
  const hasPhoto = photoData && photoData.length > 0;

  console.log('📸 Checking for photo:', {
    taskId: task.TaskID,
    hasPhoto: hasPhoto,
    photoLength: photoData ? photoData.length : 0
  });

  const html = `
    <div class="task-detail-section">
      <h3>Description</h3>
      <p>${escapeHtml(task.Description) || 'No description'}</p>
    </div>

    ${hasPhoto ? `
      <div class="task-detail-section">
        <h3>📸 Photo</h3>
        <img src="${photoData}" 
             style="width: 100%; max-height: 300px; border-radius: 8px; object-fit: cover; margin-top: 8px;" 
             alt="Task attachment">
      </div>
    ` : ''}

    <div class="task-detail-section">
      <h3>Details</h3>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">${escapeHtml(task.Status === 'completed' ? '✅ Completed' : '⏳ Open')}</span>
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

  // Delete photo from localStorage if exists
  PhotoStorage.delete(State.selectedTaskId);
  
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
// PASSCODE PROTECTION - FIXED
// ============================================================================

function verifyPasscode() {
  const passcode = document.getElementById('passcodeInput').value.trim();

  if (!passcode || passcode.length !== 4) {
    alert('Please enter a 4-digit passcode');
    return;
  }

  const task = State.getTask(State.pendingPasscodeTaskId);
  if (!task) {
    alert('Task not found');
    return;
  }

  // FIX: Get stored passcode and trim both values
  const storedPasscode = (task.ContentHash || '').trim();
  const enteredPasscode = passcode.trim();

  console.log('Comparing passcodes:');
  console.log('  Entered:', enteredPasscode, 'Length:', enteredPasscode.length);
  console.log('  Stored:', storedPasscode, 'Length:', storedPasscode.length);
  console.log('  Match:', enteredPasscode === storedPasscode);

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

  // Prepare passcode (stored in ContentHash field in sheet)
  let contentHash = '';
  if (isPrivate && passcode) {
    contentHash = passcode.trim();
  }

  console.log('📋 Task data:', {
    isPrivate: isPrivate,
    hasPasscode: contentHash.length > 0,
    contentHash: contentHash,
    hasAttachment: attachmentData && attachmentData.length > 0
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
    Status: 'open',
    ContentHash: contentHash,
    AttachmentURLs: 'photo' // Marker that this task has a photo
  });

  if (result.success) {
    const newTask = result.data;
    
    // Store photo locally if it exists
    if (attachmentData && attachmentData.length > 0) {
      PhotoStorage.store(newTask.TaskID, attachmentData);
      console.log('📸 Photo stored for task:', newTask.TaskID);
    }

    State.addTask(newTask);
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
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openCreateTaskModal();
  }
});
