/* ==========================================================================
   💍 甜蜜备婚全能助手 - App JavaScript Logic
   Includes: Countdown Timer, Checklist CRUD, Expense Tracker, 
            Gift Ledger, Chart.js Integration, CSV/JSON Export & Canvas Petals
   ========================================================================== */

// Storage & Auth Keys
const STORAGE_KEY = 'SWEET_WEDDING_PLANNER_DATA_V1';
const AUTH_SESSION_KEY = 'WEDDING_AUTH_SESSION_V1';
let currentAuthMode = 'login';

function getAuthSession() {
  // 1. Check URL Hash or Query Parameter (100% immune to file:/// protocol local origin wiping)
  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const rawStr = hash.replace(/^#/, '') || search.replace(/^\?/, '');
    if (rawStr && rawStr.includes('user=')) {
      const params = new URLSearchParams(rawStr);
      const urlUser = params.get('user');
      const urlToken = params.get('token');
      if (urlUser) {
        const session = {
          token: urlToken || ('tok_url_' + urlUser),
          username: urlUser,
          expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
        };
        try {
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
          sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        } catch (e) {}
        return session;
      }
    }
  } catch (e) {}

  // 2. Check localStorage / sessionStorage
  let saved = null;
  try {
    saved = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
  } catch (e) {}

  if (!saved) return null;
  try {
    const session = JSON.parse(saved);
    if (session && session.username) {
      const default7Days = Date.now() + (7 * 24 * 60 * 60 * 1000);
      const expTime = Number(session.expiresAt) || default7Days;
      if (Date.now() < expTime) {
        return session;
      } else {
        try {
          localStorage.removeItem(AUTH_SESSION_KEY);
          sessionStorage.removeItem(AUTH_SESSION_KEY);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error('Failed to parse auth session:', e);
  }
  return null;
}

function getAuthHeaders() {
  const session = getAuthSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  return headers;
}

// Initialize State
function loadState() {
  const session = getAuthSession();
  if (session && session.username) {
    const userLocalKey = 'WEDDING_USER_DATA_' + session.username;
    try {
      const userSaved = localStorage.getItem(userLocalKey) || sessionStorage.getItem(userLocalKey);
      if (userSaved) return JSON.parse(userSaved);
    } catch (e) {}
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return getDefaultData();
}

function updateAuthUI() {
  const session = getAuthSession();
  const userProfileBadge = document.getElementById('userProfileBadge');
  const userProfileName = document.getElementById('userProfileName');
  const loginCornerBtn = document.getElementById('loginCornerBtn');

  const appContainer = document.querySelector('.app-container');

  if (session && session.username) {
    if (appContainer) appContainer.style.display = 'block';
    if (userProfileBadge) userProfileBadge.style.display = 'inline-flex';
    if (userProfileName) userProfileName.textContent = session.username;
    if (loginCornerBtn) loginCornerBtn.style.display = 'none';
    if (typeof closeModal === 'function') closeModal('authModal');
  } else {
    if (appContainer) appContainer.style.display = 'none';
    if (userProfileBadge) userProfileBadge.style.display = 'none';
    if (loginCornerBtn) loginCornerBtn.style.display = 'none';
    if (typeof openAuthModal === 'function') {
      setTimeout(() => openAuthModal('login'), 50);
    }
  }
}

async function initCloudSync() {
  const session = getAuthSession();
  updateAuthUI();

  if (!session) {
    return;
  }

  // If logged in, load user-specific data from local cache first (Instant UI load on refresh!)
  const userLocalKey = 'WEDDING_USER_DATA_' + session.username;
  try {
    const userSaved = localStorage.getItem(userLocalKey) || sessionStorage.getItem(userLocalKey);
    if (userSaved) {
      state = JSON.parse(userSaved);
      renderAll();
    }
  } catch (e) {}

  // Async sync with server
  try {
    const res = await fetch('/api/data', {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const result = await res.json();
      // Only overwrite local state if server data strictly belongs to THIS logged in user!
      if (result && result.success && result.data && result.username === session.username) {
        state = result.data;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          localStorage.setItem(userLocalKey, JSON.stringify(state));
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          sessionStorage.setItem(userLocalKey, JSON.stringify(state));
        } catch (e) {}
        console.log('☁️ 成功同步最新云端数据库数据');
        renderAll();
      }
    }
  } catch (err) {
    console.log('💡 静态/本地模式，使用本地账本');
  }
}

async function saveState() {
  const session = getAuthSession();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (session && session.username) {
      localStorage.setItem('WEDDING_USER_DATA_' + session.username, JSON.stringify(state));
      sessionStorage.setItem('WEDDING_USER_DATA_' + session.username, JSON.stringify(state));
    }
  } catch (e) {}
  renderAll();

  // Async POST to Cloud Database API with Auth token
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(state)
    });
  } catch (err) {}
}

// Default State Generator
function getDefaultData() {
  // Set default wedding date 6 months from now
  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 6);
  defaultDate.setHours(10, 58, 0, 0);

  return {
    settings: {
      couples: '新郎 ❤️ 新娘',
      date: defaultDate.toISOString().slice(0, 16),
      location: '三亚海棠湾亚特兰蒂斯酒店',
      quote: '爱是执子之手，与子偕老。',
      totalBudget: 200000
    },
    checklist: [
      { id: 'c1', title: '确定婚期吉日与婚礼形式', category: '酒店婚宴', completed: false, notes: '挑选黄金吉日' },
      { id: 'c2', title: '预订婚宴酒店宴会厅', category: '酒店婚宴', completed: false, notes: '确定桌数与菜单套餐' },
      { id: 'c3', title: '预订婚纱摄影机构拍摄外景', category: '婚纱礼服与美妆', completed: false, notes: '选择摄影师与拍摄风格' },
      { id: 'c4', title: '确定婚礼策划团队与四大金刚', category: '婚庆策划与四大', completed: false, notes: '主持人、摄影师、摄像师、新娘跟妆师' },
      { id: 'c5', title: '选购对戒与新娘钻戒', category: '珠宝首饰', completed: false, notes: '定制刻字婚戒' },
      { id: 'c6', title: '定制新郎西装与新娘婚纱礼服', category: '婚纱礼服与美妆', completed: false, notes: '出门纱、主婚纱、敬酒服' },
      { id: 'c7', title: '选购喜糖、喜饼及伴手礼礼盒', category: '伴手礼与喜糖', completed: false, notes: '准备300份' },
      { id: 'c8', title: '新房软装布置与贴喜字', category: '婚房布置与采购', completed: false, notes: '红气球、压床娃娃、铺红床单' },
      { id: 'c9', title: '核对结婚戒指、急救包及誓言卡', category: '其他事项', completed: false, notes: '伴郎保管戒指，伴娘随身携带急救包' }
    ],
    expenses: [
      { id: 'e1', title: '婚宴酒店定金', category: '酒店婚宴', amount: 20000, status: 'deposit', deposit: 20000, notes: '尾款在婚礼一周前付清' },
      { id: 'e2', title: '婚纱照全款', category: '婚纱礼服', amount: 12000, status: 'paid', deposit: 12000, notes: '已取产品相册' },
      { id: 'e3', title: '定制钻戒与结婚对戒', category: '珠宝首饰', amount: 25000, status: 'paid', deposit: 25000, notes: '已到货取回' },
      { id: 'e4', title: '婚礼策划预付款', category: '婚庆策划', amount: 10000, status: 'deposit', deposit: 10000, notes: '总设计费3.5万元' }
    ],
    gifts: [
      { id: 'g1', type: 'recv', name: '张叔叔', relation: '男方亲戚', amount: 5000, date: '2026-07-20', returnStatus: 'none', notes: '男方大舅贺礼' },
      { id: 'g2', type: 'recv', name: '李阿姨', relation: '女方亲戚', amount: 6600, date: '2026-07-21', returnStatus: 'none', notes: '女方小姨贺礼' },
      { id: 'g3', type: 'recv', name: '王强', relation: '同学朋友', amount: 1000, date: '2026-07-25', returnStatus: 'none', notes: '伴郎红包' },
      { id: 'g4', type: 'recv', name: '陈主管', relation: '男方同事', amount: 1200, date: '2026-07-28', returnStatus: 'none', notes: '部门领导祝福' }
    ]
  };
}

