import './style.css';
import './admin.css';
import { 
  createIcons, 
  ShieldCheck, 
  Shield, 
  Users, 
  Clock, 
  BrainCircuit, 
  CheckCircle2, 
  ClipboardList, 
  Eye, 
  Inbox 
} from 'lucide';

// Initialize Lucide Icons
function initIcons() {
  createIcons({
    icons: {
      ShieldCheck,
      Shield,
      Users,
      Clock,
      BrainCircuit,
      CheckCircle2,
      ClipboardList,
      Eye,
      Inbox
    }
  });
}

// Variables & State
const API_BASE = import.meta.env.VITE_API_BASE || '';

let allGrievances = [];
let currentGrievance = null;

// DOM Elements
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const grievancesTbody = document.getElementById('grievances-tbody');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statProgress = document.getElementById('stat-progress');
const statResolved = document.getElementById('stat-resolved');

// Filter Elements
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterCategory = document.getElementById('filter-category');

// Modal Elements
const detailsModal = document.getElementById('details-modal');
const closeModalBtn = document.querySelector('.close-modal');
const updateForm = document.getElementById('update-grievance-form');
const deleteGrievanceBtn = document.getElementById('delete-grievance-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  checkAuthStatus();
  setupEventListeners();
});

// Event Listeners setup
function setupEventListeners() {
  // Login Form
  loginForm.addEventListener('submit', handleLogin);
  
  // Logout Button
  logoutBtn.addEventListener('click', handleLogout);
  
  // Refresh Button
  refreshBtn.addEventListener('click', fetchGrievances);
  
  // Filters Event Listeners (Real-time Filtering)
  searchInput.addEventListener('input', renderTable);
  filterStatus.addEventListener('change', renderTable);
  filterCategory.addEventListener('change', renderTable);
  
  // Modal Close
  closeModalBtn.addEventListener('click', () => {
    detailsModal.classList.remove('active');
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === detailsModal) {
      detailsModal.classList.remove('active');
    }
  });
  
  // Update Form
  updateForm.addEventListener('submit', handleUpdateGrievance);
  
  // Delete Button
  deleteGrievanceBtn.addEventListener('click', handleDeleteGrievance);
}

// Authentication Check Status
async function checkAuthStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/status`, {
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.loggedIn) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('Error checking authentication status:', error);
    showLogin();
  }
}

// Show Login Page
function showLogin() {
  loginContainer.style.display = 'flex';
  dashboardContainer.style.display = 'none';
  logoutBtn.style.display = 'none';
  loginError.style.display = 'none';
  usernameInput.value = '';
  passwordInput.value = '';
}

// Show Dashboard Page
function showDashboard() {
  loginContainer.style.display = 'none';
  dashboardContainer.style.display = 'block';
  logoutBtn.style.display = 'block';
  fetchGrievances();
}

// Handle Login Form Submission
async function handleLogin(e) {
  e.preventDefault();
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const submitBtn = document.getElementById('login-submit-btn');
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Authenticating...';
  loginError.style.display = 'none';
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      showDashboard();
    } else {
      showLoginError(data.message || 'Invalid username or password');
    }
  } catch (error) {
    console.error('Login error:', error);
    showLoginError('Network error. Make sure backend is running.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Authenticate & Enter';
  }
}

// Show login error box
function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
}

// Handle Logout action
async function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  
  try {
    await fetch(`${API_BASE}/api/admin/logout`, { 
      method: 'POST',
      credentials: 'include'
    });
    showLogin();
  } catch (error) {
    console.error('Logout error:', error);
    showLogin();
  }
}

// Fetch grievances from server
async function fetchGrievances() {
  grievancesTbody.innerHTML = `
    <tr class="loading-row">
      <td colspan="8">
        <div class="table-loading">
          <span class="spinner"></span> Syncing database files...
        </div>
      </td>
    </tr>
  `;
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/grievances`, {
      credentials: 'include'
    });
    if (res.status === 401) {
      showLogin();
      return;
    }
    
    const data = await res.json();
    
    if (data.success) {
      allGrievances = data.data;
      updateStats();
      renderTable();
    } else {
      console.error('Failed to load grievances:', data.message);
    }
  } catch (error) {
    console.error('Error fetching grievances:', error);
  }
}

// Update Stats widgets
function updateStats() {
  const total = allGrievances.length;
  const pending = allGrievances.filter(g => g.status === 'Pending').length;
  const progress = allGrievances.filter(g => g.status === 'In Progress').length;
  const resolved = allGrievances.filter(g => g.status === 'Resolved').length;
  
  statTotal.textContent = total;
  statPending.textContent = pending;
  statProgress.textContent = progress;
  statResolved.textContent = resolved;
}

