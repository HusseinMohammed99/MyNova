// ==================== STATE MANAGEMENT & MOCK DATA ====================

let products = [];
let sales = [];
let maintenance = [];
let customers = [];
let ledger = [];
let cart = [];
let printPrices = {};
const defaultPrintPrices = {
    bw_a4: 150,
    color_a4: 500,
    bw_a3: 300,
    color_a3: 1000
};
let syncQueue = [];
let syncSettings = { endpoint: '' };
let currentInvoiceSaleId = null;
let currentDiscount = { type: 'none', value: 0 };
// Ensure storage is internal/offline (using localStorage)
const USE_LOCAL_DB = true; // true => localStorage only

// Mock Data Definitions
const mockProducts = [
    
];

const mockCustomers = [

];

const mockMaintenance = [
  ];

const mockSales = [

];

const mockLedger = [
   ];

// Initialize Data from localStorage
function initData() {
    if (!localStorage.getItem("nova_products")) {
        localStorage.setItem("nova_products", JSON.stringify(mockProducts));
        localStorage.setItem("nova_customers", JSON.stringify(mockCustomers));
        localStorage.setItem("nova_maintenance", JSON.stringify(mockMaintenance));
        localStorage.setItem("nova_sales", JSON.stringify(mockSales));
        localStorage.setItem("nova_ledger", JSON.stringify(mockLedger));
        localStorage.setItem("nova_print_prices", JSON.stringify(defaultPrintPrices));
    }
    
    products = JSON.parse(localStorage.getItem("nova_products"));
    customers = JSON.parse(localStorage.getItem("nova_customers"));
    maintenance = JSON.parse(localStorage.getItem("nova_maintenance"));
    sales = JSON.parse(localStorage.getItem("nova_sales"));
    ledger = JSON.parse(localStorage.getItem("nova_ledger"));
    initPrintPrices();
}

function initPrintPrices() {
    const stored = JSON.parse(localStorage.getItem("nova_print_prices"));
    if (stored && typeof stored === "object") {
        printPrices = {
            bw_a4: stored.bw_a4 || defaultPrintPrices.bw_a4,
            color_a4: stored.color_a4 || defaultPrintPrices.color_a4,
            bw_a3: stored.bw_a3 || defaultPrintPrices.bw_a3,
            color_a3: stored.color_a3 || defaultPrintPrices.color_a3
        };
    } else {
        printPrices = { ...defaultPrintPrices };
    }
    saveData("nova_print_prices", printPrices);
}

function getPrintPrice(type) {
    return printPrices[type] || defaultPrintPrices[type] || 0;
}

function setPrintPrice(type, value) {
    if (!defaultPrintPrices.hasOwnProperty(type)) return;
    printPrices[type] = Number(value) || defaultPrintPrices[type];
    saveData("nova_print_prices", printPrices);
}