// Global App State
let state = loadState();
let budgetChart = null;
let overviewBudgetChart = null;
let giftChart = null;
let countdownInterval = null;

// Global Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'warning') icon = 'fa-exclamation-triangle';
  
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  const targetTabBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  const targetContent = document.getElementById(tabId);
  
  if (targetTabBtn && targetContent) {
    targetTabBtn.classList.add('active');
    targetContent.classList.add('active');
    
    // Refresh Charts when switching
    setTimeout(() => {
      if (tabId === 'tab-budget') renderBudgetCharts();
      if (tabId === 'tab-gifts') renderGiftChart();
      if (tabId === 'tab-overview') renderOverviewCharts();
    }, 100);
  }
}

// Modal System
function initModals() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      closeModal(modalId);
    });
  });
  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (overlay.id === 'authModal') {
          const s = getAuthSession();
          if (!s || !s.username) return; // Prevent closing if not logged in
        }
        overlay.classList.remove('active');
      }
    });
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}
window.openModal = openModal;

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}
window.closeModal = closeModal;

/**
 * Reusable Custom Confirm Modal (Replaces system browser confirm dialog)
 */
function showCustomConfirm(title, message, options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const iconWrapper = document.getElementById('confirmModalIcon');
    const okBtn = document.getElementById('confirmModalOkBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');

    if (!modal) {
      resolve(false);
      return;
    }

    titleEl.textContent = title || '确认操作';
    msgEl.textContent = message || '确定要执行此操作吗？';

    const iconType = options.icon || 'danger';
    iconWrapper.className = `confirm-icon-wrapper ${iconType}`;
    iconWrapper.innerHTML = iconType === 'warning' 
      ? '<i class="fa-solid fa-triangle-exclamation"></i>'
      : '<i class="fa-solid fa-trash-can"></i>';

    okBtn.textContent = options.confirmText || '确定';
    cancelBtn.textContent = options.cancelText || '取消';

    const cleanup = () => {
      closeModal('customConfirmModal');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);

    openModal('customConfirmModal');
  });
}
window.showCustomConfirm = showCustomConfirm;

