// State Management
let state = {
  items: [],
  cashBuffer: 8000,
  salary: 20000,
  salaryDelayMonths: 0,
  stretchPercentage: 0,
  bankLedger: [],
  monthlySalaries: [],
  additionalExpenses: []
};

const STORAGE_KEY = "homebudget_planner_data";

// Initialize Application State
function initAppState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
      // Ensure basic structure is intact
      if (!state.items) state.items = [];
      if (state.cashBuffer === undefined) state.cashBuffer = 8000;
      if (state.salary === undefined) state.salary = 20000;
      if (state.salaryDelayMonths === undefined) state.salaryDelayMonths = 0;
      if (state.stretchPercentage === undefined) state.stretchPercentage = 0;
      if (!state.bankLedger) state.bankLedger = [];
      if (!state.monthlySalaries) state.monthlySalaries = [];
      if (!state.additionalExpenses) state.additionalExpenses = [];
      if (!state.auditTrail) state.auditTrail = [];
      if (!state.closedMonths) state.closedMonths = [];
      if (!state.unresolvedTransactions) state.unresolvedTransactions = [];
      if (state.cloudSyncUrl === undefined) state.cloudSyncUrl = "";
      
      syncLedgerWithPurchases();
    } catch (e) {
      console.error("Failed to load saved state, resetting to presets", e);
      loadPresets();
    }
  } else {
    loadPresets();
  }
  // Hook up global state object for easier inspection and cross-script math
  window.state = state;
  
  // Trigger background cloud sync on load if online
  if (state.cloudSyncUrl && navigator.onLine) {
    setTimeout(() => {
      triggerCloudDownload();
    }, 1000);
  }
}

function loadPresets() {
  state.items = JSON.parse(JSON.stringify(PRESETS.items)).map((preset, index) => {
    // Generate dates in the past so the simulation has historical data
    const pDate = new Date();
    pDate.setDate(pDate.getDate() - 30); // 30 days ago
    
    // Add an initial purchase so the preset has stock
    let packQty = 1;
    let packUnit = "kg";
    let price = 50;
    
    if (preset.baseUnit === "ml") {
      packQty = 1;
      packUnit = "L";
      price = 110;
    } else if (preset.baseUnit === "pcs") {
      packQty = preset.name.includes("LPG") ? 1 : 12;
      packUnit = preset.name.includes("LPG") ? "cylinder" : "piece";
      price = preset.name.includes("LPG") ? 950 : 80;
    }
    
    return {
      id: "item-" + Date.now() + "-" + index,
      name: preset.name,
      category: preset.category,
      priority: preset.priority,
      baseUnit: preset.baseUnit,
      conversions: preset.conversions || {},
      consumption: preset.defaultConsumption || { qty: 1, unit: "piece", schedule: { type: "daily", interval: 1 } },
      purchases: [
        {
          id: "p-" + Date.now() + "-" + index,
          date: pDate.toISOString().split('T')[0],
          packQty: packQty,
          packUnit: packUnit,
          price: price,
          expiry: "",
          brand: "Local Brand",
          store: "Nearby Shop"
        }
      ],
      depletions: []
    };
  });
  
  // Set default monthly salaries for past and current month
  const today = new Date();
  const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
  today.setMonth(today.getMonth() - 1);
  const prevMonthStr = today.toISOString().slice(0, 7);
  
  state.monthlySalaries = [
    { month: prevMonthStr, amount: state.salary, status: "Received" },
    { month: currentMonthStr, amount: state.salary, status: "Received" }
  ];
  
  state.bankLedger = [];
  state.additionalExpenses = [];
  state.auditTrail = [];
  state.closedMonths = [];
  state.unresolvedTransactions = [];
  
  syncLedgerWithPurchases();
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.state = state;
  triggerCloudUpload();
}

// ----------------------------------------------------
// Financial Ledger & Account Management
// ----------------------------------------------------

function syncLedgerWithPurchases() {
  if (!state.bankLedger) state.bankLedger = [];
  
  // Keep manual items and opening balance
  const manualTxs = state.bankLedger.filter(tx => tx.source !== "Grocery Purchase" && tx.type !== "opening");
  const syncedLedger = [];
  
  // 1. Create or keep opening balance transaction
  const openingBalance = state.cashBuffer || 8000;
  const pDate = new Date();
  pDate.setDate(pDate.getDate() - 30);
  const openingDateStr = pDate.toISOString().split('T')[0];
  
  syncedLedger.push({
    id: "tx-opening",
    date: openingDateStr,
    type: "income",
    amount: openingBalance,
    description: "Opening cash balance",
    source: "Opening Balance",
    status: "Received"
  });
  
  // 2. Add manual transactions back
  syncedLedger.push(...manualTxs);
  
  // 3. Scan items to add all purchases that aren't already represented
  state.items.forEach(item => {
    item.purchases.forEach(p => {
      const existingTx = state.bankLedger.find(tx => tx.linkedPurchaseId === p.id);
      if (existingTx) {
        syncedLedger.push(existingTx);
      } else {
        syncedLedger.push({
          id: "tx-" + p.id,
          date: p.date,
          type: "expense",
          amount: p.price,
          description: `Bought ${item.name} (${p.packQty} ${p.packUnit})`,
          source: "Grocery Purchase",
          status: "Received",
          linkedPurchaseId: p.id
        });
      }
    });
  });
  
  // Sort ledger by date ascending
  syncedLedger.sort((a, b) => new Date(a.date) - new Date(b.date));
  state.bankLedger = syncedLedger;
}

function getBankBalance() {
  let balance = 0;
  
  if (state.bankLedger) {
    state.bankLedger.forEach(tx => {
      const amount = parseFloat(tx.amount) || 0;
      if (tx.type === "income" || tx.type === "loan") {
        balance += amount;
      } else if (tx.type === "expense") {
        balance -= amount;
      }
    });
  }
  
  if (state.monthlySalaries) {
    state.monthlySalaries.forEach(sal => {
      if (sal.status === "Received") {
        balance += parseFloat(sal.amount) || 0;
      }
    });
  }
  
  return balance;
}

function addPurchaseToState(itemId, qty, unit, price, date, brand, store, allowDeficit = false, fundingOption = "undefined", lenderName = "") {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return { success: false, message: "Item not found." };
  
  if (isMonthClosed(date)) {
    return { success: false, message: "Cannot add purchase to a closed and locked month." };
  }
  
  const currentBalance = getBankBalance();
  if (currentBalance < price && !allowDeficit) {
    return { 
      success: false, 
      insufficientFunds: true, 
      deficit: price - currentBalance,
      message: `Insufficient funds: Purchase cost is ₹${price} but bank balance is ₹${currentBalance}.` 
    };
  }
  
  const purchaseId = "p-" + Date.now() + "-" + Math.floor(Math.random()*1000);
  
  // Cover deficit if allowed
  if (currentBalance < price && allowDeficit) {
    const deficit = price - currentBalance;
    let description = "";
    let type = "loan";
    let sourceName = "";
    let status = "Received";
    
    if (fundingOption === "family") {
      sourceName = lenderName || "Family Loan";
      description = `Family Loan from ${sourceName} to cover deficit for ${item.name} purchase`;
    } else if (fundingOption === "external") {
      sourceName = lenderName || "External Loan";
      description = `External Loan from ${sourceName} to cover deficit for ${item.name} purchase`;
    } else if (fundingOption === "carryover") {
      type = "income";
      sourceName = "Opening Balance";
      description = `Carried forward surplus used to cover deficit for ${item.name} purchase`;
    } else {
      sourceName = "Undefined Source / Loan";
      description = `Covered deficit for ${item.name} purchase`;
      status = "Undefined";
      if (!state.unresolvedTransactions) state.unresolvedTransactions = [];
      state.unresolvedTransactions.push(purchaseId);
    }
    
    state.bankLedger.push({
      id: "tx-deficit-loan-" + Date.now() + "-" + Math.floor(Math.random()*1000),
      date: date,
      type: type,
      amount: deficit,
      description: description,
      source: sourceName,
      status: status,
      linkedPurchaseId: purchaseId
    });
  }
  
  const purchase = {
    id: purchaseId,
    date,
    packQty: qty,
    packUnit: unit,
    price,
    expiry: "",
    brand: brand || "Local",
    store: store || "Local Shop",
    bulkFlag: false
  };
  
  item.purchases.push(purchase);
  
  // Log expense in ledger
  state.bankLedger.push({
    id: "tx-" + purchaseId,
    date,
    type: "expense",
    amount: price,
    description: `Bought ${item.name} (${qty} ${unit})`,
    source: "Grocery Purchase",
    status: "Received",
    linkedPurchaseId: purchaseId
  });
  
  state.bankLedger.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Sync legacy field
  state.cashBuffer = getBankBalance();
  
  saveState();
  return { success: true, message: `Purchase logged for ${item.name}. Stock and ledger updated!` };
}

