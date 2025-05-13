// Main application JS
document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  setupTabs();
  
  // Form handling
  setupFormListeners();
  
  // Modal handling
  setupModalListeners();
  
  // Setup IPC listeners
  setupIpcListeners();
  
  // Initial data loading
  loadInitialData();
});

// Tab navigation functionality
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to current button
      button.classList.add('active');
      
      // Get the target tab content
      const targetId = button.id.replace('nav-', '');
      const targetContent = document.getElementById(targetId);
      targetContent.classList.add('active');
    });
  });
}

// Form listeners
function setupFormListeners() {
  // Project form
  const projectForm = document.getElementById('project-form');
  if (projectForm) {
    projectForm.addEventListener('submit', handleProjectFormSubmit);
  }
  
  // Proxy form
  const proxyForm = document.getElementById('proxy-form');
  if (proxyForm) {
    proxyForm.addEventListener('submit', handleProxyFormSubmit);
  }
  
  // Anti-Sybil settings form
  const antiSybilForm = document.getElementById('anti-sybil-form');
  if (antiSybilForm) {
    antiSybilForm.addEventListener('submit', handleAntiSybilFormSubmit);
  }
  
  // Browser settings form
  const browserSettingsForm = document.getElementById('browser-settings-form');
  if (browserSettingsForm) {
    browserSettingsForm.addEventListener('submit', handleBrowserSettingsFormSubmit);
  }
  
  // Account form
  const accountForm = document.getElementById('account-form');
  if (accountForm) {
    accountForm.addEventListener('submit', handleAccountFormSubmit);
  }
  
  // Account buttons
  const addAccountBtn = document.getElementById('add-account');
  if (addAccountBtn) {
    addAccountBtn.addEventListener('click', () => {
      openAccountModal();
    });
  }
  
  const importAccountsBtn = document.getElementById('import-accounts');
  if (importAccountsBtn) {
    importAccountsBtn.addEventListener('click', handleImportAccounts);
  }
}

// Modal handlers
function setupModalListeners() {
  // Account modal
  const accountModal = document.getElementById('account-modal');
  const closeBtn = document.querySelector('.close');
  const cancelBtn = document.getElementById('cancel-account');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      accountModal.style.display = 'none';
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      accountModal.style.display = 'none';
    });
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === accountModal) {
      accountModal.style.display = 'none';
    }
  });
}

// IPC listeners for communication with main process
function setupIpcListeners() {
  // Listen for task status updates
  window.airdropManager.onTaskStatusUpdate((data) => {
    updateTaskStatus(data);
  });
  
  // Listen for points updates
  window.airdropManager.onPointsUpdate((data) => {
    updatePointsDisplay(data);
  });
  
  // Listen for errors
  window.airdropManager.onError((data) => {
    showError(data.message);
  });
}

// Initial data loading on app start
async function loadInitialData() {
  try {
    // Load accounts
    const accountsResponse = await window.airdropManager.getAccountsStatus();
    if (accountsResponse.success) {
      renderAccountsList(accountsResponse.accounts);
    }
    
    // Load points data if available
    const pointsData = await window.airdropManager.getProjectPoints();
    if (pointsData.success && pointsData.points) {
      renderPointsData(pointsData.points);
    }
  } catch (error) {
    console.error('Error loading initial data:', error);
    showError('Gagal memuat data awal. Silakan muat ulang aplikasi.');
  }
}

// Form handlers
async function handleProjectFormSubmit(event) {
  event.preventDefault();
  
  const projectUrl = document.getElementById('project-url').value;
  const accountCount = parseInt(document.getElementById('account-count').value);
  const referralCode = document.getElementById('referral-code').value;
  
  // Validate inputs
  if (!projectUrl) {
    showError('URL project tidak boleh kosong');
    return;
  }
  
  if (isNaN(accountCount) || accountCount < 1) {
    showError('Jumlah akun harus minimal 1');
    return;
  }
  
  try {
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Memproses...';
    submitBtn.disabled = true;
    
    // Submit project to main process
    const result = await window.airdropManager.submitProject({
      url: projectUrl,
      accounts: accountCount,
      referralCode: referralCode
    });
    
    // Reset form state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    
    if (result.success) {
      showSuccess('Task berhasil dibuat!');
      // Maybe switch to the task list view
      document.getElementById('nav-dashboard').click();
    } else {
      showError(result.error || 'Gagal membuat task');
    }
  } catch (error) {
    console.error('Error submitting project:', error);
    showError('Terjadi kesalahan saat memproses permintaan');
  }
}

