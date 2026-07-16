// ----------------------------------------------------
// UI Navigation and Tab Controller
// ----------------------------------------------------

let activeTab = "dashboard";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize App Data first
  initAppState();
  
  // Setup Navigation Tab Listeners
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      
      const tabName = item.getAttribute("data-tab");
      switchTab(tabName);
    });
  });
  
  // Setup General UI Event Listeners
  setupFormEventListeners();
  setupPlannerSliders();
  setupBackupButtons();
  
  // Initial rendering
  switchTab("dashboard");
  populatePresetDatalist();
});

function switchTab(tabName) {
  activeTab = tabName;
  
  // Hide all tab screens
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.style.display = "none";
  });
  
  // Show active tab screen
  const activeTabEl = document.getElementById(`tab-${tabName}`);
  if (activeTabEl) {
    activeTabEl.style.display = "block";
  }
  
  // Render tab-specific details
  renderCurrentTab();
}

function renderCurrentTab() {
  switch (activeTab) {
    case "dashboard":
      renderDashboard();
      break;
    case "inventory":
      renderInventory();
      break;
    case "sheet":
      renderSpreadsheetGrid();
      break;
    case "purchases":
      renderPurchasesHistory();
      break;
    case "monthly":
      renderMonthlyPlanner();
      break;
    case "items":
      renderManageItems();
      break;
    case "planner":
      renderSalaryPlanner();
      break;
    case "bank":
      renderBankLedger();
      break;
    case "reports":
      renderReports();
      break;
  }
}

// Populate the datalist of preset item names
function populatePresetDatalist() {
  const datalist = document.getElementById("preset-names-datalist");
  if (!datalist) return;
  datalist.innerHTML = "";
  PRESETS.items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.name;
    datalist.appendChild(option);
  });
}

// ----------------------------------------------------
// Modal Utilities
// ----------------------------------------------------

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    // Clear forms inside modal
    const form = modal.querySelector("form");
    if (form) form.reset();
  }
}

// Toast Notifications Helper
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "🔔";
  if (type === "success") icon = "✅";
  if (type === "warn") icon = "⚠️";
  if (type === "error") icon = "❌";
  if (type === "info") icon = "🧠";
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  
  // Slide out after 3.5 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ----------------------------------------------------
// Dashboard Rendering
// ----------------------------------------------------

function renderDashboard() {
  const budget = calculateBudgetReport();
  
  // Update Overview Stats Cards
  document.getElementById("stat-cash-val").innerText = state.cashBuffer.toLocaleString();
  document.getElementById("stat-salary-val").innerText = state.salary.toLocaleString();
  
  document.getElementById("stat-monthly-spend").innerText = Math.round(budget.totalMonthlySpendNormal).toLocaleString();
  document.getElementById("stat-survival-spend").innerText = Math.round(budget.totalMonthlySpendSurvivalOnly).toLocaleString();
  
  document.getElementById("stat-survival-days").innerText = Math.round(budget.totalSurvivalOutlookDays);
  document.getElementById("stat-stock-lasts-val").innerText = `${Math.round(budget.minEssentialDays)} days`;
  document.getElementById("stat-cash-lasts-val").innerText = `${Math.round(budget.cashSurvivalDays)} days`;
  
  // Out of stock counts
  let lowStockCount = 0;
  let outCount = 0;
  
  state.items.forEach(item => {
    const stats = calculateItemStats(item);
    if (stats.status === "Out of Stock") outCount++;
    else if (stats.status === "Low Stock" || stats.status === "Critical") lowStockCount++;
  });
  
  document.getElementById("stat-critical-count").innerText = (outCount + lowStockCount);
  document.getElementById("stat-out-of-stock-count").innerText = outCount;
  document.getElementById("stat-low-stock-count").innerText = lowStockCount;
  
  // Dashboard Banner Warnings
  const alertContainer = document.getElementById("dashboard-alert-container");
  alertContainer.innerHTML = "";
  
  if (state.salaryDelayMonths > 0) {
    const delayBanner = document.createElement("div");
    if (budget.isSurvivalSecure) {
      delayBanner.className = "alert-banner warning";
      delayBanner.innerHTML = `⚠️ <strong>Salary Delay Simulation Active (${state.salaryDelayMonths} Months Delay):</strong> Your stretched cash buffer (₹${state.cashBuffer}) is projected to cover essential food and care. Survival outlook is secure.`;
    } else {
      delayBanner.className = "alert-banner";
      delayBanner.innerHTML = `🚨 <strong>Emergency Cash Deficit Detected:</strong> Your cash buffer will fall short by ₹${Math.abs(budget.cashBalanceAfterDelay).toLocaleString()} during this salary delay! Stretch your stock or purchase survival essentials in advance.`;
    }
    alertContainer.appendChild(delayBanner);
  } else if (outCount > 0) {
    const alertBanner = document.createElement("div");
    alertBanner.className = "alert-banner warning";
    alertBanner.innerHTML = `⚠️ You have <strong>${outCount} essential items out of stock</strong>. Check the list below to log purchases.`;
    alertContainer.appendChild(alertBanner);
  }
  
  // Render critical table list
  const criticalTbody = document.getElementById("dashboard-critical-tbody");
  criticalTbody.innerHTML = "";
  
  const criticalItems = state.items
    .map(item => ({ item, stats: calculateItemStats(item) }))
    .filter(x => x.stats.status !== "Safe")
    .sort((a, b) => a.stats.remainingDays - b.stats.remainingDays);
    
  if (criticalItems.length === 0) {
    criticalTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dark); padding: 30px;">All grocery stocks are currently safe! 👍</td></tr>`;
  } else {
    criticalItems.forEach(x => {
      const item = x.item;
      const stats = x.stats;
      
      const tr = document.createElement("tr");
      
      // Stock quantity display strings
      const origDisplay = formatBaseQty(stats.currentStockBase, item);
      const houseDisplay = formatHouseQty(stats.currentStockBase, item);
      
      const statusBadge = getStatusBadgeHTML(stats.status);
      const daysText = stats.status === "Out of Stock" ? "Depleted" : `${Math.round(stats.remainingDays)} Days`;
      
      tr.innerHTML = `
        <td style="font-weight: 600;">${item.name} <span class="badge badge-${item.priority}" style="font-size: 9px; padding: 2px 6px; margin-left: 5px;">${item.priority}</span></td>
        <td>${origDisplay} <br><span style="font-size: 11px; color: var(--text-dark);">${houseDisplay}</span></td>
        <td>${daysText}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="logItemDepletedDirect('${item.id}')">🍽️ Finished Today</button>
            <button class="btn btn-primary btn-sm" onclick="openPurchaseModalDirect('${item.id}')">🛒 Buy</button>
          </div>
        </td>
      `;
      criticalTbody.appendChild(tr);
    });
  }
  
  // Render Dynamic planning tip
  const tipBox = document.getElementById("dashboard-tip-box");
  if (tipBox) {
    tipBox.innerHTML = generateDynamicTip(budget, criticalItems);
  }
}

// Generate dynamic adaptive text suggestions for homemaker
function generateDynamicTip(budget, criticalItems) {
  if (state.salaryDelayMonths > 0) {
    if (budget.isSurvivalSecure) {
      return `💡 <strong>Survival Mode Enabled:</strong> Your current stretch level is set to ${state.stretchPercentage}%. This stretches your essential items like Flour and Oil. Because of this, your overall budget is secure for the next ${Math.round(budget.totalSurvivalOutlookDays)} days. Try to avoid buying any comfort or luxury items.`;
    } else {
      return `💡 <strong>Budget Deficit Action Required:</strong> We project a cash deficit. Consider increasing your "Stock Stretch Level" to 20% or 25% in the Simulator tab. This reduces the consumption amount per serving, making your stocks last longer and lowering monthly cash demand.`;
    }
  }
  
  if (criticalItems.length > 0) {
    const firstCritical = criticalItems[0].item;
    return `💡 <strong>Purchase Optimization:</strong> Your ${firstCritical.name} is running low. By purchasing it in a larger pack size next time, you can optimize your budget. Our statistics engine will automatically track the price difference per base unit and recommend the cheapest store.`;
  }
  
  return `💡 <strong>Budget Advice:</strong> All inventory levels look healthy. Consider saving your extra cash of ₹${state.cashBuffer} into an emergency fund to prepare for potential salary delays in the coming months.`;
}

// ----------------------------------------------------
// Inventory Tab Rendering
// ----------------------------------------------------