function bulkBuyItems(itemIds, monthStr) {
  let count = 0;
  let totalCost = 0;
  
  itemIds.forEach(id => {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    const lastP = item.purchases.length > 0 ? item.purchases[item.purchases.length - 1] : null;
    const price = lastP ? lastP.price : (item.baseUnit === "ml" ? 110 : 50);
    totalCost += price;
  });
  
  const currentBalance = getBankBalance();
  const allowDeficit = currentBalance < totalCost;
  
  itemIds.forEach(id => {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    
    const lastP = item.purchases.length > 0 ? item.purchases[item.purchases.length - 1] : null;
    const qty = lastP ? lastP.packQty : 1;
    const unit = lastP ? lastP.packUnit : (item.baseUnit === "g" ? "kg" : (item.baseUnit === "ml" ? "L" : "piece"));
    const price = lastP ? lastP.price : (item.baseUnit === "ml" ? 110 : 50);
    const brand = lastP ? lastP.brand : "Local Brand";
    const store = lastP ? lastP.store : "Local Shop";
    
    // Purchase date is the first day of the selected month
    const purchaseDate = monthStr + "-01";
    
    addPurchaseToState(id, qty, unit, price, purchaseDate, brand, store, allowDeficit);
    count++;
  });
  
  return { success: true, count, totalCost };
}

// ----------------------------------------------------
// Live cell updates & Spreadsheet management
// ----------------------------------------------------

function updateItemFieldDirect(itemId, field, value) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return { success: false, message: "Item not found." };
  
  switch (field) {
    case "name":
      item.name = value.trim();
      break;
    case "category":
      item.category = value.trim();
      break;
    case "priority":
      item.priority = value.trim().toLowerCase();
      break;
    case "baseUnit":
      item.baseUnit = value.trim().toLowerCase();
      break;
    case "houseUnit":
      const oldHouseUnit = item.consumption.unit;
      const newHouseUnit = value.trim().toLowerCase();
      item.consumption.unit = newHouseUnit;
      if (item.conversions && item.conversions[oldHouseUnit.toLowerCase()]) {
        item.conversions[newHouseUnit.toLowerCase()] = item.conversions[oldHouseUnit.toLowerCase()];
        delete item.conversions[oldHouseUnit.toLowerCase()];
      }
      break;
    case "dailyRate":
      item.consumption.qty = parseFloat(value) || 0;
      break;
    case "scheduleType":
      if (!item.consumption.schedule) item.consumption.schedule = {};
      item.consumption.schedule.type = value.trim();
      break;
    case "scheduleDetail":
      if (!item.consumption.schedule) item.consumption.schedule = {};
      const type = item.consumption.schedule.type;
      if (type === "interval") {
        item.consumption.schedule.interval = parseInt(value) || 2;
      } else if (type === "weekly") {
        item.consumption.schedule.weekdays = String(value).split(",").map(x => parseInt(x.trim())).filter(x => !isNaN(x));
      }
      break;
    case "override":
      const houseUnitKey = item.consumption.unit.toLowerCase().trim();
      if (!item.conversions) item.conversions = {};
      const oVal = parseFloat(value);
      if (!isNaN(oVal) && oVal > 0) {
        item.conversions[houseUnitKey] = {
          value: oVal,
          confidence: 1.0,
          source: "user"
        };
      } else {
        delete item.conversions[houseUnitKey];
      }
      break;
    case "stock":
      const targetStockHouse = parseFloat(value) || 0;
      const factor = getConversionFactor(item, item.consumption.unit);
      const targetStockBase = targetStockHouse * factor;
      
      const stats = calculateItemStats(item);
      const currentStockBase = stats.currentStockBase;
      const diffBase = targetStockBase - currentStockBase;
      
      if (item.purchases.length > 0) {
        const lastP = item.purchases[item.purchases.length - 1];
        const lastPBaseQty = convertToBase(lastP.packQty, lastP.packUnit, item.baseUnit, item.conversions);
        const newPBaseQty = Math.max(0, lastPBaseQty + diffBase);
        const packFactor = convertToBase(1, lastP.packUnit, item.baseUnit, item.conversions);
        lastP.packQty = parseFloat((newPBaseQty / packFactor).toFixed(2));
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        item.purchases.push({
          id: "p-" + Date.now(),
          date: todayStr,
          packQty: targetStockHouse,
          packUnit: item.consumption.unit,
          price: 0,
          expiry: "",
          brand: "Stock Correction",
          store: "Spreadsheet"
        });
      }
      break;
    case "price":
      const newPrice = parseFloat(value) || 0;
      if (item.purchases.length > 0) {
        const lastP = item.purchases[item.purchases.length - 1];
        lastP.price = newPrice;
      }
      break;
  }
  
  saveState();
  syncLedgerWithPurchases();
  return { success: true };
}

// ----------------------------------------------------
// Excel Import/Export Handlers using SheetJS
// ----------------------------------------------------

// Helper to set formula on worksheet cells
function setCellFormula(ws, colIndex, rowIndex, formulaStr, defaultVal = 0) {
  const colLetter = XLSX.utils.encode_col(colIndex);
  const cellRef = `${colLetter}${rowIndex + 1}`;
  if (!ws[cellRef]) {
    ws[cellRef] = { t: 'n', v: defaultVal };
  }
  ws[cellRef].f = formulaStr;
  ws[cellRef].t = 'n';
}

