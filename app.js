/**
 * Companion App v3.1 - Clean Rewrite
 * Focus: Make it ACTUALLY WORK
 * 
 * Core principle: Fetch sheet data → Store in memory → Render to screen
 * No complexity. No tricks. Just work.
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbzY7xAh9eQHl6idW4W6i--7YIRjp7IbFGQ4a1k3IXxrnry1X1b7lRjmpUGMWpkUy1NCQg/exec';

// Simple global state
let currentUser = null;
let allTasks = [];
let currentPage = 'home';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 App Starting...');
  
  // Check if user exists
  const stored = localStorage.getItem('companion-user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      console.log('✅ User loaded:', currentUser.userName);
      showMainApp();
      updateUILabels();
      loadAllTasks();
    } catch (e) {
      console.error('❌ Error loading user:', e);
      showSetupWizard();
    }
  } else {
    console.log('📋 No user found, showing setup');
    showSetupWizard();
  }
});

// ============================================================================
// SETUP
// ============================================================================

function showSetupWizard() {
  document.getElementById('setupWizard').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function goToStep(step) {
  document.querySelectorAll('.setup-step').forEach(s => s.classList.remove('active'));
  document.getElementById('setupStep' + step).classList.add('active');
}

function completeSetup() {
  const yourName = document.getElementById('yourName').value.trim();
  const partnerName = document.getElementById('partnerName').value.trim();
  const syncPin = document.getElementById('syncPin').value.trim();

  if (!yourName || !partnerName || !syncPin) {
    alert('Please fill all fields');
    return;
  }

  // Determine if user1 or user2 based on sync pin
  const isCreator = document.getElementById('pinOption').value === 'create';
  const userId = isCreator ? 'user1' : 'user2';
  const partnerId = isCreator ? 'user2' : 'user1';
  const theme = isCreator ? 'his' : 'her';

  currentUser = {
    userId: userId,
    userName: yourName,
    partnerId: partnerId,
    partnerName: partnerName,
    theme: theme
  };

  localStorage.setItem('companion-user', JSON.stringify(currentUser));
  console.log('✅ Setup complete:', currentUser);

  showMainApp();
  updateUILabels();
  loadAllTasks();
}

// ============================================================================
// MAIN APP
// ============================================================================

function showMainApp() {
  document.getElementById('setupWizard').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  applyTheme();
}

function updateUILabels() {
  if (!currentUser) return;
  
  document.getElementById('settingYourName').textContent = currentUser.userName;
  document.getElementById('settingPartnerName').textContent = currentUser.partnerName;
  document.getElementById('themeSelector').value = currentUser.theme;
  
  const partnerLabel = document.getElementById('navAssignedLabel');
  if (partnerLabel) partnerLabel.textContent = currentUser.partnerName + "'s";
  
  const assignOption = document.getElementById('assignToPartnerOption');
  if (assignOption) assignOption.textContent = currentUser.partnerName;
}

function applyTheme() {
  document.body.classList.remove('theme-his', 'theme-her');
  document.body.classList.add('theme-' + currentUser.theme);
}

// ============================================================================
// LOAD TASKS - THIS IS THE MOST IMPORTANT FUNCTION
// ============================================================================

async function loadAllTasks() {
  console.log('📥 Loading tasks from sheet...');
  
  try {
    // Fetch from API
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getTasks' })
    });

    const result = await response.json();
    console.log('📡 API Response:', result);

    if (!result.success || !result.data || !Array.isArray(result.data)) {
      console.error('❌ Invalid API response:', result);
      allTasks = [];
      renderCurrentPage();
      return;
    }

    // Store tasks in memory
    allTasks = result.data;
    console.log('✅ Tasks loaded:', allTasks.length, 'tasks');
    console.log('   Tasks:', allTasks.map(t => ({ id: t.TaskID, title: t.Title, assigned: t.AssignedTo })));

    // Render current page
    renderCurrentPage();

  } catch (error) {
    console.error('❌ Error loading tasks:', error);
    alert('Error loading tasks: ' + error.message);
  }
}

// ============================================================================
// NAVIGATE PAGES
// ============================================================================

function goToPage(pageName) {
  currentPage = pageName;
  
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  
  // Show current page
  const pageEl = document.getElementById(pageName + 'Page');
  if (pageEl) pageEl.style.display = 'block';

  // Update nav
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.nav-tab[data-page="${pageName}"]`)?.classList.add('active');

  // Render
  renderCurrentPage();
}

// ============================================================================
// RENDER - THIS IS WHERE TASKS APPEAR ON SCREEN
// ============================================================================

function renderCurrentPage() {
  console.log('🎨 Rendering page:', currentPage);
  
  if (currentPage === 'home') renderHome();
  if (currentPage === 'myTasks') renderMyTasks();
  if (currentPage === 'assignedToPartner') renderAssignedTasks();
}

function renderHome() {
  const container = document.getElementById('homeTasksList');
  if (!container) {
    console.error('❌ homeTasksList not found!');
    return;
  }

  const filterStatus = document.querySelector('.home-filters .filter-btn.active')?.textContent.toLowerCase() || 'all';
  let tasks = filterTasks(allTasks, filterStatus);

  console.log('🏠 Rendering home:', tasks.length, 'tasks with filter:', filterStatus);

  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state-compact"><div class="empty-state-icon">✨</div><div class="empty-state-title">No tasks</div></div>';
    return;
  }

  container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
  attachTaskListeners();
}

function renderMyTasks() {
  const container = document.getElementById('myTasksList');
  if (!container) {
    console.error('❌ myTasksList not found!');
    return;
  }

  const filterStatus = document.querySelector('.my-tasks-filters .filter-btn.active')?.textContent.toLowerCase() || 'all';
  let tasks = allTasks.filter(t => t.AssignedTo === currentUser.userId);
  tasks = filterTasks(tasks, filterStatus);

  console.log('📋 Rendering my tasks:', tasks.length, 'tasks');

  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state-compact"><div class="empty-state-icon">📭</div><div class="empty-state-title">No tasks</div></div>';
    return;
  }

  container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
  attachTaskListeners();
}

function renderAssignedTasks() {
  const container = document.getElementById('assignedTasksList');
  if (!container) {
    console.error('❌ assignedTasksList not found!');
    return;
  }

  const filterStatus = document.querySelector('.assigned-filters .filter-btn.active')?.textContent.toLowerCase() || 'all';
  let tasks = allTasks.filter(t => t.CreatedBy === currentUser.userId && t.AssignedTo === currentUser.partnerId);
  tasks = filterTasks(tasks, filterStatus);

  console.log('👥 Rendering assigned tasks:', tasks.length, 'tasks');

  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state-compact"><div class="empty-state-icon">🎯</div><div class="empty-state-title">No tasks assigned</div></div>';
    return;
  }

  container.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
  attachTaskListeners();
}

function filterTasks(tasks, status) {
  if (status === 'open' || status === 'open') {
    return tasks.filter(t => t.Status !== 'completed');
  }
  if (status === 'done' || status === 'completed') {
    return tasks.filter(t => t.Status === 'completed');
  }
  return tasks;
}

function renderTaskCard(task) {
  const isCompleted = task.Status === 'completed';
  const isPrivate = task.IsPrivate === 'TRUE' || task.IsPrivate === true;
  
  return `
    <div class="task-card ${isCompleted ? 'completed' : ''}" onclick="clickTask('${task.TaskID}')">
      <div class="task-info">
        <div class="task-title ${isCompleted ? 'line-through' : ''}">${escapeHtml(task.Title || 'Untitled')}</div>
        <div class="task-meta">
          ${isPrivate ? '🔐 ' : ''}
          ${task.Category ? '<span>' + escapeHtml(task.Category) + '</span>' : ''}
          ${task.DueDate ? '<span>📅 ' + escapeHtml(task.DueDate) + '</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

function attachTaskListeners() {
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// CREATE TASK
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
}

async function createTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const assignedToValue = document.getElementById('taskAssignedTo').value;
  const category = document.getElementById('taskCategory').value || '';
  const priority = document.getElementById('taskPriority').value || 'medium';
  const dueDate = document.getElementById('taskDueDate').value || '';
  const isPrivate = document.getElementById('taskPrivate').checked;
  const passcode = document.getElementById('taskPasscode').value.trim();

  if (!title) { alert('Enter task title'); return; }
  if (!assignedToValue) { alert('Select who this is for'); return; }
  if (isPrivate && !passcode) { alert('Enter 4-digit passcode'); return; }

  const assignedToId = assignedToValue === 'me' ? currentUser.userId : currentUser.partnerId;

  console.log('📝 Creating task:');
  console.log('   Title:', title);
  console.log('   AssignedTo:', assignedToId);
  console.log('   CreatedBy:', currentUser.userId);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'createTask',
        Title: title,
        Description: description,
        AssignedTo: assignedToId,
        CreatedBy: currentUser.userId,
        Category: category,
        Priority: priority,
        DueDate: dueDate,
        Status: 'open',
        IsPrivate: isPrivate ? 'TRUE' : 'FALSE',
        ContentHash: isPrivate ? passcode : ''
      })
    });

    const result = await response.json();
    console.log('📡 Create response:', result);

    if (!result.success) {
      alert('Error: ' + (result.error || 'Unknown error'));
      return;
    }

    console.log('✅ Task created in sheet');
    closeCreateTaskModal();

    // CRITICAL: Reload tasks from sheet
    console.log('⏳ Reloading all tasks from sheet...');
    await loadAllTasks();

    alert('Task created!');

  } catch (error) {
    console.error('❌ Create error:', error);
    alert('Error: ' + error.message);
  }
}

// ============================================================================
// TASK ACTIONS
// ============================================================================

function clickTask(taskId) {
  const task = allTasks.find(t => t.TaskID === taskId);
  if (!task) return;

  const isPrivate = task.IsPrivate === 'TRUE' || task.IsPrivate === true;
  const hasPasscode = (task.ContentHash || '').trim().length > 0;

  if (isPrivate && hasPasscode) {
    promptPasscode(taskId);
  } else {
    showTaskDetails(task);
  }
}

function promptPasscode(taskId) {
  const passcode = prompt('🔐 Enter passcode (4 digits):');
  if (!passcode) return;

  const task = allTasks.find(t => t.TaskID === taskId);
  if (!task) return;

  if (passcode.trim() !== (task.ContentHash || '').trim()) {
    alert('❌ Incorrect passcode');
    return;
  }

  showTaskDetails(task);
}

function showTaskDetails(task) {
  document.getElementById('detailTaskTitle').textContent = task.Title;
  
  let html = `
    <div class="task-detail-section">
      <h3>Description</h3>
      <p>${escapeHtml(task.Description) || 'No description'}</p>
    </div>
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
      ${task.Category ? `
        <div class="detail-row">
          <span class="detail-label">Category:</span>
          <span class="detail-value">${escapeHtml(task.Category)}</span>
        </div>
      ` : ''}
      ${task.DueDate ? `
        <div class="detail-row">
          <span class="detail-label">Due Date:</span>
          <span class="detail-value">${escapeHtml(task.DueDate)}</span>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('detailTaskContent').innerHTML = html;
  
  const completeBtn = document.getElementById('completeDetailBtn');
  completeBtn.textContent = task.Status === 'completed' ? 'Mark as Open' : 'Mark Complete';
  completeBtn.onclick = () => completeTask(task.TaskID);

  document.getElementById('taskDetailsModal').style.display = 'flex';
}

function closeTaskDetailsModal() {
  document.getElementById('taskDetailsModal').style.display = 'none';
}

async function completeTask(taskId) {
  const task = allTasks.find(t => t.TaskID === taskId);
  if (!task) return;

  const newStatus = task.Status === 'completed' ? 'open' : 'completed';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateTask',
        TaskID: taskId,
        Status: newStatus
      })
    });

    const result = await response.json();
    if (!result.success) {
      alert('Error: ' + (result.error || 'Unknown'));
      return;
    }

    closeTaskDetailsModal();
    await loadAllTasks();

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'deleteTask',
        TaskID: taskId
      })
    });

    const result = await response.json();
    if (!result.success) {
      alert('Error: ' + (result.error || 'Unknown'));
      return;
    }

    closeTaskDetailsModal();
    await loadAllTasks();

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ============================================================================
// SETTINGS
// ============================================================================

function changeTheme(newTheme) {
  if (!currentUser) return;
  currentUser.theme = newTheme;
  localStorage.setItem('companion-user', JSON.stringify(currentUser));
  applyTheme();
}

function switchUser() {
  if (!confirm('Switch to ' + currentUser.partnerName + "'s profile?")) return;

  const oldUserId = currentUser.userId;
  currentUser.userId = currentUser.partnerId;
  currentUser.partnerId = oldUserId;

  const oldName = currentUser.userName;
  currentUser.userName = currentUser.partnerName;
  currentUser.partnerName = oldName;

  currentUser.theme = currentUser.userId === 'user1' ? 'his' : 'her';

  localStorage.setItem('companion-user', JSON.stringify(currentUser));

  allTasks = [];
  updateUILabels();
  applyTheme();
  goToPage('home');
  loadAllTasks();
}

function resetAllData() {
  if (!confirm('Clear all data? Cannot undo!')) return;
  localStorage.clear();
  location.reload();
}

// ============================================================================
// UTILITIES
// ============================================================================

function togglePrivateFields() {
  const isChecked = document.getElementById('taskPrivate').checked;
  document.getElementById('privateFields').style.display = isChecked ? 'block' : 'none';
}

function filterHome(type) {
  document.querySelectorAll('.home-filters .filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderHome();
}

function filterMyTasks(type) {
  document.querySelectorAll('.my-tasks-filters .filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderMyTasks();
}

function filterAssignedTasks(type) {
  document.querySelectorAll('.assigned-filters .filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderAssignedTasks();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('createTaskModal').style.display = 'none';
    document.getElementById('taskDetailsModal').style.display = 'none';
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openCreateTaskModal();
  }
});