function renderInventory() {
  const grid = document.getElementById("inventory-cards-container");
  grid.innerHTML = "";
  
  const searchVal = document.getElementById("inventory-search").value.toLowerCase();
  const catFilter = document.getElementById("inventory-filter-category").value;
  const statusFilter = document.getElementById("inventory-filter-status").value;
  
  // Populate category dropdown
  const catSelect = document.getElementById("inventory-filter-category");
  if (catSelect.options.length <= 1) {
    PRESETS.categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      catSelect.appendChild(opt);
    });
  }
  
  const filtered = state.items.filter(item => {
    const stats = calculateItemStats(item);
    const matchesSearch = item.name.toLowerCase().includes(searchVal);
    const matchesCat = catFilter === "all" || item.category === catFilter;
    const matchesStatus = statusFilter === "all" || stats.status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });
  
  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-dark); padding: 50px;">No items match your filters. Try adding a new purchase!</div>`;
    return;
  }
  
  filtered.forEach(item => {
    const stats = calculateItemStats(item);
    const card = document.createElement("div");
    card.className = `glass-panel item-card`;
    
    // Unit strings
    const packStr = formatBaseQty(stats.currentStockBase, item);
    const scientificStr = `${Math.round(stats.currentStockBase)} ${item.baseUnit}`;
    const houseStr = formatHouseQty(stats.currentStockBase, item);
    
    const priorityBadge = `<span class="badge badge-${item.priority}">${item.priority}</span>`;
    const statusIndicator = getStatusBadgeHTML(stats.status);
    
    // Determine conversion confidence percentage
    const houseUnit = item.consumption.unit.toLowerCase().trim();
    let confidencePercent = 100;
    let confidenceSource = "Manual Override";
    if (item.conversions && item.conversions[houseUnit]) {
      confidencePercent = Math.round(item.conversions[houseUnit].confidence * 100);
      confidenceSource = item.conversions[houseUnit].source === "scientific" ? "Kitchen Standard" : "System Learned 🧠";
    }
    
    const schedDesc = getScheduleDescription(item.consumption);
    
    card.innerHTML = `
      <div>
        <div class="item-card-header">
          <div class="item-title-wrap">
            <span class="item-name">${item.name}</span>
            <span class="item-category">${item.category}</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
            ${priorityBadge}
            ${statusIndicator}
          </div>
        </div>
        
        <div class="item-stock-box">
          <div class="stock-row highlight">
            <span class="lbl">Remaining Stock:</span>
            <span class="val">${packStr}</span>
          </div>
          <div class="stock-row">
            <span class="lbl">Scientific Measure:</span>
            <span class="val">${scientificStr}</span>
          </div>
          <div class="stock-row">
            <span class="lbl">Household Measure:</span>
            <span class="val">${houseStr}</span>
          </div>
          <div class="stock-confidence">
            <span>${confidenceSource} (${confidencePercent}% confidence)</span>
          </div>
        </div>
        
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px;">
          📋 <strong>Usage:</strong> ${item.consumption.qty} ${item.consumption.unit} ${schedDesc}
        </div>
      </div>
      
      <div>
        <div class="item-timeline">
          <div class="timeline-col">
            <span class="lbl">Stock Cycle</span>
            <span class="num">${stats.daysElapsed} days</span>
          </div>
          <div class="timeline-col" style="text-align: right;">
            <span class="lbl">Depletion Date</span>
            <span class="num">${stats.status === 'Out of Stock' ? 'Empty' : stats.depletionDate}</span>
          </div>
        </div>
        
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" onclick="logItemDepletedDirect('${item.id}')">🍽️ Finished</button>
          <button class="btn btn-primary btn-sm" onclick="openPurchaseModalDirect('${item.id}')">➕ Buy</button>
          <button class="btn btn-secondary btn-sm" style="padding: 8px;" onclick="openItemModalDirect('${item.id}')">✏️</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ----------------------------------------------------
// Manage Items Tab Rendering
// ----------------------------------------------------

// Pagination state for Manage Items
let itemsCurrentPage = 1;
const itemsPageSize = 10;

function getFilteredItemsList() {
  const searchVal = document.getElementById("items-search").value.toLowerCase().trim();
  const catFilter = document.getElementById("items-filter-category").value;
  const priFilter = document.getElementById("items-filter-priority").value;
  const sortBy = document.getElementById("items-sort-by").value;
  
  // Fill categories dropdown dynamically if needed
  const catSelect = document.getElementById("items-filter-category");
  if (catSelect && catSelect.options.length <= 1) {
    PRESETS.categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      catSelect.appendChild(opt);
    });
  }

  let list = state.items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchVal);
    const matchesCat = catFilter === "all" || item.category === catFilter;
    const matchesPri = priFilter === "all" || item.priority === priFilter;
    return matchesSearch && matchesCat && matchesPri;
  });
  
  // Sorting
  if (sortBy === "name-asc") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "name-desc") {
    list.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortBy === "category") {
    list.sort((a, b) => a.category.localeCompare(b.category));
  }
  
  return list;
}

function renderManageItems() {
  const tbody = document.getElementById("items-list-tbody");
  tbody.innerHTML = "";
  
  const filtered = getFilteredItemsList();
  const totalCount = filtered.length;
  
  document.getElementById("lbl-items-total-count").innerText = totalCount;
  
  if (totalCount === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dark); padding: 40px;">No household items defined yet. Click "Add New Item Definition" above!</td></tr>`;
    document.getElementById("lbl-items-start-idx").innerText = 0;
    document.getElementById("lbl-items-end-idx").innerText = 0;
    return;
  }
  
  // Paginate
  const maxPage = Math.ceil(totalCount / itemsPageSize);
  if (itemsCurrentPage > maxPage) itemsCurrentPage = maxPage;
  if (itemsCurrentPage < 1) itemsCurrentPage = 1;
  
  const startIdx = (itemsCurrentPage - 1) * itemsPageSize;
  const endIdx = Math.min(startIdx + itemsPageSize, totalCount);
  
  document.getElementById("lbl-items-start-idx").innerText = startIdx + 1;
  document.getElementById("lbl-items-end-idx").innerText = endIdx;
  
  const paginated = filtered.slice(startIdx, endIdx);
  
  paginated.forEach(item => {
    const tr = document.createElement("tr");
    tr.className = "item-row";
    tr.setAttribute("data-id", item.id);
    
    const priorityBadge = `<span class="badge badge-${item.priority}">${item.priority}</span>`;
    const schedDesc = getScheduleDescription(item.consumption);
    
    let learnedHTML = "";
    const houseUnit = item.consumption.unit.toLowerCase().trim();
    if (item.conversions && item.conversions[houseUnit]) {
      const conv = item.conversions[houseUnit];
      learnedHTML = `1 ${houseUnit} ≈ ${conv.value} ${item.baseUnit} <span style="font-size: 11px; color: var(--text-dark);">(${Math.round(conv.confidence * 100)}% conf)</span>`;
    } else {
      learnedHTML = `<span style="color: var(--text-dark); font-style: italic;">Learning pending...</span>`;
    }
    
    tr.innerHTML = `
      <td><input type="checkbox" name="items-chk-item" value="${item.id}" onclick="event.stopPropagation(); updateItemsCheckedCount();"></td>
      <td style="font-weight: 600;" onclick="toggleItemRowExpand('${item.id}')">${item.name} <span>🔍</span></td>
      <td onclick="toggleItemRowExpand('${item.id}')">${item.category}</td>
      <td onclick="toggleItemRowExpand('${item.id}')">${priorityBadge}</td>
      <td style="text-transform: uppercase;" onclick="toggleItemRowExpand('${item.id}')">${item.baseUnit}</td>
      <td onclick="toggleItemRowExpand('${item.id}')">${item.consumption.qty} ${item.consumption.unit} ${schedDesc}</td>
      <td onclick="toggleItemRowExpand('${item.id}')">${learnedHTML}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openItemModalDirect('${item.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteItemDirect('${item.id}')">🗑️ Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
    
    // Add sub-row for expanded details
    const detailTr = document.createElement("tr");
    detailTr.id = `item-detail-row-${item.id}`;
    detailTr.className = "item-detail-row";
    detailTr.style.display = "none";
    detailTr.innerHTML = `
      <td colspan="8">
        <div class="item-detail-content">
          <div style="flex: 1;">
            <h3>📊 Item Overview & Stats</h3>
            <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); font-size: 13px; line-height: 1.6; margin-top: 10px;">
              Total Purchases: <strong>${item.purchases.length} times</strong><br>
              Daily Consumption Rate (Base): <strong>${(getDailyConsumptionRateHouse(item.consumption) * getConversionFactor(item, item.consumption.unit)).toFixed(2)} ${item.baseUnit}/day</strong><br>
              Current Stock (Base): <strong>${Math.round(calculateItemStats(item).currentStockBase).toLocaleString()} ${item.baseUnit}</strong>
            </div>
          </div>
          <div style="flex: 1.5;" class="detail-chart-panel">
            <h3>🧾 Linked Purchases History</h3>
            <div style="max-height: 120px; overflow-y: auto; font-size: 12px; margin-top: 8px;">
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pack</th>
                    <th>Price</th>
                    <th>Store</th>
                  </tr>
                </thead>
                <tbody>
                  ${item.purchases.length === 0 
                    ? `<tr><td colspan="4" style="text-align: center; color: var(--text-dark);">No purchases recorded.</td></tr>`
                    : item.purchases.map(p => `
                      <tr>
                        <td>${p.date}</td>
                        <td>${p.packQty} ${p.packUnit}</td>
                        <td>₹${p.price}</td>
                        <td>${p.store || 'Local'}</td>
                      </tr>
                    `).join("")
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(detailTr);
  });
  
  // reset master checkbox
  document.getElementById("chk-items-master").checked = false;
  updateItemsCheckedCount();
}

function updateItemsCheckedCount() {
  const count = document.querySelectorAll('input[name="items-chk-item"]:checked').length;
  document.getElementById("lbl-items-checked-count").innerText = count;
}

function toggleItemRowExpand(itemId) {
  const detailTr = document.getElementById(`item-detail-row-${itemId}`);
  if (detailTr) {
    const isCollapsed = detailTr.style.display === "none";
    document.querySelectorAll(".item-detail-row").forEach(tr => tr.style.display = "none");
    if (isCollapsed) {
      detailTr.style.display = "table-row";
    }
  }
}

// ----------------------------------------------------
// Salary Delay Planner Tab Rendering
// ----------------------------------------------------

function renderSalaryPlanner() {
  // Sync form controls from state
  document.getElementById("planner-cash-input").value = state.cashBuffer;
  document.getElementById("planner-salary-input").value = state.salary;
  document.getElementById("slider-delay-months").value = state.salaryDelayMonths;
  document.getElementById("val-delay-months").innerText = `${state.salaryDelayMonths} Months`;
  document.getElementById("slider-stretch-percent").value = state.stretchPercentage;
  document.getElementById("val-stretch-percent").innerText = `${state.stretchPercentage}%`;
  
  const budget = calculateBudgetReport();
  
  // Render spend labels
  document.getElementById("lbl-spend-normal").innerText = `₹${Math.round(budget.totalMonthlySpendNormal).toLocaleString()} / mo`;
  document.getElementById("lbl-spend-survival").innerText = `₹${Math.round(budget.totalMonthlySpendSurvivalOnly).toLocaleString()} / mo`;
  document.getElementById("lbl-spend-stretched").innerText = `₹${Math.round(budget.totalMonthlySpendStretched).toLocaleString()} / mo`;
  
  // Render comparison bar width sizes
  const maxSpend = Math.max(budget.totalMonthlySpendNormal, 100);
  document.getElementById("bar-spend-normal").style.width = "100%";
  document.getElementById("bar-spend-survival").style.width = `${(budget.totalMonthlySpendSurvivalOnly / maxSpend) * 100}%`;
  document.getElementById("bar-spend-stretched").style.width = `${(budget.totalMonthlySpendStretched / maxSpend) * 100}%`;
  
  // Alert box
  const alertBox = document.getElementById("planner-survival-box");
  if (state.salaryDelayMonths === 0) {
    alertBox.className = "survival-alert-box secure";
    alertBox.innerHTML = `<strong>Outlook: Secure 👍</strong><span>Your budget has no salary delay simulated. Total survival days is set to ${Math.round(budget.totalSurvivalOutlookDays)} days.</span>`;
  } else {
    if (budget.isSurvivalSecure) {
      alertBox.className = "survival-alert-box secure";
      alertBox.innerHTML = `<strong>Outlook: Stretched but Secure! 🛡️</strong>
        <span>Your cash buffer (₹${state.cashBuffer}) is enough to handle the simulated ${state.salaryDelayMonths} months delay (Emergency Cost: ₹${Math.round(budget.totalDelaySurvivalCost).toLocaleString()}). Remaining cash after delay: <strong>₹${Math.round(budget.cashBalanceAfterDelay).toLocaleString()}</strong>.</span>`;
    } else {
      alertBox.className = "survival-alert-box danger";
      alertBox.innerHTML = `<strong>Outlook: Cash Deficit! ⚠️</strong>
        <span>Your cash buffer will run out by ₹${Math.abs(Math.round(budget.cashBalanceAfterDelay)).toLocaleString()} during the simulated ${state.salaryDelayMonths} months delay. You should increase your stock stretch level or arrange an additional emergency fund.</span>`;
    }
  }
  
  // Render Emergency purchase table
  const tbody = document.getElementById("planner-emergency-tbody");
  tbody.innerHTML = "";
  
  const delayDays = state.salaryDelayMonths * 30;
  let totalEmergencyCost = 0;
  
  if (delayDays <= 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dark); padding: 30px;">Set a salary delay slider above to generate your emergency shopping list!</td></tr>`;
    return;
  }
  
  const emergencies = budget.itemReports.filter(r => r.priority === "essential" && r.remainingDays < delayDays);
  
  if (emergencies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--primary); padding: 30px; font-weight: 600;">All essential stock is fully sufficient for the delay period! No immediate purchases required. 🎉</td></tr>`;
  } else {
    emergencies.forEach(r => {
      const item = state.items.find(i => i.id === r.id);
      const deficitDays = delayDays - r.remainingDays;
      const deficitBaseQty = deficitDays * r.dailyRateBase;
      const cost = deficitBaseQty * r.avgCostPerBase;
      totalEmergencyCost += cost;
      
      // Determine a smart package recommendation (e.g. 5kg, or packets)
      let recommendedSize = "";
      if (item.baseUnit === "g") {
        const kgNeeded = Math.ceil(deficitBaseQty / 1000);
        recommendedSize = `${kgNeeded} kg bulk`;
      } else if (item.baseUnit === "ml") {
        const lNeeded = Math.ceil(deficitBaseQty / 1000);
        recommendedSize = `${lNeeded} Litres`;
      } else {
        recommendedSize = `${Math.ceil(deficitBaseQty)} pieces`;
      }
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 600;">${r.name}</td>
        <td style="color: var(--status-critical); font-weight: 600;">${Math.round(r.remainingDays)} days left</td>
        <td>${formatBaseQty(deficitBaseQty, item)}</td>
        <td style="font-weight: 600; color: #fff;">₹${Math.round(cost).toLocaleString()}</td>
        <td>${recommendedSize}</td>
        <td><span class="badge badge-essential">Essential</span></td>
      `;
      tbody.appendChild(tr);
    });
    
    // Append a summary row
    const totalRow = document.createElement("tr");
    totalRow.style.background = "rgba(255, 255, 255, 0.05)";
    totalRow.style.fontWeight = "bold";
    totalRow.innerHTML = `
      <td colspan="3" style="text-align: right; padding-right: 20px;">Total Emergency Fund Needed for Groceries:</td>
      <td style="color: var(--primary); font-size: 16px;">₹${Math.round(totalEmergencyCost).toLocaleString()}</td>
      <td colspan="2"></td>
    `;
    tbody.appendChild(totalRow);
  }
}

// ----------------------------------------------------
// Reports Tab Rendering
// ----------------------------------------------------

function renderReports() {
  const budget = calculateBudgetReport();
  
  // Render Top 10 costs charts
  const chart = document.getElementById("reports-costs-chart");
  chart.innerHTML = "";
  
  const sortedCosts = [...budget.itemReports]
    .filter(r => r.monthlyCost > 0)
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
    .slice(0, 10);
    
  if (sortedCosts.length === 0) {
    chart.innerHTML = `<div style="text-align: center; color: var(--text-dark); width: 100%; padding-top: 100px;">Add purchases and consumption schedules to visualize monthly expenditures.</div>`;
  } else {
    const maxCost = sortedCosts[0].monthlyCost;
    sortedCosts.forEach(r => {
      const pct = (r.monthlyCost / maxCost) * 100;
      
      const barEl = document.createElement("div");
      barEl.className = "chart-bar";
      barEl.style.height = `${pct}%`;
      
      barEl.innerHTML = `
        <div class="chart-bar-hover-val">₹${Math.round(r.monthlyCost)}/mo</div>
        <div class="chart-label" style="position: absolute; bottom: -30px; left: 50%; transform: translateX(-50%); max-width: 60px;">${r.name.substring(0, 8)}</div>
      `;
      chart.appendChild(barEl);
    });
  }
  
  // Render Category Breakdown share
  const breakdownContainer = document.getElementById("reports-category-breakdown");
  breakdownContainer.innerHTML = "";
  
  const catShares = {};
  let totalCost = 0;
  
  budget.itemReports.forEach(r => {
    catShares[r.category] = (catShares[r.category] || 0) + r.monthlyCost;
    totalCost += r.monthlyCost;
  });
  
  const sortedCats = Object.entries(catShares)
    .filter(([_, cost]) => cost > 0)
    .sort((a, b) => b[1] - a[1]);
    
  if (sortedCats.length === 0) {
    breakdownContainer.innerHTML = `<div style="color: var(--text-dark); text-align: center; padding: 20px;">No category shares yet.</div>`;
  } else {
    sortedCats.forEach(([catName, cost]) => {
      const sharePct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
      
      const row = document.createElement("div");
      row.className = "metric-bar-wrap";
      row.innerHTML = `
        <div class="metric-bar-label">
          <span>${catName}</span>
          <span>₹${Math.round(cost).toLocaleString()} (${sharePct.toFixed(0)}%)</span>
        </div>
        <div class="metric-bar-bg" style="height: 6px;">
          <div class="metric-bar-fill normal" style="width: ${sharePct}%; height: 100%;"></div>
        </div>
      `;
      breakdownContainer.appendChild(row);
    });
  }
  
  // Render Inflation & Price Spread table
  const tbody = document.getElementById("reports-inflation-tbody");
  tbody.innerHTML = "";
  
  let hasSpreadData = false;
  
  state.items.forEach(item => {
    if (item.purchases.length < 2) return;
    
    // Sort purchases by unit price paid (price / quantity converted to base unit)
    const normalizedPurchases = item.purchases.map(p => {
      const baseQty = convertToBase(p.packQty, p.packUnit, item.baseUnit, item.conversions);
      const unitPrice = baseQty > 0 ? (p.price / baseQty) : 0;
      return { p, unitPrice };
    }).sort((a, b) => a.unitPrice - b.unitPrice);
    
    const cheapest = normalizedPurchases[0];
    const dearest = normalizedPurchases[normalizedPurchases.length - 1];
    
    const cheapestDisplay = `₹${cheapest.p.price} (${cheapest.p.packQty} ${cheapest.p.packUnit})`;
    const dearestDisplay = `₹${dearest.p.price} (${dearest.p.packQty} ${dearest.p.packUnit})`;
    
    const spreadPct = cheapest.unitPrice > 0 ? ((dearest.unitPrice - cheapest.unitPrice) / cheapest.unitPrice) * 100 : 0;
    if (spreadPct <= 1.0) return; // skip tiny fluctuations
    
    hasSpreadData = true;
    
    let advice = "Price fluctuated. Check store locations.";
    if (cheapest.p.packQty > dearest.p.packQty) {
      advice = `💡 Bulk pack (${cheapest.p.packQty} ${cheapest.p.packUnit}) is ${(spreadPct).toFixed(0)}% cheaper than small pack.`;
    } else if (cheapest.p.store && dearest.p.store && cheapest.p.store !== dearest.p.store) {
      advice = `💡 Bought cheaper at "${cheapest.p.store}". Save money by purchasing there next time.`;
    }
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 600;">${item.name}</td>
      <td style="color: var(--primary);">${cheapestDisplay}</td>
      <td style="color: var(--status-critical);">${dearestDisplay}</td>
      <td><strong>${spreadPct.toFixed(0)}% Price Spread</strong></td>
      <td style="font-size: 13px; color: var(--text-muted);">${advice}</td>
    `;
    tbody.appendChild(tr);
  });
  
  if (!hasSpreadData) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dark); padding: 30px;">Price trends require multiple purchases of the same item in different sizes/stores to compare unit rates.</td></tr>`;
  }
}

