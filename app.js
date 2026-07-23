/**
 * Companion Frontend
 * Connects to Apps Script backend
 */

// Backend URL (replace with your deployed URL)
const API_URL = 'https://script.google.com/macros/s/AKfycbwuDAd42gcX83_fHFZoj1OQmPkC1RJ1KAxNKORD6CQ2ao8ToZ2ZkFEVX7DeombC755T8w/exec';

// Current user (for demo)
let currentUser = 'user1';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 App loaded');
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('✓ Service Worker registered'))
      .catch(err => console.error('SW error:', err));
  }
  
  // Load tasks on start
  loadTasks();
});

// ============================================================================
// API CALLS
// ============================================================================

async function apiCall(action, data = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...data })
    });
    
    const result = await response.json();
    console.log(`✓ ${action}:`, result);
    return result;
  } catch (error) {
    console.error(`✗ ${action} failed:`, error);
    return { error: error.message };
  }
}

// ============================================================================
// TASKS
// ============================================================================

async function loadTasks() {
  console.log('📂 Loading tasks...');
  
  const result = await apiCall('getTasks', {
    filters: { assignedTo: currentUser }
  });
  
  if (!result.data) {
    displayNoTasks();
    return;
  }
  
  displayTasks(result.data);
}

function displayTasks(tasks) {
  const container = document.getElementById('tasksList');
  
  if (tasks.length === 0) {
    displayNoTasks();
    return;
  }
  
  container.innerHTML = tasks.map(task => `
    <div class="task-card">
      <div class="task-info">
        <div class="task-title">${escapeHtml(task.Title)}</div>
        <div class="task-meta">
          ${task.DueDate ? `📅 ${task.DueDate}` : 'No due date'}
          • ${task.Priority}
        </div>
      </div>
      <button class="task-complete" onclick="completeTask('${task.TaskID}')">✓</button>
    </div>
  `).join('');
}

function displayNoTasks() {
  const container = document.getElementById('tasksList');
  container.innerHTML = '<div class="empty-state">No tasks yet. Create one! 🎯</div>';
}

async function createTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const assignee = document.getElementById('taskAssignee').value;
  
  if (!title) {
    alert('Please enter a task title');
    return;
  }
  
  if (!assignee) {
    alert('Please assign to someone');
    return;
  }
  
  console.log('➕ Creating task...');
  
  const result = await apiCall('createTask', {
    Title: title,
    AssignedTo: assignee,
    CreatedBy: currentUser,
    Priority: 'medium',
    Category: 'Together'
  });
  
  if (result.success) {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskAssignee').value = '';
    loadTasks();
  }
}

async function completeTask(taskId) {
  console.log('✓ Completing task:', taskId);
  
  // This will be implemented in backend next
  alert('Coming soon! (backend needs update)');
}

// ============================================================================
// UTILS
// ============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