function exportDataExcel() {
  // 1. Items configuration sheet
  const itemsData = state.items.map((item, index) => {
    const stats = calculateItemStats(item);
    const houseUnit = item.consumption.unit;
    const conversionFactor = getConversionFactor(item, houseUnit);
    const lastP = item.purchases.length > 0 ? item.purchases[item.purchases.length - 1] : null;
    
    let schedDetails = "";
    if (item.consumption.schedule) {
      if (item.consumption.schedule.type === "interval") {
        schedDetails = item.consumption.schedule.interval;
      } else if (item.consumption.schedule.type === "weekly") {
        schedDetails = (item.consumption.schedule.weekdays || []).join(",");
      }
    }
    
    const meals = (item.consumption.schedule && item.consumption.schedule.meals) || [];
    const b = meals.find(m => m.name === "breakfast")?.qty || 0;
    const l = meals.find(m => m.name === "lunch")?.qty || 0;
    const d = meals.find(m => m.name === "dinner")?.qty || 0;
    const s = meals.find(m => m.name === "snacks")?.qty || 0;
    
    return {
      "Item Name": item.name,
      "Category": item.category,
      "Priority": item.priority,
      "Base Scientific Unit": item.baseUnit,
      "Household Unit": houseUnit,
      "Breakfast Qty": b,
      "Lunch Qty": l,
      "Dinner Qty": d,
      "Snacks Qty": s,
      "Daily Rate (Household Qty)": item.consumption.qty,
      "Schedule Type": item.consumption.schedule ? item.consumption.schedule.type : "daily",
      "Schedule Detail": schedDetails,
      "Scientific Conversion Override": item.conversions && item.conversions[houseUnit.toLowerCase()] ? item.conversions[houseUnit.toLowerCase()].value : "",
      "Current Stock (Household Qty)": Math.round(stats.currentStockBase / conversionFactor),
      "Avg Price Paid (₹)": lastP ? lastP.price : 0,
      "Stock Value (₹)": 0 // placeholder for formula
    };
  });

  // 2. Purchases Sheet
  const purchasesData = [];
  state.items.forEach(item => {
    item.purchases.forEach(p => {
      purchasesData.push({
        "Date": p.date,
        "Item Name": item.name,
        "Quantity": p.packQty,
        "Unit": p.packUnit,
        "Unit Price (₹)": p.packQty > 0 ? (p.price / p.packQty) : 0,
        "Line Total (₹)": p.price,
        "Brand": p.brand || "Local",
        "Store": p.store || "Local Shop",
        "Note": p.note || "",
        "Bulk Flag": p.bulkFlag ? "Yes" : "No",
        "PurchaseId": p.id
      });
    });
  });
  purchasesData.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 3. Bank Ledger sheet
  const ledgerData = state.bankLedger.map((tx) => {
    const isIn = tx.type === "income" || tx.type === "loan";
    return {
      "Date": tx.date,
      "Type": tx.type,
      "Description": tx.description,
      "Source Category": tx.source,
      "Cash In (₹)": isIn ? tx.amount : "",
      "Cash Out (₹)": !isIn ? tx.amount : "",
      "Status": tx.status,
      "Cumulative Balance (₹)": 0 // formula placeholder
    };
  });

  const wb = XLSX.utils.book_new();
  const itemsWS = XLSX.utils.json_to_sheet(itemsData);
  const purchasesWS = XLSX.utils.json_to_sheet(purchasesData);
  const ledgerWS = XLSX.utils.json_to_sheet(ledgerData);
  
  // Set Formulas in Items Sheet
  itemsData.forEach((row, idx) => {
    const excelRow = idx + 2;
    // Stock Value formula in Column P (index 15): `=N2*O2`
    setCellFormula(itemsWS, 15, idx + 1, `N${excelRow}*O${excelRow}`, row["Current Stock (Household Qty)"] * row["Avg Price Paid (₹)"]);
    
    // Daily Rate formula in Column J (index 9) if schedule type is meals: `=SUM(F2:I2)`
    if (row["Schedule Type"] === "meals") {
      setCellFormula(itemsWS, 9, idx + 1, `SUM(F${excelRow}:I${excelRow})`, row["Breakfast Qty"] + row["Lunch Qty"] + row["Dinner Qty"] + row["Snacks Qty"]);
    }
  });

  // Set Formulas in Purchases Sheet
  purchasesData.forEach((row, idx) => {
    const excelRow = idx + 2;
    // Line Total formula in Column F (index 5): `=C2*E2`
    setCellFormula(purchasesWS, 5, idx + 1, `C${excelRow}*E${excelRow}`, row["Line Total (₹)"]);
  });

  // Set Formulas in Ledger Sheet
  ledgerData.forEach((row, idx) => {
    const excelRow = idx + 2;
    let formula = "";
    if (excelRow === 2) {
      formula = `IF(ISNUMBER(E2),E2,0)-IF(ISNUMBER(F2),F2,0)`;
    } else {
      formula = `H${excelRow - 1}+IF(ISNUMBER(E${excelRow}),E${excelRow},0)-IF(ISNUMBER(F${excelRow}),F${excelRow},0)`;
    }
    // Calculate running balance in JS as default
    let defaultVal = 0;
    if (idx === 0) {
      defaultVal = (parseFloat(row["Cash In (₹)"]) || 0) - (parseFloat(row["Cash Out (₹)"]) || 0);
    } else {
      defaultVal = 0;
    }
    setCellFormula(ledgerWS, 7, idx + 1, formula, defaultVal);
  });

  XLSX.utils.book_append_sheet(wb, itemsWS, "Household Items");
  XLSX.utils.book_append_sheet(wb, purchasesWS, "Purchase Transactions");
  XLSX.utils.book_append_sheet(wb, ledgerWS, "Financial Ledger");
  
  XLSX.writeFile(wb, `homebudget_master_sheets_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function downloadExcelTemplate() {
  const templateData = [
    {
      "Item Name": "Atta (Wheat Flour)",
      "Category": "Flour & Grains",
      "Priority": "essential",
      "Base Scientific Unit": "g",
      "Household Unit": "cup",
      "Breakfast Qty": 0,
      "Lunch Qty": 2,
      "Dinner Qty": 2,
      "Snacks Qty": 0,
      "Daily Rate (Household Qty)": 4, // Sum of meals
      "Schedule Type": "meals",
      "Schedule Detail": "",
      "Scientific Conversion Override": 120,
      "Current Stock (Household Qty)": 20,
      "Avg Price Paid (₹)": 150,
      "Stock Value (₹)": 3000
    },
    {
      "Item Name": "Mustard Oil",
      "Category": "Oils & Ghee",
      "Priority": "essential",
      "Base Scientific Unit": "ml",
      "Household Unit": "spoon",
      "Breakfast Qty": 0,
      "Lunch Qty": 0,
      "Dinner Qty": 0,
      "Snacks Qty": 0,
      "Daily Rate (Household Qty)": 3,
      "Schedule Type": "daily",
      "Schedule Detail": "",
      "Scientific Conversion Override": 12,
      "Current Stock (Household Qty)": 80,
      "Avg Price Paid (₹)": 120,
      "Stock Value (₹)": 9600
    }
  ];

  const helpData = [
    { "Column Name": "Item Name", "Mandatory": "Yes", "Allowed Values": "Any text (unique)", "Description": "The name of the household or grocery product." },
    { "Column Name": "Category", "Mandatory": "No (General)", "Allowed Values": PRESETS.categories.join(", "), "Description": "Category name for grouping and reports." },
    { "Column Name": "Priority", "Mandatory": "No (normal)", "Allowed Values": "essential, normal, luxury", "Description": "Priority level for survival calculation ratios." },
    { "Column Name": "Base Scientific Unit", "Mandatory": "No (pcs)", "Allowed Values": "g, ml, pcs", "Description": "The scientific base unit for calculations." },
    { "Column Name": "Household Unit", "Mandatory": "No (piece)", "Allowed Values": "spoon, teaspoon, tablespoon, cup, glass, bowl, piece, cylinder, box", "Description": "Daily measuring unit used in household." },
    { "Column Name": "Schedule Type", "Mandatory": "No (daily)", "Allowed Values": "daily, meals, interval, weekly, monthly", "Description": "How often the product is consumed." },
    { "Column Name": "Schedule Detail", "Mandatory": "Only for interval/weekly", "Allowed Values": "Number for interval, days list (1,3,5) for weekly", "Description": "Defines interval days or weekly days." },
    { "Column Name": "Breakfast/Lunch/Dinner/Snacks Qty", "Mandatory": "No (0)", "Allowed Values": "Positive decimal", "Description": "Consumption quantity per meal slot (Only used if Schedule Type is 'meals')." }
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(templateData);
  const helpWS = XLSX.utils.json_to_sheet(helpData);
  
  // Set formula for template item 1 Daily Rate: `=SUM(F2:I2)`
  setCellFormula(ws, 9, 1, "SUM(F2:I2)", 4);
  setCellFormula(ws, 15, 1, "N2*O2", 3000);
  
  // Set formula for template item 2 Stock Value: `=N3*O3`
  setCellFormula(ws, 15, 2, "N3*O3", 9600);

  XLSX.utils.book_append_sheet(wb, ws, "Items Template");
  XLSX.utils.book_append_sheet(wb, helpWS, "Help & Guidance");
  XLSX.writeFile(wb, "homebudget_excel_template.xlsx");
}

function generateImportPreview(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      let itemsSheet = null;
      let purchasesSheet = null;
      let ledgerSheet = null;
      
      workbook.SheetNames.forEach(name => {
        const lowerName = name.toLowerCase().trim();
        if (lowerName === "household items" || lowerName === "items template" || lowerName === "items") {
          itemsSheet = workbook.Sheets[name];
        } else if (lowerName === "purchase transactions" || lowerName === "purchases" || lowerName === "purchase history") {
          purchasesSheet = workbook.Sheets[name];
        } else if (lowerName === "financial ledger" || lowerName === "ledger" || lowerName === "bank ledger") {
          ledgerSheet = workbook.Sheets[name];
        }
      });
      
      // Fallback: if not found, use the first sheet
      if (!itemsSheet) {
        itemsSheet = workbook.Sheets[workbook.SheetNames[0]];
      }
      
      const rows = XLSX.utils.sheet_to_json(itemsSheet);
      if (rows.length === 0) {
        callback({ success: false, message: "Spreadsheet contains no data rows in the items worksheet." });
        return;
      }
      
      const previewRows = [];
      let validCount = 0;
      let duplicateCount = 0;
      let warnCount = 0;
      
      rows.forEach((row, idx) => {
        const name = row["Item Name"] ? String(row["Item Name"]).trim() : "";
        if (!name) return; // skip entirely empty rows
        
        const category = row["Category"] ? String(row["Category"]).trim() : "";
        const priority = row["Priority"] ? String(row["Priority"]).trim().toLowerCase() : "";
        const baseUnit = row["Base Scientific Unit"] ? String(row["Base Scientific Unit"]).trim().toLowerCase() : "";
        const houseUnit = row["Household Unit"] ? String(row["Household Unit"]).trim().toLowerCase() : "";
        
        const dailyRate = parseFloat(row["Daily Rate (Household Qty)"]) || 0;
        const currentStock = parseFloat(row["Current Stock (Household Qty)"]) || 0;
        const price = parseFloat(row["Avg Price Paid (₹)"]) || 0;
        const override = parseFloat(row["Scientific Conversion Override"]) || null;
        
        const scheduleType = row["Schedule Type"] ? String(row["Schedule Type"]).trim().toLowerCase() : "daily";
        const scheduleDetail = row["Schedule Detail"] !== undefined ? String(row["Schedule Detail"]).trim() : "";
        
        const b = parseFloat(row["Breakfast Qty"]) || 0;
        const l = parseFloat(row["Lunch Qty"]) || 0;
        const d = parseFloat(row["Dinner Qty"]) || 0;
        const s = parseFloat(row["Snacks Qty"]) || 0;
        
        const diag = {
          status: "success",
          messages: [],
          action: "add"
        };
        
        if (!category) {
          diag.status = "warning";
          diag.messages.push("Missing Category (will default to 'General')");
        }
        if (!priority || !["essential", "normal", "luxury"].includes(priority)) {
          diag.status = "warning";
          diag.messages.push("Invalid Priority (will default to 'normal')");
        }
        if (!baseUnit || !["g", "ml", "pcs"].includes(baseUnit)) {
          diag.status = "warning";
          diag.messages.push("Invalid Base Unit (will default to 'pcs')");
        }
        if (dailyRate < 0 || currentStock < 0 || price < 0) {
          diag.status = "danger";
          diag.messages.push("Value cannot be negative.");
        }
        
        const exists = state.items.some(i => i.name.toLowerCase() === name.toLowerCase());
        if (exists) {
          if (diag.status !== "danger") {
            diag.status = "warning";
            diag.action = "update";
            diag.messages.push("Duplicate item: will sync definitions.");
          }
          duplicateCount++;
        } else {
          validCount++;
        }
        
        if (diag.status === "warning") {
          warnCount++;
        }
        
        previewRows.push({
          rowNumber: idx + 2,
          name,
          category: category || "General",
          priority: ["essential", "normal", "luxury"].includes(priority) ? priority : "normal",
          baseUnit: ["g", "ml", "pcs"].includes(baseUnit) ? baseUnit : "pcs",
          houseUnit: houseUnit || "piece",
          dailyRate: dailyRate >= 0 ? dailyRate : 1,
          scheduleType,
          scheduleDetail,
          override,
          currentStock: currentStock >= 0 ? currentStock : 0,
          price: price >= 0 ? price : 0,
          meals: { breakfast: b, lunch: l, dinner: d, snacks: s },
          diagnostics: diag
        });
      });
      
      let purchasesRows = null;
      if (purchasesSheet) {
        purchasesRows = XLSX.utils.sheet_to_json(purchasesSheet);
      }
      
      let ledgerRows = null;
      if (ledgerSheet) {
        ledgerRows = XLSX.utils.sheet_to_json(ledgerSheet);
      }
      
      callback({
        success: true,
        previewRows,
        purchasesRows,
        ledgerRows,
        summary: {
          validCount,
          duplicateCount,
          warnCount,
          purchasesCount: purchasesRows ? purchasesRows.length : 0,
          ledgerCount: ledgerRows ? ledgerRows.length : 0
        }
      });
    } catch (err) {
      console.error(err);
      callback({ success: false, message: "Failed parsing Excel: " + err.message });
    }
  };
  reader.readAsArrayBuffer(file);
}

function applyImport(previewRows, mergeMode = true, purchasesRows = null, ledgerRows = null) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  if (!mergeMode) {
    state.items = [];
    state.bankLedger = [];
    state.unresolvedTransactions = [];
  }
  
  // 1. Process items definitions
  previewRows.forEach((row) => {
    const schedule = { type: row.scheduleType };
    if (row.scheduleType === "interval") {
      schedule.interval = parseInt(row.scheduleDetail) || 2;
    } else if (row.scheduleType === "weekly") {
      schedule.weekdays = row.scheduleDetail.split(",").map(x => parseInt(x.trim())).filter(x => !isNaN(x));
      if (schedule.weekdays.length === 0) schedule.weekdays = [1];
    } else if (row.scheduleType === "meals") {
      schedule.meals = [
        { name: "breakfast", qty: row.meals.breakfast },
        { name: "lunch", qty: row.meals.lunch },
        { name: "dinner", qty: row.meals.dinner },
        { name: "snacks", qty: row.meals.snacks }
      ];
    } else {
      schedule.interval = 1;
    }
    
    const conversions = {};
    if (row.override) {
      conversions[row.houseUnit] = {
        value: row.override,
        confidence: 1.0,
        source: "user"
      };
    }
    
    // Default initial purchase logic: ONLY when purchasesRows is NOT provided in import file
    const purchases = [];
    if (!purchasesRows && row.currentStock > 0) {
      purchases.push({
        id: "p-import-" + row.rowNumber + "-" + Date.now(),
        date: todayStr,
        packQty: row.currentStock,
        packUnit: row.houseUnit,
        price: row.price,
        expiry: "",
        brand: "Excel Import",
        store: "Imported Ledger"
      });
    }
    
    const existingIndex = state.items.findIndex(i => i.name.toLowerCase() === row.name.toLowerCase());
    if (mergeMode && existingIndex > -1) {
      const existing = state.items[existingIndex];
      existing.category = row.category;
      existing.priority = row.priority;
      existing.baseUnit = row.baseUnit;
      existing.consumption = {
        qty: row.scheduleType === "meals" ? (row.meals.breakfast + row.meals.lunch + row.meals.dinner + row.meals.snacks) : row.dailyRate,
        unit: row.houseUnit,
        schedule
      };
      if (row.override) {
        existing.conversions[row.houseUnit] = {
          value: row.override,
          confidence: 1.0,
          source: "user"
        };
      }
      if (purchases.length > 0) {
        existing.purchases.push(...purchases);
      }
    } else {
      const importedItem = {
        id: "item-import-" + row.rowNumber + "-" + Date.now(),
        name: row.name,
        category: row.category,
        priority: row.priority,
        baseUnit: row.baseUnit,
        conversions,
        consumption: {
          qty: row.scheduleType === "meals" ? (row.meals.breakfast + row.meals.lunch + row.meals.dinner + row.meals.snacks) : row.dailyRate,
          unit: row.houseUnit,
          schedule
        },
        purchases,
        depletions: []
      };
      state.items.push(importedItem);
    }
  });
  
  // 2. Process purchases history if sheet is present
  if (purchasesRows) {
    if (!mergeMode) {
      state.items.forEach(item => {
        item.purchases = [];
      });
    }
    
    purchasesRows.forEach((row, idx) => {
      const itemName = row["Item Name"] ? String(row["Item Name"]).trim() : "";
      if (!itemName) return;
      
      const item = state.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
      if (item) {
        const purchaseId = row["PurchaseId"] || `p-import-${idx}-${Date.now()}`;
        const priceVal = parseFloat(row["Line Total (₹)"]) || parseFloat(row["Line Total"]) || 0;
        const qtyVal = parseFloat(row["Quantity"]) || 1;
        
        const newPurchase = {
          id: purchaseId,
          date: row["Date"] || todayStr,
          packQty: qtyVal,
          packUnit: row["Unit"] || "piece",
          price: priceVal,
          brand: row["Brand"] || "Imported",
          store: row["Store"] || "Local Shop",
          note: row["Note"] || "",
          bulkFlag: String(row["Bulk Flag"]).toLowerCase() === "yes"
        };
        
        const existingIdx = item.purchases.findIndex(p => p.id === purchaseId);
        if (existingIdx > -1) {
          item.purchases[existingIdx] = newPurchase;
        } else {
          item.purchases.push(newPurchase);
        }
      }
    });
  }
  
  // 3. Process ledger transactions if sheet is present
  if (ledgerRows) {
    if (!mergeMode) {
      state.bankLedger = [];
    }
    
    ledgerRows.forEach((row, idx) => {
      const txId = row["TransactionId"] || row["Transaction ID"] || `tx-import-${idx}-${Date.now()}`;
      const cashIn = parseFloat(row["Cash In (₹)"]) || parseFloat(row["Cash In"]) || 0;
      const cashOut = parseFloat(row["Cash Out (₹)"]) || parseFloat(row["Cash Out"]) || 0;
      const amount = cashIn || cashOut || 0;
      
      if (row["Type"] === "cumulative balance" || row["Type"] === "Cumulative Balance") return;
      
      const newTx = {
        id: txId,
        date: row["Date"] || todayStr,
        type: row["Type"] || "expense",
        description: row["Description"] || "Excel Import Log",
        source: row["Source Category"] || "Manual Receipt",
        amount: amount,
        status: row["Status"] || "Received"
      };
      
      const existingIdx = state.bankLedger.findIndex(tx => tx.id === txId);
      if (existingIdx > -1) {
        state.bankLedger[existingIdx] = newTx;
      } else {
        state.bankLedger.push(newTx);
      }
    });
    
    state.bankLedger.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (!mergeMode) {
    state.bankLedger = [{
      id: "tx-opening",
      date: "2026-01-01",
      type: "income",
      description: "Opening Balance Setup",
      source: "Opening Balance",
      amount: 10000,
      status: "Received"
    }];
  }
  
  saveState();
  syncLedgerWithPurchases();
  state.cashBuffer = getBankBalance();
  saveState();
}

function isMonthClosed(dateStr) {
  if (!dateStr) return false;
  const month = dateStr.slice(0, 7); // YYYY-MM
  return state.closedMonths.some(cm => cm.month === month && cm.locked);
}

function editPurchaseRecord(purchaseId, updatedFields, reason, forceOverride = false) {
  let foundItem = null;
  let foundPurchase = null;
  
  state.items.forEach(item => {
    const p = item.purchases.find(x => x.id === purchaseId);
    if (p) {
      foundItem = item;
      foundPurchase = p;
    }
  });
  
  if (!foundPurchase) return { success: false, message: "Purchase record not found." };
  
  const isTargetDateClosed = isMonthClosed(updatedFields.date || foundPurchase.date);
  const isOriginalDateClosed = isMonthClosed(foundPurchase.date);
  
  if ((isTargetDateClosed || isOriginalDateClosed) && !forceOverride) {
    return { success: false, isLocked: true, message: "This transaction falls in a closed month." };
  }
  
  const beforeState = {
    itemId: foundItem.id,
    itemName: foundItem.name,
    date: foundPurchase.date,
    packQty: foundPurchase.packQty,
    packUnit: foundPurchase.packUnit,
    price: foundPurchase.price,
    brand: foundPurchase.brand,
    store: foundPurchase.store,
    note: foundPurchase.note || ""
  };
  
  if (updatedFields.itemName && updatedFields.itemName.trim().toLowerCase() !== foundItem.name.toLowerCase()) {
    const newName = updatedFields.itemName.trim();
    let targetItem = state.items.find(i => i.name.toLowerCase() === newName.toLowerCase());
    
    if (!targetItem) {
      targetItem = {
        id: "item-" + Date.now() + "-" + Math.floor(Math.random()*1000),
        name: newName,
        category: foundItem.category,
        priority: foundItem.priority,
        baseUnit: foundItem.baseUnit,
        conversions: JSON.parse(JSON.stringify(foundItem.conversions)),
        consumption: JSON.parse(JSON.stringify(foundItem.consumption)),
        purchases: [],
        depletions: []
      };
      state.items.push(targetItem);
    }
    
    foundItem.purchases = foundItem.purchases.filter(x => x.id !== purchaseId);
    targetItem.purchases.push(foundPurchase);
    foundItem = targetItem;
  }
  
  if (updatedFields.date) foundPurchase.date = updatedFields.date;
  if (updatedFields.packQty !== undefined) foundPurchase.packQty = parseFloat(updatedFields.packQty) || 1;
  if (updatedFields.packUnit) foundPurchase.packUnit = updatedFields.packUnit;
  if (updatedFields.price !== undefined) foundPurchase.price = parseFloat(updatedFields.price) || 0;
  if (updatedFields.brand !== undefined) foundPurchase.brand = updatedFields.brand.trim();
  if (updatedFields.store !== undefined) foundPurchase.store = updatedFields.store.trim();
  if (updatedFields.note !== undefined) foundPurchase.note = updatedFields.note.trim();
  if (updatedFields.bulkFlag !== undefined) foundPurchase.bulkFlag = !!updatedFields.bulkFlag;
  
  const ledgerTx = state.bankLedger.find(tx => tx.linkedPurchaseId === purchaseId);
  if (ledgerTx) {
    ledgerTx.date = foundPurchase.date;
    ledgerTx.amount = foundPurchase.price;
    ledgerTx.description = `Bought ${foundItem.name} (${foundPurchase.packQty} ${foundPurchase.packUnit})`;
  }
  
  state.auditTrail.push({
    id: "audit-" + Date.now(),
    timestamp: new Date().toISOString(),
    type: "purchase_edit",
    recordId: purchaseId,
    before: beforeState,
    after: {
      itemId: foundItem.id,
      itemName: foundItem.name,
      date: foundPurchase.date,
      packQty: foundPurchase.packQty,
      packUnit: foundPurchase.packUnit,
      price: foundPurchase.price,
      brand: foundPurchase.brand,
      store: foundPurchase.store,
      note: foundPurchase.note || ""
    },
    reason: reason || "Manual Correction"
  });
  
  saveState();
  syncLedgerWithPurchases();
  state.cashBuffer = getBankBalance();
  saveState();
  
  return { success: true, message: "Purchase record corrected successfully." };
}

function deletePurchaseRecordDirect(purchaseId, forceOverride = false) {
  let foundItem = null;
  let foundPurchase = null;
  
  state.items.forEach(item => {
    const p = item.purchases.find(x => x.id === purchaseId);
    if (p) {
      foundItem = item;
      foundPurchase = p;
    }
  });
  
  if (!foundPurchase) return { success: false, message: "Purchase record not found." };
  
  if (isMonthClosed(foundPurchase.date) && !forceOverride) {
    return { success: false, isLocked: true, message: "This transaction falls in a closed month." };
  }
  
  foundItem.purchases = foundItem.purchases.filter(x => x.id !== purchaseId);
  state.bankLedger = state.bankLedger.filter(tx => tx.linkedPurchaseId !== purchaseId);
  state.unresolvedTransactions = (state.unresolvedTransactions || []).filter(id => id !== purchaseId);
  
  state.auditTrail.push({
    id: "audit-" + Date.now(),
    timestamp: new Date().toISOString(),
    type: "purchase_delete",
    recordId: purchaseId,
    before: {
      itemName: foundItem.name,
      price: foundPurchase.price,
      qty: foundPurchase.packQty,
      date: foundPurchase.date
    },
    after: null,
    reason: "User Deletion"
  });
  
  saveState();
  syncLedgerWithPurchases();
  state.cashBuffer = getBankBalance();
  saveState();
  
  return { success: true, message: "Purchase record deleted successfully." };
}

function closeMonthLedger(monthStr, nextMonthSalaryAmt) {
  const existing = state.closedMonths.find(cm => cm.month === monthStr);
  
  let incomeTotal = 0;
  let expenseTotal = 0;
  
  state.bankLedger.forEach(tx => {
    if (tx.date.startsWith(monthStr)) {
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === "income" || tx.type === "loan") {
        incomeTotal += amt;
      } else if (tx.type === "expense") {
        expenseTotal += amt;
      }
    }
  });
  
  state.monthlySalaries.forEach(sal => {
    if (sal.month === monthStr && sal.status === "Received") {
      incomeTotal += parseFloat(sal.amount) || 0;
    }
  });
  
  const currentBalance = getBankBalance();
  
  if (existing) {
    existing.locked = true;
    existing.closingBalance = currentBalance;
    existing.totalIncome = incomeTotal;
    existing.totalExpenditure = expenseTotal;
  } else {
    state.closedMonths.push({
      month: monthStr,
      closingBalance: currentBalance,
      totalIncome: incomeTotal,
      totalExpenditure: expenseTotal,
      locked: true
    });
  }
  
  const [year, month] = monthStr.split("-").map(Number);
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  
  const salExisting = state.monthlySalaries.find(s => s.month === nextMonthStr);
  if (salExisting) {
    salExisting.amount = nextMonthSalaryAmt;
  } else {
    state.monthlySalaries.push({
      month: nextMonthStr,
      amount: nextMonthSalaryAmt,
      status: "Pending"
    });
  }
  
  const nextMonthStartDate = `${nextMonthStr}-01`;
  state.bankLedger = state.bankLedger.filter(tx => tx.id !== `tx-carryover-${nextMonthStr}`);
  
  state.bankLedger.push({
    id: `tx-carryover-${nextMonthStr}`,
    date: nextMonthStartDate,
    type: "income",
    amount: currentBalance,
    description: `Carried forward surplus balance from ${monthStr}`,
    source: "Opening Balance",
    status: "Received"
  });
  
  state.bankLedger.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  state.cashBuffer = getBankBalance();
  saveState();
  
  return { success: true, nextMonth: nextMonthStr, carryover: currentBalance };
}


// ----------------------------------------------------
// Unit Conversion Mathematics
// ----------------------------------------------------

// Convert standard packaging units to scientific base units (g or ml)
function convertToBase(packQty, packUnit, baseUnit, customConversions = {}) {
  const qty = parseFloat(packQty) || 0;
  const unit = packUnit.toLowerCase().trim();
  
  if (unit === baseUnit) return qty;
  
  // Weights (base unit: g)
  if (baseUnit === "g") {
    if (unit === "kg" || unit === "kilogram" || unit === "kilograms") return qty * 1000;
    if (unit === "g" || unit === "gram" || unit === "grams") return qty;
    if (unit === "mg" || unit === "milligram" || unit === "milligrams") return qty * 0.001;
    if (unit === "lb" || unit === "pound" || unit === "pounds") return qty * 453.592;
    if (unit === "oz" || unit === "ounce" || unit === "ounces") return qty * 28.349;
    if (unit === "pav" || unit === "quarter kg") return qty * 250;
    if (unit === "half kg" || unit === "500g") return qty * 500;
  }
  
  // Volumes (base unit: ml)
  if (baseUnit === "ml") {
    if (unit === "l" || unit === "litre" || unit === "liter" || unit === "litres" || unit === "liters") return qty * 1000;
    if (unit === "ml" || unit === "millilitre" || unit === "milliliter" || unit === "millilitres" || unit === "milliliters") return qty;
    if (unit === "gallon" || unit === "gal") return qty * 3785.41;
    if (unit === "fl oz" || unit === "fluid ounce") return qty * 29.573;
    if (unit === "half litre" || unit === "500ml") return qty * 500;
  }
  
  // Count items (base unit: pcs)
  if (baseUnit === "pcs") {
    if (unit === "dozen" || unit === "darjan") return qty * 12;
    if (unit === "half dozen") return qty * 6;
    if (unit === "tray") return qty * 30;
    if (unit === "piece" || unit === "pc" || unit === "pieces" || unit === "pcs") return qty;
  }

  // If the packaging unit matches a known custom household unit
  if (customConversions[unit]) {
    return qty * customConversions[unit].value;
  }
  
  // Default fallback if unit cannot be resolved: treat 1 unit as 1 base unit
  return qty;
}

// Convert base quantity to household unit
function convertBaseToHouse(baseQty, item, targetUnit) {
  const factor = getConversionFactor(item, targetUnit);
  if (factor <= 0) return 0;
  return baseQty / factor;
}

// Helper to resolve conversion factor (grams or ml per household unit)
function getConversionFactor(item, unitName) {
  const unit = unitName.toLowerCase().trim();
  
  // 1. Check custom conversions inside item
  if (item.conversions && item.conversions[unit]) {
    return item.conversions[unit].value;
  }
  
  // 2. Fallbacks based on common scientific naming
  if (unit === "teaspoon" || unit === "tsp" || unit === "choti chamach") return item.baseUnit === "ml" ? 5 : 5;
  if (unit === "tablespoon" || unit === "tbsp" || unit === "badi chamach") return item.baseUnit === "ml" ? 15 : 15;
  if (unit === "spoon" || unit === "chamach") return item.baseUnit === "ml" ? 10 : 8; // oil vs solid
  if (unit === "cup") return item.baseUnit === "ml" ? 240 : 120;
  if (unit === "glass") return item.baseUnit === "ml" ? 250 : 200;
  if (unit === "bowl" || unit === "katori") return item.baseUnit === "ml" ? 200 : 150;
  if (unit === "pinch" || unit === "chutki") return 1.5;
  if (unit === "handful" || unit === "muthi") return 40;
  if (unit === "piece" || unit === "pc" || unit === "tablet" || unit === "bar" || unit === "cylinder") return 1;

  // Search if any preset has it
  const matchedPreset = PRESETS.items.find(p => p.name.toLowerCase() === item.name.toLowerCase());
  if (matchedPreset && matchedPreset.conversions && matchedPreset.conversions[unit]) {
    return matchedPreset.conversions[unit].value;
  }
  
  return 1; // absolute fallback
}

// ----------------------------------------------------
// Consumption Schedule & Rate Calculator
// ----------------------------------------------------

// Calculate how many household units are consumed per day based on schedule
function getDailyConsumptionRateHouse(consumption) {
  if (!consumption || !consumption.qty) return 0;
  const qty = parseFloat(consumption.qty) || 0;
  const schedule = consumption.schedule;
  if (!schedule) return qty; // assume daily
  
  switch (schedule.type) {
    case "daily":
      const interval = parseFloat(schedule.interval) || 1;
      return qty / interval;
      
    case "weekly":
      const weekdaysCount = (schedule.weekdays && schedule.weekdays.length) || 1;
      return (qty * weekdaysCount) / 7;
      
    case "monthly":
      return qty / 30;
      
    case "interval":
      const intDays = parseFloat(schedule.interval) || 1;
      return qty / intDays;
      
    case "meals":
      // Multiple occasions per day
      if (schedule.meals && schedule.meals.length > 0) {
        return schedule.meals.reduce((sum, meal) => sum + (parseFloat(meal.qty) || 0), 0);
      }
      return qty;
      
    default:
      return qty;
  }
}

// ----------------------------------------------------
// Inventory Timeline Calculation
// ----------------------------------------------------

function calculateItemStats(item, targetDateStr = null) {
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
  
  // Sort purchases and depletions by date
  const purchases = [...item.purchases].sort((a, b) => new Date(a.date) - new Date(b.date));
  const depletions = [...item.depletions].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Find the last depletion event before or on targetDate
  let lastDepletionDate = null;
  for (let i = depletions.length - 1; i >= 0; i--) {
    if (new Date(depletions[i].date) <= targetDate) {
      lastDepletionDate = new Date(depletions[i].date);
      break;
    }
  }
  
  // Filter active purchases that occurred after the last depletion event
  const activePurchases = purchases.filter(p => {
    const pDate = new Date(p.date);
    if (pDate > targetDate) return false;
    if (lastDepletionDate) {
      return pDate > lastDepletionDate;
    }
    return true;
  });
  
  // Calculate total active purchased quantity in base units
  let totalPurchasedBase = 0;
  let firstPurchaseDate = null;
  
  activePurchases.forEach(p => {
    const qtyBase = convertToBase(p.packQty, p.packUnit, item.baseUnit, item.conversions);
    totalPurchasedBase += qtyBase;
    const pDate = new Date(p.date);
    if (!firstPurchaseDate || pDate < firstPurchaseDate) {
      firstPurchaseDate = pDate;
    }
  });
  
  // Calculate daily consumption rates
  const dailyRateHouse = getDailyConsumptionRateHouse(item.consumption);
  const conversionFactor = getConversionFactor(item, item.consumption.unit);
  let dailyRateBase = dailyRateHouse * conversionFactor;
  
  // Apply "Stretch Mode" scaling during salary delays
  const isEssential = item.priority === "essential";
  const isNormal = item.priority === "normal";
  if (state.salaryDelayMonths > 0 && state.stretchPercentage > 0 && (isEssential || isNormal)) {
    const stretchReduction = parseFloat(state.stretchPercentage) || 0;
    dailyRateBase = dailyRateBase * (1 - stretchReduction / 100);
  }
  
  let currentStockBase = 0;
  let daysElapsed = 0;
  
  if (firstPurchaseDate) {
    const diffTime = Math.max(0, targetDate - firstPurchaseDate);
    daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const totalConsumedBase = daysElapsed * dailyRateBase;
    currentStockBase = Math.max(0, totalPurchasedBase - totalConsumedBase);
  }
  
  // Remaining days of stock
  const remainingDays = dailyRateBase > 0 ? (currentStockBase / dailyRateBase) : 0;
  const depletionDate = new Date(targetDate);
  depletionDate.setDate(targetDate.getDate() + Math.ceil(remainingDays));
  
  // Determine Stock Status
  let status = "Safe";
  if (currentStockBase <= 0) {
    status = "Out of Stock";
  } else if (remainingDays <= 3) {
    status = "Critical";
  } else if (remainingDays <= 7) {
    status = "Low Stock";
  }
  
  // Average purchase details
  let totalCost = 0;
  let totalUnitsBought = 0;
  purchases.forEach(p => {
    totalCost += parseFloat(p.price) || 0;
    totalUnitsBought += convertToBase(p.packQty, p.packUnit, item.baseUnit, item.conversions);
  });
  
  const avgCostPerBase = totalUnitsBought > 0 ? (totalCost / totalUnitsBought) : 0;
  const dailyCost = dailyRateBase * avgCostPerBase;
  
  return {
    currentStockBase,
    dailyRateBase,
    dailyRateHouse,
    remainingDays,
    depletionDate: remainingDays > 0 ? depletionDate.toISOString().split('T')[0] : targetDate.toISOString().split('T')[0],
    status,
    totalPurchasedBase,
    daysElapsed,
    avgCostPerBase,
    dailyCost
  };
}

// ----------------------------------------------------
// Adaptive Learning Engine (Back-Calculation)
// ----------------------------------------------------

function calibrateConversionOnDepletion(itemId, depletionDateStr) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return null;
  
  const depletionDate = new Date(depletionDateStr);
  
  // 1. Sort purchases and depletions
  const purchases = [...item.purchases].sort((a, b) => new Date(a.date) - new Date(b.date));
  const depletions = [...item.depletions].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Find the depletion event immediately prior to the new depletion event
  let prevDepletionDate = null;
  for (let i = depletions.length - 1; i >= 0; i--) {
    const dDate = new Date(depletions[i].date);
    if (dDate < depletionDate) {
      prevDepletionDate = dDate;
      break;
    }
  }
  
  // Find purchases between prevDepletionDate and this depletionDate
  const cyclePurchases = purchases.filter(p => {
    const pDate = new Date(p.date);
    if (pDate > depletionDate) return false;
    if (prevDepletionDate) {
      return pDate > prevDepletionDate;
    }
    return true;
  });
  
  if (cyclePurchases.length === 0) {
    return { success: false, message: "No purchases found in this cycle to calibrate conversion." };
  }
  
  // Find first purchase date in this cycle
  const firstPurchaseDate = new Date(cyclePurchases.reduce((min, p) => p.date < min ? p.date : min, cyclePurchases[0].date));
  
  // Calculate total days elapsed in the cycle
  const diffTime = Math.max(0, depletionDate - firstPurchaseDate);
  const cycleDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (cycleDays <= 2) {
    return { success: false, message: "Stock cycle too short to estimate consumption pattern reliably (must be at least 3 days)." };
  }
  
  // Total quantity added during the cycle
  let totalCycleQtyBase = 0;
  cyclePurchases.forEach(p => {
    totalCycleQtyBase += convertToBase(p.packQty, p.packUnit, item.baseUnit, item.conversions);
  });
  
  // Calculated daily rate in base units (e.g., grams/day)
  const calcDailyRateBase = totalCycleQtyBase / cycleDays;
  
  // Scheduled rate in household units (e.g., spoon/day)
  const dailyRateHouse = getDailyConsumptionRateHouse(item.consumption);
  if (dailyRateHouse <= 0) {
    return { success: false, message: "Household consumption rate is set to 0. Cannot back-calculate unit size." };
  }
  
  // Back-calculated conversion factor: grams per household unit
  const calcConversionFactor = calcDailyRateBase / dailyRateHouse;
  
  // Update item conversions dictionary
  const houseUnit = item.consumption.unit.toLowerCase().trim();
  if (!item.conversions) item.conversions = {};
  
  let oldVal = 0;
  let oldConf = 0;
  if (item.conversions[houseUnit]) {
    oldVal = item.conversions[houseUnit].value || 0;
    oldConf = item.conversions[houseUnit].confidence || 0;
  }
  
  let newVal = calcConversionFactor;
  let newConf = 0.4;
  
  if (oldConf > 0) {
    // Smoothen the value to avoid outliers (weighted moving average)
    newVal = oldVal * 0.6 + calcConversionFactor * 0.4;
    newConf = Math.min(1.0, oldConf + 0.2);
  }
  
  item.conversions[houseUnit] = {
    value: parseFloat(newVal.toFixed(2)),
    confidence: parseFloat(newConf.toFixed(2)),
    source: "back-calculation",
    lastUpdated: depletionDateStr
  };
  
  saveState();
  
  return {
    success: true,
    message: `Smart calibration complete! 1 ${houseUnit} of ${item.name} is estimated at ${newVal.toFixed(1)} ${item.baseUnit} (Confidence: ${(newConf * 100).toFixed(0)}%).`,
    calculatedValue: newVal,
    confidence: newConf
  };
}

// ----------------------------------------------------
// Budget & Salary Delay Simulation Engine
// ----------------------------------------------------

function calculateBudgetReport() {
  let totalMonthlySpendNormal = 0;
  let totalMonthlySpendSurvivalOnly = 0;
  let totalMonthlySpendStretched = 0;
  
  const itemReports = state.items.map(item => {
    const stats = calculateItemStats(item);
    
    // Monthly consumption in base units
    const monthlyRateBase = stats.dailyRateBase * 30;
    
    // Monthly expenditure
    const monthlyCost = monthlyRateBase * stats.avgCostPerBase;
    
    // Categorize spend
    totalMonthlySpendNormal += monthlyCost;
    if (item.priority === "essential") {
      totalMonthlySpendSurvivalOnly += monthlyCost;
    }
    
    // Stretch expenditure (only essential and normal gets stretched)
    let stretchedCost = monthlyCost;
    if (item.priority === "essential" || item.priority === "normal") {
      stretchedCost = monthlyCost * (1 - state.stretchPercentage / 100);
    } else {
      // Luxury is completely cut out in survival planning
      stretchedCost = 0;
    }
    totalMonthlySpendStretched += stretchedCost;
    
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      priority: item.priority,
      baseUnit: item.baseUnit,
      currentStockBase: stats.currentStockBase,
      dailyRateBase: stats.dailyRateBase,
      remainingDays: stats.remainingDays,
      depletionDate: stats.depletionDate,
      status: stats.status,
      monthlyCost,
      stretchedCost,
      dailyCost: stats.dailyCost,
      householdUnit: item.consumption.unit,
      avgCostPerBase: stats.avgCostPerBase
    };
  });
  
  // Calculate cash flow projection during salary delay
  const delayMonths = state.salaryDelayMonths || 0;
  const currentCash = state.cashBuffer || 0;
  
  // Expenses needed over the delay period (Survival and stretched)
  const monthlySurvivalBudget = totalMonthlySpendStretched;
  const totalDelaySurvivalCost = monthlySurvivalBudget * delayMonths;
  const cashBalanceAfterDelay = currentCash - totalDelaySurvivalCost;
  
  // Calculate aggregate stock duration for survival foods (the minimum remaining days of essential items)
  let minEssentialDays = Infinity;
  let outOfStockEssentialsCount = 0;
  
  itemReports.forEach(r => {
    if (r.priority === "essential") {
      if (r.remainingDays < minEssentialDays) {
        minEssentialDays = r.remainingDays;
      }
      if (r.remainingDays <= 0) {
        outOfStockEssentialsCount++;
      }
    }
  });
  
  if (minEssentialDays === Infinity) minEssentialDays = 0;
  
  // How long cash buffer can buy additional essential stock
  let cashSurvivalDays = 0;
  if (monthlySurvivalBudget > 0) {
    cashSurvivalDays = (currentCash / monthlySurvivalBudget) * 30;
  }
  
  const totalSurvivalOutlookDays = minEssentialDays + cashSurvivalDays;
  
  return {
    itemReports,
    totalMonthlySpendNormal,
    totalMonthlySpendSurvivalOnly,
    totalMonthlySpendStretched,
    currentCash,
    delayMonths,
    totalDelaySurvivalCost,
    cashBalanceAfterDelay,
    minEssentialDays,
    cashSurvivalDays,
    totalSurvivalOutlookDays,
    outOfStockEssentialsCount,
    isSurvivalSecure: cashBalanceAfterDelay >= 0
  };
}

// ----------------------------------------------------
// Import & Export API
// ----------------------------------------------------

function exportDataJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `homebudget_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importDataJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.items || !Array.isArray(parsed.items)) {
      return { success: false, message: "Invalid backup file structure: missing item list." };
    }
    
    // Overwrite state
    state.items = parsed.items;
    state.cashBuffer = parsed.cashBuffer !== undefined ? parsed.cashBuffer : 8000;
    state.salary = parsed.salary !== undefined ? parsed.salary : 20000;
    state.salaryDelayMonths = parsed.salaryDelayMonths !== undefined ? parsed.salaryDelayMonths : 0;
    state.stretchPercentage = parsed.stretchPercentage !== undefined ? parsed.stretchPercentage : 0;
    
    saveState();
    return { success: true, message: "All data successfully restored!" };
  } catch (e) {
    return { success: false, message: "Failed to parse JSON file: " + e.message };
  }
}