// ----------------------------------------------------
// Formatting Utilities
// ----------------------------------------------------

function formatBaseQty(baseQty, item) {
  if (baseQty <= 0) return "Out of stock";
  
  if (item.baseUnit === "g") {
    if (baseQty >= 1000) {
      return `${(baseQty / 1000).toFixed(2).replace(/\.?0+$/, '')} kg`;
    }
    return `${Math.round(baseQty)} g`;
  }
  
  if (item.baseUnit === "ml") {
    if (baseQty >= 1000) {
      return `${(baseQty / 1000).toFixed(2).replace(/\.?0+$/, '')} L`;
    }
    return `${Math.round(baseQty)} ml`;
  }
  
  // Count items
  if (baseQty >= 12) {
    const doz = Math.floor(baseQty / 12);
    const rem = baseQty % 12;
    return rem > 0 ? `${doz} dozen & ${rem} pcs` : `${doz} dozen`;
  }
  return `${Math.round(baseQty)} pieces`;
}

function formatHouseQty(baseQty, item) {
  if (baseQty <= 0) return "0 servings";
  const houseUnit = item.consumption.unit;
  const houseVal = convertBaseToHouse(baseQty, item, houseUnit);
  
  return `≈ ${Math.round(houseVal)} ${houseUnit}s`;
}

function getStatusBadgeHTML(status) {
  const cl = status.toLowerCase().replace(" ", "-");
  return `<span class="status-indicator ${cl}"><span class="status-dot ${cl}"></span>${status}</span>`;
}

function getScheduleDescription(cons) {
  if (!cons || !cons.schedule) return "daily";
  const sched = cons.schedule;
  
  switch (sched.type) {
    case "daily":
      return sched.interval > 1 ? `every ${sched.interval} days` : "daily";
    case "interval":
      return `every ${sched.interval} days`;
    case "weekly":
      const days = (sched.weekdays || []).map(d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ");
      return `weekly on [${days || "Mon"}]`;
    case "monthly":
      return "monthly";
    default:
      return "daily";
  }
}

// ----------------------------------------------------
// UI Trigger Operations & Button Hooks
// ----------------------------------------------------

function openItemModalDirect(itemId = null) {
  const modal = document.getElementById("modal-item");
  const form = document.getElementById("form-item");
  form.reset();
  
  // Populate category dropdown
  const catSelect = document.getElementById("form-item-category");
  catSelect.innerHTML = "";
  PRESETS.categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.innerText = cat;
    catSelect.appendChild(opt);
  });
  
  if (itemId) {
    // Edit Mode
    const item = state.items.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById("modal-item-title").innerText = "✏️ Edit Item Definition";
    document.getElementById("form-item-id").value = item.id;
    document.getElementById("form-item-name").value = item.name;
    document.getElementById("form-item-category").value = item.category;
    document.getElementById("form-item-priority").value = item.priority;
    document.getElementById("form-item-baseunit").value = item.baseUnit;
    document.getElementById("form-item-houseunit").value = item.consumption.unit;
    document.getElementById("form-item-cons-qty").value = item.consumption.qty;
    document.getElementById("form-item-schedule-type").value = item.consumption.schedule ? item.consumption.schedule.type : "daily";
    
    // Set schedule values
    if (item.consumption.schedule) {
      const type = item.consumption.schedule.type;
      if (type === "interval") {
        document.getElementById("form-item-schedule-interval").value = item.consumption.schedule.interval;
      } else if (type === "weekly") {
        const checkboxes = document.querySelectorAll('input[name="weekdays"]');
        checkboxes.forEach(cb => {
          cb.checked = (item.consumption.schedule.weekdays || []).includes(parseInt(cb.value));
        });
      } else if (type === "meals") {
        const meals = item.consumption.schedule.meals || [];
        const bMeal = meals.find(m => m.name === "breakfast");
        const lMeal = meals.find(m => m.name === "lunch");
        const dMeal = meals.find(m => m.name === "dinner");
        const sMeal = meals.find(m => m.name === "snacks");
        document.getElementById("form-item-meal-breakfast").value = bMeal ? bMeal.qty : 0;
        document.getElementById("form-item-meal-lunch").value = lMeal ? lMeal.qty : 0;
        document.getElementById("form-item-meal-dinner").value = dMeal ? dMeal.qty : 0;
        document.getElementById("form-item-meal-snacks").value = sMeal ? sMeal.qty : 0;
      }
    }
    
    // Conversions
    const houseUnit = item.consumption.unit.toLowerCase().trim();
    if (item.conversions && item.conversions[houseUnit]) {
      document.getElementById("form-item-conversion-value").value = item.conversions[houseUnit].value;
    }
  } else {
    // Add Mode
    document.getElementById("modal-item-title").innerText = "➕ Define Custom Item";
    document.getElementById("form-item-id").value = "";
    document.getElementById("form-item-schedule-interval").value = "2";
  }
  
  triggerScheduleFieldsToggle();
  syncUnitLabels();
  openModal("modal-item");
}

function openPurchaseModalDirect(itemId = null) {
  const modal = document.getElementById("modal-purchase");
  const form = document.getElementById("form-purchase");
  form.reset();
  
  // Set date field to today
  document.getElementById("form-purchase-date").value = new Date().toISOString().split('T')[0];
  
  // Populate items select dropdown
  const select = document.getElementById("form-purchase-item-id");
  select.innerHTML = `<option value="">-- Select Item --</option>`;
  state.items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.innerText = item.name;
    select.appendChild(opt);
  });
  
  if (itemId) {
    select.value = itemId;
    triggerPurchaseUnitDropdownSetup(itemId);
  }
  
  openModal("modal-purchase");
}

function deleteItemDirect(itemId) {
  if (confirm("Are you sure you want to delete this item? This deletes all purchase history and inventory stock!")) {
    state.items = state.items.filter(i => i.id !== itemId);
    saveState();
    showToast("Item deleted from cockpit.", "info");
    renderCurrentTab();
  }
}

function logItemDepletedDirect(itemId) {
  calibrateDepletionPrompt(itemId);
}

function calibrateDepletionPrompt(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Validate if it has stock to deplete
  const stats = calculateItemStats(item, todayStr);
  if (stats.totalPurchasedBase <= 0) {
    showToast("Cannot log depletion: No purchases recorded for this item yet.", "warn");
    return;
  }
  
  if (confirm(`Confirm "${item.name}" finished today? This will calibrate our intelligent unit converters.`)) {
    // Add depletion event
    item.depletions.push({
      date: todayStr,
      type: "finished"
    });
    
    // Calibrate
    const cal = calibrateConversionOnDepletion(itemId, todayStr);
    if (cal && cal.success) {
      showToast(cal.message, "info");
    } else {
      showToast(`${item.name} stock logged as finished.`, "success");
    }
    
    saveState();
    renderCurrentTab();
  }
}

// ----------------------------------------------------
// Form Handlers & Setup
// ----------------------------------------------------