async function handleProxyFormSubmit(event) {
  event.preventDefault();
  
  const proxyAddress = document.getElementById('proxy-address').value;
  const proxyUsername = document.getElementById('proxy-username').value;
  const proxyPassword = document.getElementById('proxy-password').value;
  
  // Validate inputs
  if (!proxyAddress) {
    showError('Alamat proxy tidak boleh kosong');
    return;
  }
  
  try {
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Memproses...';
    submitBtn.disabled = true;
    
    // Submit proxy to main process
    const result = await window.airdropManager.addProxy({
      address: proxyAddress,
      username: proxyUsername,
      password: proxyPassword
    });
    
    // Reset form state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    
    if (result.success) {
      showSuccess('Proxy berhasil ditambahkan!');
      // Reset form
      event.target.reset();
      // Reload proxy list
      loadProxyList();
    } else {
      showError(result.error || 'Gagal menambahkan proxy');
    }
  } catch (error) {
    console.error('Error adding proxy:', error);
    showError('Terjadi kesalahan saat memproses permintaan');
  }
}

async function handleAntiSybilFormSubmit(event) {
  event.preventDefault();
  
  const minDelay = parseInt(document.getElementById('min-delay').value);
  const maxDelay = parseInt(document.getElementById('max-delay').value);
  const proxyStrategy = document.querySelector('input[name="proxy-strategy"]:checked').value;
  const fingerprintLevel = document.getElementById('fingerprint-level').value;
  
  // Validate inputs
  if (isNaN(minDelay) || minDelay < 1) {
    showError('Minimal delay harus minimal 1 detik');
    return;
  }
  
  if (isNaN(maxDelay) || maxDelay <= minDelay) {
    showError('Maksimal delay harus lebih besar dari minimal delay');
    return;
  }
  
  try {
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Menyimpan...';
    submitBtn.disabled = true;
    
    // Submit settings to main process
    // (This would be implemented in the real app to save settings via IPC)
    
    // For now, simulate a success
    setTimeout(() => {
      // Reset form state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      
      showSuccess('Pengaturan berhasil disimpan!');
    }, 500);
  } catch (error) {
    console.error('Error saving anti-sybil settings:', error);
    showError('Terjadi kesalahan saat menyimpan pengaturan');
  }
}

async function handleBrowserSettingsFormSubmit(event) {
  event.preventDefault();
  
  const browserMemory = parseInt(document.getElementById('browser-memory').value);
  const maxConcurrent = parseInt(document.getElementById('max-concurrent').value);
  
  // Validate inputs
  if (isNaN(browserMemory) || browserMemory < 256) {
    showError('Batas memori minimal 256 MB');
    return;
  }
  
  if (isNaN(maxConcurrent) || maxConcurrent < 1) {
    showError('Maksimal browser minimal 1');
    return;
  }
  
  try {
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Menyimpan...';
    submitBtn.disabled = true;
    
    // Submit settings to main process
    // (This would be implemented in the real app to save settings via IPC)
    
    // For now, simulate a success
    setTimeout(() => {
      // Reset form state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      
      showSuccess('Pengaturan browser berhasil disimpan!');
    }, 500);
  } catch (error) {
    console.error('Error saving browser settings:', error);
    showError('Terjadi kesalahan saat menyimpan pengaturan');
  }
}