// Reset local database to mock/default state
function resetDatabase(force = false) {
    if (!force && !confirm("هل أنت متأكد من إعادة تعيين قاعدة البيانات المحلية؟ سيتم فقدان جميع البيانات المعدلة.")) return;

    // Remove known keys
    const keys = ["nova_products", "nova_customers", "nova_maintenance", "nova_sales", "nova_ledger", "nova_print_prices", "nova_sync_queue", "nova_sync_settings", "nova_theme"];
    keys.forEach(k => localStorage.removeItem(k));

    // Clear in-memory arrays
    products = [];
    customers = [];
    maintenance = [];
    sales = [];
    ledger = [];
    cart = [];

    // Reinitialize
    initData();

    // Re-render UI
    updateDashboard();
    try { renderPOSTab(); } catch(e) {}
    try { renderInventoryTable(); } catch(e) {}
    try { renderMaintenanceTable(); } catch(e) {}
    try { renderCustomersTable(); } catch(e) {}
    try { renderAccountingTab(); } catch(e) {}
    try { renderCart(); } catch(e) {}

    alert("تمت إعادة تعيين قاعدة البيانات محلياً وإرجاعها إلى القيم الافتراضية.");
    console.log("Local DB reset to defaults. Using localStorage (offline).");
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function enqueueSync(item) {
    item._queuedAt = new Date().toISOString();
    item._id = item._id || ('q-' + Date.now() + '-' + Math.floor(Math.random()*1000));
    syncQueue.push(item);
    localStorage.setItem('nova_sync_queue', JSON.stringify(syncQueue));
}

async function processSyncQueue() { // This function remains but won't be called automatically by network events
    if (!syncSettings.endpoint) return;
    while (syncQueue.length > 0) {
        const item = syncQueue[0];
        try {
            const res = await fetch(syncSettings.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error('Status ' + res.status);
            syncQueue.shift();
            localStorage.setItem('nova_sync_queue', JSON.stringify(syncQueue));
        } catch (e) {
            console.warn('Sync failed, will retry later', e);
            break;
        }
    }
}

function saveSyncSettings(obj) {
    syncSettings = Object.assign({}, syncSettings, obj);
    localStorage.setItem('nova_sync_settings', JSON.stringify(syncSettings));
}

if (typeof window !== 'undefined' && typeof window.lucide === 'undefined') {
    window.lucide = {
        createIcons: function() {
            // Fallback for offline use when lucide library is not loaded.
        }
    };
}

// ==================== NAVIGATION & LIVE SYSTEM INFO ====================

document.addEventListener("DOMContentLoaded", () => {
    initData();
    // Remove sync settings setup as initSync is removed
    // const inp = document.getElementById('sync-endpoint');
    // if (inp) inp.value = syncSettings.endpoint || '';

    updateLiveDate();

    // Toggle Print Calculator
    const quickPrintBody = document.getElementById("quick-print-body");
    const togglePrintCalcBtn = document.getElementById("toggle-print-calc-btn");
    const togglePrintCalcIcon = togglePrintCalcBtn ? togglePrintCalcBtn.querySelector('i') : null;

    // Load initial state from localStorage
    const savedPrintCalcState = localStorage.getItem("nova_print_calc_hidden");
    let isPrintCalcHidden = savedPrintCalcState === "true"; // Default to false if not set

    function updatePrintCalcUI() {
        if (quickPrintBody) {
            if (isPrintCalcHidden) {
                quickPrintBody.style.display = "none";
                if (togglePrintCalcIcon) togglePrintCalcIcon.setAttribute("data-lucide", "chevron-down");
            } else {
                quickPrintBody.style.display = "block";
                if (togglePrintCalcIcon) togglePrintCalcIcon.setAttribute("data-lucide", "chevron-up");
            }
            lucide.createIcons(); // Re-render icons after changing data-lucide attribute
        }
    }

    if (togglePrintCalcBtn) {
        togglePrintCalcBtn.addEventListener("click", () => {
            isPrintCalcHidden = !isPrintCalcHidden;
            localStorage.setItem("nova_print_calc_hidden", isPrintCalcHidden);
            updatePrintCalcUI();
        });
    }
    updatePrintCalcUI(); // Apply initial state on load

    switchTab("dashboard");
    resetDiscountState();

    const discountType = document.getElementById("discount-type");
    const discountValue = document.getElementById("discount-value");
    const clearDiscountBtn = document.getElementById("btn-clear-discount");

    if (discountType && discountValue) {
        discountType.addEventListener("change", () => {
            currentDiscount.type = discountType.value;
            updateDiscountControls();
            updateCartSummary();
        });

        discountValue.addEventListener("input", () => {
            currentDiscount.value = Number(discountValue.value) || 0;
            updateCartSummary();
        });
    }

    if (clearDiscountBtn) {
        clearDiscountBtn.addEventListener("click", () => {
            resetDiscountState();
        });
    }
    
    // Set up sidebar clicks
    document.querySelectorAll(".menu-item").forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            switchTab(tabId);
        });
    });

    // Theme Toggling Setup
    const btnTheme = document.getElementById("btn-theme-toggle");
    const themeIcon = document.getElementById("theme-icon");
    const savedTheme = localStorage.getItem("nova_theme") || "dark";
    
    function updateThemeIcon(isLight) {
        if (!themeIcon) return;
        themeIcon.setAttribute("data-lucide", isLight ? "moon" : "sun");
        lucide.createIcons();
    }
    
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        updateThemeIcon(true);
    } else {
        document.body.classList.remove("light-theme");
        updateThemeIcon(false);
    }
    
    btnTheme.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        const isLight = document.body.classList.contains("light-theme");
        localStorage.setItem("nova_theme", isLight ? "light" : "dark");
        updateThemeIcon(isLight);
    });

    // Design selector (professional / modern)
    const designSelect = document.getElementById('design-select');
    const savedDesign = localStorage.getItem('nova_design') || 'professional';
    function applyDesign(design) {
        document.body.classList.remove('design-modern');
        if (design === 'modern') document.body.classList.add('design-modern');
    }
    applyDesign(savedDesign);
    if (designSelect) {
        designSelect.value = savedDesign;
        designSelect.addEventListener('change', () => {
            const d = designSelect.value;
            localStorage.setItem('nova_design', d);
            applyDesign(d);
        });
    }

    const mobileNavOverlay = document.getElementById("mobile-nav-overlay");
    const sidebarToggleBtn = document.getElementById("btn-sidebar-toggle");
    const appContainer = document.querySelector(".app-container");

    function closeMobileSidebar() {
        if (appContainer) appContainer.classList.remove("sidebar-open");
    }

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener("click", () => {
            if (appContainer) appContainer.classList.toggle("sidebar-open");
        });
    }

    if (mobileNavOverlay) {
        mobileNavOverlay.addEventListener("click", closeMobileSidebar);
    }

    document.querySelectorAll(".sidebar-menu .menu-item").forEach(item => {
        item.addEventListener("click", () => {
            if (window.innerWidth <= 992) closeMobileSidebar();
        });
    });

    // Copying & Printing Calculator Logic
    const calcService = document.getElementById("print-calc-service");
    const calcColor = document.getElementById("print-calc-color");
    const calcPages = document.getElementById("print-calc-pages");
    const calcCopies = document.getElementById("print-calc-copies");
    const calcTotalSpan = document.getElementById("print-calc-total");
    const btnAddPrint = document.getElementById("btn-add-print-to-cart");

    function updatePrintCalculator() {
        const colorVal = calcColor.value;
        const pages = parseInt(calcPages.value) || 1;
        const copies = parseInt(calcCopies.value) || 1;
        
        let pricePerPage = 150;
        if (colorVal === "bw_a4") pricePerPage = getPrintPrice("bw_a4");
        else if (colorVal === "color_a4") pricePerPage = getPrintPrice("color_a4");
        else if (colorVal === "bw_a3") pricePerPage = getPrintPrice("bw_a3");
        else if (colorVal === "color_a3") pricePerPage = getPrintPrice("color_a3");
        
        const total = pricePerPage * pages * copies;
        calcTotalSpan.innerText = total.toLocaleString('en-US');
    }

    const priceInputs = {
        bw_a4: document.getElementById("print-price-bw-a4"),
        color_a4: document.getElementById("print-price-color-a4"),
        bw_a3: document.getElementById("print-price-bw-a3"),
        color_a3: document.getElementById("print-price-color-a3")
    };

    if(calcService && calcColor && calcPages && calcCopies) {
        [calcService, calcColor, calcPages, calcCopies].forEach(el => {
            el.addEventListener("input", updatePrintCalculator);
            el.addEventListener("change", updatePrintCalculator);
        });
    }

    Object.entries(priceInputs).forEach(([type, input]) => {
        if (!input) return;
        input.value = getPrintPrice(type);
        input.addEventListener("change", () => {
            setPrintPrice(type, input.value);
            updateColorLabels();
            updatePrintCalculator();
        });
    });

    function updateColorLabels() {
        const labels = {
            bw_a4: `أسود وأبيض - A4 (${getPrintPrice("bw_a4").toLocaleString()} د.ع)`,
            color_a4: `ملون عادي - A4 (${getPrintPrice("color_a4").toLocaleString()} د.ع)`,
            bw_a3: `أسود وأبيض - A3 (${getPrintPrice("bw_a3").toLocaleString()} د.ع)`,
            color_a3: `ملون عادي - A3 (${getPrintPrice("color_a3").toLocaleString()} د.ع)`
        };
        if (calcColor) {
            Array.from(calcColor.options).forEach(opt => {
                if (labels[opt.value]) opt.textContent = labels[opt.value];
            });
        }
    }
    updateColorLabels();

    if(btnAddPrint) {
        btnAddPrint.addEventListener("click", () => {
            const serviceText = calcService.value === "copy" ? "استنساخ نسخ" : "طباعة مستندات";
            const colorText = calcColor.options[calcColor.selectedIndex].text.split(" (")[0];
            const pages = parseInt(calcPages.value) || 1;
            const copies = parseInt(calcCopies.value) || 1;
            
            const colorVal = calcColor.value;
            let pricePerPage = 150;
            let costPerPage = 50;
            if (colorVal === "bw_a4") { pricePerPage = getPrintPrice("bw_a4"); costPerPage = 50; }
            else if (colorVal === "color_a4") { pricePerPage = getPrintPrice("color_a4"); costPerPage = 200; }
            else if (colorVal === "bw_a3") { pricePerPage = getPrintPrice("bw_a3"); costPerPage = 100; }
            else if (colorVal === "color_a3") { pricePerPage = getPrintPrice("color_a3"); costPerPage = 400; }
            
            const totalPrice = pricePerPage * pages * copies;
            const totalCost = costPerPage * pages * copies;

            // Add service directly to cart
            cart.push({
                productId: "print-service-" + Date.now(),
                name: `${serviceText} (${colorText}) - ${pages} ص × ${copies} نسخ`,
                category: "print",
                sellPrice: totalPrice,
                buyPrice: totalCost,
                qty: 1,
                selectedImei: ""
            });

            renderCart();
            
            // Reset input values
            calcPages.value = 1;
            calcCopies.value = 1;
            updatePrintCalculator();
        });
    }