function setupFormEventListeners() {
  // Autocomplete auto-fill preset attributes
  const itemNameInput = document.getElementById("form-item-name");
  itemNameInput.addEventListener("change", () => {
    const val = itemNameInput.value.toLowerCase().trim();
    const preset = PRESETS.items.find(p => p.name.toLowerCase() === val);
    if (preset) {
      document.getElementById("form-item-category").value = preset.category;
      document.getElementById("form-item-priority").value = preset.priority;
      document.getElementById("form-item-baseunit").value = preset.baseUnit;
      if (preset.defaultConsumption) {
        document.getElementById("form-item-houseunit").value = preset.defaultConsumption.unit;
        document.getElementById("form-item-cons-qty").value = preset.defaultConsumption.qty;
      }
      syncUnitLabels();
    }
  });
  
  // Sync unit labels when text edits occur
  document.getElementById("form-item-houseunit").addEventListener("input", syncUnitLabels);
  document.getElementById("form-item-baseunit").addEventListener("change", syncUnitLabels);
  
  // Toggle schedule detail subpanels
  document.getElementById("form-item-schedule-type").addEventListener("change", triggerScheduleFieldsToggle);
  
  // Save Item Submit
  document.getElementById("form-item").addEventListener("submit", (e) => {
    e.preventDefault();
    const itemId = document.getElementById("form-item-id").value;
    const name = document.getElementById("form-item-name").value.trim();
    const category = document.getElementById("form-item-category").value;
    const priority = document.getElementById("form-item-priority").value;
    const baseUnit = document.getElementById("form-item-baseunit").value;
    const houseUnit = document.getElementById("form-item-houseunit").value.trim();
    let consQty = parseFloat(document.getElementById("form-item-cons-qty").value) || 1;
    const schedType = document.getElementById("form-item-schedule-type").value;
    
    // Build schedule object
    const schedule = { type: schedType };
    if (schedType === "interval") {
      schedule.interval = parseInt(document.getElementById("form-item-schedule-interval").value) || 2;
    } else if (schedType === "weekly") {
      const weekdays = [];
      document.querySelectorAll('input[name="weekdays"]:checked').forEach(cb => {
        weekdays.push(parseInt(cb.value));
      });
      schedule.weekdays = weekdays.length > 0 ? weekdays : [1];
    } else if (schedType === "meals") {
      const b = parseFloat(document.getElementById("form-item-meal-breakfast").value) || 0;
      const l = parseFloat(document.getElementById("form-item-meal-lunch").value) || 0;
      const d = parseFloat(document.getElementById("form-item-meal-dinner").value) || 0;
      const s = parseFloat(document.getElementById("form-item-meal-snacks").value) || 0;
      schedule.meals = [
        { name: "breakfast", qty: b },
        { name: "lunch", qty: l },
        { name: "dinner", qty: d },
        { name: "snacks", qty: s }
      ];
      consQty = b + l + d + s;
    } else {
      schedule.interval = 1;
    }
    
    // Custom Conversions Override
    const conversions = {};
    const manualVal = parseFloat(document.getElementById("form-item-conversion-value").value);
    if (!isNaN(manualVal) && manualVal > 0) {
      conversions[houseUnit.toLowerCase()] = {
        value: manualVal,
        confidence: 1.0,
        source: "user"
      };
    }
    
    if (itemId) {
      // Modify
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        item.name = name;
        item.category = category;
        item.priority = priority;
        item.baseUnit = baseUnit;
        item.consumption = { qty: consQty, unit: houseUnit, schedule };
        if (!item.conversions) item.conversions = {};
        if (conversions[houseUnit.toLowerCase()]) {
          item.conversions[houseUnit.toLowerCase()] = conversions[houseUnit.toLowerCase()];
        }
      }
      showToast("Item definition modified successfully.");
    } else {
      // Create new
      const newItem = {
        id: "item-" + Date.now(),
        name,
        category,
        priority,
        baseUnit,
        conversions,
        consumption: { qty: consQty, unit: houseUnit, schedule },
        purchases: [],
        depletions: []
      };
      state.items.push(newItem);
      showToast("New custom item added to cockpit.");
    }
    
    saveState();
    closeModal("modal-item");
    renderCurrentTab();
  });
  
  // Setup purchase item dropdown change listener
  document.getElementById("form-purchase-item-id").addEventListener("change", (e) => {
    triggerPurchaseUnitDropdownSetup(e.target.value);
  });
  
  // Save Purchase Submit
  document.getElementById("form-purchase").addEventListener("submit", (e) => {
    e.preventDefault();
    const itemId = document.getElementById("form-purchase-item-id").value;
    const qty = parseFloat(document.getElementById("form-purchase-qty").value) || 0;
    const unit = document.getElementById("form-purchase-unit").value;
    const price = parseFloat(document.getElementById("form-purchase-price").value) || 0;
    const date = document.getElementById("form-purchase-date").value;
    const brand = document.getElementById("form-purchase-brand").value.trim();
    const store = document.getElementById("form-purchase-store").value.trim();
    const allowDeficit = document.getElementById("form-purchase-allow-deficit").checked;
    
    const item = state.items.find(i => i.id === itemId);
    if (!item) return;
    
    const res = addPurchaseToState(itemId, qty, unit, price, date, brand, store, allowDeficit);
    if (res.success) {
      showToast(res.message, "success");
      closeModal("modal-purchase");
      renderCurrentTab();
    } else if (res.insufficientFunds) {
      // Intercept with Deficit Authorization modal
      document.getElementById("auth-purchase-item-id").value = itemId;
      document.getElementById("auth-purchase-qty").value = qty;
      document.getElementById("auth-purchase-unit").value = unit;
      document.getElementById("auth-purchase-price").value = price;
      document.getElementById("auth-purchase-date").value = date;
      document.getElementById("auth-purchase-brand").value = brand;
      document.getElementById("auth-purchase-store").value = store;
      
      document.getElementById("lbl-auth-current-balance").innerText = getBankBalance().toLocaleString();
      document.getElementById("lbl-auth-purchase-cost").innerText = price.toLocaleString();
      
      closeModal("modal-purchase");
      openModal("modal-auth-purchase");
    } else {
      showToast(res.message, "error");
    }
  });
  
  // Dashboard Action Shortcuts
  document.getElementById("btn-add-purchase-shortcut").addEventListener("click", () => openPurchaseModalDirect());
  document.getElementById("btn-add-purchase-inventory").addEventListener("click", () => openPurchaseModalDirect());
  document.getElementById("btn-create-new-item").addEventListener("click", () => openItemModalDirect());
  
  // Search and Filter Listeners on Inventory
  document.getElementById("inventory-search").addEventListener("input", renderInventory);
  document.getElementById("inventory-filter-category").addEventListener("change", renderInventory);
  document.getElementById("inventory-filter-status").addEventListener("change", renderInventory);

  // Bank Ledger transaction logger
  document.getElementById("form-bank-transaction").addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.getElementById("bank-tx-type").value;
    const amount = parseFloat(document.getElementById("bank-tx-amount").value) || 0;
    const date = document.getElementById("bank-tx-date").value;
    const desc = document.getElementById("bank-tx-desc").value.trim();
    
    state.bankLedger.push({
      id: "tx-" + Date.now(),
      date,
      type,
      amount,
      description: desc,
      source: type === "expense" ? "Additional Expense" : "Manual Receipt",
      status: type === "loan" ? "Undefined" : "Received"
    });
    
    state.bankLedger.sort((a, b) => new Date(a.date) - new Date(b.date));
    state.cashBuffer = getBankBalance();
    saveState();
    
    showToast("Transaction registered in ledger.", "success");
    document.getElementById("form-bank-transaction").reset();
    renderCurrentTab();
  });

  // Salary month setting
  document.getElementById("btn-add-salary-month").addEventListener("click", () => {
    const month = document.getElementById("salary-month-input").value;
    const amount = parseFloat(document.getElementById("salary-amount-input").value) || 0;
    if (!month || amount <= 0) {
      showToast("Please enter a valid month and amount.", "warn");
      return;
    }
    
    const existing = state.monthlySalaries.find(s => s.month === month);
    if (existing) {
      existing.amount = amount;
    } else {
      state.monthlySalaries.push({ month, amount, status: "Pending" });
    }
    
    state.cashBuffer = getBankBalance();
    saveState();
    showToast(`Salary for ${month} set to ₹${amount.toLocaleString()}.`, "success");
    renderCurrentTab();
  });

  // Clear ledger history
  document.getElementById("btn-clear-ledger-history").addEventListener("click", () => {
    if (confirm("Clear all manual receipts, loans, and additional expenses from ledger? This does NOT delete grocery purchases.")) {
      state.bankLedger = state.bankLedger.filter(tx => tx.id === "tx-opening" || tx.linkedPurchaseId);
      state.cashBuffer = getBankBalance();
      saveState();
      showToast("Ledger history cleared.", "info");
      renderCurrentTab();
    }
  });

  // Spreadsheet live search/filters
  document.getElementById("spreadsheet-search").addEventListener("input", renderSpreadsheetGrid);
  document.getElementById("spreadsheet-filter-category").addEventListener("change", renderSpreadsheetGrid);

  // Spreadsheet add row
  document.getElementById("btn-spreadsheet-add-row").addEventListener("click", () => {
    const newItem = {
      id: "item-" + Date.now(),
      name: "New Item " + (state.items.length + 1),
      category: PRESETS.categories[0],
      priority: "normal",
      baseUnit: "g",
      conversions: {},
      consumption: { qty: 1, unit: "piece", schedule: { type: "daily", interval: 1 } },
      purchases: [],
      depletions: []
    };
    state.items.push(newItem);
    saveState();
    showToast("New spreadsheet row added.", "success");
    renderSpreadsheetGrid();
  });

  // Monthly planner triggers
  document.getElementById("monthly-planner-month").addEventListener("change", renderMonthlyPlanner);
  
  document.getElementById("chk-monthly-master").addEventListener("change", (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('input[name="monthly-item-chk"]').forEach(cb => cb.checked = checked);
  });

  document.getElementById("btn-monthly-select-all").addEventListener("click", () => {
    document.querySelectorAll('input[name="monthly-item-chk"]').forEach(cb => cb.checked = true);
  });

  document.getElementById("btn-monthly-select-unbought").addEventListener("click", () => {
    document.querySelectorAll('input[name="monthly-item-chk"]').forEach(cb => {
      cb.checked = (cb.getAttribute("data-bought") !== "true");
    });
  });

  document.getElementById("btn-monthly-bulk-buy").addEventListener("click", () => {
    const checkedBoxes = document.querySelectorAll('input[name="monthly-item-chk"]:checked');
    if (checkedBoxes.length === 0) {
      showToast("Please select at least one item to buy in bulk.", "warn");
      return;
    }
    const itemIds = Array.from(checkedBoxes).map(cb => cb.value);
    const monthStr = document.getElementById("monthly-planner-month").value;
    
    if (confirm(`Log monthly bulk purchases for ${itemIds.length} selected items?`)) {
      const res = bulkBuyItems(itemIds, monthStr);
      showToast(`Bulk buy logged! Total cost: ₹${res.totalCost.toLocaleString()}`, "success");
      renderCurrentTab();
    }
  });
}

function syncUnitLabels() {
  const houseVal = document.getElementById("form-item-houseunit").value || "spoon";
  const baseVal = document.getElementById("form-item-baseunit").value || "g";
  
  document.getElementById("form-item-cons-unit-lbl").innerText = houseVal;
  document.getElementById("form-item-override-houseunit-lbl").innerText = houseVal;
  document.getElementById("form-item-override-baseunit-lbl").innerText = baseVal;
}

function triggerScheduleFieldsToggle() {
  const type = document.getElementById("form-item-schedule-type").value;
  document.getElementById("subpanel-schedule-interval").style.display = type === "interval" ? "block" : "none";
  document.getElementById("subpanel-schedule-weekly").style.display = type === "weekly" ? "block" : "none";
  document.getElementById("subpanel-schedule-meals").style.display = type === "meals" ? "block" : "none";
}

function triggerPurchaseUnitDropdownSetup(itemId) {
  const unitSelect = document.getElementById("form-purchase-unit");
  unitSelect.innerHTML = "";
  
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  
  const base = item.baseUnit;
  let options = [];
  
  if (base === "g") {
    options = ["kg", "g", "half kg", "pav", "packet", "piece"];
  } else if (base === "ml") {
    options = ["L", "ml", "half L", "bottle", "can"];
  } else {
    options = ["piece", "dozen", "half dozen", "tray", "packet", "box"];
  }
  
  options.forEach(opt => {
    const el = document.createElement("option");
    el.value = opt;
    el.innerText = opt;
    unitSelect.appendChild(el);
  });
}

// ----------------------------------------------------
// Planner Sliders Sync
// ----------------------------------------------------

