/**
 * Google Apps Script - Backend for Companion App v3.1
 * 
 * Deploy as web app:
 * 1. Click Deploy → New Deployment → Web App
 * 2. Execute as: Your email
 * 3. Who has access: Anyone
 * 4. Copy deployment URL to app.js
 */

const SHEET_ID = '1-xkHL_SzI2oCIqBMzJxJQfhrOW8-svTjHoLxOtZNOr4';
const SHEET = SpreadsheetApp.openById(SHEET_ID);

// ============================================================================
// MAIN HANDLER
// ============================================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    console.log('📥 Request received:', action);

    if (action === 'getTasks') {
      return getTasks();
    } else if (action === 'createTask') {
      return createTask(data);
    } else if (action === 'updateTask') {
      return updateTask(data);
    } else if (action === 'deleteTask') {
      return deleteTask(data);
    } else {
      return response(false, 'Unknown action: ' + action);
    }
  } catch (error) {
    console.error('❌ Error:', error.toString());
    return response(false, error.toString());
  }
}

// ============================================================================
// GET ALL TASKS
// ============================================================================

function getTasks() {
  try {
    console.log('📖 getTasks called');
    
    const tasksSheet = SHEET.getSheetByName('Tasks');
    if (!tasksSheet) {
      console.error('❌ Tasks sheet not found');
      return response(false, 'Tasks sheet not found');
    }

    // Get all data
    const range = tasksSheet.getDataRange();
    const values = range.getValues();
    
    console.log('📊 Sheet has', values.length, 'rows');

    if (values.length < 2) {
      console.log('✅ No tasks (only header row)');
      return response(true, []);
    }

    // Get headers (first row)
    const headers = values[0];
    console.log('📋 Headers:', headers);

    // Find column indices
    const colIndex = {
      TaskID: headers.indexOf('TaskID'),
      Title: headers.indexOf('Title'),
      Description: headers.indexOf('Description'),
      AssignedTo: headers.indexOf('AssignedTo'),
      CreatedBy: headers.indexOf('CreatedBy'),
      Status: headers.indexOf('Status'),
      Priority: headers.indexOf('Priority'),
      Category: headers.indexOf('Category'),
      DueDate: headers.indexOf('DueDate'),
      IsPrivate: headers.indexOf('IsPrivate'),
      ContentHash: headers.indexOf('ContentHash'),
      DeletedAt: headers.indexOf('DeletedAt'),
      CreatedAt: headers.indexOf('CreatedAt'),
      UpdatedAt: headers.indexOf('UpdatedAt')
    };

    console.log('🔑 Column indices:', colIndex);

    // Convert rows to objects
    const tasks = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      // Skip if row is empty or has no TaskID
      if (!row[colIndex.TaskID]) continue;
      
      // Skip soft-deleted rows
      if (row[colIndex.DeletedAt]) continue;

      const task = {
        TaskID: row[colIndex.TaskID],
        Title: row[colIndex.Title],
        Description: row[colIndex.Description],
        AssignedTo: row[colIndex.AssignedTo],
        CreatedBy: row[colIndex.CreatedBy],
        Status: row[colIndex.Status],
        Priority: row[colIndex.Priority],
        Category: row[colIndex.Category],
        DueDate: row[colIndex.DueDate],
        IsPrivate: row[colIndex.IsPrivate],
        ContentHash: row[colIndex.ContentHash],
        CreatedAt: row[colIndex.CreatedAt],
        UpdatedAt: row[colIndex.UpdatedAt]
      };

      tasks.push(task);
    }

    console.log('✅ Tasks parsed:', tasks.length, 'active tasks');
    return response(true, tasks);

  } catch (error) {
    console.error('❌ getTasks error:', error.toString());
    return response(false, error.toString());
  }
}

// ============================================================================
// CREATE TASK
// ============================================================================