// Direct Copy Sale Button
const btnAddCopyDirect = document.getElementById("addCopyDirectBtn");
if (btnAddCopyDirect) {
    btnAddCopyDirect.addEventListener("click", () => {
        const serviceText = "استنساخ نسخ";
        const colorText = calcColor.options[calcColor.selectedIndex].text.split(" (")[0];
        const pages = parseInt(calcPages.value) || 1;
        const copies = parseInt(calcCopies.value) || 1;
        const colorVal = calcColor.value;
        let pricePerPage = 150;
        let costPerPage = 50;
        if (colorVal === "bw_a4") { pricePerPage = getPrintPrice("bw_a4"); costPerPage = 50; }
        else if (colorVal === "color_a4") { pricePerPage = getPrintPrice("color_a4"); costPerPage = 200; }
        else if (colorVal === "bw_a3") { pricePerPage = getPrintPrice("bw_a3"); costPerPage = 100; }
        else if (colorVal === "color_a3") { pricePerPage = getPrintPrice("color_a3"); costPerPage = 400; }
        const totalPrice = pricePerPage * pages * copies;
        const totalCost = costPerPage * pages * copies;
        // Add service directly to cart
        cart.push({
            productId: "copy-service-" + Date.now(),
            name: `${serviceText} (${colorText}) - ${pages} ص × ${copies} نسخ`,
            category: "print",
            sellPrice: totalPrice,
            buyPrice: totalCost,
            qty: 1,
            selectedImei: ""
        });
        renderCart();
        // Reset input values
        calcPages.value = 1;
        calcCopies.value = 1;
        updatePrintCalculator();
    });
}

    // POS Cart Events
    document.getElementById("btn-clear-cart").addEventListener("click", clearCart);
    document.getElementById("btn-complete-sale").addEventListener("click", completeSale);
    document.getElementById("btn-quick-add-customer").addEventListener("click", () => {
        openModal("customer-modal");
    });

    // Form Submissions
    document.getElementById("product-form").addEventListener("submit", handleProductForm);
    document.getElementById("customer-form").addEventListener("submit", handleCustomerForm);
    document.getElementById("maintenance-form").addEventListener("submit", handleMaintenanceForm);
    document.getElementById("accounting-form").addEventListener("submit", handleAccountingForm);

    // Search & Filter Listeners
    document.getElementById("pos-search-input").addEventListener("input", renderPOSProducts);
    document.getElementById("pos-category-filter").addEventListener("change", renderPOSProducts);
    
    document.getElementById("inventory-search").addEventListener("input", renderInventoryTable);
    document.getElementById("inventory-category-filter").addEventListener("change", renderInventoryTable);
    
    document.getElementById("maintenance-search").addEventListener("input", renderMaintenanceTable);
    document.getElementById("maintenance-status-filter").addEventListener("change", renderMaintenanceTable);
    
    document.getElementById("customers-search").addEventListener("input", renderCustomersTable);

    const inventoryFileInput = document.getElementById("inventory-file-input");
    const importProductsBtn = document.getElementById("btn-import-products");

    if (importProductsBtn && inventoryFileInput) {
        importProductsBtn.addEventListener("click", () => inventoryFileInput.click());
        inventoryFileInput.addEventListener("change", async (e) => {
            await handleInventoryImport(e.target.files);
            e.target.value = "";
        });
    }

    document.getElementById("btn-add-product").addEventListener("click", () => {
        document.getElementById("product-form").reset();
        document.getElementById("edit-product-id").value = "";
        document.getElementById("product-modal-title").innerText = "إضافة منتج جديد";
        toggleIMEIField();
        openModal("product-modal");
    });

    document.getElementById("btn-add-repair").addEventListener("click", () => {
        document.getElementById("maintenance-form").reset();
        document.getElementById("edit-repair-id").value = "";
        document.getElementById("maintenance-modal-title").innerText = "تسجيل جهاز صيانة جديد";
        populateCustomerSelects();
        openModal("maintenance-modal");
    });

    document.getElementById("btn-add-customer").addEventListener("click", () => {
        document.getElementById("customer-form").reset();
        document.getElementById("edit-customer-id").value = "";
        document.getElementById("customer-modal-title").innerText = "إضافة زبون جديد";
        openModal("customer-modal");
    });

    document.getElementById("btn-clear-ledger").addEventListener("click", () => {
        if(confirm("هل أنت متأكد من مسح جميع المعاملات المالية المضافة يدوياً؟")) {
            ledger = [];
            saveData("nova_ledger", ledger);
            updateDashboard();
            renderAccountingTab();
        }
    });

    // Re-instantiate icons
    lucide.createIcons();
    // Reset DB button hookup (local/offline reset)
    const btnResetDb = document.getElementById("btn-reset-db");
    if (btnResetDb) btnResetDb.addEventListener("click", resetDatabase);
    // If URL contains ?resetdb=1 then force-reset without user prompt
    try {
        const params = new URL(window.location.href).searchParams;
        if (params.get('resetdb') === '1') {
            resetDatabase(true);
            // remove parameter to avoid repeating on refresh
            params.delete('resetdb');
            const newUrl = window.location.origin + window.location.pathname + (params.toString() ? '?' + params.toString() : '');
            history.replaceState({}, document.title, newUrl);
        }
    } catch (e) { /* ignore if window not available */ }
});

function updateLiveDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const formatter = new Intl.DateTimeFormat('ar-EG', options);
    document.getElementById("live-date").innerText = formatter.format(new Date());
}