async function handleAccountFormSubmit(event) {
  event.preventDefault();
  
  const accountEmail = document.getElementById('account-email').value;
  const accountPassword = document.getElementById('account-password').value;
  const accountNotes = document.getElementById('account-notes').value;
  
  // Validate inputs
  if (!accountEmail) {
    showError('Email/username tidak boleh kosong');
    return;
  }
  
  if (!accountPassword) {
    showError('Password tidak boleh kosong');
    return;
  }
  
  try {
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Menyimpan...';
    submitBtn.disabled = true;
    
    // Get account ID if we're editing
    const accountId = event.target.dataset.accountId;
    
    // Submit account to main process
    const result = await window.airdropManager.manageAccount({
      id: accountId, // Will be undefined for new accounts
      email: accountEmail,
      password: accountPassword,
      notes: accountNotes
    });
    
    // Reset form state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    
    if (result.success) {
      showSuccess('Akun berhasil disimpan!');
      // Close modal
      document.getElementById('account-modal').style.display = 'none';
      // Reload accounts list
      loadAccountsList();
    } else {
      showError(result.error || 'Gagal menyimpan akun');
    }
  } catch (error) {
    console.error('Error saving account:', error);
    showError('Terjadi kesalahan saat menyimpan akun');
  }
}

function handleImportAccounts() {
  // This would open a file dialog to select a CSV file
  // For now, we'll just show a message
  showInfo('Fitur import akun akan tersedia di versi berikutnya');
}

// Helper functions
function openAccountModal(account = null) {
  const modal = document.getElementById('account-modal');
  const form = document.getElementById('account-form');
  const title = modal.querySelector('h2');
  
  // Reset form
  form.reset();
  
  if (account) {
    // We're editing an existing account
    title.textContent = 'Edit Akun';
    document.getElementById('account-email').value = account.email;
    document.getElementById('account-password').value = ''; // Don't pre-fill for security
    document.getElementById('account-notes').value = account.notes || '';
    form.dataset.accountId = account.id;
  } else {
    // We're adding a new account
    title.textContent = 'Tambah Akun';
    delete form.dataset.accountId;
  }
  
  modal.style.display = 'block';
}

// UI update functions
async function loadAccountsList() {
  try {
    const accountsResponse = await window.airdropManager.getAccountsStatus();
    if (accountsResponse.success) {
      renderAccountsList(accountsResponse.accounts);
    } else {
      showError(accountsResponse.error || 'Gagal memuat daftar akun');
    }
  } catch (error) {
    console.error('Error loading accounts:', error);
    showError('Terjadi kesalahan saat memuat daftar akun');
  }
}

async function loadProxyList() {
  // This would be implemented in the real app
  // For now, just display a placeholder
  const proxyList = document.getElementById('proxy-list');
  if (proxyList) {
    proxyList.innerHTML = '<div class="empty-state">Fitur daftar proxy akan tersedia di versi berikutnya</div>';
  }
}

function renderAccountsList(accounts) {
  const accountsList = document.getElementById('accounts-list');
  if (!accountsList) return;
  
  if (!accounts || accounts.length === 0) {
    accountsList.innerHTML = '<div class="empty-state">Belum ada akun yang terdaftar</div>';
    return;
  }
  
  let html = '';
  accounts.forEach(account => {
    html += `
      <div class="account-item" data-id="${account.id}">
        <div class="account-info">
          <div class="account-email">${account.email}</div>
          <div class="account-notes">${account.notes || ''}</div>
        </div>
        <div class="account-actions">
          <button class="btn edit-account" data-id="${account.id}">Edit</button>
          <button class="btn delete-account" data-id="${account.id}">Hapus</button>
        </div>
      </div>
    `;
  });
  
  accountsList.innerHTML = html;
  
  // Add event listeners for the buttons
  accountsList.querySelectorAll('.edit-account').forEach(button => {
    button.addEventListener('click', (e) => {
      const accountId = e.target.dataset.id;
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        openAccountModal(account);
      }
    });
  });
  
  accountsList.querySelectorAll('.delete-account').forEach(button => {
    button.addEventListener('click', async (e) => {
      const accountId = e.target.dataset.id;
      if (confirm('Apakah Anda yakin ingin menghapus akun ini?')) {
        try {
          // This would call the main process to delete the account
          // await window.airdropManager.deleteAccount(accountId);
          // For now, just reload the list
          loadAccountsList();
        } catch (error) {
          console.error('Error deleting account:', error);
          showError('Gagal menghapus akun');
        }
      }
    });
  });
}