// Render dynamic grievances table with clientside filtering
function renderTable() {
  const searchKeyword = searchInput.value.trim().toLowerCase();
  const statusVal = filterStatus.value;
  const categoryVal = filterCategory.value;
  
  const filtered = allGrievances.filter(g => {
    // Search filter
    const matchesSearch = 
      g.name.toLowerCase().includes(searchKeyword) ||
      g.phone.includes(searchKeyword) ||
      g.constituency.toLowerCase().includes(searchKeyword) ||
      `TVK-GR-2026-${String(g.id).padStart(4, '0')}`.toLowerCase().includes(searchKeyword) ||
      g.description.toLowerCase().includes(searchKeyword);
      
    // Status filter
    const matchesStatus = statusVal === 'all' || g.status === statusVal;
    
    // Category filter
    const matchesCategory = categoryVal === 'all' || g.category === categoryVal;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });
  
  if (filtered.length === 0) {
    grievancesTbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <i data-lucide="inbox"></i>
            <p>No queries match your search or filter settings.</p>
          </div>
        </td>
      </tr>
    `;
    initIcons();
    return;
  }
  
  grievancesTbody.innerHTML = filtered.map(g => {
    const trackId = `TVK-GR-2026-${String(g.id).padStart(4, '0')}`;
    const dateStr = new Date(g.created_at).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const statusClass = g.status.toLowerCase().replace(' ', '');
    const categoryName = g.category.charAt(0).toUpperCase() + g.category.slice(1);
    
    return `
      <tr>
        <td><span class="track-id-badge">${trackId}</span></td>
        <td><strong>${escapeHtml(g.name)}</strong></td>
        <td>
          <a href="tel:${escapeHtml(g.phone)}" style="text-decoration:none; color:inherit;">
            ${escapeHtml(g.phone)}
          </a>
        </td>
        <td>${escapeHtml(g.constituency)}</td>
        <td><span style="font-weight:600; color:#555;">${escapeHtml(categoryName)}</span></td>
        <td style="font-size:0.85rem; color:#666;">${dateStr}</td>
        <td>
          <span class="status-badge ${statusClass}">
            ${g.status}
          </span>
        </td>
        <td>
          <button class="dashboard-btn btn-secondary view-details-btn" data-id="${g.id}" style="padding: 6px 12px; font-size: 0.8rem;">
            <i data-lucide="eye"></i> View Detail
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Attach Click events to the dynamically rendered View Detail buttons
  document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const dbId = parseInt(e.currentTarget.getAttribute('data-id'));
      openDetailsModal(dbId);
    });
  });
  
  initIcons();
}

// Open Details Modal and populate details
function openDetailsModal(id) {
  currentGrievance = allGrievances.find(g => g.id === id);
  if (!currentGrievance) return;
  
  const trackId = `TVK-GR-2026-${String(currentGrievance.id).padStart(4, '0')}`;
  
  document.getElementById('modal-track-id').textContent = trackId;
  document.getElementById('modal-db-id').value = currentGrievance.id;
  document.getElementById('modal-name').textContent = currentGrievance.name;
  document.getElementById('modal-phone').textContent = currentGrievance.phone;
  document.getElementById('modal-constituency').textContent = currentGrievance.constituency;
  
  const categoryName = currentGrievance.category.charAt(0).toUpperCase() + currentGrievance.category.slice(1);
  document.getElementById('modal-category').textContent = categoryName;
  
  const dateStr = new Date(currentGrievance.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('modal-date').textContent = dateStr;
  document.getElementById('modal-description').textContent = currentGrievance.description;

  const photoBox = document.getElementById('modal-photo-box');
  const photoImg = document.getElementById('modal-photo');
  const photoLink = document.getElementById('modal-photo-link');
  const photoName = document.getElementById('modal-photo-name');

  if (currentGrievance.photo_data) {
    photoImg.src = currentGrievance.photo_data;
    photoLink.href = currentGrievance.photo_data;
    photoName.textContent = currentGrievance.photo_name || 'Uploaded grievance photo';
    photoBox.hidden = false;
  } else {
    photoImg.removeAttribute('src');
    photoLink.href = '#';
    photoName.textContent = '';
    photoBox.hidden = true;
  }
  
  // Inputs
  document.getElementById('modal-status').value = currentGrievance.status;
  document.getElementById('modal-notes').value = currentGrievance.admin_notes || '';
  
  // Activate modal view
  detailsModal.classList.add('active');
  initIcons();
}

// Handle updates to Status and Notes
async function handleUpdateGrievance(e) {
  e.preventDefault();
  
  const id = document.getElementById('modal-db-id').value;
  const status = document.getElementById('modal-status').value;
  const admin_notes = document.getElementById('modal-notes').value;
  
  const submitBtn = updateForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving Updates...';
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/grievances/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes }),
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      detailsModal.classList.remove('active');
      fetchGrievances();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Error updating grievance:', error);
    alert('Failed to update submission records due to network errors.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Updates';
  }
}

// Handle Delete grievance
async function handleDeleteGrievance() {
  const id = document.getElementById('modal-db-id').value;
  const trackId = document.getElementById('modal-track-id').textContent;
  
  if (!confirm(`Are you absolutely sure you want to delete query ${trackId}? This cannot be undone.`)) {
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/admin/grievances/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await res.json();
    
    if (data.success) {
      detailsModal.classList.remove('active');
      fetchGrievances();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Error deleting grievance:', error);
    alert('Failed to delete query record due to network errors.');
  }
}

// Basic HTML Sanitization
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