function switchTab(tabId) {
    // Update active class on menu items
    document.querySelectorAll(".menu-item").forEach(item => {
        if (item.getAttribute("data-tab") === tabId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    // Update active class on content sections
    document.querySelectorAll(".tab-content").forEach(content => {
        if (content.id === tabId) {
            content.classList.add("active");
        } else {
            content.classList.remove("active");
        }
    });

    // Update main header title
    const titles = {
        dashboard: "لوحة التحكم الرئيسية",
        pos: "نقطة البيع (POS)",
        inventory: "إدارة المخازن والمنتجات",
        maintenance: "قسم الصيانة والتذاكر",
        customers: "قاعدة بيانات الزبائن",
        accounting: "المحاسبة والتقارير المالية"
    };
    document.getElementById("page-title").innerText = titles[tabId] || "لوحة التحكم";

    // Refresh Tab-specific data
    if (tabId === "dashboard") updateDashboard();
    else if (tabId === "pos") renderPOSTab();
    else if (tabId === "inventory") renderInventoryTable();
    else if (tabId === "maintenance") renderMaintenanceTable();
    else if (tabId === "customers") renderCustomersTable();
    else if (tabId === "accounting") renderAccountingTab();
    
    lucide.createIcons();
}

function updateDiscountControls() {
    const typeEl = document.getElementById("discount-type");
    const valueEl = document.getElementById("discount-value");
    if (!typeEl || !valueEl) return;

    const isEnabled = typeEl.value !== "none";
    valueEl.disabled = !isEnabled;
    if (typeEl.value === "percent") {
        valueEl.placeholder = "مثال: 10";
        valueEl.step = "1";
    } else if (typeEl.value === "amount") {
        valueEl.placeholder = "مثال: 5000";
        valueEl.step = "500";
    }
}

function resetDiscountState() {
    currentDiscount = { type: 'none', value: 0 };
    const typeEl = document.getElementById("discount-type");
    const valueEl = document.getElementById("discount-value");
    if (typeEl) typeEl.value = "none";
    if (valueEl) valueEl.value = "";
    updateDiscountControls();
    updateCartSummary();
}

function getCartSubtotal() {
    return cart.reduce((sum, item) => sum + (item.sellPrice * item.qty), 0);
}

function calculateDiscountAmount(subtotal) {
    if (!subtotal || currentDiscount.type === "none") return 0;

    const value = Number(currentDiscount.value) || 0;
    if (value <= 0) return 0;

    if (currentDiscount.type === "percent") {
        const percent = Math.min(100, Math.max(0, value));
        return Math.max(0, subtotal * (percent / 100));
    }

    if (currentDiscount.type === "amount") {
        return Math.max(0, Math.min(subtotal, value));
    }

    return 0;
}

function getCurrentSaleTotals() {
    const subtotal = getCartSubtotal();
    const discountAmount = calculateDiscountAmount(subtotal);
    const finalTotal = Math.max(0, subtotal - discountAmount);
    return { subtotal, discountAmount, finalTotal };
}

function updateCartSummary() {
    const { subtotal, discountAmount, finalTotal } = getCurrentSaleTotals();
    const subtotalEl = document.getElementById("cart-subtotal-price");
    const discountEl = document.getElementById("cart-discount-amount");
    const totalEl = document.getElementById("cart-total-price");

    if (subtotalEl) subtotalEl.innerText = formatCurrency(subtotal);
    if (discountEl) discountEl.innerText = formatCurrency(discountAmount);
    if (totalEl) totalEl.innerText = formatCurrency(finalTotal);
}

function getAccountingNetForSale(sale) {
    const originalTotal = sale.items.reduce((sum, item) => sum + (item.sellPrice * item.qty), 0);
    const discountType = sale.discountType || "none";
    const discountValue = Number(sale.discountValue) || 0;
    const discountAmount = Number(sale.discountAmount) || 0;

    let salesTotal = 0;
    let printTotal = 0;

    sale.items.forEach(item => {
        const lineTotal = item.sellPrice * item.qty;
        let lineNet = lineTotal;

        if (discountType === "percent" && discountValue > 0) {
            lineNet = lineTotal * (1 - (discountValue / 100));
        } else if (discountType === "amount" && discountAmount > 0 && originalTotal > 0) {
            lineNet = lineTotal - ((lineTotal / originalTotal) * discountAmount);
        }

        if (item.category === "print") {
            printTotal += lineNet;
        } else {
            salesTotal += lineNet;
        }
    });

    return { salesTotal, printTotal };
}

// ==================== DASHBOARD LOGIC ====================

function updateDashboard() {
    // 1. Calculations
    let totalRevenues = 0;
    let totalCostOfGoodsSold = 0;

    // From Sales
    sales.forEach(sale => {
        if (sale.returned) return;
        totalRevenues += sale.total;
        sale.items.forEach(item => {
            totalCostOfGoodsSold += (item.qty * item.buyPrice);
        });
    });

    // From Maintenance (only delivered or ready with advances, for this model: count cost as income, advances received)
    let maintenanceRevenue = 0;
    let activeRepairsCount = 0;
    maintenance.forEach(ticket => {
        if (ticket.status === "pending") {
            activeRepairsCount++;
            // Only advance counts as current revenue
            totalRevenues += ticket.advance;
            maintenanceRevenue += ticket.advance;
        } else if (ticket.status === "ready") {
            totalRevenues += ticket.advance;
            maintenanceRevenue += ticket.advance;
        } else if (ticket.status === "delivered") {
            // Full cost received
            totalRevenues += ticket.cost;
            maintenanceRevenue += ticket.cost;
        }
    });

    // Expenses (Ledger expenses)
    let totalExpenses = 0;
    let extraRevenue = 0;
    ledger.forEach(trans => {
        if (trans.type === "expense") {
            totalExpenses += trans.amount;
        } else if (trans.type === "revenue") {
            extraRevenue += trans.amount;
        }
    });

    totalRevenues += extraRevenue;

    // Net Profit = (Sales Revenue - Cost of Goods Sold) + Maintenance Revenue + Extra Revenue - Custom Expenses
    const grossProfitFromSales = (totalRevenues - maintenanceRevenue - extraRevenue) - totalCostOfGoodsSold;
    const netProfit = grossProfitFromSales + maintenanceRevenue + extraRevenue - totalExpenses;

    // Low stock count (threshold <= 3)
    const lowStockCount = products.filter(p => p.qty <= 3).length;

    // 2. Write values to DOM
    document.getElementById("dashboard-revenues").innerText = formatCurrency(totalRevenues);
    document.getElementById("dashboard-profits").innerText = formatCurrency(netProfit);
    document.getElementById("dashboard-repairs").innerText = activeRepairsCount;
    document.getElementById("dashboard-low-stock").innerText = lowStockCount;

    document.getElementById("alert-count").innerText = lowStockCount;
    const alertBadge = document.getElementById("low-stock-alert-badge");
    if(lowStockCount > 0) {
        alertBadge.style.color = "var(--color-danger)";
    } else {
        alertBadge.style.color = "var(--text-muted)";
    }

    // 3. Render lists on dashboard
    renderRecentSales();
    renderRecentRepairs();
    lucide.createIcons();
}

function renderRecentSales() {
    const tbody = document.getElementById("dashboard-recent-sales");
    tbody.innerHTML = "";
    
    // Show last 5 sales
    const recent = sales.slice(-5).reverse();
    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;" class="text-muted">لا توجد عمليات بيع مؤخراً</td></tr>`;
        return;
    }

    recent.forEach(sale => {
        const tr = document.createElement("tr");
        const returnAction = sale.returned ?
            `<span class="badge badge-danger">مرتجع</span>` :
            `<button class="btn-action delete" onclick="returnSale('${sale.id}')" title="إرجاع الفاتورة"><i data-lucide="rotate-ccw"></i></button>`;

        tr.innerHTML = `
            <td><strong>${sale.id}</strong></td>
            <td>${sale.customerName}</td>
            <td>${sale.date.split(" ")[0]}</td>
            <td class="text-green font-bold">${formatCurrency(sale.total)}</td>
            <td>
                <div class="flex-row gap-2">
                    <button class="btn-action edit" onclick="viewInvoice('${sale.id}')" title="عرض الفاتورة">
                        <i data-lucide="eye"></i>
                    </button>
                    ${returnAction}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function renderRecentRepairs() {
    const tbody = document.getElementById("dashboard-recent-repairs");
    tbody.innerHTML = "";
    
    const recent = maintenance.slice(-5).reverse();
    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;" class="text-muted">لا توجد أجهزة صيانة مستلمة</td></tr>`;
        return;
    }

    recent.forEach(ticket => {
        let statusBadge = "";
        if (ticket.status === "pending") statusBadge = `<span class="badge badge-warning">قيد الإصلاح</span>`;
        else if (ticket.status === "ready") statusBadge = `<span class="badge badge-success">جاهز للتسليم</span>`;
        else statusBadge = `<span class="badge badge-info">تم التسليم</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${ticket.customerName}</td>
            <td>${ticket.device}</td>
            <td>${ticket.problem}</td>
            <td>${statusBadge}</td>
            <td class="font-bold">${formatCurrency(ticket.cost)}</td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// ==================== POS LOGIC ====================

function renderPOSTab() {
    populateCustomerSelects();
    renderPOSProducts();
    renderCart();
}

function populateCustomerSelects() {
    const selectors = ["pos-customer-select", "repair-customer-select"];
    selectors.forEach(selId => {
        const select = document.getElementById(selId);
        if (!select) return;
        
        select.innerHTML = "";
        if(selId === "pos-customer-select") {
            select.innerHTML = `<option value="walk-in">زبون سفري (نقدي)</option>`;
        }
        
        customers.forEach(cust => {
            const opt = document.createElement("option");
            opt.value = cust.id;
            opt.innerText = `${cust.name} (${cust.phone})`;
            select.appendChild(opt);
        });
    });
}

function renderPOSProducts() {
    const grid = document.getElementById("pos-products-grid");
    grid.innerHTML = "";

    const searchVal = document.getElementById("pos-search-input").value.toLowerCase();
    const catVal = document.getElementById("pos-category-filter").value;

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal) || p.barcode.includes(searchVal);
        const matchesCat = (catVal === "all") || (p.category === catVal);
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px;" class="text-muted">لا توجد منتجات مطابقة للبحث</div>`;
        return;
    }

    filtered.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-item-card p-4 fade-in";
        if (p.qty === 0) card.classList.add("out-of-stock");
        else if (p.qty <= 3) card.classList.add("low-stock");

        let catName = "مجهول";
        if (p.category === "phone") catName = "موبايل";
        else if (p.category === "accessory") catName = "اكسسوار";
        else if (p.category === "part") catName = "قطعة صيانة";
        else if (p.category === "print") catName = "استنساخ وطباعة";

        card.innerHTML = `
            <div>
                <span class="badge" style="background:rgba(255,255,255,0.1); margin-bottom:8px; display:inline-block;">${catName}</span>
                <h3 class="product-card-name">${p.name}</h3>
            </div>
            <div class="product-card-bottom">
                <p class="product-card-price">${formatCurrency(p.sellPrice)}</p>
                <p class="product-card-qty text-muted">${p.qty > 0 ? `الكمية المتوفرة: ${p.qty}` : 'نفد من المخزن'}</p>
            </div>
        `;
        
        card.addEventListener("click", () => addToCart(p.id));
        grid.appendChild(card);
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.qty === 0) return;

    const cartItem = cart.find(item => item.productId === productId);
    if (cartItem) {
        if (cartItem.qty < product.qty) {
            cartItem.qty++;
        } else {
            alert("لا يمكن إضافة كمية أكبر من المتوفرة في المخزن!");
        }
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            category: product.category,
            sellPrice: product.sellPrice,
            buyPrice: product.buyPrice,
            qty: 1,
            selectedImei: product.category === "phone" ? (product.imeis[0] || "") : ""
        });
    }

    renderCart();
}

function renderCart() {
    const list = document.getElementById("cart-items-list");
    list.innerHTML = "";

    if (cart.length === 0) {
        list.innerHTML = `
            <div class="empty-cart-message py-10">
                <i data-lucide="shopping-cart" size="48" class="mb-4"></i>
                <p>السلة فارغة. اختر منتجات للبيع</p>
            </div>
        `;
        document.getElementById("cart-total-items").innerText = "0";
        updateCartSummary();
        lucide.createIcons();
        return;
    }

    let totalItems = 0;

    cart.forEach((item, index) => {
        totalItems += item.qty;

        const product = products.find(p => p.id === item.productId);
        const hasProduct = !!product;
        const maxQty = hasProduct ? product.qty : Infinity;
        const hasImei = hasProduct && item.category === "phone" && product.imeis.length > 0;

        const cartItemDiv = document.createElement("div");
        cartItemDiv.className = "cart-item";
        
        let imeiSelectHtml = "";
        if (hasImei) {
            imeiSelectHtml = `
                <select class="form-select cart-item-imei-select" onchange="updateCartItemImei(${index}, this.value)">
                    ${product.imeis.map(imei => `<option value="${imei}" ${item.selectedImei === imei ? 'selected' : ''}>IMEI: ${imei}</option>`).join("")}
                </select>
            `;
        }

        cartItemDiv.innerHTML = `
            <div class="cart-item-info">
                <h4 class="cart-item-name">${item.name}</h4>
                <p class="cart-item-price text-sm">${formatCurrency(item.sellPrice)}</p>
                ${imeiSelectHtml}
            </div>
            <div class="cart-item-actions gap-2">
                <input type="number" class="cart-qty-input" value="${item.qty}" min="1" max="${maxQty}" onchange="updateCartItemQty(${index}, this.value)">
                <button class="btn-action delete" onclick="removeFromCart(${index})">
                    <i data-lucide="trash-2" size="18"></i>
                </button>
            </div>
        `;
        list.appendChild(cartItemDiv);
    });

    document.getElementById("cart-total-items").innerText = totalItems;
    updateCartSummary();
    lucide.createIcons();
}

function updateCartItemQty(index, qty) {
    qty = parseInt(qty);
    if (isNaN(qty) || qty < 1) qty = 1;

    const item = cart[index];
    const product = products.find(p => p.id === item.productId);
    const maxQty = product ? product.qty : Infinity;

    if (qty > maxQty) {
        if (product) {
            alert(`أقصى كمية متوفعة هي ${product.qty}`);
            qty = product.qty;
        } else {
            qty = 1;
        }
    }

    item.qty = qty;
    renderCart();
}

function updateCartItemImei(index, imei) {
    cart[index].selectedImei = imei;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function clearCart() {
    cart = [];
    resetDiscountState();
    renderCart();
}

function completeSale() {
    if (cart.length === 0) {
        alert("سلة المبيعات فارغة!");
        return;
    }

    // Determine customer info
    const customerId = document.getElementById("pos-customer-select").value;
    let customerName = "زبون سفري";
    let customerPhone = "-";

    if (customerId !== "walk-in") {
        const cust = customers.find(c => c.id === customerId);
        if (cust) {
            customerName = cust.name;
            customerPhone = cust.phone;
        }
    }

    const payMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const invoiceId = "INV-" + (sales.length + 1001);
    const dateStr = formatDateTime(new Date());
    const { subtotal, discountAmount, finalTotal } = getCurrentSaleTotals();

    // Deduct stock and finalize items
    cart.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.qty -= item.qty;
            if (product.category === "phone" && item.selectedImei) {
                // Remove the selected IMEI from product list
                const idx = product.imeis.indexOf(item.selectedImei);
                if (idx > -1) product.imeis.splice(idx, 1);
            }
        }
    });

    const newSale = {
        id: invoiceId,
        customerId: customerId,
        customerName: customerName,
        customerPhone: customerPhone,
        date: dateStr,
        items: [...cart],
        subtotal: subtotal,
        discountAmount: discountAmount,
        discountType: currentDiscount.type,
        discountValue: currentDiscount.value,
        total: finalTotal,
        payMethod: payMethod
    };

    sales.push(newSale);
    saveData("nova_sales", sales);
    saveData("nova_products", products);
    // enqueue for remote sync if configured
    enqueueSync({ type: 'sale', action: 'create', payload: newSale });

    // Clear cart & Refresh GUI
    cart = [];
    resetDiscountState();
    renderCart();
    renderPOSProducts();
    
    // Open invoice and show print layout
    displayInvoice(newSale);
}