function updateCloudSyncStatusUI(statusType, detail = "") {
  const el = document.getElementById("cloud-sync-status");
  if (!el) return;
  
  if (!state.cloudSyncUrl) {
    el.innerHTML = `⚫ Local Only`;
    return;
  }
  
  if (statusType === "synced") {
    el.innerHTML = `<span style="color: #34d399;">🟢 Connected & Synced</span>`;
  } else if (statusType === "syncing") {
    el.innerHTML = `<span style="color: #6366f1;">🔵 Syncing...</span>`;
  } else if (statusType === "offline") {
    el.innerHTML = `<span style="color: #fbbf24;">🟡 Offline - Sync Pending</span>`;
  } else if (statusType === "error") {
    el.innerHTML = `<span style="color: #f87171;" title="${detail}">🔴 Sync Connection Error</span>`;
  } else {
    el.innerHTML = `⚫ Local Only`;
  }
}
window.updateCloudSyncStatusUI = updateCloudSyncStatusUI;

function fetchJSONP(url, successCallback, errorCallback) {
  const callbackName = 'gas_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  
  // 10 second timeout safety net
  const timeoutId = setTimeout(() => {
    cleanup();
    if (errorCallback) errorCallback(new Error("Request timed out. Verify your Web App URL is correct, deployed as 'Anyone', and the Apps Script code has been deployed as a New Version."));
  }, 10000);
  
  window[callbackName] = function(data) {
    clearTimeout(timeoutId);
    successCallback(data);
    cleanup();
  };
  
  const script = document.createElement('script');
  script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
  
  script.onerror = function() {
    clearTimeout(timeoutId);
    if (errorCallback) errorCallback(new Error("Network connection failed. Verify your Apps Script Web App is deployed as a new version supporting JSONP."));
    cleanup();
  };
  
  function cleanup() {
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
    delete window[callbackName];
  }
  
  document.body.appendChild(script);
}
window.fetchJSONP = fetchJSONP;