// --------------------------------------------------------------------------
// 1. COUNTDOWN & OVERVIEW LOGIC
// --------------------------------------------------------------------------
function initCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  
  function updateTimer() {
    const targetDate = new Date(state.settings.date).getTime();
    const now = new Date().getTime();
    const diff = targetDate - now;
    
    if (isNaN(diff) || diff <= 0) {
      document.getElementById('cdDays').innerText = '00';
      document.getElementById('cdHours').innerText = '00';
      document.getElementById('cdMinutes').innerText = '00';
      document.getElementById('cdSeconds').innerText = '00';
      document.getElementById('heroWeddingDate').innerText = '婚礼正吉日举行中！新婚快乐！💐';
      return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    document.getElementById('cdDays').innerText = String(days).padStart(2, '0');
    document.getElementById('cdHours').innerText = String(hours).padStart(2, '0');
    document.getElementById('cdMinutes').innerText = String(minutes).padStart(2, '0');
    document.getElementById('cdSeconds').innerText = String(seconds).padStart(2, '0');
  }
  
  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

function renderOverview() {
  const couplesEl = document.getElementById('heroCouples');
  if (couplesEl) couplesEl.innerText = state.settings.couples || '新郎 ❤️ 新娘';

  const locEl = document.getElementById('heroLocation');
  if (locEl) locEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${state.settings.location || '待设置地点'}`;
  
  const dateEl = document.getElementById('heroWeddingDate');
  if (dateEl) {
    const wDate = new Date(state.settings.date);
    const formattedDate = isNaN(wDate.getTime()) ? '未设定' : `${wDate.getFullYear()}年${wDate.getMonth()+1}月${wDate.getDate()}日 ${String(wDate.getHours()).padStart(2,'0')}:${String(wDate.getMinutes()).padStart(2,'0')}`;
    dateEl.innerText = formattedDate;
  }

  // Checklist Rate
  const totalChk = state.checklist.length;
  const completedChk = state.checklist.filter(c => c.completed).length;
  const chkRate = totalChk === 0 ? 0 : Math.round((completedChk / totalChk) * 100);
  document.getElementById('overviewChecklistRate').innerText = `${chkRate}%`;
  document.getElementById('checklistProgressFill').style.width = `${chkRate}%`;
  document.getElementById('checklistBadge').innerText = totalChk - completedChk;

  // Budget Rate
  const totalBudget = state.settings.totalBudget || 1;
  const totalSpent = state.expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const budgetRate = Math.min(100, Math.round((totalSpent / totalBudget) * 100));
  document.getElementById('overviewBudgetRate').innerText = `${budgetRate}%`;
  document.getElementById('budgetProgressFill').style.width = `${budgetRate}%`;

  // Gifts Overview
  const recvGifts = state.gifts.filter(g => g.type === 'recv');
  const giftsTotal = recvGifts.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  document.getElementById('overviewGiftsTotal').innerText = `¥${giftsTotal.toLocaleString()}`;
  document.getElementById('overviewGiftsCount').innerText = `共 ${recvGifts.length} 笔宾客礼金`;

  // Urgent Checklist Mini List
  const urgentContainer = document.getElementById('urgentChecklist');
  const uncompleted = state.checklist.filter(c => !c.completed).slice(0, 4);
  if (uncompleted.length === 0) {
    urgentContainer.innerHTML = '<p class="text-muted" style="padding: 12px 0;">🎉 太棒啦！所有备婚事项已全部完成！</p>';
  } else {
    urgentContainer.innerHTML = uncompleted.map(item => `
      <div class="chk-card" style="padding: 12px; margin-bottom: 8px;">
        <div class="chk-header" style="align-items: center; padding-right: 0; width: 100%;">
          <div class="custom-checkbox" style="flex-shrink: 0;" onclick="toggleChecklistDone('${item.id}')"></div>
          <span class="chk-title" style="font-size: 0.92rem; flex: 1; margin-right: 10px;">${item.title}</span>
          <span class="tag tag-cat" style="margin-left: auto; flex-shrink: 0;">${item.category}</span>
        </div>
      </div>
    `).join('');
  }

  // Render overview charts
  renderOverviewCharts();
}

// Register ChartDataLabels plugin if available
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

function renderOverviewCharts() {
  const ctx = document.getElementById('overviewBudgetChart');
  if (!ctx) return;
  
  if (overviewBudgetChart) overviewBudgetChart.destroy();
  
  const catTotals = {};
  let totalSpent = 0;
  state.expenses.forEach(e => {
    const amt = parseFloat(e.amount || 0);
    catTotals[e.category] = (catTotals[e.category] || 0) + amt;
    totalSpent += amt;
  });
  
  const labels = Object.keys(catTotals);
  const data = Object.values(catTotals);

  const colors = ['#ff758c', '#f6d365', '#55efc4', '#74b9ff', '#a29bfe', '#fd79a8', '#ffeaa7'];

  overviewBudgetChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['尚未添加支出'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: colors.slice(0, Math.max(labels.length, 1))
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, /* Disable native Chart.js legend to force strict 2-column grid */
        datalabels: {
          color: '#ffffff',
          font: { weight: 'bold', size: 11 },
          formatter: (value, ctx) => {
            if (totalSpent === 0 || !data.length) return '';
            const pct = Math.round((value / totalSpent) * 100);
            return pct > 5 ? `${pct}%` : '';
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              const pct = totalSpent === 0 ? 0 : ((val / totalSpent) * 100).toFixed(1);
              return ` ${context.label}: ¥${val.toLocaleString()} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  // Render Custom HTML Legend
  const legendContainer = document.getElementById('overviewChartLegend');
  if (legendContainer) {
    if (!labels.length) {
      legendContainer.innerHTML = '';
      return;
    }
    legendContainer.innerHTML = labels.map((lbl, idx) => {
      const val = data[idx] || 0;
      return `
        <div class="legend-item-2col">
          <span class="legend-color-box" style="background-color: ${colors[idx % colors.length]};"></span>
          <span style="font-weight: 500;">${lbl} - ¥${val.toLocaleString()}</span>
        </div>
      `;
    }).join('');
  }
}

// --------------------------------------------------------------------------
// 2. CHECKLIST LOGIC
// --------------------------------------------------------------------------
function initChecklistListeners() {
  // Category Filter
  document.getElementById('checklistCategorySelect').addEventListener('change', renderChecklist);

  // Add Button
  document.getElementById('addChecklistItemBtn').addEventListener('click', () => {
    document.getElementById('chkId').value = '';
    document.getElementById('checklistForm').reset();
    document.getElementById('checklistModalTitle').innerText = '新增待办事项';
    openModal('checklistModal');
  });

function loadPresetChecklist() {
  if (!checkAuthGuard()) return;
  try {
    const select = document.getElementById('checklistCategorySelect');
    if (select) select.value = 'all';

    const presetData = getDefaultData().checklist;
    state.checklist = presetData.map(item => ({
      ...item,
      id: 'chk_' + Date.now() + Math.random().toString(36).substr(2, 4),
      completed: false
    }));
    
    saveState();
    if (typeof renderChecklist === 'function') renderChecklist();
    if (typeof renderOverview === 'function') renderOverview();
    showToast('标准备婚模板已成功载入！所有事项重置为未完成。', 'success');
  } catch (err) {
    console.error('loadPresetChecklist error:', err);
  }
}
window.loadPresetChecklist = loadPresetChecklist;

}

window.handleSaveChecklist = function() {
  try {
    if (!checkAuthGuard()) return;
    if (!state.checklist) state.checklist = [];
    const id = document.getElementById('chkId') ? document.getElementById('chkId').value : '';
    const title = document.getElementById('chkTitle') ? document.getElementById('chkTitle').value : '';
    const category = document.getElementById('chkCategory') ? document.getElementById('chkCategory').value : 'preparation';
    const notes = document.getElementById('chkNotes') ? document.getElementById('chkNotes').value : '';
    
    if (id) {
      const item = state.checklist.find(i => i.id === id);
      if (item) {
        item.title = title;
        item.category = category;
        item.notes = notes;
      }
    } else {
      state.checklist.push({
        id: 'chk_' + Date.now(),
        title,
        category,
        notes,
        completed: false
      });
    }

    closeModal('checklistModal');
    saveState();
    renderChecklist();
    renderOverview();
    showToast('待办已保存', 'success');
  } catch (err) {
    alert("保存待办报错: " + err.message);
    console.error(err);
  }
};

async function clearChecklist() {
  if (!checkAuthGuard()) return;
  if (state.checklist.length === 0) {
    showToast('当前清单已经是空的啦！', 'info');
    return;
  }
  const confirmed = await showCustomConfirm('清空待办清单', '确定要清空清单中的所有待办事项吗？此操作不可撤销！', {
    icon: 'danger',
    confirmText: '确认清空'
  });
  if (confirmed) {
    state.checklist = [];
    saveState();
    renderChecklist();
    renderOverview();
    showToast('清单已成功清空', 'info');
  }
}
window.clearChecklist = clearChecklist;

function openAddChecklistModal() {
  if (!checkAuthGuard()) return;
  document.getElementById('chkId').value = '';
  document.getElementById('checklistForm').reset();
  document.getElementById('checklistModalTitle').innerText = '新增待办事项';
  openModal('checklistModal');
}
window.openAddChecklistModal = openAddChecklistModal;

function renderChecklist() {
  const categoryFilter = document.getElementById('checklistCategorySelect').value;
  const container = document.getElementById('checklistItemsContainer');

  let filtered = state.checklist.filter(item => {
    return categoryFilter === 'all' || item.category === categoryFilter;
  });

  // Status Bar Update
  const total = state.checklist.length;
  const completed = state.checklist.filter(c => c.completed).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  document.getElementById('checklistCountText').innerText = `${completed}/${total} 完成 (${pct}%)`;
  document.getElementById('checklistMainProgress').style.width = `${pct}%`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="glass-card text-center flex-grow" style="grid-column: 1 / -1; padding: 40px;">
      <i class="fa-solid fa-clipboard-check" style="font-size: 2.5rem; color: var(--primary-gold); margin-bottom: 12px;"></i>
      <p style="color: var(--text-muted);">暂无符合条件的备婚事项，点击“新增待办事项”或载入标准模板！</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map((item, index) => `
    <div class="chk-card ${item.completed ? 'completed' : ''}">
      <span class="chk-index">${index + 1}.</span>
      <div class="chk-header">
        <div class="custom-checkbox" onclick="toggleChecklistDone('${item.id}')">
          ${item.completed ? '<i class="fa-solid fa-check"></i>' : ''}
        </div>
        <span class="chk-title" onclick="toggleChecklistDone('${item.id}')">${item.title}</span>
      </div>
      <div class="chk-meta">
        <span class="tag tag-cat">${item.category}</span>
      </div>
      <div class="chk-notes-col">
        ${item.notes && item.notes.trim() ? `<i class="fa-regular fa-comment-dots"></i> ${item.notes}` : '<span class="no-print" style="opacity:0.3;">-</span>'}
      </div>
      <div class="chk-footer">
        <span class="chk-status-text">${item.completed ? '已完成' : '待办中'}</span>
        <div class="chk-actions">
          <button onclick="editChecklist('${item.id}')" title="编辑"><i class="fa-solid fa-pen"></i></button>
          <button class="del" onclick="deleteChecklist('${item.id}')" title="删除"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleChecklistDone(id) {
  if (!checkAuthGuard()) return;
  const item = state.checklist.find(c => c.id === id);
  if (item) {
    item.completed = !item.completed;
    if (item.completed) {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    }
    saveState();
    renderChecklist();
    if (typeof renderOverview === 'function') renderOverview();
  }
}

function editChecklist(id) {
  if (!checkAuthGuard()) return;
  const item = state.checklist.find(c => c.id === id);
  if (!item) return;
  
  document.getElementById('chkId').value = item.id;
  document.getElementById('chkTitle').value = item.title;
  document.getElementById('chkCategory').value = item.category;
  document.getElementById('chkNotes').value = item.notes || '';
  
  document.getElementById('checklistModalTitle').innerText = '编辑待办事项';
  openModal('checklistModal');
}

async function deleteChecklist(id) {
  if (!checkAuthGuard()) return;
  const confirmed = await showCustomConfirm('删除事项', '确定要删除该待办事项吗？', {
    icon: 'danger',
    confirmText: '确定删除'
  });
  if (confirmed) {
    state.checklist = state.checklist.filter(c => c.id !== id);
    saveState();
    renderChecklist();
    renderOverview();
    showToast('已删除待办事项', 'info');
  }
}

// --------------------------------------------------------------------------
// 3. BUDGET & EXPENSES LOGIC
// --------------------------------------------------------------------------
function initBudgetListeners() {
  // Clear Budget Expenses Button
  const clearBudgetBtn = document.getElementById('clearBudgetBtn');
  if (clearBudgetBtn) {
    clearBudgetBtn.addEventListener('click', () => {
      clearBudget();
    });
  }

  // Set Total Budget Button
  const setTotalBudgetBtn = document.getElementById('setTotalBudgetBtn');
  if (setTotalBudgetBtn) {
    setTotalBudgetBtn.addEventListener('click', () => {
      openBudgetModal();
    });
  }

  // Add Expense Button
  const addExpenseBtn = document.getElementById('addExpenseBtn');
  if (addExpenseBtn) {
    addExpenseBtn.addEventListener('click', () => {
      openAddExpenseModal();
    });
  }
}

window.handleSaveExpense = function() {
  try {
    if (!checkAuthGuard()) return;
    if (!state.expenses) state.expenses = [];
    const id = document.getElementById('expId') ? document.getElementById('expId').value : '';
    const title = document.getElementById('expTitle') ? document.getElementById('expTitle').value : '';
    const category = document.getElementById('expCategory') ? document.getElementById('expCategory').value : '';
    const amount = parseFloat(document.getElementById('expAmount') ? document.getElementById('expAmount').value : 0) || 0;
    const status = document.getElementById('expStatus') ? document.getElementById('expStatus').value : 'paid';
    const deposit = parseFloat(document.getElementById('expDeposit') ? document.getElementById('expDeposit').value : 0) || 0;
    const notesInput = document.getElementById('expNotes');
    const notes = notesInput ? notesInput.value : '';

    if (id) {
      const exp = state.expenses.find(e => e.id === id);
      if (exp) {
        exp.title = title;
        exp.category = category;
        exp.amount = amount;
        exp.status = status;
        exp.deposit = deposit;
        exp.notes = notes;
      }
    } else {
      state.expenses.push({
        id: 'exp_' + Date.now(),
        title,
        category,
        amount,
        status,
        deposit,
        notes,
        date: new Date().toISOString()
      });
    }

    closeModal('expenseModal');
    saveState();
    renderExpenses();
    renderOverview();
    
    const totalBudget = parseFloat(state.settings.totalBudget) || 0;
    const totalSpent = state.expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    if (totalBudget > 0 && totalSpent > totalBudget) {
      showToast('⚠️ 账单已保存（注意：实际总支出已超出总预算！）', 'warning');
    } else {
      showToast('账单已保存', 'success');
    }
  } catch (err) {
    alert("保存账单报错: " + err.message);
    console.error(err);
  }
};

function renderExpenses() {
  const totalBudget = parseFloat(state.settings.totalBudget) || 0;
  const totalSpent = state.expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
  const remaining = totalBudget - totalSpent;
  
  let totalDeposit = 0;
  let totalPending = 0;

  state.expenses.forEach(e => {
    const amt = parseFloat(e.amount) || 0;
    const dep = parseFloat(e.deposit) || 0;
    if (e.status === 'paid') {
      totalDeposit += amt;
    } else if (e.status === 'deposit') {
      totalDeposit += dep;
      totalPending += (amt - dep);
    } else {
      totalPending += amt;
    }
  });

  const totalDisplay = document.getElementById('budgetTotalDisplay');
  if (totalDisplay) {
    totalDisplay.innerText = `¥${totalBudget.toLocaleString()}`;
  }
  document.getElementById('budgetSpentDisplay').innerText = `¥${totalSpent.toLocaleString()}`;
  
  const remainElem = document.getElementById('budgetRemainingDisplay');
  remainElem.innerText = `¥${remaining.toLocaleString()}`;
  
  if (remaining < 0) {
    remainElem.className = 'b-amount text-danger';
  } else {
    remainElem.className = 'b-amount text-green';
  }

  document.getElementById('budgetDepositDisplay').innerText = `¥${totalDeposit.toLocaleString()}`;
  document.getElementById('budgetPendingDisplay').innerText = `¥${totalPending.toLocaleString()}`;

  // Render Table
  const searchInputEl = document.getElementById('expenseSearchInput');
  const searchKey = searchInputEl ? searchInputEl.value.toLowerCase() : '';
  const tableBody = document.getElementById('expensesTableBody');
  if (!tableBody) return;
  
  const filtered = state.expenses.filter(e => {
    return e.title.toLowerCase().includes(searchKey) ||
           e.category.toLowerCase().includes(searchKey) ||
           (e.vendor && e.vendor.toLowerCase().includes(searchKey));
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 24px;">暂无满足条件的支出记录</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map((e, index) => {
    const amt = parseFloat(e.amount) || 0;
    const dep = parseFloat(e.deposit) || 0;
    const pending = Math.max(0, amt - dep);

    let statusHtml = '';
    let depositHtml = '';
    let pendingHtml = '';

    if (e.status === 'paid') {
      statusHtml = '<span class="status-badge paid">全额结清</span>';
      depositHtml = '<span class="text-muted">-</span>';
      pendingHtml = '<span class="text-muted">-</span>';
    } else if (e.status === 'deposit') {
      statusHtml = '<span class="status-badge deposit">已付定金</span>';
      depositHtml = `<span class="mobile-label">定金:</span><span class="text-green">¥${dep.toLocaleString()}</span>`;
      pendingHtml = `<span class="mobile-label">尾款:</span><span class="text-rose">¥${pending.toLocaleString()}</span>`;
    } else {
      statusHtml = '<span class="status-badge pending">待结算</span>';
      depositHtml = '<span class="text-muted">-</span>';
      pendingHtml = `<span class="mobile-label">待付:</span><span class="text-rose">¥${amt.toLocaleString()}</span>`;
    }

    return `
      <tr class="table-row-card">
        <td class="td-index" style="font-weight: 600; color: var(--text-muted);">${index + 1}.</td>
        <td class="td-cat"><span class="tag tag-cat">${e.category}</span></td>
        <td class="td-title"><strong>${e.title}</strong></td>
        <td class="td-amount"><span class="mobile-label">金额:</span><strong class="text-rose">¥${amt.toLocaleString()}</strong></td>
        <td class="td-status"><span class="mobile-label">状态:</span>${statusHtml}</td>
        ${e.status !== 'paid' ? `<td class="td-deposit">${depositHtml}</td>` : '<td class="td-deposit desktop-only"><span class="text-muted">-</span></td>'}
        ${e.status !== 'paid' ? `<td class="td-pending">${pendingHtml}</td>` : '<td class="td-pending desktop-only"><span class="text-muted">-</span></td>'}
        <td class="td-actions">
          <div class="chk-actions">
            <button onclick="editExpense('${e.id}')" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="del" onclick="deleteExpense('${e.id}')" title="删除"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderBudgetCharts();
  renderCategoryStats();
}

function renderCategoryStats() {
  const statsList = document.getElementById('categoryStatsList');
  if (!statsList) return;
  const catTotals = {};
  let totalSpent = 0;

  state.expenses.forEach(e => {
    const amt = parseFloat(e.amount) || 0;
    catTotals[e.category] = (catTotals[e.category] || 0) + amt;
    totalSpent += amt;
  });

  const categories = Object.keys(catTotals);
  if (categories.length === 0) {
    statsList.innerHTML = '<p class="text-muted" style="padding: 20px;">暂无数据</p>';
    return;
  }

  statsList.innerHTML = categories.map(cat => {
    const amt = catTotals[cat];
    const pct = totalSpent === 0 ? 0 : Math.round((amt / totalSpent) * 100);
    return `
      <div class="cat-stat-item">
        <div class="cat-stat-header">
          <span><strong>${cat}</strong></span>
          <span>¥${amt.toLocaleString()} (${pct}%)</span>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill rose" style="width: ${pct}%"></div></div>
      </div>
    `;
  }).join('');
}

function renderBudgetCharts() {
  const ctx = document.getElementById('budgetMainChart');
  if (!ctx) return;
  
  if (budgetChart) budgetChart.destroy();

  const catTotals = {};
  let totalSpent = 0;
  state.expenses.forEach(e => {
    const amt = parseFloat(e.amount || 0);
    catTotals[e.category] = (catTotals[e.category] || 0) + amt;
    totalSpent += amt;
  });

  const labels = Object.keys(catTotals);
  const data = Object.values(catTotals);

  budgetChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['暂无支出'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: ['#ff758c', '#f6d365', '#55efc4', '#74b9ff', '#a29bfe', '#fd79a8', '#ffeaa7', '#fab1a0']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          align: 'center',
          labels: {
            font: { size: 12 },
            padding: 10,
            boxWidth: 24,
            boxHeight: 12,
            generateLabels: (chart) => {
              const orig = Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart);
              if (!totalSpent || !data.length) return orig;
              return orig.map((label, i) => {
                const val = data[i] || 0;
                label.text = `${label.text} - ¥${val.toLocaleString()}`;
                return label;
              });
            }
          }
        },
        datalabels: {
          color: '#ffffff',
          font: { weight: 'bold', size: 12 },
          formatter: (value) => {
            if (!totalSpent || !data.length) return '';
            const pct = Math.round((value / totalSpent) * 100);
            return pct >= 4 ? `${pct}%` : '';
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              const pct = totalSpent === 0 ? 0 : ((val / totalSpent) * 100).toFixed(1);
              return ` ${context.label}: ¥${val.toLocaleString()} (占比 ${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function editExpense(id) {
  if (!checkAuthGuard()) return;
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('expId').value = exp.id;
  document.getElementById('expTitle').value = exp.title;
  document.getElementById('expCategory').value = exp.category;
  document.getElementById('expAmount').value = exp.amount;
  document.getElementById('expStatus').value = exp.status;
  document.getElementById('expDeposit').value = exp.deposit || 0;
  document.getElementById('expNotes').value = exp.notes || '';

  document.getElementById('expenseModalTitle').innerText = '编辑支出明细';
  openModal('expenseModal');
}

async function deleteExpense(id) {
  if (!checkAuthGuard()) return;
  const confirmed = await showCustomConfirm('删除支出记录', '确认要删除该笔支出记录吗？', {
    icon: 'danger',
    confirmText: '确定删除'
  });
  if (confirmed) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveState();
    renderExpenses();
    renderOverview();
    showToast('支出记录已删除', 'info');
  }
}

// --------------------------------------------------------------------------
// 4. GIFTS & RED ENVELOPES LOGIC
// --------------------------------------------------------------------------
let currentGiftType = 'all';

function initGiftListeners() {
  // Type Pills (全部 | 收礼 | 随礼)
  document.querySelectorAll('#giftTypePills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#giftTypePills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentGiftType = pill.getAttribute('data-type') || 'all';
      renderGifts();
    });
  });

  // Relation Filter
  document.getElementById('giftRelationSelect').addEventListener('change', renderGifts);
  // Search Input
  document.getElementById('giftSearchInput').addEventListener('input', renderGifts);

  // Add Gift Button
  document.getElementById('addGiftBtn').addEventListener('click', () => {
    document.getElementById('gftId').value = '';
    document.getElementById('giftForm').reset();
    document.getElementById('gftDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('giftModalTitle').innerText = '登记礼金记录';
    openModal('giftModal');
  });

  // Gift Form Submit
}

window.handleSaveGift = function() {
  try {
    if (!checkAuthGuard()) return;
    if (!state.gifts) state.gifts = [];
    const id = document.getElementById('gftId').value;
    const type = document.getElementById('gftType').value;
    const name = document.getElementById('gftName').value;
    const relation = document.getElementById('gftRelation').value;
    const amount = parseFloat(document.getElementById('gftAmount').value) || 0;
    const dateInput = document.getElementById('gftDate');
    const date = dateInput ? dateInput.value : '';
    const notesInput = document.getElementById('gftNotes');
    const notes = notesInput ? notesInput.value : '';

    if (id) {
      const gift = state.gifts.find(g => g.id === id);
      if (gift) {
        gift.type = type;
        gift.name = name;
        gift.relation = relation;
        gift.amount = amount;
        gift.date = date;
        gift.notes = notes;
      }
    } else {
      state.gifts.unshift({
        id: 'gft_' + Date.now(),
        type, name, relation, amount, date, notes
      });
    }

    closeModal('giftModal');
    saveState();
    
    const searchInput = document.getElementById('giftSearchInput');
    if (searchInput) searchInput.value = '';

    if (typeof currentGiftType !== 'undefined' && currentGiftType !== 'all' && currentGiftType !== type) {
      window.currentGiftType = 'all';
      document.querySelectorAll('#giftTypePills .pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-type') === 'all');
      });
    }

    renderGifts();
    if (typeof renderOverview === 'function') renderOverview();
    showToast('礼金记录保存成功！已为你展示在列表中。', 'success');
  } catch (err) {
    alert("保存礼金报错: " + err.message);
    console.error(err);
  }
};

function renderGifts() {
  const recvList = state.gifts.filter(g => g.type === 'recv');
  const sentList = state.gifts.filter(g => g.type === 'sent');

  const totalRecv = recvList.reduce((acc, g) => acc + (parseFloat(g.amount) || 0), 0);
  const totalSent = sentList.reduce((acc, g) => acc + (parseFloat(g.amount) || 0), 0);
  const netAmount = totalRecv - totalSent;
  const totalCount = state.gifts.length;

  if (document.getElementById('giftTotalRecvDisplay')) {
    document.getElementById('giftTotalRecvDisplay').innerText = `¥${totalRecv.toLocaleString()}`;
  }
  if (document.getElementById('giftTotalSentDisplay')) {
    document.getElementById('giftTotalSentDisplay').innerText = `¥${totalSent.toLocaleString()}`;
  }
  if (document.getElementById('giftNetDisplay')) {
    const netEl = document.getElementById('giftNetDisplay');
    netEl.innerText = `¥${netAmount.toLocaleString()}`;
    netEl.className = netAmount >= 0 ? 'b-amount text-green' : 'b-amount text-rose';
  }
  if (document.getElementById('giftCountDisplay')) {
    document.getElementById('giftCountDisplay').innerText = `${totalCount} 笔`;
  }

  // Filter Table
  const relationFilter = document.getElementById('giftRelationSelect').value;
  const searchKey = document.getElementById('giftSearchInput').value.toLowerCase();
  const tableBody = document.getElementById('giftsTableBody');

  const filtered = state.gifts.filter(g => {
    const typeMatch = currentGiftType === 'all' || g.type === currentGiftType;
    const relMatch = relationFilter === 'all' || g.relation === relationFilter;
    const searchMatch = g.name.toLowerCase().includes(searchKey) ||
                        g.relation.toLowerCase().includes(searchKey) ||
                        (g.notes && g.notes.toLowerCase().includes(searchKey));
    return typeMatch && relMatch && searchMatch;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">暂无符合条件的礼金明细</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map((g) => `
    <tr class="table-row-card">
      <td class="td-cat">${g.type === 'recv' ? '<span class="status-badge paid">收礼</span>' : '<span class="status-badge pending">随礼</span>'}</td>
      <td class="td-title"><strong>${g.name}</strong></td>
      <td class="td-rel"><span class="tag tag-stage">${g.relation}</span></td>
      <td class="td-amount"><span class="mobile-label">金额:</span><strong class="text-rose">¥${parseFloat(g.amount).toLocaleString()}</strong></td>
      <td class="td-date"><span class="mobile-label">日期:</span>${g.date || '-'}</td>
      <td class="td-notes">${g.notes && g.notes.trim() ? `<span class="mobile-label">备注:</span>${g.notes}` : ''}</td>
      <td class="td-actions">
        <div class="chk-actions">
          <button onclick="editGift('${g.id}')" title="编辑"><i class="fa-solid fa-pen"></i></button>
          <button class="del" onclick="deleteGift('${g.id}')" title="删除"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  renderGiftChart();
}

function getReturnStatusBadge(status) {
  if (status === 'returned') return '<span class="status-badge paid">已回礼</span>';
  if (status === 'gift_sent') return '<span class="status-badge deposit">已送伴手礼</span>';
  return '<span class="text-muted" style="font-size:0.8rem;">未回礼</span>';
}

function renderGiftChart() {
  const ctx = document.getElementById('giftChart');
  if (!ctx) return;

  if (giftChart) giftChart.destroy();

  const relTotals = {};
  let totalRecv = 0;
  state.gifts.filter(g => g.type === currentGiftType).forEach(g => {
    const amt = parseFloat(g.amount || 0);
    relTotals[g.relation] = (relTotals[g.relation] || 0) + amt;
    totalRecv += amt;
  });

  const labels = Object.keys(relTotals);
  const data = Object.values(relTotals);

  giftChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels : ['暂无明细'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: ['#ff758c', '#74b9ff', '#55efc4', '#f6d365', '#a29bfe', '#fd79a8', '#ffeaa7']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        datalabels: {
          color: '#ffffff',
          font: { weight: 'bold', size: 12 },
          formatter: (value) => {
            if (!totalRecv || !data.length) return '';
            const pct = Math.round((value / totalRecv) * 100);
            return pct >= 5 ? `${pct}%` : '';
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              const pct = totalRecv === 0 ? 0 : ((val / totalRecv) * 100).toFixed(1);
              return ` ${context.label}: ¥${val.toLocaleString()} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function editGift(id) {
  if (!checkAuthGuard()) return;
  const gift = state.gifts.find(g => g.id === id);
  if (!gift) return;

  document.getElementById('gftId').value = gift.id;
  document.getElementById('gftType').value = gift.type;
  document.getElementById('gftName').value = gift.name;
  document.getElementById('gftRelation').value = gift.relation;
  document.getElementById('gftAmount').value = gift.amount;
  document.getElementById('gftDate').value = gift.date || '';
  document.getElementById('gftNotes').value = gift.notes || '';

  document.getElementById('giftModalTitle').innerText = '编辑礼金记录';
  openModal('giftModal');
}

async function deleteGift(id) {
  if (!checkAuthGuard()) return;
  const confirmed = await showCustomConfirm('删除礼金记录', '确定要删除该笔礼金记录吗？', {
    icon: 'danger',
    confirmText: '确定删除'
  });
  if (confirmed) {
    state.gifts = state.gifts.filter(g => g.id !== id);
    saveState();
    renderGifts();
    renderOverview();
    showToast('礼金记录已删除', 'info');
  }
}

// --------------------------------------------------------------------------
// 5. CORNER EXPORT & PDF / EXCEL LOGIC
// --------------------------------------------------------------------------
function initDataManagement() {
  // Corner Export Button
  const exportCornerBtn = document.getElementById('exportCornerBtn');
  if (exportCornerBtn) {
    exportCornerBtn.addEventListener('click', () => {
      openModal('exportModal');
    });
  }

  // PDF Export Handlers for Individual Categories
  function triggerPdfPrint(targetTabId, name) {
    closeModal('exportModal');

    // Populate clean document print header text
    const coupleText = (state.settings && state.settings.couples) ? state.settings.couples : '新郎 & 新娘';
    let dateText = '未设定日期';
    if (state.settings && state.settings.date) {
      const d = new Date(state.settings.date);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        dateText = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else {
        dateText = String(state.settings.date).replace('T', ' ');
      }
    }
    document.querySelectorAll('.print-couples').forEach(el => el.innerText = coupleText);
    document.querySelectorAll('.print-date').forEach(el => el.innerText = dateText);

    const totalB = parseFloat(state.settings.totalBudget || 0);
    const spentB = state.expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    const remainB = totalB - spentB;
    document.querySelectorAll('.print-budget-total').forEach(el => el.innerText = `¥${totalB.toLocaleString()}`);
    document.querySelectorAll('.print-budget-spent').forEach(el => el.innerText = `¥${spentB.toLocaleString()}`);
    document.querySelectorAll('.print-budget-remain').forEach(el => el.innerText = `¥${remainB.toLocaleString()}`);

    const totalRecv = state.gifts.filter(g => g.type === 'recv').reduce((acc, g) => acc + (parseFloat(g.amount) || 0), 0);
    const totalSent = state.gifts.filter(g => g.type === 'sent').reduce((acc, g) => acc + (parseFloat(g.amount) || 0), 0);
    document.querySelectorAll('.print-gift-recv').forEach(el => el.innerText = `¥${totalRecv.toLocaleString()}`);
    document.querySelectorAll('.print-gift-sent').forEach(el => el.innerText = `¥${totalSent.toLocaleString()}`);

    document.body.setAttribute('data-print-target', targetTabId);
    showToast(`正在准备【${name}】PDF 打印文档...`, 'info');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.removeAttribute('data-print-target');
      }, 1000);
    }, 400);
  }

  const exportPdfChecklistBtn = document.getElementById('exportPdfChecklistBtn');
  if (exportPdfChecklistBtn) {
    exportPdfChecklistBtn.addEventListener('click', () => {
      triggerPdfPrint('tab-checklist', '备婚待办清单');
    });
  }

  const exportPdfExpensesBtn = document.getElementById('exportPdfExpensesBtn');
  if (exportPdfExpensesBtn) {
    exportPdfExpensesBtn.addEventListener('click', () => {
      triggerPdfPrint('tab-budget', '预算与支出明细');
    });
  }

  const exportPdfGiftsBtn = document.getElementById('exportPdfGiftsBtn');
  if (exportPdfGiftsBtn) {
    exportPdfGiftsBtn.addEventListener('click', () => {
      triggerPdfPrint('tab-gifts', '婚礼人情礼金');
    });
  }

  // Export Excel / CSV Tables
  const exportCsvChecklistBtn = document.getElementById('exportCsvChecklistBtn');
  if (exportCsvChecklistBtn) {
    exportCsvChecklistBtn.addEventListener('click', () => {
      const headers = ['分类', '待办事项名称', '完成状态', '备注说明'];
      const rows = state.checklist.map(item => [
        item.category,
        item.title,
        item.completed ? '已完成' : '待办中',
        item.notes || ''
      ]);
      downloadCleanCSV(`备婚待办事项清单_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      showToast('备婚待办事项清单 CSV 表格导出成功！', 'success');
    });
  }

  const exportCsvExpensesBtn = document.getElementById('exportCsvExpensesBtn');
  if (exportCsvExpensesBtn) {
    exportCsvExpensesBtn.addEventListener('click', () => {
      const headers = ['分类', '支出项目名称', '花费总金额', '付款状态', '已付定金', '备注说明'];
      const rows = state.expenses.map(e => [
        e.category,
        e.title,
        `¥${(parseFloat(e.amount) || 0).toLocaleString()}`,
        e.status === 'paid' ? '全额结清' : (e.status === 'deposit' ? '已付定金' : '待结算'),
        e.status !== 'paid' ? `¥${(parseFloat(e.deposit) || 0).toLocaleString()}` : '-',
        e.notes || ''
      ]);
      downloadCleanCSV(`婚礼支出明细账单_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      showToast('婚礼支出明细 CSV 表格导出成功！', 'success');
    });
  }

  const exportCsvGiftsBtn = document.getElementById('exportCsvGiftsBtn');
  if (exportCsvGiftsBtn) {
    exportCsvGiftsBtn.addEventListener('click', () => {
      const headers = ['类型', '宾客姓名', '关系分组', '礼金金额', '日期', '备注说明'];
      const rows = state.gifts.map(g => [
        g.type === 'recv' ? '收礼' : '随礼',
        g.name,
        g.relation,
        `¥${(parseFloat(g.amount) || 0).toLocaleString()}`,
        g.date || '',
        g.notes || ''
      ]);
      downloadCleanCSV(`婚礼人情礼金账本_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      showToast('婚礼人情礼金账本 CSV 表格导出成功！', 'success');
    });
  }
}

function downloadCleanCSV(fileName, headers, rows) {
  // UTF-8 BOM signature to ensure Excel opens Chinese text correctly
  let csvContent = '\uFEFF';
  
  // Header row
  csvContent += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';
  
  // Data rows
  rows.forEach(row => {
    csvContent += row.map(cell => {
      const val = cell !== null && cell !== undefined ? String(cell) : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --------------------------------------------------------------------------
// 6. SETTINGS & APP INIT
// --------------------------------------------------------------------------
function openSettingsModal() {
  if (!checkAuthGuard()) return;
  try {
    const couplesInput = document.getElementById('settingCouples');
    const dateInput = document.getElementById('settingDate');
    const locInput = document.getElementById('settingLocation');

    if (couplesInput) couplesInput.value = state.settings?.couples || '新郎 ❤️ 新娘';
    if (locInput) locInput.value = state.settings?.location || '';
    
    if (dateInput && state.settings.date) {
      try {
        const d = new Date(state.settings.date);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          dateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
      } catch (err) {
        dateInput.value = '';
      }
    }
  } catch (err) {
    console.error('Settings init error:', err);
  }
  openModal('settingsModal');
}
window.openSettingsModal = openSettingsModal;

function initSettings() {
  const openBtn = document.getElementById('openSettingsBtn');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSettingsModal();
    });
  }

  window.handleSaveSettings = function() {
    try {
      if (!checkAuthGuard()) return;
      if (!state.settings) state.settings = {};
      state.settings.couples = document.getElementById('settingCouples').value;
      state.settings.date = document.getElementById('settingDate').value;
      state.settings.location = document.getElementById('settingLocation').value;

      closeModal('settingsModal');
      saveState();
      initCountdown();
      showToast('婚礼设置修改已保存！', 'success');
    } catch (err) {
      alert("保存报错: " + err.message);
      console.error("handleSaveSettings error:", err);
    }
  };

  const totalBudgetForm = document.getElementById('totalBudgetForm');
  // Form submission removed. It's now handled by window.handleSaveTotalBudget
}

window.handleSaveTotalBudget = function() {
  try {
    if (!checkAuthGuard()) return;
    if (!state.settings) state.settings = {};
    const val = parseFloat(document.getElementById('inputTotalBudget').value) || 0;
    state.settings.totalBudget = val;
    saveState();
    renderAll();
    closeModal('totalBudgetModal');

    const totalSpent = state.expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    if (val > 0 && totalSpent > val) {
      showToast(`总预算已更新为 ¥${val.toLocaleString()}（注意：已超出设定预算！）`, 'warning');
    } else {
      showToast(`总预算已更新为 ¥${val.toLocaleString()}`, 'success');
    }
  } catch (err) {
    alert("保存总预算报错: " + err.message);
    console.error(err);
  }
};

function openBudgetModal() {
  if (!checkAuthGuard()) return;
  const modal = document.getElementById('totalBudgetModal');
  if (modal) {
    const input = document.getElementById('inputTotalBudget');
    if (input) {
      input.value = (state && state.settings && state.settings.totalBudget !== undefined) ? state.settings.totalBudget : 200000;
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    }
    openModal('totalBudgetModal');
  }
}
window.openBudgetModal = openBudgetModal;

async function clearBudget() {
  if (!checkAuthGuard()) return;
  if (state.expenses.length === 0) {
    showToast('当前支出账单已经是空的啦！', 'info');
    return;
  }
  const confirmed = await showCustomConfirm('清空支出明细', '确认要清空所有已记录的支出明细并重置账本吗？此操作不可撤销！', {
    icon: 'danger',
    confirmText: '确认清空'
  });
  if (confirmed) {
    state.expenses = [];
    saveState();
    renderAll();
    showToast('支出记录已成功清空重置', 'info');
  }
}
window.clearBudget = clearBudget;

function openAddExpenseModal() {
  if (!checkAuthGuard()) return;
  document.getElementById('expId').value = '';
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseModalTitle').innerText = '新增支出明细';
  openModal('expenseModal');
}
window.openAddExpenseModal = openAddExpenseModal;

function openAddGiftModal() {
  if (!checkAuthGuard()) return;
  document.getElementById('gftId').value = '';
  document.getElementById('giftForm').reset();
  document.getElementById('giftModalTitle').innerText = '登记礼金记录';
  openModal('giftModal');
}
window.openAddGiftModal = openAddGiftModal;

// --------------------------------------------------------------------------
// 7. CANVAS PETALS EFFECT
// --------------------------------------------------------------------------
function initPetalCanvas() {
  const canvas = document.getElementById('petalCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const petals = Array.from({ length: 25 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height - height,
    size: Math.random() * 8 + 6,
    speedY: Math.random() * 1.2 + 0.8,
    speedX: Math.random() * 0.6 - 0.3,
    rotation: Math.random() * 360,
    rotSpeed: Math.random() * 2 - 1,
    opacity: Math.random() * 0.5 + 0.3
  }));

  function animate() {
    ctx.clearRect(0, 0, width, height);
    petals.forEach(p => {
      p.y += p.speedY;
      p.x += Math.sin(p.y * 0.01) + p.speedX;
      p.rotation += p.rotSpeed;

      if (p.y > height) {
        p.y = -20;
        p.x = Math.random() * width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      
      // Draw Heart/Petal Shape
      ctx.fillStyle = '#ff7b9c';
      ctx.beginPath();
      ctx.arc(-p.size/2, 0, p.size/2, 0, Math.PI, true);
      ctx.arc(p.size/2, 0, p.size/2, 0, Math.PI, true);
      ctx.lineTo(0, p.size);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    });
    requestAnimationFrame(animate);
  }

  animate();
}

// --------------------------------------------------------------------------
// AUTHENTICATION LOGIC & GUARD (Login, Register & 7-Day Session)
// --------------------------------------------------------------------------
function checkAuthGuard() {
  const session = getAuthSession();
  if (!session) {
    showToast('请先登录账号，再添加或修改备婚数据！', 'warning');
    openAuthModal('login');
    return false;
  }
  return true;
}

function openAuthModal(mode = 'login') {
  switchAuthTab(mode);
  const uInput = document.getElementById('authUsername');
  const pInput = document.getElementById('authPassword');
  const cInput = document.getElementById('authConfirmPassword');
  if (uInput) uInput.value = '';
  if (pInput) pInput.value = '';
  if (cInput) cInput.value = '';
  const errBox = document.getElementById('authErrorMsg');
  if (errBox) errBox.style.display = 'none';
  openModal('authModal');
}

function switchAuthTab(mode) {
  currentAuthMode = mode;
  const tabLogin = document.getElementById('authTabLogin');
  const tabRegister = document.getElementById('authTabRegister');
  const title = document.getElementById('authModalTitle');
  const confirmGroup = document.getElementById('authConfirmGroup');
  const submitBtn = document.getElementById('authSubmitBtn');
  const errBox = document.getElementById('authErrorMsg');
  if (errBox) errBox.style.display = 'none';

  if (mode === 'login') {
    if (tabLogin) {
      tabLogin.classList.add('active');
      tabLogin.style.background = '#ffffff';
      tabLogin.style.color = 'var(--primary-rose)';
      tabLogin.style.fontWeight = '700';
      tabLogin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    }
    if (tabRegister) {
      tabRegister.classList.remove('active');
      tabRegister.style.background = 'transparent';
      tabRegister.style.color = 'var(--text-muted)';
      tabRegister.style.fontWeight = 'normal';
      tabRegister.style.boxShadow = 'none';
    }
    if (title) title.innerHTML = '<i class="fa-solid fa-user-lock" style="color: var(--primary-rose);"></i> 账号登录';
    if (confirmGroup) confirmGroup.style.display = 'none';
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> 确认登录';
  } else {
    if (tabRegister) {
      tabRegister.classList.add('active');
      tabRegister.style.background = '#ffffff';
      tabRegister.style.color = 'var(--primary-rose)';
      tabRegister.style.fontWeight = '700';
      tabRegister.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    }
    if (tabLogin) {
      tabLogin.classList.remove('active');
      tabLogin.style.background = 'transparent';
      tabLogin.style.color = 'var(--text-muted)';
      tabLogin.style.fontWeight = 'normal';
      tabLogin.style.boxShadow = 'none';
    }
    if (title) title.innerHTML = '<i class="fa-solid fa-user-plus" style="color: var(--primary-rose);"></i> 注册新账号';
    if (confirmGroup) confirmGroup.style.display = 'block';
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> 立即注册';
  }
}

function initAuthListeners() {
  const form = document.getElementById('authForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const confirmPassword = document.getElementById('authConfirmPassword').value;
    const rememberWeek = document.getElementById('rememberWeekCheck').checked;
    const errBox = document.getElementById('authErrorMsg');

    if (!username || !password) {
      if (errBox) { errBox.textContent = '请填写完整的用户名和密码'; errBox.style.display = 'block'; }
      return;
    }

    if (currentAuthMode === 'register') {
      if (password !== confirmPassword) {
        if (errBox) { errBox.textContent = '两次输入的密码不一致'; errBox.style.display = 'block'; }
        return;
      }
    }

    let token = null;
    let expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    let userData = null;

    // 1. Try server API first if online and returns JSON
    const endpoint = currentAuthMode === 'register' ? '/api/register' : '/api/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          token = data.token;
          expiresAt = Number(data.expiresAt) || expiresAt;
          userData = data.data;
        } else {
          if (errBox) { errBox.textContent = data.message || (currentAuthMode === 'login' ? '账号不存在，请切到【注册新账号】' : '注册失败'); errBox.style.display = 'block'; }
          return;
        }
      }
    } catch (err) {
      console.log('💡 纯离线/静态模式');
    }

    // 2. Standalone client-side auth fallback if static hosting or server offline
    if (!token) {
      const localUsersKey = 'WEDDING_REGISTERED_USERS_V1';
      const userLocalKey = 'WEDDING_USER_DATA_' + username;
      let users = {};
      try { users = JSON.parse(localStorage.getItem(localUsersKey) || '{}'); } catch (e) {}

      const hasExistingData = !!(localStorage.getItem(userLocalKey) || sessionStorage.getItem(userLocalKey));

      if (currentAuthMode === 'register') {
        // If user is registering
        if (users[username] && users[username].password !== password && !hasExistingData) {
          if (errBox) { errBox.textContent = '该用户名已被注册，请检查密码或直接登录'; errBox.style.display = 'block'; }
          return;
        }
        // Save/Update password
        users[username] = { password };
        localStorage.setItem(localUsersKey, JSON.stringify(users));
      } else {
        // If user is logging in
        if (!users[username]) {
          if (errBox) { errBox.textContent = '账号不存在，请先切到【注册新账号】'; errBox.style.display = 'block'; }
          return;
        } else if (users[username].password !== password) {
          if (errBox) { errBox.textContent = '密码不正确，请重新输入'; errBox.style.display = 'block'; }
          return;
        }
      }

      token = 'tok_local_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    // 3. Save Session into localStorage & sessionStorage
    const session = {
      token: token,
      username: username,
      expiresAt: rememberWeek ? expiresAt : (Date.now() + 24 * 60 * 60 * 1000)
    };

    try {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    } catch (e) {}

    // Update URL hash so refresh on file:/// protocol or sandboxed iframe never loses session
    try {
      const newHash = `#user=${encodeURIComponent(username)}&token=${encodeURIComponent(token)}`;
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
      } else {
        window.location.hash = newHash;
      }
    } catch (e) {}

    updateAuthUI();
    closeModal('authModal');

    // 4. Load & save user-isolated state
    const userLocalKey = 'WEDDING_USER_DATA_' + username;
    if (userData) {
      state = userData;
    } else {
      let userSavedData = null;
      try { userSavedData = localStorage.getItem(userLocalKey) || sessionStorage.getItem(userLocalKey); } catch (e) {}
      if (userSavedData) {
        try { state = JSON.parse(userSavedData); } catch (e) {}
      } else {
        state = getDefaultData(username);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(userLocalKey, JSON.stringify(state));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      sessionStorage.setItem(userLocalKey, JSON.stringify(state));
    } catch (e) {}

    renderAll();
    showToast(currentAuthMode === 'register' ? '注册成功！已自动保持登录 7 天' : '登录成功！已自动保持登录 7 天', 'success');
  });
}

async function handleLogout() {
  const confirmed = await showCustomConfirm('确认退出登录', '退出后您可以随时重新登录该账号同步数据。是否确认退出？', {
    icon: 'info',
    confirmText: '退出登录',
    danger: true
  });

  if (confirmed) {
    const session = getAuthSession();
    if (session && session.token) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } catch (e) {
        console.warn('Logout API err:', e);
      }
    }
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch (e) {}

    // Clear URL Hash
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else {
        window.location.hash = '';
      }
    } catch (e) {}

    updateAuthUI();
    showToast('已安全退出登录', 'info');
    initCloudSync();
  }
}