// ==================== INVOICE VIEWER ====================

function displayInvoice(sale) {
    document.getElementById("inv-number").innerText = sale.id;
    document.getElementById("inv-date").innerText = sale.date;
    document.getElementById("inv-customer-name").innerText = sale.customerName;
    document.getElementById("inv-customer-phone").innerText = sale.customerPhone;
    document.getElementById("inv-pay-method").innerText = sale.payMethod === "cash" ? "نقدي" : "بطاقة دفع";

    const tbody = document.getElementById("invoice-items-body");
    tbody.innerHTML = "";

    sale.items.forEach(item => {
        const tr = document.createElement("tr");
        let nameDesc = item.name;
        if(item.selectedImei) {
            nameDesc += `<br><span style="font-size: 10px; color:#4b5563;">IMEI: ${item.selectedImei}</span>`;
        }
        tr.innerHTML = `
            <td>${nameDesc}</td>
            <td>${item.qty}</td>
            <td>${formatCurrency(item.sellPrice)}</td>
            <td>${formatCurrency(item.sellPrice * item.qty)}</td>
        `;
        tbody.appendChild(tr);
    });

    const subtotal = Number(sale.subtotal) || (sale.total + Number(sale.discountAmount || 0));
    const discountAmount = Number(sale.discountAmount) || 0;

    document.getElementById("inv-discount-amount").innerText = formatCurrency(discountAmount);
    document.getElementById("inv-total-raw").innerText = formatCurrency(subtotal);
    document.getElementById("inv-total-net").innerText = formatCurrency(sale.total);

    currentInvoiceSaleId = sale.id;
    const returnButton = document.getElementById("btn-return-sale");
    if (returnButton) {
        if (sale.returned) {
            returnButton.style.display = "none";
        } else {
            returnButton.style.display = "inline-flex";
        }
    }

    openModal("invoice-modal");
    lucide.createIcons();
}

function viewInvoice(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if(sale) {
        displayInvoice(sale);
    }
}

function returnSale(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if(!sale || sale.returned) return;

    if(!confirm(`هل تريد إرجاع فاتورة ${sale.id} بالكامل؟ سيتم استرجاع الكميات إلى المخزون.`)) return;

    sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.qty += item.qty;
            if (product.category === "phone" && item.selectedImei) {
                if (!product.imeis.includes(item.selectedImei)) {
                    product.imeis.push(item.selectedImei);
                }
            }
        }
    });

    sale.returned = true;
    sale.returnDate = formatDateTime(new Date());

    saveData("nova_sales", sales);
    saveData("nova_products", products);
    enqueueSync({ type: 'sale', action: 'return', payload: { id: sale.id, returnedAt: sale.returnDate } });

    updateDashboard();
    renderRecentSales();
    renderInventoryTable();
    renderAccountingTab();
    renderCustomersTable();
    try { renderPOSProducts(); } catch(e) {}

    if (currentInvoiceSaleId === saleId) {
        displayInvoice(sale);
    }

    alert("تمت عملية الإرجاع بنجاح.");
}

function printInvoice() {
    window.print();
}

function updateImportStatus(message, variant = "info") {
    const statusEl = document.getElementById("inventory-import-status");
    if (!statusEl) return;

    statusEl.textContent = message;
    if (variant === "success") {
        statusEl.style.color = "var(--success, #10b981)";
    } else if (variant === "error") {
        statusEl.style.color = "var(--danger, #ef4444)";
    } else {
        statusEl.style.color = "var(--text-secondary, #6b7280)";
    }
}

function normalizeCategory(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["phone", "mobile", "موبايل", "هاتف", "جوال"].includes(normalized)) return "phone";
    if (["accessory", "اكسسوار", "ملحق"].includes(normalized)) return "accessory";
    if (["part", "piece", "قطع صيانة", "قطع", "parts"].includes(normalized)) return "part";
    if (["print", "printing", "copy", "استنساخ", "طباعة", "print & copy"].includes(normalized)) return "print";
    return normalized;
}

function parseNumber(value) {
    if (value === undefined || value === null || value === "") return 0;
    const sanitized = String(value).replace(/,/g, "").replace(/[^0-9.\-]/g, "");
    const num = Number(sanitized);
    return Number.isFinite(num) ? num : 0;
}

function parseImeis(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    return String(value)
        .split(/[\n,;/|]+/)
        .map(item => item.trim())
        .filter(Boolean);
}

function getHeaderKey(value) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9ء-ي]/g, "");

    if (["name", "الاسم"].includes(normalized)) return "name";
    if (["سعرالدولار"].includes(normalized)) return "dollarPrice";
    if (["سعرالشراء"].includes(normalized)) return "buyPriceRaw";
    if (["الكمية"].includes(normalized)) return "qty";
    if (["المصاريف"].includes(normalized)) return "expenses";
    if (["سعرالبيع"].includes(normalized)) return "sellPrice";
    return normalized;
}