let cloudUploadTimeout = null;
function triggerCloudUpload() {
  if (!state.cloudSyncUrl || !navigator.onLine) {
    if (state.cloudSyncUrl && !navigator.onLine) {
      state.pendingSync = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateCloudSyncStatusUI("offline");
    } else {
      updateCloudSyncStatusUI("local");
    }
    return;
  }
  
  if (cloudUploadTimeout) clearTimeout(cloudUploadTimeout);
  cloudUploadTimeout = setTimeout(() => {
    updateCloudSyncStatusUI("syncing");
    const project = state.cloudSyncProject || "default";
    const uploadUrl = state.cloudSyncUrl + (state.cloudSyncUrl.includes("?") ? "&" : "?") + "project=" + encodeURIComponent(project);
    
    // Using mode: "no-cors" to bypass CORS write restrictions on local file origins
    fetch(uploadUrl, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        items: state.items,
        cashBuffer: state.cashBuffer,
        salary: state.salary,
        salaryDelayMonths: state.salaryDelayMonths,
        stretchPercentage: state.stretchPercentage,
        bankLedger: state.bankLedger,
        monthlySalaries: state.monthlySalaries,
        additionalExpenses: state.additionalExpenses,
        closedMonths: state.closedMonths,
        unresolvedTransactions: state.unresolvedTransactions,
        auditTrail: state.auditTrail
      })
    })
    .then(() => {
      state.pendingSync = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      console.log("Cloud sync upload successful!");
      updateCloudSyncStatusUI("synced");
    })
    .catch(err => {
      console.error("Cloud sync upload failed:", err);
      state.pendingSync = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateCloudSyncStatusUI("error", err.message);
    });
  }, 2000);
}