// --------------------------------------------------------------------------
// RENDER ALL & BOOTSTRAP
// --------------------------------------------------------------------------
function renderAll() {
  try { renderOverview(); } catch (e) { console.error('renderOverview err:', e); }
  try { renderChecklist(); } catch (e) { console.error('renderChecklist err:', e); }
  try { renderExpenses(); } catch (e) { console.error('renderExpenses err:', e); }
  try { renderGifts(); } catch (e) { console.error('renderGifts err:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
  try { initTabs(); } catch (e) { console.error('initTabs err:', e); }
  try { initModals(); } catch (e) { console.error('initModals err:', e); }
  try { initCountdown(); } catch (e) { console.error('initCountdown err:', e); }
  try { initChecklistListeners(); } catch (e) { console.error('initChecklistListeners err:', e); }
  try { initBudgetListeners(); } catch (e) { console.error('initBudgetListeners err:', e); }
  try { initGiftListeners(); } catch (e) { console.error('initGiftListeners err:', e); }
  try { initDataManagement(); } catch (e) { console.error('initDataManagement err:', e); }
  try { initSettings(); } catch (e) { console.error('initSettings err:', e); }
  try { initAuthListeners(); } catch (e) { console.error('initAuthListeners err:', e); }
  try { initPetalCanvas(); } catch (e) { console.error('initPetalCanvas err:', e); }
  
  renderAll();
  initCloudSync();
});