function parseDelimitedRows(text, delimiter) {
    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === delimiter && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = "";
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentCell.trim());
            if (currentRow.some(cell => cell !== "")) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = "";
            continue;
        }

        currentCell += char;
    }

    if (currentCell !== "" || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell !== "")) {
            rows.push(currentRow);
        }
    }

    return rows;
}

function parseTableRows(text) {
    const delimiters = [",", ";", "\t", "|"];
    const cleanedText = text.trim();

    if (!cleanedText) {
        throw new Error("الملف فارغ");
    }

    if (cleanedText.startsWith("[") || cleanedText.startsWith("{")) {
        return { type: "json", data: JSON.parse(cleanedText) };
    }

    for (const delimiter of delimiters) {
        const rows = parseDelimitedRows(cleanedText, delimiter);
        if (!rows.length) continue;

        const headerRow = rows[0].map(getHeaderKey);
        const hasKnownHeader = headerRow.some(key => ["name", "barcode", "category", "qty", "buyprice", "sellprice", "imeis"].includes(key));

        if (hasKnownHeader) {
            return { type: "table", rows };
        }
    }

    throw new Error("تعذر التعرف على الهيكل الداخلي للملف. استخدم CSV أو JSON أو Excel يحتوي على الأعمدة المطلوبة.");
}

function normalizeImportedRow(row, index) {
    let record = {};

    if (row && typeof row === "object" && !Array.isArray(row)) {
        record = row;
    } else if (Array.isArray(row)) {
        record = {};
        row.forEach((cell, cellIndex) => {
            const key = cellIndex === 0 ? "name" : cellIndex === 1 ? "dollarPrice" : cellIndex === 2 ? "buyPriceRaw" : cellIndex === 3 ? "qty" : cellIndex === 4 ? "expenses" : cellIndex === 5 ? "sellPrice" : `extra_${cellIndex}`;
            record[key] = cell;
        });
    } else {
        throw new Error(`الصف رقم ${index + 1} غير صالح`);
    }

    const name = String(record.name || "").trim();
    if (!name) {
        throw new Error(`الصف رقم ${index + 1} لا يحتوي على اسم منتج`);
    }

    let category = normalizeCategory(record.category);
    if (!category || !["phone", "accessory", "part", "print"].includes(category)) {
        category = "accessory";
    }

    const qty = Math.max(0, Math.round(parseNumber(record.qty)));
    const buyPriceRaw = parseNumber(record.buyPriceRaw);
    const expenses = parseNumber(record.expenses);
    const buyPrice = buyPriceRaw + expenses;

    const sellPrice = parseNumber(record.sellPrice) || buyPrice;
    const barcode = String(record.barcode || record["باركود"] || "").trim() || `imp-${Date.now()}-${index + 1}`;
    const imeis = parseImeis(record.imeis || record.imei || record["الـ IMEI"] || record["IMEI"] || "");

    return {
        id: `p${Date.now()}-${index + 1}`,
        barcode,
        name,
        category,
        qty,
        buyPrice,
        sellPrice,
        imeis
    };
}

function normalizeJsonImport(data) {
    if (Array.isArray(data)) {
        return data.map((item, index) => normalizeImportedRow(item, index));
    }

    if (data && typeof data === "object" && Array.isArray(data.rows)) {
        return data.rows.map((item, index) => normalizeImportedRow(item, index));
    }

    if (data && typeof data === "object") {
        return [normalizeImportedRow(data, 0)];
    }

    throw new Error("تنسيق JSON غير مدعوم");
}