function setupPlannerSliders() {
  const delaySlider = document.getElementById("slider-delay-months");
  delaySlider.addEventListener("input", (e) => {
    state.salaryDelayMonths = parseInt(e.target.value);
    document.getElementById("val-delay-months").innerText = `${state.salaryDelayMonths} Months`;
    saveState();
    renderSalaryPlanner();
  });
  
  const stretchSlider = document.getElementById("slider-stretch-percent");
  stretchSlider.addEventListener("input", (e) => {
    state.stretchPercentage = parseInt(e.target.value);
    document.getElementById("val-stretch-percent").innerText = `${state.stretchPercentage}%`;
    saveState();
    renderSalaryPlanner();
  });
  
  // Cash buffer & Salary inputs binding
  document.getElementById("planner-cash-input").addEventListener("change", (e) => {
    state.cashBuffer = parseFloat(e.target.value) || 0;
    saveState();
    renderSalaryPlanner();
  });
  document.getElementById("planner-salary-input").addEventListener("change", (e) => {
    state.salary = parseFloat(e.target.value) || 0;
    saveState();
    renderSalaryPlanner();
  });
}

// ----------------------------------------------------
// File Importers, Exporters & Backup Setup
// ----------------------------------------------------

function setupBackupButtons() {
  document.getElementById("btn-export-backup").addEventListener("click", () => {
    exportDataJSON();
    showToast("JSON backup downloaded to your computer.");
  });
  
  document.getElementById("btn-trigger-import").addEventListener("click", () => {
    document.getElementById("file-import-input").click();
  });
  
  document.getElementById("file-import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const res = importDataJSON(evt.target.result);
      if (res.success) {
        showToast(res.message, "success");
        renderCurrentTab();
      } else {
        showToast(res.message, "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // Excel buttons
  document.getElementById("btn-export-excel").addEventListener("click", () => {
    exportDataExcel();
    showToast("Excel spreadsheet backup generated.");
  });

  document.getElementById("btn-trigger-excel-import").addEventListener("click", () => {
    document.getElementById("file-excel-import-input").click();
  });

  document.getElementById("file-excel-import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    generateImportPreview(file, (res) => {
      if (!res.success) {
        showToast(res.message, "error");
        return;
      }
      
      document.getElementById("lbl-preview-valid-count").innerText = res.summary.validCount;
      document.getElementById("lbl-preview-duplicate-count").innerText = res.summary.duplicateCount;
      document.getElementById("lbl-preview-warn-count").innerText = res.summary.warnCount;
      
      // Update validation status badge to reflect master worksheet contents
      if (res.purchasesRows) {
        document.getElementById("lbl-preview-status-txt").innerText = `Master (${res.summary.purchasesCount} TXs, ${res.summary.ledgerCount} Ledger)`;
        document.getElementById("lbl-preview-status-txt").style.color = "var(--primary)";
      } else {
        document.getElementById("lbl-preview-status-txt").innerText = "Ready (Items)";
        document.getElementById("lbl-preview-status-txt").style.color = "var(--status-safe)";
      }
      
      const tbody = document.getElementById("import-preview-tbody");
      tbody.innerHTML = "";
      
      res.previewRows.forEach(row => {
        const tr = document.createElement("tr");
        if (row.diagnostics.status === "danger") {
          tr.className = "preview-row-danger";
        } else if (row.diagnostics.status === "warning") {
          tr.className = "preview-row-warning";
        }
        
        const diagList = row.diagnostics.messages.map(m => 
          `<div class="preview-diagnostic ${row.diagnostics.status}">${m}</div>`
        ).join("") || `<div class="preview-diagnostic success">✅ Valid (Action: ${row.diagnostics.action})</div>`;
        
        tr.innerHTML = `
          <td>${row.rowNumber}</td>
          <td style="font-weight: 600;">${row.name}</td>
          <td>${row.category}</td>
          <td>${row.dailyRate} ${row.houseUnit}s</td>
          <td>${row.currentStock}</td>
          <td>₹${row.price}</td>
          <td>${diagList}</td>
        `;
        tbody.appendChild(tr);
      });
      
      openModal("modal-import-preview");
      
      // Bind confirm buttons
      const mergeBtn = document.getElementById("btn-confirm-import-merge");
      const overwriteBtn = document.getElementById("btn-confirm-import-overwrite");
      
      // Remove old listeners to avoid multiple bindings
      const newMergeBtn = mergeBtn.cloneNode(true);
      const newOverwriteBtn = overwriteBtn.cloneNode(true);
      mergeBtn.parentNode.replaceChild(newMergeBtn, mergeBtn);
      overwriteBtn.parentNode.replaceChild(newOverwriteBtn, overwriteBtn);
      
      newMergeBtn.addEventListener("click", () => {
        applyImport(res.previewRows, true, res.purchasesRows, res.ledgerRows);
        let msg = `Excel sync complete! Merged ${res.previewRows.length} items.`;
        if (res.purchasesRows) {
          msg = `Excel sync complete! Merged ${res.previewRows.length} items, ${res.summary.purchasesCount} transactions, and ${res.summary.ledgerCount} ledger entries.`;
        }
        showToast(msg, "success");
        closeModal("modal-import-preview");
        renderCurrentTab();
      });
      
      newOverwriteBtn.addEventListener("click", () => {
        if (confirm("WARNING: This will wipe out all existing items, purchase histories, and ledger records! Continue?")) {
          applyImport(res.previewRows, false, res.purchasesRows, res.ledgerRows);
          let msg = `Excel restore complete! Loaded ${res.previewRows.length} items.`;
          if (res.purchasesRows) {
            msg = `Excel restore complete! Restored ${res.previewRows.length} items, ${res.summary.purchasesCount} transactions, and ${res.summary.ledgerCount} ledger entries.`;
          }
          showToast(msg, "success");
          closeModal("modal-import-preview");
          renderCurrentTab();
        }
      });
    });
    
    e.target.value = "";
  });

  document.getElementById("btn-download-template").addEventListener("click", () => {
    downloadExcelTemplate();
    showToast("Downloaded sample Excel template.");
  });

  // Excel spreadsheet tab actions
  const downloadTemplateBtn = document.getElementById("btn-spreadsheet-download-template");
  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener("click", () => {
      downloadExcelTemplate();
      showToast("Downloaded Excel template.");
    });
  }

  const exportExcelBtn = document.getElementById("btn-spreadsheet-export");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", () => {
      exportDataExcel();
      showToast("Excel spreadsheet exported.");
    });
  }
  
  document.getElementById("btn-reset-presets").addEventListener("click", () => {
    if (confirm("WARNING: This will delete all custom items, custom schedules, and purchase history. It will reset the system back to demo presets. Continue?")) {
      loadPresets();
      showToast("App database reset to clean default presets.", "info");
      renderCurrentTab();
    }
  });

  document.getElementById("btn-flush-data").addEventListener("click", () => {
    if (confirm("🚨 DANGER ZONE - CRITICAL WARNING 🚨\n\nThis will permanently delete all grocery items, transaction history, audit trails, and financial ledger records!\n\nAre you absolutely sure you want to flush all data and start completely fresh?")) {
      flushAppState();
      showToast("Database flushed successfully! Starting fresh.", "error");
      renderCurrentTab();
    }
  });
}

// ----------------------------------------------------
// New Rendering Functions
// ----------------------------------------------------

function renderSpreadsheetGrid() {
  const tbody = document.getElementById("spreadsheet-tbody");
  tbody.innerHTML = "";
  
  const searchVal = document.getElementById("spreadsheet-search").value.toLowerCase().trim();
  const catFilter = document.getElementById("spreadsheet-filter-category").value;
  
  const catSelect = document.getElementById("spreadsheet-filter-category");
  if (catSelect.options.length <= 1) {
    PRESETS.categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      catSelect.appendChild(opt);
    });
  }

  const filtered = state.items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchVal);
    const matchesCat = catFilter === "all" || item.category === catFilter;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--text-dark); padding: 40px;">No items match filters.</td></tr>`;
    return;
  }

  filtered.forEach((item, index) => {
    const stats = calculateItemStats(item);
    const houseUnit = item.consumption.unit;
    const conversionFactor = getConversionFactor(item, houseUnit);
    const currentStockHouse = Math.round(stats.currentStockBase / conversionFactor);
    const lastP = item.purchases.length > 0 ? item.purchases[item.purchases.length - 1] : null;
    const lastPrice = lastP ? lastP.price : 0;
    
    let schedDetails = "";
    if (item.consumption.schedule) {
      if (item.consumption.schedule.type === "interval") {
        schedDetails = item.consumption.schedule.interval;
      } else if (item.consumption.schedule.type === "weekly") {
        schedDetails = (item.consumption.schedule.weekdays || []).join(",");
      }
    }
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="color: var(--text-dark); font-weight: bold; text-align: center;">${index + 1}</td>
      <td class="editable" data-id="${item.id}" data-field="name">${item.name}</td>
      <td class="editable" data-id="${item.id}" data-field="category" data-type="select" data-options="${PRESETS.categories.join('|')}">${item.category}</td>
      <td class="editable" data-id="${item.id}" data-field="priority" data-type="select" data-options="essential|normal|luxury">${item.priority}</td>
      <td class="editable" data-id="${item.id}" data-field="baseUnit" data-type="select" data-options="g|ml|pcs">${item.baseUnit.toUpperCase()}</td>
      <td class="editable" data-id="${item.id}" data-field="houseUnit">${houseUnit}</td>
      <td class="editable" data-id="${item.id}" data-field="dailyRate" data-type="number">${item.consumption.qty}</td>
      <td class="editable" data-id="${item.id}" data-field="scheduleType" data-type="select" data-options="daily|meals|interval|weekly|monthly">${item.consumption.schedule ? item.consumption.schedule.type : 'daily'}</td>
      <td class="editable" data-id="${item.id}" data-field="scheduleDetail">${schedDetails}</td>
      <td class="editable" data-id="${item.id}" data-field="override" data-type="number">${item.conversions && item.conversions[houseUnit.toLowerCase()] ? item.conversions[houseUnit.toLowerCase()].value : ''}</td>
      <td class="editable" data-id="${item.id}" data-field="stock" data-type="number">${currentStockHouse}</td>
      <td class="editable" data-id="${item.id}" data-field="price" data-type="number">${lastPrice}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteItemDirect('${item.id}')" style="padding: 4px 8px;">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  setupSpreadsheetEditListeners();
}

function setupSpreadsheetEditListeners() {
  const cells = document.querySelectorAll("#spreadsheet-table td.editable");
  
  cells.forEach(cell => {
    cell.addEventListener("click", function(e) {
      if (this.classList.contains("editing")) return;
      
      const itemId = this.getAttribute("data-id");
      const field = this.getAttribute("data-field");
      const type = this.getAttribute("data-type") || "text";
      const currentVal = this.innerText;
      
      this.classList.add("editing");
      this.innerHTML = "";
      
      let input;
      if (type === "select") {
        const optionsStr = this.getAttribute("data-options") || "";
        const options = optionsStr.split("|");
        input = document.createElement("select");
        input.className = "custom-select spreadsheet-cell-input";
        options.forEach(opt => {
          const el = document.createElement("option");
          el.value = opt;
          el.innerText = opt;
          if (opt.toLowerCase() === currentVal.toLowerCase()) {
            el.selected = true;
          }
          input.appendChild(el);
        });
      } else {
        input = document.createElement("input");
        input.type = type === "number" ? "number" : "text";
        if (type === "number") {
          input.step = "any";
          input.min = "0";
          input.inputMode = "decimal";
        }
        input.className = "spreadsheet-cell-input";
        input.value = currentVal;
      }
      
      this.appendChild(input);
      input.focus();
      
      const commitChange = () => {
        const newVal = input.value;
        this.classList.remove("editing");
        if (newVal !== currentVal) {
          updateItemFieldDirect(itemId, field, newVal);
          showToast(`Spreadsheet updated: ${field} set to "${newVal}"`, "success");
          renderSpreadsheetGrid();
        } else {
          this.innerHTML = currentVal;
        }
      };
      
      input.addEventListener("blur", commitChange);
      
      input.addEventListener("keydown", function(ev) {
        if (ev.key === "Enter") {
          commitChange();
        }
      });
    });
  });
}

function renderBankLedger() {
  const balance = getBankBalance();
  document.getElementById("bank-current-balance").innerText = balance.toLocaleString();
  
  document.getElementById("bank-tx-date").value = new Date().toISOString().split('T')[0];
  
  const ledgerTbody = document.getElementById("bank-ledger-tbody");
  ledgerTbody.innerHTML = "";
  
  if (state.bankLedger.length === 0) {
    ledgerTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dark); padding: 30px;">No transactions recorded.</td></tr>`;
  } else {
    const reversedLedger = [...state.bankLedger].reverse();
    
    reversedLedger.forEach(tx => {
      const tr = document.createElement("tr");
      
      let cashIn = "";
      let cashOut = "";
      let typeClass = "";
      
      if (tx.type === "income" || tx.type === "loan") {
        cashIn = `₹${tx.amount.toLocaleString()}`;
        typeClass = tx.type === "loan" ? "tx-loan" : "tx-income";
      } else {
        cashOut = `₹${tx.amount.toLocaleString()}`;
        typeClass = "tx-expense";
      }
      
      const badgeClass = tx.status ? tx.status.toLowerCase() : "received";
      const statusBadge = `<span class="ledger-badge ${badgeClass}">${tx.status || 'Received'}</span>`;
      
      let deleteBtn = "";
      if (tx.id !== "tx-opening" && !tx.linkedPurchaseId) {
        deleteBtn = `<button class="btn btn-danger btn-sm" onclick="deleteBankTxDirect('${tx.id}')" style="padding: 4px 8px;">🗑️</button>`;
      }
      
      tr.innerHTML = `
        <td>${tx.date}</td>
        <td class="${typeClass}" style="text-transform: capitalize; font-weight: 600;">${tx.type}</td>
        <td>${tx.description}</td>
        <td class="tx-income ledger-amount">${cashIn}</td>
        <td class="tx-expense ledger-amount">${cashOut}</td>
        <td>${statusBadge}</td>
        <td>${deleteBtn}</td>
      `;
      ledgerTbody.appendChild(tr);
    });
  }

  const salariesTbody = document.getElementById("bank-salaries-tbody");
  salariesTbody.innerHTML = "";
  
  if (!state.monthlySalaries || state.monthlySalaries.length === 0) {
    salariesTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dark); padding: 15px;">No salaries configured.</td></tr>`;
  } else {
    const sortedSalaries = [...state.monthlySalaries].sort((a, b) => b.month.localeCompare(a.month));
    
    sortedSalaries.forEach((sal, idx) => {
      const tr = document.createElement("tr");
      
      const checked = sal.status === "Received" ? "checked" : "";
      const [year, month] = sal.month.split("-");
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const formattedMonth = `${monthNames[parseInt(month)-1]} ${year}`;
      
      tr.innerHTML = `
        <td style="font-weight: 600;">${formattedMonth}</td>
        <td>₹${sal.amount.toLocaleString()}</td>
        <td>
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" onchange="toggleSalaryReceived('${sal.month}', this.checked)" ${checked}>
            <span>Received</span>
          </label>
        </td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteSalaryMonthDirect('${sal.month}')" style="padding: 2px 6px;">🗑️</button>
        </td>
      `;
      salariesTbody.appendChild(tr);
    });
  }
}

