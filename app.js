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
    const keys = ["nova_products", "nova_customers", "nova_maintenance", "nova_sales", "nova_ledger", "nova_print_prices", "nova_theme"];
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
    updateLiveDate();
    switchTab("dashboard");
    
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
        themeIcon.textContent = isLight ? "🌙" : "☀️";
        themeIcon.setAttribute("data-lucide", isLight ? "moon" : "sun");
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

// ==================== DASHBOARD LOGIC ====================

function updateDashboard() {
    // 1. Calculations
    let totalRevenues = 0;
    let totalCostOfGoodsSold = 0;

    // From Sales
    sales.forEach(sale => {
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
        tr.innerHTML = `
            <td><strong>${sale.id}</strong></td>
            <td>${sale.customerName}</td>
            <td>${sale.date.split(" ")[0]}</td>
            <td class="text-green font-bold">${formatCurrency(sale.total)}</td>
            <td>
                <button class="btn-action edit" onclick="viewInvoice('${sale.id}')" title="عرض الفاتورة">
                    <i data-lucide="eye"></i>
                </button>
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
        card.className = "product-item-card";
        if (p.qty === 0) card.classList.add("out-of-stock");
        else if (p.qty <= 3) card.classList.add("low-stock");

        let catName = "مجهول";
        if (p.category === "phone") catName = "موبايل";
        else if (p.category === "accessory") catName = "اكسسوار";
        else if (p.category === "part") catName = "قطعة صيانة";
        else if (p.category === "print") catName = "استنساخ وطباعة";

        card.innerHTML = `
            <div>
                <span class="product-card-category">${catName}</span>
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
            <div class="empty-cart-message">
                <i data-lucide="shopping-bag"></i>
                <p>السلة فارغة. اختر منتجات للبيع</p>
            </div>
        `;
        document.getElementById("cart-total-items").innerText = "0";
        document.getElementById("cart-total-price").innerText = "0 د.ع";
        lucide.createIcons();
        return;
    }

    let totalItems = 0;
    let totalPrice = 0;

    cart.forEach((item, index) => {
        totalItems += item.qty;
        totalPrice += (item.sellPrice * item.qty);

        const product = products.find(p => p.id === item.productId);

        const cartItemDiv = document.createElement("div");
        cartItemDiv.className = "cart-item";
        
        let imeiSelectHtml = "";
        if (item.category === "phone" && product.imeis.length > 0) {
            imeiSelectHtml = `
                <select class="form-select cart-item-imei-select" onchange="updateCartItemImei(${index}, this.value)">
                    ${product.imeis.map(imei => `<option value="${imei}" ${item.selectedImei === imei ? 'selected' : ''}>IMEI: ${imei}</option>`).join("")}
                </select>
            `;
        }

        cartItemDiv.innerHTML = `
            <div class="cart-item-info">
                <h4 class="cart-item-name">${item.name}</h4>
                <p class="cart-item-price">${formatCurrency(item.sellPrice)}</p>
                ${imeiSelectHtml}
            </div>
            <div class="cart-item-actions">
                <input type="number" class="cart-qty-input" value="${item.qty}" min="1" max="${product.qty}" onchange="updateCartItemQty(${index}, this.value)">
                <button class="btn-action delete" onclick="removeFromCart(${index})">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `;
        list.appendChild(cartItemDiv);
    });

    document.getElementById("cart-total-items").innerText = totalItems;
    document.getElementById("cart-total-price").innerText = formatCurrency(totalPrice);
    
    lucide.createIcons();
}

function updateCartItemQty(index, qty) {
    qty = parseInt(qty);
    if(isNaN(qty) || qty < 1) qty = 1;
    
    const item = cart[index];
    const product = products.find(p => p.id === item.productId);
    
    if (qty > product.qty) {
        alert(`أقصى كمية متوفرة هي ${product.qty}`);
        qty = product.qty;
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

    let saleTotal = 0;

    // Deduct stock and finalize items
    cart.forEach(item => {
        saleTotal += (item.sellPrice * item.qty);
        
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
        total: saleTotal,
        payMethod: payMethod
    };

    sales.push(newSale);
    saveData("nova_sales", sales);
    saveData("nova_products", products);

    // Clear cart & Refresh GUI
    cart = [];
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

    document.getElementById("inv-total-raw").innerText = formatCurrency(sale.total);
    document.getElementById("inv-total-net").innerText = formatCurrency(sale.total);

    openModal("invoice-modal");
}

function viewInvoice(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if(sale) {
        displayInvoice(sale);
    }
}

function printInvoice() {
    window.print();
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
                <div class="flex-row">
                    <button class="btn-action edit" onclick="editProduct('${p.id}')">
                        <i data-lucide="edit-2"></i>
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
                    <i data-lucide="check"></i>
                </button>
            `;
        } else if (ticket.status === "ready") {
            statusBadge = `<span class="badge badge-success">جاهز للتسليم</span>`;
            actionBtn = `
                <button class="btn-action done" onclick="updateRepairStatus('${ticket.id}', 'delivered')" title="تأكيد التسليم للزبون">
                    <i data-lucide="truck"></i>
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
                <div class="flex-row">
                    ${actionBtn}
                    <button class="btn-action edit" onclick="editRepair('${ticket.id}')" title="تعديل">
                        <i data-lucide="edit-2"></i>
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
        const custSales = sales.filter(s => s.customerId === c.id);
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
                <div class="flex-row">
                    <button class="btn-action edit" onclick="editCustomer('${c.id}')">
                        <i data-lucide="edit-2"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteCustomer('${c.id}')">
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
        s.items.forEach(item => {
            if (item.category === "print") {
                printTotal += (item.sellPrice * item.qty);
            } else {
                salesTotal += (item.sellPrice * item.qty);
            }
        });
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
        allTransactions.push({
            date: s.date,
            description: `بيع بضاعة - فاتورة رقم ${s.id}`,
            type: "revenue",
            amount: s.total
        });
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