function createProductFromImport(record) {
    return {
        id: record.id || `p${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        barcode: record.barcode || `imp-${Date.now()}`,
        name: record.name,
        category: record.category,
        qty: Math.max(0, Number(record.qty) || 0),
        buyPrice: Number(record.buyPrice) || 0,
        sellPrice: Number(record.sellPrice) || 0,
        imeis: Array.isArray(record.imeis) ? record.imeis : parseImeis(record.imeis)
    };
}

async function parseImportedFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    if (extension === "xlsx" || extension === "xls") {
        if (typeof window.XLSX === "undefined") {
            throw new Error("لم يتم تحميل مكتبة Excel. الرجاء إعادة تحميل الصفحة أو استخدام ملف CSV/JSON.");
        }

        const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!Array.isArray(rows) || rows.length === 0) {
            throw new Error("الملف لا يحتوي على بيانات قابلة للقراءة");
        }

        const headers = rows[0].map(getHeaderKey);
        const hasKnownHeader = headers.some(key => ["name", "barcode", "category", "qty", "buyprice", "sellprice", "imeis"].includes(key));
        if (!hasKnownHeader) {
            throw new Error("الملف لا يحتوي على الأعمدة المطلوبة للمنتجات");
        }

        return rows.slice(1).map((row) => {
            const record = {};
            headers.forEach((header, index) => {
                record[header] = row[index];
            });
            return record;
        });
    }

    const text = await file.text();
    const parsed = parseTableRows(text);

    if (parsed.type === "json") {
        return normalizeJsonImport(parsed.data);
    }

    const rows = parsed.rows;
    const headers = rows[0].map(getHeaderKey);
    return rows.slice(1).map((row) => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = row[index];
        });
        return record;
    });
}

function applyImportedProducts(records) {
    let added = 0;
    let updated = 0;
    let skipped = 0;

    records.forEach((record, index) => {
        try {
            const normalized = createProductFromImport(normalizeImportedRow(record, index));
            const existing = products.find(product => product.barcode && product.barcode === normalized.barcode);

            if (existing) {
                existing.name = normalized.name;
                existing.category = normalized.category;
                existing.qty = Math.max(0, existing.qty + normalized.qty);
                existing.buyPrice = normalized.buyPrice;
                existing.sellPrice = normalized.sellPrice || normalized.buyPrice;
                existing.imeis = Array.from(new Set([...(existing.imeis || []), ...(normalized.imeis || [])]));
                updated++;
                return;
            }

            products.push(normalized);
            added++;
        } catch (error) {
            skipped++;
            console.warn("Skipped import row", index + 1, error);
        }
    });

    return { added, updated, skipped };
}

async function handleInventoryImport(fileList) {
    if (!fileList || fileList.length === 0) {
        return;
    }

    updateImportStatus("جارٍ قراءة الملفات...", "info");

    products = []; // مسح جميع المنتجات السابقة لبدء استيراد نظيف

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const file of Array.from(fileList)) {
        try {
            const records = await parseImportedFile(file);
            const result = applyImportedProducts(records);
            added += result.added;
            updated += result.updated;
            skipped += result.skipped;
        } catch (error) {
            errors.push(`${file.name}: ${error.message}`);
        }
    }

    if (added || updated) {
        saveData("nova_products", products);
        renderInventoryTable();
        renderPOSProducts();
        updateDashboard();
    }

    if (errors.length > 0) {
        updateImportStatus(`تعذر استيراد بعض الملفات. تمت إضافة ${added} منتجات، وتحديث ${updated}. ${errors.slice(0, 2).join(" | ")}`, "error");
        return;
    }

    if (added === 0 && updated === 0) {
        updateImportStatus("لم يتم العثور على بيانات قابلة للاستيراد في الملفات المحددة.", "error");
        return;
    }

    updateImportStatus(`تمت الاستيراد بنجاح: ${added} مضاف، ${updated} محدث، ${skipped} تم تخطيه.`, "success");
}

// ==================== INVENTORY LOGIC ====================

function renderInventoryTable() {
    const tbody = document.getElementById("inventory-table-body");
    tbody.innerHTML = "";

    const searchVal = document.getElementById("inventory-search").value.toLowerCase();
    const catVal = document.getElementById("inventory-category-filter").value;

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal) || p.barcode.includes(searchVal);
        const matchesCat = (catVal === "all") || (p.category === catVal);
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;" class="text-muted">المخزن لا يحتوي على منتجات مطابقة لعملية البحث</td></tr>`;
        return;
    }

    filtered.forEach(p => {
        let catName = "مجهول";
        if (p.category === "phone") catName = "موبايل";
        else if (p.category === "accessory") catName = "اكسسوار";
        else if (p.category === "part") catName = "قطعة صيانة";
        else if (p.category === "print") catName = "استنساخ وطباعة";

        let statusBadge = `<span class="badge badge-success">متوفر</span>`;
        if (p.qty === 0) statusBadge = `<span class="badge badge-danger">نفد من المخزن</span>`;
        else if (p.qty <= 3) statusBadge = `<span class="badge badge-warning">كمية منخفضة</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${p.barcode || '-'}</strong></td>
            <td>${p.name}</td>
            <td>${catName}</td>
            <td>${p.qty}</td>
            <td>${formatCurrency(p.buyPrice)}</td>
            <td>${formatCurrency(p.sellPrice)}</td>
            <td><span style="font-size: 11px;">${p.imeis && p.imeis.length > 0 ? p.imeis.join(", ") : '-'}</span></td>
            <td>${statusBadge}</td>
            <td>
                <div class="flex-row gap-2">
                    <button class="btn-action edit" onclick="editProduct('${p.id}')" title="تعديل">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteProduct('${p.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
}

function toggleIMEIField() {
    const cat = document.getElementById("product-category").value;
    const imeiWrapper = document.getElementById("imei-field-wrapper");
    if(cat === "phone") {
        imeiWrapper.style.display = "block";
    } else {
        imeiWrapper.style.display = "none";
    }
}

function handleProductForm(e) {
    e.preventDefault();
    const id = document.getElementById("edit-product-id").value;
    const name = document.getElementById("product-name").value;
    const category = document.getElementById("product-category").value;
    const barcode = document.getElementById("product-barcode").value || Math.floor(Math.random() * 9000 + 1000).toString();
    const qty = parseInt(document.getElementById("product-qty").value);
    const buyPrice = parseFloat(document.getElementById("product-buy-price").value);
    const sellPrice = parseFloat(document.getElementById("product-sell-price").value);
    
    let imeis = [];
    if(category === "phone") {
        const text = document.getElementById("product-imeis").value;
        imeis = text.split(",").map(i => i.trim()).filter(i => i.length > 0);
    }

    if (id) {
        // Edit existing
        const p = products.find(p => p.id === id);
        if (p) {
            p.name = name;
            p.category = category;
            p.barcode = barcode;
            p.qty = qty;
            p.buyPrice = buyPrice;
            p.sellPrice = sellPrice;
            p.imeis = imeis;
        }
    } else {
        // Create new
        const newProduct = {
            id: "p" + (products.length + 1),
            barcode,
            name,
            category,
            qty,
            buyPrice,
            sellPrice,
            imeis
        };
        products.push(newProduct);
    }

    saveData("nova_products", products);
    closeModal("product-modal");
    renderInventoryTable();
}

function editProduct(productId) {
    const p = products.find(prod => prod.id === productId);
    if(!p) return;

    document.getElementById("edit-product-id").value = p.id;
    document.getElementById("product-name").value = p.name;
    document.getElementById("product-category").value = p.category;
    document.getElementById("product-barcode").value = p.barcode;
    document.getElementById("product-qty").value = p.qty;
    document.getElementById("product-buy-price").value = p.buyPrice;
    document.getElementById("product-sell-price").value = p.sellPrice;
    
    toggleIMEIField();

    if(p.category === "phone") {
        document.getElementById("product-imeis").value = p.imeis.join(", ");
    }

    document.getElementById("product-modal-title").innerText = "تعديل بيانات المنتج";
    openModal("product-modal");
}

function deleteProduct(productId) {
    if(confirm("هل أنت متأكد من حذف هذا المنتج نهائياً من المخزن؟")) {
        products = products.filter(p => p.id !== productId);
        saveData("nova_products", products);
        renderInventoryTable();
    }
}

// ==================== MAINTENANCE LOGIC ====================

function renderMaintenanceTable() {
    const tbody = document.getElementById("maintenance-table-body");
    tbody.innerHTML = "";

    const searchVal = document.getElementById("maintenance-search").value.toLowerCase();
    const statusVal = document.getElementById("maintenance-status-filter").value;

    const filtered = maintenance.filter(t => {
        const matchesSearch = t.customerName.toLowerCase().includes(searchVal) || 
                              t.customerPhone.includes(searchVal) || 
                              t.device.toLowerCase().includes(searchVal) ||
                              t.id.toLowerCase().includes(searchVal);
        const matchesStatus = (statusVal === "all") || (t.status === statusVal);
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;" class="text-muted">لا توجد بطاقات صيانة مطابقة للفلتر</td></tr>`;
        return;
    }

    filtered.forEach(ticket => {
        let statusBadge = "";
        let actionBtn = "";

        if (ticket.status === "pending") {
            statusBadge = `<span class="badge badge-warning">قيد الإصلاح</span>`;
            actionBtn = `
                <button class="btn-action done" onclick="updateRepairStatus('${ticket.id}', 'ready')" title="تحديد كجاهز">
                    <i data-lucide="check-circle"></i>
                </button>
            `;
        } else if (ticket.status === "ready") {
            statusBadge = `<span class="badge badge-success">جاهز للتسليم</span>`;
            actionBtn = `
                <button class="btn-action done" onclick="updateRepairStatus('${ticket.id}', 'delivered')" title="تأكيد التسليم للزبون">
                    <i data-lucide="package-check"></i>
                </button>
            `;
        } else {
            statusBadge = `<span class="badge badge-info">تم التسليم</span>`;
        }

        const rem = ticket.cost - ticket.advance;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${ticket.id}</strong></td>
            <td>
                <div>${ticket.customerName}</div>
                <div style="font-size:11px;" class="text-muted">${ticket.customerPhone}</div>
            </td>
            <td>${ticket.device}</td>
            <td>${ticket.problem}</td>
            <td>${ticket.date}</td>
            <td>${statusBadge}</td>
            <td>${formatCurrency(ticket.cost)}</td>
            <td class="text-green">${formatCurrency(ticket.advance)}</td>
            <td class="${rem > 0 ? 'text-red font-bold' : ''}">${formatCurrency(rem)}</td>
            <td>
                <div class="flex-row gap-2">
                    ${actionBtn}
                    <button class="btn-action edit" onclick="editRepair('${ticket.id}')" title="تعديل">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteRepair('${ticket.id}')" title="حذف">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
}

function updateRepairStatus(id, newStatus) {
    const ticket = maintenance.find(t => t.id === id);
    if(ticket) {
        ticket.status = newStatus;
        if(newStatus === "delivered") {
            // Full payment received
            ticket.advance = ticket.cost; 
        }
        saveData("nova_maintenance", maintenance);
        renderMaintenanceTable();
        updateDashboard();
    }
}

function handleMaintenanceForm(e) {
    e.preventDefault();
    const id = document.getElementById("edit-repair-id").value;
    const customerId = document.getElementById("repair-customer-select").value;
    const device = document.getElementById("repair-device").value;
    const problem = document.getElementById("repair-problem").value;
    const cost = parseFloat(document.getElementById("repair-cost").value);
    const advance = parseFloat(document.getElementById("repair-advance").value);
    const status = document.getElementById("repair-status").value;

    const cust = customers.find(c => c.id === customerId);
    const customerName = cust ? cust.name : "زبون عام";
    const customerPhone = cust ? cust.phone : "-";

    if (id) {
        // Edit existing
        const t = maintenance.find(item => item.id === id);
        if (t) {
            t.customerName = customerName;
            t.customerPhone = customerPhone;
            t.device = device;
            t.problem = problem;
            t.cost = cost;
            t.advance = advance;
            t.status = status;
        }
    } else {
        // Create new
        const newTicket = {
            id: "m-" + (maintenance.length + 101),
            customerName,
            customerPhone,
            device,
            problem,
            cost,
            advance,
            status,
            date: new Date().toISOString().split("T")[0]
        };
        maintenance.push(newTicket);
        // enqueue maintenance ticket for sync
        enqueueSync({ type: 'maintenance', action: 'create', payload: newTicket });
    }

    saveData("nova_maintenance", maintenance);
    closeModal("maintenance-modal");
    renderMaintenanceTable();
    updateDashboard();
}

function editRepair(id) {
    const t = maintenance.find(item => item.id === id);
    if(!t) return;

    populateCustomerSelects();
    
    // Find customer by name/phone to set select values
    const cust = customers.find(c => c.name === t.customerName);
    if(cust) {
        document.getElementById("repair-customer-select").value = cust.id;
    }

    document.getElementById("edit-repair-id").value = t.id;
    document.getElementById("repair-device").value = t.device;
    document.getElementById("repair-problem").value = t.problem;
    document.getElementById("repair-cost").value = t.cost;
    document.getElementById("repair-advance").value = t.advance;
    document.getElementById("repair-status").value = t.status;

    document.getElementById("maintenance-modal-title").innerText = "تعديل طلب الصيانة";
    openModal("maintenance-modal");
}

function deleteRepair(id) {
    if(confirm("هل تريد حذف بطاقة الصيانة هذه نهائياً؟")) {
        maintenance = maintenance.filter(t => t.id !== id);
        saveData("nova_maintenance", maintenance);
        renderMaintenanceTable();
        updateDashboard();
    }
}

// ==================== CUSTOMERS LOGIC ====================

function renderCustomersTable() {
    const tbody = document.getElementById("customers-table-body");
    tbody.innerHTML = "";

    const searchVal = document.getElementById("customers-search").value.toLowerCase();

    const filtered = customers.filter(c => {
        return c.name.toLowerCase().includes(searchVal) || c.phone.includes(searchVal);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;" class="text-muted">لم يتم العثور على زبائن مطابقة</td></tr>`;
        return;
    }

    filtered.forEach(c => {
        // Calculate totals for each customer
        const custSales = sales.filter(s => s.customerId === c.id && !s.returned);
        const purchaseCount = custSales.length;
        const totalPaid = custSales.reduce((sum, s) => sum + s.total, 0);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>${c.date}</td>
            <td>${purchaseCount} عمليات</td>
            <td class="text-green font-bold">${formatCurrency(totalPaid)}</td>
            <td>
                <div class="flex-row gap-2">
                    <button class="btn-action edit" onclick="editCustomer('${c.id}')" title="تعديل">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteCustomer('${c.id}')" title="حذف">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
}

function handleCustomerForm(e) {
    e.preventDefault();
    const id = document.getElementById("edit-customer-id").value;
    const name = document.getElementById("customer-name").value;
    const phone = document.getElementById("customer-phone").value;

    if (id) {
        const c = customers.find(item => item.id === id);
        if (c) {
            c.name = name;
            c.phone = phone;
        }
    } else {
        const newCust = {
            id: "c" + (customers.length + 1),
            name,
            phone,
            date: new Date().toISOString().split("T")[0]
        };
        customers.push(newCust);
    }

    saveData("nova_customers", customers);
    closeModal("customer-modal");
    
    // Refresh GUI
    renderCustomersTable();
    populateCustomerSelects();
}

function editCustomer(id) {
    const c = customers.find(item => item.id === id);
    if(!c) return;

    document.getElementById("edit-customer-id").value = c.id;
    document.getElementById("customer-name").value = c.name;
    document.getElementById("customer-phone").value = c.phone;

    document.getElementById("customer-modal-title").innerText = "تعديل بيانات الزبون";
    openModal("customer-modal");
}

function deleteCustomer(id) {
    if(confirm("هل تريد حذف هذا الزبون نهائياً؟ ستفقد البيانات الخاصة بإحصائيات مشترياته.")) {
        customers = customers.filter(c => c.id !== id);
        saveData("nova_customers", customers);
        renderCustomersTable();
        populateCustomerSelects();
    }
}

// ==================== ACCOUNTING LOGIC ====================

function renderAccountingTab() {
    let salesTotal = 0;
    let printTotal = 0;
    
    sales.forEach(s => {
        if (s.returned) return;
        const net = getAccountingNetForSale(s);
        salesTotal += net.salesTotal;
        printTotal += net.printTotal;
    });

    let repairsTotal = 0;
    maintenance.forEach(ticket => {
        if(ticket.status === "pending" || ticket.status === "ready") {
            repairsTotal += ticket.advance;
        } else {
            repairsTotal += ticket.cost;
        }
    });

    let expensesTotal = 0;
    let extraRevenue = 0;
    ledger.forEach(trans => {
        if (trans.type === "expense") {
            expensesTotal += trans.amount;
        } else {
            extraRevenue += trans.amount;
        }
    });

    // Calculate product cost of sold items to compute net profit
    let cogs = 0;
    sales.forEach(sale => {
        if (sale.returned) return;
        sale.items.forEach(item => {
            cogs += (item.qty * item.buyPrice);
        });
    });

    const netProfit = (salesTotal + printTotal - cogs) + repairsTotal + extraRevenue - expensesTotal;

    document.getElementById("acc-sales-value").innerText = formatCurrency(salesTotal);
    document.getElementById("acc-repairs-value").innerText = formatCurrency(repairsTotal);
    document.getElementById("acc-print-value").innerText = formatCurrency(printTotal);
    document.getElementById("acc-expenses-value").innerText = formatCurrency(expensesTotal);
    document.getElementById("acc-net-profit").innerText = formatCurrency(netProfit);

    renderLedgerTable(salesTotal + printTotal, repairsTotal);
}

function renderLedgerTable(salesTotal, repairsTotal) {
    const tbody = document.getElementById("accounting-ledger-body");
    tbody.innerHTML = "";

    // Assemble dynamic ledger containing sales summaries, repairs summaries, and manual ledger transactions
    let allTransactions = [];

    // Add Sales (Summarized or grouped)
    sales.forEach(s => {
        if (!s.returned) {
            allTransactions.push({
                date: s.date,
                description: `بيع بضاعة - فاتورة رقم ${s.id}`,
                type: "revenue",
                amount: s.total
            });
        } else {
            allTransactions.push({
                date: s.returnDate || s.date,
                description: `مرتجع بيع - فاتورة رقم ${s.id}`,
                type: "expense",
                amount: s.total
            });
        }
    });

    // Add Repairs
    maintenance.forEach(t => {
        if (t.status === "pending" || t.status === "ready") {
            if(t.advance > 0) {
                allTransactions.push({
                    date: t.date + " 12:00",
                    description: `واصل صيانة مقدمة - ${t.device} (${t.customerName})`,
                    type: "revenue",
                    amount: t.advance
                });
            }
        } else {
            allTransactions.push({
                date: t.date + " 18:00",
                description: `تسليم صيانة كاملة - ${t.device} (${t.customerName})`,
                type: "revenue",
                amount: t.cost
            });
        }
    });

    // Add manual entries
    ledger.forEach(l => {
        allTransactions.push({
            date: l.date,
            description: l.description,
            type: l.type,
            amount: l.amount
        });
    });

    // Sort by date descending
    allTransactions.sort((a,b) => new Date(b.date.replace(" ", "T")) - new Date(a.date.replace(" ", "T")));

    if(allTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;" class="text-muted">سجل الصندوق فارغ</td></tr>`;
        return;
    }

    allTransactions.forEach(t => {
        const tr = document.createElement("tr");
        const typeBadge = t.type === "expense" ? 
            `<span class="badge badge-danger">مصروف</span>` : 
            `<span class="badge badge-success font-bold">إيراد</span>`;
            
        tr.innerHTML = `
            <td>${t.date.split(" ")[0]}</td>
            <td>${t.description}</td>
            <td>${typeBadge}</td>
            <td class="${t.type === 'expense' ? 'text-red' : 'text-green font-bold'}">${formatCurrency(t.amount)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function handleAccountingForm(e) {
    e.preventDefault();
    const type = document.getElementById("acc-type").value;
    const amount = parseFloat(document.getElementById("acc-amount").value);
    const description = document.getElementById("acc-description").value;

    const newTrans = {
        id: "l" + (ledger.length + 1),
        type,
        amount,
        description,
        date: formatDateTime(new Date())
    };

    ledger.push(newTrans);
    saveData("nova_ledger", ledger);

    document.getElementById("accounting-form").reset();
    renderAccountingTab();
    updateDashboard();
}

// ==================== HELPER & MODAL UTILITIES ====================

function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', minimumFractionDigits: 0 }).format(amount).replace("IQD", "د.ع");
}

function formatDateTime(date) {
    const d = new Date(date);
    const dateStr = d.toISOString().split("T")[0];
    const timeStr = d.toTimeString().split(" ")[0].substring(0,5);
    return `${dateStr} ${timeStr}`;
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}