function mergeCloudDataDirect(data) {
  if (!data || !data.items) return 0;
  let mergedCount = 0;
  
  data.items.forEach(cItem => {
    const lItemIdx = state.items.findIndex(i => i.name.toLowerCase() === cItem.name.toLowerCase());
    if (lItemIdx > -1) {
      const lItem = state.items[lItemIdx];
      if (cItem.purchases.length > lItem.purchases.length) {
        state.items[lItemIdx] = cItem;
        mergedCount++;
      }
    } else {
      state.items.push(cItem);
      mergedCount++;
    }
  });
  
  if (data.bankLedger) {
    data.bankLedger.forEach(cTx => {
      if (!state.bankLedger.some(lTx => lTx.id === cTx.id)) {
        state.bankLedger.push(cTx);
        mergedCount++;
      }
    });
    state.bankLedger.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  
  if (data.monthlySalaries) {
    data.monthlySalaries.forEach(cSal => {
      if (!state.monthlySalaries.some(lSal => lSal.month === cSal.month)) {
        state.monthlySalaries.push(cSal);
        mergedCount++;
      }
    });
  }
  
  if (mergedCount > 0) {
    saveState();
  }
  return mergedCount;
}
window.mergeCloudDataDirect = mergeCloudDataDirect;

function triggerCloudDownload(callback) {
  if (!state.cloudSyncUrl || !navigator.onLine) {
    if (state.cloudSyncUrl && !navigator.onLine) {
      updateCloudSyncStatusUI("offline");
    } else {
      updateCloudSyncStatusUI("local");
    }
    return;
  }
  
  updateCloudSyncStatusUI("syncing");
  const project = state.cloudSyncProject || "default";
  const downloadUrl = state.cloudSyncUrl + (state.cloudSyncUrl.includes("?") ? "&" : "?") + "action=load&project=" + encodeURIComponent(project);
  
  const processDownloadData = (data) => {
    if (data && data.items) {
      if (callback) {
        updateCloudSyncStatusUI("synced");
        callback({ success: true, rawData: data });
        return;
      }
      
      // Standard background merge (no callback)
      const mergedCount = mergeCloudDataDirect(data);
      updateCloudSyncStatusUI("synced");
      if (mergedCount > 0) {
        showToast(`Cloud sync: Synced and merged ${mergedCount} updates from Google Drive.`, "success");
        if (window.renderCurrentTab) window.renderCurrentTab();
      }
    } else {
      updateCloudSyncStatusUI("synced");
      if (callback) {
        callback({ success: true, rawData: null });
      }
    }
  };

  const handleDownloadError = (err) => {
    console.error("Cloud download sync failed:", err);
    updateCloudSyncStatusUI("error", err.message);
    if (callback) callback({ success: false, message: "Cloud sync failed: " + err.message });
  };

  if (window.location.protocol === 'file:') {
    // Local filesystem files cannot use standard CORS fetch redirects, fallback to JSONP
    fetchJSONP(downloadUrl, processDownloadData, handleDownloadError);
  } else {
    // Normal web servers (Netlify, localhost, Vercel) use standard direct CORS fetch
    fetch(downloadUrl)
      .then(r => {
        if (!r.ok) throw new Error("HTTP error " + r.status);
        return r.json();
      })
      .then(processDownloadData)
      .catch(handleDownloadError);
  }
}

window.triggerCloudUpload = triggerCloudUpload;
window.triggerCloudDownload = triggerCloudDownload;

function flushAppState() {
  state.items = [];
  state.cashBuffer = 0;
  state.salary = 0;
  state.salaryDelayMonths = 0;
  state.stretchPercentage = 0;
  state.bankLedger = [{
    id: "tx-opening",
    date: new Date().toISOString().split('T')[0],
    type: "income",
    description: "Opening Balance Setup",
    source: "Opening Balance",
    amount: 0,
    status: "Received"
  }];
  state.monthlySalaries = [];
  state.additionalExpenses = [];
  state.auditTrail = [];
  state.closedMonths = [];
  state.unresolvedTransactions = [];
  
  saveState();
}
window.flushAppState = flushAppState;

// Initialize state on load
initAppState();