function renderMonthlyPlanner() {
  const monthInput = document.getElementById("monthly-planner-month");
  
  if (!monthInput.value) {
    const today = new Date();
    monthInput.value = today.toISOString().slice(0, 7);
  }
  
  const selectedMonth = monthInput.value;
  document.getElementById("monthly-planner-balance").innerText = `₹${getBankBalance().toLocaleString()}`;
  
  const tbody = document.getElementById("monthly-planner-tbody");
  tbody.innerHTML = "";
  
  if (state.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-dark); padding: 30px;">No items defined.</td></tr>`;
    return;
  }
  
  state.items.forEach(item => {
    const dailyRateHouse = getDailyConsumptionRateHouse(item.consumption);
    const requiredMonthHouse = Math.ceil(dailyRateHouse * 30);
    
    const lastP = item.purchases.length > 0 ? item.purchases[item.purchases.length - 1] : null;
    const lastQty = lastP ? lastP.packQty : 1;
    const lastUnit = lastP ? lastP.packUnit : (item.baseUnit === "g" ? "kg" : (item.baseUnit === "ml" ? "L" : "piece"));
    const lastPrice = lastP ? lastP.price : (item.baseUnit === "ml" ? 110 : 50);
    
    const boughtThisMonth = item.purchases.some(p => p.date.startsWith(selectedMonth));
    
    const tr = document.createElement("tr");
    
    if (boughtThisMonth) {
      tr.style.background = "rgba(16, 185, 129, 0.05)";
      tr.style.opacity = "0.85";
    }
    
    const boughtBadge = boughtThisMonth 
      ? `<span class="badge badge-normal" style="font-size: 11px;">✅ Bought (${selectedMonth})</span>` 
      : `<span class="badge badge-essential" style="background: rgba(245, 158, 11, 0.1); color: var(--status-low); border: 1px solid rgba(245, 158, 11, 0.2);">Pending Buy</span>`;
      
    tr.innerHTML = `
      <td>
        <input type="checkbox" name="monthly-item-chk" value="${item.id}" data-bought="${boughtThisMonth}">
      </td>
      <td style="font-weight: 600;">${item.name}</td>
      <td>${item.category}</td>
      <td>${requiredMonthHouse} ${item.consumption.unit}s</td>
      <td>${lastQty} ${lastUnit}</td>
      <td>₹${lastPrice}</td>
      <td style="font-weight: 600; color: #fff;">₹${lastPrice}</td>
      <td>${boughtBadge}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="quickBuyItem('${item.id}', '${selectedMonth}')" style="padding: 4px 10px;">
          ${boughtThisMonth ? 'Buy More' : '🛒 Buy'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function quickBuyItem(itemId, monthStr) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  
  const lastP = item.purchases.length > 0 ? item.purchases[item.purchases.length - 1] : null;
  const qty = lastP ? lastP.packQty : 1;
  const unit = lastP ? lastP.packUnit : (item.baseUnit === "g" ? "kg" : (item.baseUnit === "ml" ? "L" : "piece"));
  const price = lastP ? lastP.price : (item.baseUnit === "ml" ? 110 : 50);
  const brand = lastP ? lastP.brand : "Local Brand";
  const store = lastP ? lastP.store : "Local Shop";
  
  const purchaseDate = monthStr + "-01";
  
  const res = addPurchaseToState(itemId, qty, unit, price, purchaseDate, brand, store, false);
  if (res.success) {
    showToast(res.message, "success");
    renderCurrentTab();
  } else if (res.insufficientFunds) {
    if (confirm(`Insufficient bank balance (Current: ₹${getBankBalance()}). Purchase of ${item.name} costs ₹${price}. Log as loan / undefined source debt?`)) {
      addPurchaseToState(itemId, qty, unit, price, purchaseDate, brand, store, true);
      showToast("Purchase logged via Undefined Source Loan.", "success");
      renderCurrentTab();
    }
  }
}

function toggleSalaryReceived(month, isReceived) {
  const sal = state.monthlySalaries.find(s => s.month === month);
  if (sal) {
    sal.status = isReceived ? "Received" : "Pending";
    saveState();
    showToast(`Salary for ${month} marked as ${sal.status}.`, "success");
    state.cashBuffer = getBankBalance();
    saveState();
    renderCurrentTab();
  }
}

function deleteSalaryMonthDirect(month) {
  if (confirm(`Delete salary record for ${month}?`)) {
    state.monthlySalaries = state.monthlySalaries.filter(s => s.month !== month);
    state.cashBuffer = getBankBalance();
    saveState();
    showToast(`Salary record deleted.`, "info");
    renderCurrentTab();
  }
}

function deleteBankTxDirect(txId) {
  if (confirm("Delete this transaction entry? This will permanently reverse its cash flow effect!")) {
    state.bankLedger = state.bankLedger.filter(tx => tx.id !== txId);
    state.cashBuffer = getBankBalance();
    saveState();
    showToast("Transaction removed from ledger.", "success");
    renderCurrentTab();
  }
}

// Expose functions globally for click handlers
window.quickBuyItem = quickBuyItem;
window.toggleSalaryReceived = toggleSalaryReceived;
window.deleteSalaryMonthDirect = deleteSalaryMonthDirect;
window.deleteBankTxDirect = deleteBankTxDirect;

// ----------------------------------------------------
// New Extended UI Modules
// ----------------------------------------------------

function renderPurchasesHistory() {
  const tbody = document.getElementById("purchases-tbody");
  tbody.innerHTML = "";
  
  const searchVal = document.getElementById("purchases-search").value.toLowerCase().trim();
  const startD = document.getElementById("purchases-filter-start-date").value;
  const endD = document.getElementById("purchases-filter-end-date").value;
  
  // Aggregate purchases
  const purchasesList = [];
  state.items.forEach(item => {
    item.purchases.forEach(p => {
      purchasesList.push({ item, p });
    });
  });
  
  // Sort purchases descending by date
  purchasesList.sort((a, b) => new Date(b.p.date) - new Date(a.p.date));
  
  const filtered = purchasesList.filter(row => {
    const matchesSearch = row.item.name.toLowerCase().includes(searchVal) || 
                          (row.p.store && row.p.store.toLowerCase().includes(searchVal)) ||
                          (row.p.brand && row.p.brand.toLowerCase().includes(searchVal));
    const matchesStart = !startD || row.p.date >= startD;
    const matchesEnd = !endD || row.p.date <= endD;
    return matchesSearch && matchesStart && matchesEnd;
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-dark); padding: 40px;">No purchases matches search or dates.</td></tr>`;
    return;
  }
  
  filtered.forEach((row, index) => {
    const tr = document.createElement("tr");
    const p = row.p;
    const item = row.item;
    
    tr.innerHTML = `
      <td style="color: var(--text-dark); font-weight: bold; text-align: center;">${index + 1}</td>
      <td class="editable" data-pid="${p.id}" data-field="date" data-type="date">${p.date}</td>
      <td class="editable" data-pid="${p.id}" data-field="itemName">${item.name}</td>
      <td class="editable" data-pid="${p.id}" data-field="packQty" data-type="number">${p.packQty}</td>
      <td class="editable" data-pid="${p.id}" data-field="packUnit">${p.packUnit}</td>
      <td class="editable" data-pid="${p.id}" data-field="price" data-type="number">${p.price}</td>
      <td style="font-weight: 600; color: #fff;">₹${(p.packQty * p.price).toLocaleString()}</td>
      <td class="editable" data-pid="${p.id}" data-field="bulkFlag" data-type="select" data-options="Yes|No">${p.bulkFlag ? 'Yes' : 'No'}</td>
      <td class="editable" data-pid="${p.id}" data-field="store">${p.store || ''}</td>
      <td class="editable" data-pid="${p.id}" data-field="brand">${p.brand || ''}</td>
      <td class="editable" data-pid="${p.id}" data-field="note">${p.note || ''}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deletePurchaseDirect('${p.id}')" style="padding: 4px 8px;">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  setupPurchasesEditListeners();
  renderAuditTrailLogs();
}

function setupPurchasesEditListeners() {
  const cells = document.querySelectorAll("#purchases-table td.editable");
  cells.forEach(cell => {
    cell.addEventListener("click", function(e) {
      if (this.classList.contains("editing")) return;
      
      const purchaseId = this.getAttribute("data-pid");
      const field = this.getAttribute("data-field");
      const type = this.getAttribute("data-type") || "text";
      const currentVal = this.innerText;
      
      this.classList.add("editing");
      this.innerHTML = "";
      
      let input;
      if (type === "select") {
        const optionsStr = this.getAttribute("data-options") || "";
        const options = optionsStr.split("|");
        input = document.createElement("select");
        input.className = "custom-select spreadsheet-cell-input";
        options.forEach(opt => {
          const el = document.createElement("option");
          el.value = opt;
          el.innerText = opt;
          if (opt.toLowerCase() === currentVal.toLowerCase()) el.selected = true;
          input.appendChild(el);
        });
      } else {
        input = document.createElement("input");
        input.type = type;
        if (type === "number") {
          input.inputMode = "decimal";
        }
        input.className = "spreadsheet-cell-input";
        input.value = currentVal;
      }
      
      this.appendChild(input);
      input.focus();
      
      const commitChange = () => {
        let newVal = input.value;
        this.classList.remove("editing");
        if (newVal !== currentVal) {
          const fields = {};
          if (field === "bulkFlag") {
            fields.bulkFlag = newVal === "Yes";
          } else {
            fields[field] = newVal;
          }
          
          const res = editPurchaseRecord(purchaseId, fields, "Manual Ledger correction");
          if (res.success) {
            showToast(res.message, "success");
            renderPurchasesHistory();
          } else if (res.isLocked) {
            if (confirm("This transaction falls in a closed month (locked). Re-open month historically and apply correction?")) {
              editPurchaseRecord(purchaseId, fields, "Closed period override", true);
              showToast("Correction applied historically.", "success");
              renderPurchasesHistory();
            } else {
              this.innerHTML = currentVal;
            }
          } else {
            showToast(res.message, "error");
            this.innerHTML = currentVal;
          }
        } else {
          this.innerHTML = currentVal;
        }
      };
      
      input.addEventListener("blur", commitChange);
      input.addEventListener("keydown", function(ev) {
        if (ev.key === "Enter") commitChange();
      });
    });
  });
}

function deletePurchaseDirect(purchaseId) {
  const res = deletePurchaseRecordDirect(purchaseId);
  if (res.success) {
    showToast(res.message, "info");
    renderPurchasesHistory();
  } else if (res.isLocked) {
    if (confirm("This transaction falls in a closed month (locked). Force re-open month and delete historically?")) {
      deletePurchaseRecordDirect(purchaseId, true);
      showToast("Purchase removed historically.", "success");
      renderPurchasesHistory();
    }
  }
}

function renderAuditTrailLogs() {
  const container = document.getElementById("audit-trail-logs");
  container.innerHTML = "";
  
  if (!state.auditTrail || state.auditTrail.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-dark); padding: 30px; font-size: 13px;">No corrections recorded.</div>`;
    return;
  }
  
  const reversed = [...state.auditTrail].reverse();
  reversed.forEach(log => {
    const item = document.createElement("div");
    item.className = "audit-log-item";
    
    const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = new Date(log.timestamp).toLocaleDateString();
    
    let detailsStr = "";
    if (log.type === "purchase_edit") {
      detailsStr = `Item: <strong>${log.before.itemName}</strong><br>
        Changed: ${Object.keys(log.after).filter(k => log.before[k] !== log.after[k]).map(k => 
          `${k} ("${log.before[k]}" ➜ "${log.after[k]}")`
        ).join(", ")}`;
    } else {
      detailsStr = `Deleted: <strong>${log.before.itemName}</strong> (₹${log.before.price})`;
    }
    
    item.innerHTML = `
      <span class="time">📅 ${date} ${time} - ${log.reason}</span>
      <div>${detailsStr}</div>
    `;
    container.appendChild(item);
  });
}

function renderClosedMonthsHistory() {
  const tbody = document.getElementById("closed-months-history-tbody");
  tbody.innerHTML = "";
  
  if (!state.closedMonths || state.closedMonths.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dark); padding: 10px;">No closed months.</td></tr>`;
    return;
  }
  
  state.closedMonths.forEach(cm => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 600;">${cm.month}</td>
      <td style="color: var(--status-safe);">₹${cm.totalIncome.toLocaleString()}</td>
      <td style="color: var(--status-critical);">₹${cm.totalExpenditure.toLocaleString()}</td>
      <td style="font-weight: bold; color: #fff;">₹${cm.closingBalance.toLocaleString()}</td>
      <td><span class="badge badge-normal">🔒 Locked</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUnresolvedTransactions() {
  const tbody = document.getElementById("unresolved-logs-tbody");
  tbody.innerHTML = "";
  
  // Find all purchase IDs in state.unresolvedTransactions
  const list = state.unresolvedTransactions || [];
  
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--status-safe); padding: 15px; font-weight: 600;">✅ Clean! No unresolved transactions.</td></tr>`;
    return;
  }
  
  list.forEach(pid => {
    let p = null;
    let item = null;
    state.items.forEach(i => {
      const found = i.purchases.find(x => x.id === pid);
      if (found) {
        p = found;
        item = i;
      }
    });
    
    if (!p) return;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.date}</td>
      <td style="font-weight: 600;">${item.name}</td>
      <td style="color: var(--status-critical); font-weight: 600;">₹${p.price.toLocaleString()}</td>
      <td>
        <select class="custom-select" style="height: 24px; padding: 2px 5px; font-size: 11px;" onchange="resolveUnresolvedSource('${p.id}', this.value)">
          <option value="">Assign...</option>
          <option value="family">Family Loan</option>
          <option value="external">External Loan</option>
          <option value="carryover">Carryforward surplus</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function resolveUnresolvedSource(purchaseId, option) {
  if (!option) return;
  const lenderName = option === "family" ? prompt("Enter Family member name:") : (option === "external" ? prompt("Enter External Lender:") : "");
  if ((option === "family" || option === "external") && !lenderName) {
    showToast("Resolution cancelled: Lender name required.", "warn");
    renderCurrentTab();
    return;
  }
  
  resolveUndefinedTransaction(purchaseId, option, lenderName);
}

function resolveUndefinedTransaction(purchaseId, option, lenderName) {
  const loanTx = state.bankLedger.find(x => x.linkedPurchaseId === purchaseId && x.type === "loan" && x.status === "Undefined");
  if (loanTx) {
    if (option === "family") {
      loanTx.source = lenderName || "Family Loan";
      loanTx.description = `Family Loan from ${loanTx.source} to cover deficit`;
      loanTx.status = "Received";
    } else if (option === "external") {
      loanTx.source = lenderName || "External Loan";
      loanTx.description = `External Loan from ${loanTx.source} to cover deficit`;
      loanTx.status = "Received";
    } else if (option === "carryover") {
      loanTx.type = "income";
      loanTx.source = "Opening Balance";
      loanTx.description = `Carried forward surplus used to cover deficit`;
      loanTx.status = "Received";
    }
  }
  
  state.unresolvedTransactions = (state.unresolvedTransactions || []).filter(id => id !== purchaseId);
  
  saveState();
  syncLedgerWithPurchases();
  state.cashBuffer = getBankBalance();
  saveState();
  
  showToast("Transaction resolved successfully.", "success");
  renderCurrentTab();
}

function renderMomCharts() {
  const container = document.getElementById("mom-income-expense-chart");
  container.innerHTML = "";
  
  // Aggregate income and expense for past 4 closed months plus current active month
  const today = new Date();
  const monthsList = [];
  
  for (let i = 4; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthsList.push(d.toISOString().slice(0, 7));
  }
  
  monthsList.forEach(m => {
    let income = 0;
    let expense = 0;
    
    state.bankLedger.forEach(tx => {
      if (tx.date.startsWith(m)) {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.type === "income" || tx.type === "loan") income += amt;
        else if (tx.type === "expense") expense += amt;
      }
    });
    
    state.monthlySalaries.forEach(sal => {
      if (sal.month === m && sal.status === "Received") {
        income += parseFloat(sal.amount) || 0;
      }
    });
    
    // Find closed month record to see locked totals
    const closed = state.closedMonths.find(x => x.month === m);
    if (closed) {
      income = closed.totalIncome;
      expense = closed.totalExpenditure;
    }
    
    const maxVal = Math.max(income, expense, 5000);
    const incPct = (income / maxVal) * 80; // scale to fit height
    const expPct = (expense / maxVal) * 80;
    
    const [year, month] = m.split("-");
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const label = `${monthNames[parseInt(month)-1]} ${year.slice(2)}`;
    
    const barGroup = document.createElement("div");
    barGroup.className = "chart-bar-group";
    
    barGroup.innerHTML = `
      <div class="chart-bars">
        <div class="chart-bar income" style="height: ${incPct}%;" data-val="₹${income.toLocaleString()}"></div>
        <div class="chart-bar expense" style="height: ${expPct}%;" data-val="₹${expense.toLocaleString()}"></div>
      </div>
      <div class="chart-label">${label}</div>
    `;
    container.appendChild(barGroup);
  });

  // Render top categories
  const categoriesList = document.getElementById("mom-top-categories");
  categoriesList.innerHTML = "";
  
  const currentMonth = today.toISOString().slice(0, 7);
  const spends = {};
  let totalCatSpend = 0;
  
  state.items.forEach(item => {
    item.purchases.forEach(p => {
      if (p.date.startsWith(currentMonth)) {
        spends[item.category] = (spends[item.category] || 0) + p.price;
        totalCatSpend += p.price;
      }
    });
  });
  
  const sorted = Object.entries(spends).sort((a,b) => b[1] - a[1]).slice(0, 4);
  if (sorted.length === 0) {
    categoriesList.innerHTML = `<div style="text-align: center; font-size: 12px; color: var(--text-dark); padding-top: 20px;">No purchases logged in ${currentMonth}.</div>`;
  } else {
    sorted.forEach(([cat, amt]) => {
      const pct = totalCatSpend > 0 ? (amt / totalCatSpend) * 100 : 0;
      const progress = document.createElement("div");
      progress.style.fontSize = "12px";
      progress.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>${cat}</span>
          <strong>₹${amt.toLocaleString()} (${pct.toFixed(0)}%)</strong>
        </div>
        <div class="metric-bar-bg" style="height: 4px;">
          <div class="metric-bar-fill survival" style="width: ${pct}%; height: 100%;"></div>
        </div>
      `;
      categoriesList.appendChild(progress);
    });
  }
}

function setupSpreadsheetKeyboardNav() {
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (!active || !active.classList.contains("spreadsheet-cell-input")) return;
    
    const input = active;
    const cell = input.parentElement;
    if (!cell || !cell.classList.contains("editable")) return;
    
    const tr = cell.parentElement;
    const cells = Array.from(tr.querySelectorAll("td.editable"));
    const cellIdx = cells.indexOf(cell);
    
    if (e.key === "Tab") {
      e.preventDefault();
      input.blur();
      
      const nextCell = cells[cellIdx + 1];
      if (nextCell) {
        nextCell.click();
      } else {
        const nextTr = tr.nextElementSibling;
        if (nextTr && nextTr.classList.contains("item-row")) {
          const firstNextCell = nextTr.querySelector("td.editable");
          if (firstNextCell) firstNextCell.click();
        }
      }
    }
  });
}

function bindExtendedUIActions() {
  // Items Bulk Actions
  document.getElementById("btn-bulk-delete").addEventListener("click", () => {
    const checked = document.querySelectorAll('input[name="items-chk-item"]:checked');
    if (checked.length === 0) {
      showToast("No items selected for bulk deletion.", "warn");
      return;
    }
    if (confirm(`Are you sure you want to delete all ${checked.length} selected items and their histories?`)) {
      checked.forEach(cb => {
        state.items = state.items.filter(i => i.id !== cb.value);
      });
      saveState();
      showToast("Selected items deleted.", "success");
      renderCurrentTab();
    }
  });

  document.getElementById("bulk-category-reassign").addEventListener("change", (e) => {
    const cat = e.target.value;
    if (!cat) return;
    const checked = document.querySelectorAll('input[name="items-chk-item"]:checked');
    if (checked.length === 0) {
      showToast("No items selected for category reassignment.", "warn");
      e.target.value = "";
      return;
    }
    checked.forEach(cb => {
      const item = state.items.find(i => i.id === cb.value);
      if (item) item.category = cat;
    });
    saveState();
    showToast(`Reassigned category to ${checked.length} items.`, "success");
    e.target.value = "";
    renderCurrentTab();
  });

  document.getElementById("btn-apply-bulk-price").addEventListener("click", () => {
    const priceInput = document.getElementById("bulk-price-update");
    const newPrice = parseFloat(priceInput.value);
    if (isNaN(newPrice) || newPrice < 0) {
      showToast("Please enter a valid price.", "warn");
      return;
    }
    const checked = document.querySelectorAll('input[name="items-chk-item"]:checked');
    if (checked.length === 0) {
      showToast("No items selected for price update.", "warn");
      return;
    }
    checked.forEach(cb => {
      const item = state.items.find(i => i.id === cb.value);
      if (item && item.purchases.length > 0) {
        item.purchases[item.purchases.length - 1].price = newPrice;
      }
    });
    saveState();
    showToast(`Updated price for ${checked.length} items.`, "success");
    priceInput.value = "";
    syncLedgerWithPurchases();
    state.cashBuffer = getBankBalance();
    saveState();
    renderCurrentTab();
  });

  // Deficit Authorization Form Submit
  document.getElementById("form-auth-purchase").addEventListener("submit", (e) => {
    e.preventDefault();
    const itemId = document.getElementById("auth-purchase-item-id").value;
    const qty = parseFloat(document.getElementById("auth-purchase-qty").value) || 0;
    const unit = document.getElementById("auth-purchase-unit").value;
    const price = parseFloat(document.getElementById("auth-purchase-price").value) || 0;
    const date = document.getElementById("auth-purchase-date").value;
    const brand = document.getElementById("auth-purchase-brand").value;
    const store = document.getElementById("auth-purchase-store").value;
    
    const fundingOption = document.getElementById("auth-funding-option").value;
    const lenderName = document.getElementById("auth-lender-name").value.trim();
    
    const res = addPurchaseToState(itemId, qty, unit, price, date, brand, store, true, fundingOption, lenderName);
    if (res.success) {
      showToast(res.message, "success");
      closeModal("modal-auth-purchase");
      renderCurrentTab();
    } else {
      showToast(res.message, "error");
    }
  });

  document.getElementById("auth-funding-option").addEventListener("change", (e) => {
    const val = e.target.value;
    const lenderFields = document.getElementById("auth-lender-fields");
    const lenderInput = document.getElementById("auth-lender-name");
    
    if (val === "family" || val === "external") {
      lenderFields.style.display = "block";
      lenderInput.value = val === "family" ? "Family Loan" : "Personal Loan";
      lenderInput.required = true;
    } else {
      lenderFields.style.display = "none";
      lenderInput.required = false;
      lenderInput.value = "";
    }
  });

  // Month Close Trigger and Form Submit
  document.getElementById("btn-trigger-month-close").addEventListener("click", () => {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    
    document.getElementById("lbl-close-target-month").innerText = currentMonth;
    document.getElementById("lbl-close-closing-bal").innerText = getBankBalance().toLocaleString();
    
    let incomeTotal = 0;
    let expenseTotal = 0;
    state.bankLedger.forEach(tx => {
      if (tx.date.startsWith(currentMonth)) {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.type === "income" || tx.type === "loan") incomeTotal += amt;
        else if (tx.type === "expense") expenseTotal += amt;
      }
    });
    state.monthlySalaries.forEach(sal => {
      if (sal.month === currentMonth && sal.status === "Received") {
        incomeTotal += parseFloat(sal.amount) || 0;
      }
    });
    
    document.getElementById("lbl-close-total-income").innerText = incomeTotal.toLocaleString();
    document.getElementById("lbl-close-total-exp").innerText = expenseTotal.toLocaleString();
    
    openModal("modal-month-close");
  });

  document.getElementById("form-month-close").addEventListener("submit", (e) => {
    e.preventDefault();
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    const nextSal = parseFloat(document.getElementById("close-next-month-salary").value) || 20000;
    
    const res = closeMonthLedger(currentMonth, nextSal);
    showToast(`Month closed successfully! Carried forward: ₹${res.carryover.toLocaleString()}`, "success");
    closeModal("modal-month-close");
    renderCurrentTab();
  });

  // Purchases searches & date filters
  document.getElementById("purchases-search").addEventListener("input", renderPurchasesHistory);
  document.getElementById("purchases-filter-start-date").addEventListener("change", renderPurchasesHistory);
  document.getElementById("purchases-filter-end-date").addEventListener("change", renderPurchasesHistory);
  
  // Manage Items search, priority, category filters, and sort
  document.getElementById("items-search").addEventListener("input", () => { itemsCurrentPage = 1; renderManageItems(); });
  document.getElementById("items-filter-category").addEventListener("change", () => { itemsCurrentPage = 1; renderManageItems(); });
  document.getElementById("items-filter-priority").addEventListener("change", () => { itemsCurrentPage = 1; renderManageItems(); });
  document.getElementById("items-sort-by").addEventListener("change", renderManageItems);

  // Items checked checkbox triggers
  document.getElementById("chk-items-master").addEventListener("change", (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('input[name="items-chk-item"]').forEach(cb => cb.checked = checked);
    updateItemsCheckedCount();
  });

  // Pagination controls
  document.getElementById("btn-items-prev-page").addEventListener("click", () => {
    if (itemsCurrentPage > 1) {
      itemsCurrentPage--;
      renderManageItems();
    }
  });

  document.getElementById("btn-items-next-page").addEventListener("click", () => {
    const maxPage = Math.ceil(getFilteredItemsList().length / itemsPageSize);
    if (itemsCurrentPage < maxPage) {
      itemsCurrentPage++;
      renderManageItems();
    }
  });

  // Bulk reassign category options datalist load
  const bulkCatSelect = document.getElementById("bulk-category-reassign");
  if (bulkCatSelect && bulkCatSelect.options.length <= 1) {
    PRESETS.categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      bulkCatSelect.appendChild(opt);
    });
  }
}

// Extend existing bank renderer to invoke new segments
const originalRenderBankLedger = renderBankLedger;
renderBankLedger = function() {
  originalRenderBankLedger();
  
  // Set current month text in close widget
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const today = new Date();
  const currentMonthStr = today.toISOString().slice(0, 7);
  document.getElementById("lbl-current-ledger-month").innerText = `${months[today.getMonth()]} ${today.getFullYear()}`;
  
  const isClosed = state.closedMonths.some(cm => cm.month === currentMonthStr && cm.locked);
  const statusBadge = document.getElementById("lbl-ledger-month-locked");
  statusBadge.className = isClosed ? "badge badge-essential" : "badge badge-normal";
  statusBadge.innerText = isClosed ? "🔒 Locked" : "Active";
  
  document.getElementById("btn-trigger-month-close").disabled = isClosed;
  
  renderClosedMonthsHistory();
  renderUnresolvedTransactions();
  renderMomCharts();
};

// Initialize listeners on load
bindExtendedUIActions();
setupSpreadsheetKeyboardNav();
window.resolveUnresolvedSource = resolveUnresolvedSource;
window.deletePurchaseDirect = deletePurchaseDirect;

// Register Service Worker for PWA/offline support (only if not running from file:// protocol)
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.log('Service Worker failed:', err));
  });
}

// Online/Offline listener
window.addEventListener('online', () => {
  showToast("Internet connected! Automatic cloud sync active.", "success");
  if (state.cloudSyncUrl) {
    triggerCloudDownload();
  }
});

// Cloud Sync Form & UI Event Bindings
function setupCloudSyncBindings() {
  const triggerBtn = document.getElementById("btn-trigger-cloud-sync");
  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      document.getElementById("cloud-sync-url").value = state.cloudSyncUrl || "";
      document.getElementById("cloud-sync-project").value = state.cloudSyncProject || "default";
      openModal("modal-cloud-sync");
    });
  }

  const testBtn = document.getElementById("btn-test-cloud-sync");
  if (testBtn) {
    testBtn.addEventListener("click", () => {
      const url = document.getElementById("cloud-sync-url").value.trim();
      const project = document.getElementById("cloud-sync-project").value.trim() || "default";
      if (!url) {
        showToast("Please enter a valid Google Apps Script Web App URL first.", "warn");
        return;
      }
      
      showToast("Testing connection...", "info");
      const testUrl = url + (url.includes("?") ? "&" : "?") + "action=load&project=" + encodeURIComponent(project);
      
      if (window.location.protocol === 'file:') {
        // Bypasses local file CORS block using JSONP
        fetchJSONP(testUrl, (data) => {
          showToast("Connection test successful! Drive database accessible.", "success");
        }, (err) => {
          showToast("Connection failed! Check URL permissions or offline status: " + err.message, "error");
        });
      } else {
        // Normal web servers fetch directly
        fetch(testUrl)
          .then(r => {
            if (!r.ok) throw new Error("HTTP error " + r.status);
            showToast("Connection test successful! Drive database accessible.", "success");
          })
          .catch(err => {
            showToast("Connection failed! Check URL permissions or offline status: " + err.message, "error");
          });
      }
    });
  }

  const scanBtn = document.getElementById("btn-scan-cloud-profiles");
  if (scanBtn) {
    scanBtn.addEventListener("click", () => {
      const url = document.getElementById("cloud-sync-url").value.trim();
      if (!url) {
        showToast("Please enter a valid Google Apps Script Web App URL first.", "warn");
        return;
      }
      
      showToast("Scanning Google Drive for budget profiles...", "info");
      const listUrl = url + (url.includes("?") ? "&" : "?") + "action=list";
      
      const renderProfiles = (profiles) => {
        const container = document.getElementById("cloud-profiles-container");
        const listDiv = document.getElementById("cloud-profiles-list");
        listDiv.innerHTML = "";
        
        if (profiles && profiles.length > 0) {
          profiles.forEach(p => {
            const badge = document.createElement("button");
            badge.type = "button";
            badge.className = "btn btn-secondary btn-sm";
            badge.style.padding = "4px 10px";
            badge.style.fontSize = "11px";
            badge.style.borderColor = "rgba(99, 102, 241, 0.4)";
            badge.innerText = p;
            badge.addEventListener("click", () => {
              document.getElementById("cloud-sync-project").value = p;
              showToast(`Profile "${p}" selected. Click Save to load!`, "info");
            });
            listDiv.appendChild(badge);
          });
          container.style.display = "block";
          showToast(`Scan complete: Found ${profiles.length} profiles.`, "success");
        } else {
          container.style.display = "none";
          showToast("No active profiles found on this Google Drive.", "info");
        }
      };

      const handleScanError = (err) => {
        showToast("Failed to retrieve profiles: " + err.message, "error");
      };

      if (window.location.protocol === 'file:') {
        // Bypasses local file CORS block using JSONP
        fetchJSONP(listUrl, renderProfiles, handleScanError);
      } else {
        // Normal web servers fetch directly
        fetch(listUrl)
          .then(r => {
            if (!r.ok) throw new Error("HTTP error " + r.status);
            return r.json();
          })
          .then(renderProfiles)
          .catch(handleScanError);
      }
    });
  }
  const form = document.getElementById("form-cloud-sync");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const url = document.getElementById("cloud-sync-url").value.trim();
      const project = document.getElementById("cloud-sync-project").value.trim() || "default";
      
      state.cloudSyncUrl = url;
      state.cloudSyncProject = project;
      saveState();
      
      if (!url) {
        showToast("Cloud sync deactivated. Saving local-only.", "info");
        updateCloudSyncStatusUI("local");
        closeModal("modal-cloud-sync");
        return;
      }
      
      showToast("Syncing database with Google Drive...", "info");
      
      triggerCloudDownload((res) => {
        if (res.success && res.rawData && res.rawData.items) {
          // A backup exists on the cloud!
          const choice = confirm("☁️ Cloud Backup Found!\n\nDo you want to REPLACE your local data (presets) with your Google Drive backup? (Recommended for new devices)\n\nClick [OK] to Overwrite / Click [Cancel] to Merge data.");
          
          if (choice) {
            // Overwrite local state
            state.items = res.rawData.items;
            state.cashBuffer = res.rawData.cashBuffer !== undefined ? res.rawData.cashBuffer : 8000;
            state.salary = res.rawData.salary !== undefined ? res.rawData.salary : 20000;
            state.salaryDelayMonths = res.rawData.salaryDelayMonths !== undefined ? res.rawData.salaryDelayMonths : 0;
            state.stretchPercentage = res.rawData.stretchPercentage !== undefined ? res.rawData.stretchPercentage : 0;
            state.bankLedger = res.rawData.bankLedger || [];
            state.monthlySalaries = res.rawData.monthlySalaries || [];
            state.additionalExpenses = res.rawData.additionalExpenses || [];
            state.closedMonths = res.rawData.closedMonths || [];
            state.unresolvedTransactions = res.rawData.unresolvedTransactions || [];
            state.auditTrail = res.rawData.auditTrail || [];
            
            saveState();
            showToast("Database successfully restored from Google Drive!", "success");
            renderCurrentTab();
          } else {
            // Merge
            const mergedCount = mergeCloudDataDirect(res.rawData);
            showToast(`Merged ${mergedCount} new cloud updates into your local database.`, "success");
            renderCurrentTab();
            triggerCloudUpload(); // Push back the merged result
          }
        } else if (res.success) {
          // No backup exists on cloud or empty file
          if (confirm("No backup found on Google Drive for this profile. Initialize cloud profile with your current local data?")) {
            triggerCloudUpload();
            showToast("Cloud profile initialized with local data.", "success");
          }
        } else {
          // Sync download connection failed!
          showToast("Sync failed: Unable to connect to your Google Apps Script. Your local data has NOT been changed.", "error");
        }
        closeModal("modal-cloud-sync");
      });
    });
  }
  
  // Render initial status on load
  if (state.cloudSyncUrl) {
    if (navigator.onLine) {
      updateCloudSyncStatusUI("synced");
    } else {
      updateCloudSyncStatusUI("offline");
    }
  } else {
    updateCloudSyncStatusUI("local");
  }
}

setupCloudSyncBindings();