function createTask(data) {
  try {
    console.log('✍️ createTask called');
    console.log('   Title:', data.Title);
    console.log('   AssignedTo:', data.AssignedTo);
    console.log('   CreatedBy:', data.CreatedBy);

    const tasksSheet = SHEET.getSheetByName('Tasks');
    if (!tasksSheet) {
      return response(false, 'Tasks sheet not found');
    }

    // Generate unique TaskID
    const taskId = 'task_' + Date.now();
    const now = new Date().toISOString();

    // Prepare row data
    const headers = tasksSheet.getRange(1, 1, 1, tasksSheet.getLastColumn()).getValues()[0];
    const row = [];

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      
      if (header === 'TaskID') row[i] = taskId;
      else if (header === 'Title') row[i] = data.Title || '';
      else if (header === 'Description') row[i] = data.Description || '';
      else if (header === 'AssignedTo') row[i] = data.AssignedTo || '';
      else if (header === 'CreatedBy') row[i] = data.CreatedBy || '';
      else if (header === 'Status') row[i] = data.Status || 'open';
      else if (header === 'Priority') row[i] = data.Priority || 'medium';
      else if (header === 'Category') row[i] = data.Category || '';
      else if (header === 'DueDate') row[i] = data.DueDate || '';
      else if (header === 'IsPrivate') row[i] = data.IsPrivate || 'FALSE';
      else if (header === 'ContentHash') row[i] = data.ContentHash || '';
      else if (header === 'CreatedAt') row[i] = now;
      else if (header === 'UpdatedAt') row[i] = now;
      else row[i] = '';
    }

    // Append row to sheet
    tasksSheet.appendRow(row);
    console.log('✅ Task created with ID:', taskId);

    // Return the created task
    const task = {
      TaskID: taskId,
      Title: data.Title,
      Description: data.Description,
      AssignedTo: data.AssignedTo,
      CreatedBy: data.CreatedBy,
      Status: data.Status || 'open',
      Priority: data.Priority || 'medium',
      Category: data.Category || '',
      DueDate: data.DueDate || '',
      IsPrivate: data.IsPrivate || 'FALSE',
      ContentHash: data.ContentHash || '',
      CreatedAt: now,
      UpdatedAt: now
    };

    return response(true, task);

  } catch (error) {
    console.error('❌ createTask error:', error.toString());
    return response(false, error.toString());
  }
}

// ============================================================================
// UPDATE TASK
// ============================================================================

function updateTask(data) {
  try {
    console.log('✏️ updateTask called');
    console.log('   TaskID:', data.TaskID);
    console.log('   Updates:', Object.keys(data).filter(k => k !== 'action' && k !== 'TaskID'));

    const tasksSheet = SHEET.getSheetByName('Tasks');
    if (!tasksSheet) {
      return response(false, 'Tasks sheet not found');
    }

    // Find the task row
    const values = tasksSheet.getDataRange().getValues();
    const headers = values[0];
    const taskIdCol = headers.indexOf('TaskID');
    
    let foundRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][taskIdCol] === data.TaskID) {
        foundRow = i + 1; // +1 because sheets are 1-indexed
        break;
      }
    }

    if (foundRow === -1) {
      return response(false, 'Task not found: ' + data.TaskID);
    }

    console.log('   Found at row:', foundRow);

    // Update fields
    const now = new Date().toISOString();
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      
      if (data.hasOwnProperty(header)) {
        tasksSheet.getRange(foundRow, i + 1).setValue(data[header]);
      } else if (header === 'UpdatedAt') {
        tasksSheet.getRange(foundRow, i + 1).setValue(now);
      }
    }

    console.log('✅ Task updated');
    return response(true, { success: true });

  } catch (error) {
    console.error('❌ updateTask error:', error.toString());
    return response(false, error.toString());
  }
}

// ============================================================================
// DELETE TASK (Soft Delete)
// ============================================================================

function deleteTask(data) {
  try {
    console.log('🗑️ deleteTask called');
    console.log('   TaskID:', data.TaskID);

    const tasksSheet = SHEET.getSheetByName('Tasks');
    if (!tasksSheet) {
      return response(false, 'Tasks sheet not found');
    }

    // Find the task row
    const values = tasksSheet.getDataRange().getValues();
    const headers = values[0];
    const taskIdCol = headers.indexOf('TaskID');
    const deletedAtCol = headers.indexOf('DeletedAt');
    
    let foundRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][taskIdCol] === data.TaskID) {
        foundRow = i + 1;
        break;
      }
    }

    if (foundRow === -1) {
      return response(false, 'Task not found: ' + data.TaskID);
    }

    // Set DeletedAt timestamp (soft delete)
    const now = new Date().toISOString();
    tasksSheet.getRange(foundRow, deletedAtCol + 1).setValue(now);

    console.log('✅ Task deleted (soft delete)');
    return response(true, { success: true });

  } catch (error) {
    console.error('❌ deleteTask error:', error.toString());
    return response(false, error.toString());
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function response(success, data) {
  const result = {
    success: success,
    data: data,
    timestamp: new Date().toISOString()
  };
  console.log('📤 Response:', result);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