function updateTaskStatus(data) {
  const taskList = document.getElementById('task-list');
  if (!taskList) return;
  
  // Check if task already exists in the list
  const existingTask = taskList.querySelector(`[data-id="${data.id}"]`);
  
  if (existingTask) {
    // Update existing task
    const statusBadge = existingTask.querySelector('.status-badge');
    statusBadge.textContent = getStatusText(data.status);
    statusBadge.className = `status-badge status-${data.status}`;
    
    const progressEl = existingTask.querySelector('.task-progress');
    if (progressEl && data.progress !== undefined) {
      progressEl.textContent = `${data.progress}%`;
    }
  } else {
    // Create new task element
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.dataset.id = data.id;
    
    taskItem.innerHTML = `
      <div class="task-item-header">
        <span class="task-url">${data.url}</span>
        <span class="status-badge status-${data.status}">${getStatusText(data.status)}</span>
      </div>
      <div class="task-details">
        <span>Akun: ${data.accountCount}</span>
        <span class="task-progress">${data.progress !== undefined ? data.progress + '%' : ''}</span>
      </div>
      <div class="task-actions">
        ${data.status === 'running' ? '<button class="btn pause-task">Jeda</button>' : ''}
        ${data.status === 'paused' ? '<button class="btn resume-task">Lanjutkan</button>' : ''}
        <button class="btn stop-task">Berhenti</button>
      </div>
    `;
    
    // Add the new task to the list
    const emptyState = taskList.querySelector('.empty-state');
    if (emptyState) {
      taskList.removeChild(emptyState);
    }
    
    taskList.prepend(taskItem);
    
    // Add event listeners for task actions
    const pauseBtn = taskItem.querySelector('.pause-task');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => pauseTask(data.id));
    }
    
    const resumeBtn = taskItem.querySelector('.resume-task');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => resumeTask(data.id));
    }
    
    const stopBtn = taskItem.querySelector('.stop-task');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => stopTask(data.id));
    }
  }
}

function renderPointsData(pointsData) {
  const pointsContainer = document.getElementById('points-container');
  if (!pointsContainer) return;
  
  if (!pointsData || Object.keys(pointsData).length === 0) {
    pointsContainer.innerHTML = '<div class="empty-state">Belum ada data points</div>';
    return;
  }
  
  let html = '';
  for (const [projectUrl, points] of Object.entries(pointsData)) {
    html += `
      <div class="points-item">
        <div class="points-header">
          <span class="points-url">${projectUrl}</span>
        </div>
        <div class="points-value">
          Total Points: <strong>${points.total || 0}</strong>
        </div>
        <div class="points-details">
          <span>Akun aktif: ${points.activeAccounts || 0}</span>
        </div>
      </div>
    `;
  }
  
  pointsContainer.innerHTML = html;
}

// Task control functions
async function pauseTask(taskId) {
  try {
    await window.airdropManager.pauseTask(taskId);
  } catch (error) {
    console.error('Error pausing task:', error);
    showError('Gagal menjeda task');
  }
}

async function resumeTask(taskId) {
  try {
    await window.airdropManager.resumeTask(taskId);
  } catch (error) {
    console.error('Error resuming task:', error);
    showError('Gagal melanjutkan task');
  }
}

async function stopTask(taskId) {
  if (confirm('Apakah Anda yakin ingin menghentikan task ini?')) {
    try {
      await window.airdropManager.stopTask(taskId);
    } catch (error) {
      console.error('Error stopping task:', error);
      showError('Gagal menghentikan task');
    }
  }
}

// Notifications
function showError(message) {
  // In a real app, this would show a toast or notification
  alert(`Error: ${message}`);
}

function showSuccess(message) {
  // In a real app, this would show a toast or notification
  alert(`Success: ${message}`);
}

function showInfo(message) {
  // In a real app, this would show a toast or notification
  alert(`Info: ${message}`);
}

// Utility functions
function getStatusText(status) {
  switch (status) {
    case 'running': return 'Berjalan';
    case 'paused': return 'Dijeda';
    case 'completed': return 'Selesai';
    case 'error': return 'Error';
    default: return 'Unknown';
  }
}