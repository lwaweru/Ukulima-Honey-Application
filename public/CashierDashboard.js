// CashierDashboard.js

const stock = { raw: 0, processed: 0, herbal: 0 };
const honeyPricePerMl = 1.1115;
let pendingOrders = [];
let currentAutofill = null;
let latestReceiptText = '';

function logout() {
  alert('✅ Cashier logging out...');
  localStorage.removeItem("loggedInUserEmail");
  localStorage.removeItem("loggedInUserRole");
  localStorage.removeItem("loggedInUserId");
  window.location.href = 'SignIn.html';
}

function normalizePhoneNumber(number) {
  number = number.trim().replace(/[\s-\(\)]/g, '');
  if (/^\+254[17]\d{8}$/.test(number)) return number;
  if (/^0[17]\d{8}$/.test(number)) return '+254' + number.slice(1);
  if (/^[17]\d{8}$/.test(number)) return '+254' + number;
  return null;
}

function getLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 19).replace('T', ' ');
}

async function fetchInventory() {
  try {
    const [invRes, prodRes] = await Promise.all([
      fetch('/api/inventory'),
      fetch('/api/products')
    ]);
    const [inv, prod] = await Promise.all([invRes.json(), prodRes.json()]);

    stock.raw = stock.processed = stock.herbal = 0;
    inv.forEach(i => {
      const p = prod.find(x => x.product_id === i.product_id);
      if (!p) return;
      const t = p.product_type.toLowerCase().trim();
      const vol = i.stock_quantity * p.volume_ml;
      if (t.includes('raw')) stock.raw += vol;
      if (t.includes('processed')) stock.processed += vol;
      if (t.includes('herbal')) stock.herbal += vol;
    });

    document.getElementById('rawStock').textContent = `${stock.raw} ml`;
    document.getElementById('processedStock').textContent = `${stock.processed} ml`;
    document.getElementById('herbalStock').textContent = `${stock.herbal} ml`;
  } catch (err) {
    console.error("Inventory load error:", err);
    document.getElementById("inventoryStatus").textContent = "❌ Error loading inventory.";
  }
}

async function fetchPendingOrders() {
  try {
    const res = await fetch('/api/pending-orders');
    pendingOrders = await res.json();
    renderPendingOrders();
  } catch (err) {
    console.error("Failed to load pending orders:", err);
  }
}

function renderPendingOrders() {
  const ul = document.getElementById("ordersList");
  ul.innerHTML = '';
  if (!pendingOrders.length) {
    ul.innerHTML = '<li class="list-group-item text-muted">No pending orders</li>';
    return;
  }

  pendingOrders.forEach(order => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center flex-column text-start mb-2';

    const topRow = document.createElement('div');
    topRow.className = 'd-flex justify-content-between w-100';
    topRow.innerHTML = `
      <div>
        <strong>${order.name}</strong> (${order.type}) — ${order.quantity}×${order.volume}ml<br>
        📞 ${order.phone} • 🏙️ ${order.county}
      </div>
      <div>
        <button class="btn btn-outline-primary btn-sm me-2" onclick="autofillOrder(${order.id})">Autofill</button>
        <button class="btn btn-outline-danger btn-sm" onclick="deletePending(${order.id})">Delete</button>
      </div>
    `;

    const timerRow = document.createElement('div');
    timerRow.id = `timer-${order.id}`;
    timerRow.className = 'mt-2 fw-bold text-danger';

    li.appendChild(topRow);
    li.appendChild(timerRow);
    ul.appendChild(li);

    startOrderCountdown(order.id, order.created_at);
  });
}

function startOrderCountdown(orderId, createdAt) {
  const target = new Date(new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
  const timerElement = document.getElementById(`timer-${orderId}`);

  function updateTimer() {
    const now = new Date();
    const remaining = target - now;

    if (!timerElement) return;
    if (remaining <= 0) {
      timerElement.textContent = "⏳ This order has expired!";
      return;
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
    const seconds = Math.floor((remaining / 1000) % 60);

    timerElement.textContent = `🕒 Expires in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}


function autofillOrder(id) {
  const o = pendingOrders.find(x => x.id === id);
  if (!o) return showError("Order not found.");

  currentAutofill = o;
  document.getElementById("customerName").value = o.name;
  document.getElementById("contactNumber").value = o.phone;
  document.getElementById("county").value = o.county;
  document.getElementById("honeyType").value = o.type;
  document.getElementById("unitVolume").value = o.volume;
  document.getElementById("quantity").value = o.quantity;
  showError("📋 Order autofilled. Ready to process sale.");
}

async function deletePending(id) {
  try {
    await fetch(`/api/pending-orders/${id}`, { method: 'DELETE' });
    pendingOrders = pendingOrders.filter(x => x.id !== id);
    renderPendingOrders();
    showError("🗑️ Order removed.");
  } catch (err) {
    console.error(err);
    showError("❌ Failed to remove order.");
  }
}

function generateReceipt(sale) {
  const {
    customerName,
    contactNumber,
    county,
    honey_type,
    number_quantity,
    volume_quantity,
    totalPrice,
    receiptNumber,
    date
  } = sale;

  latestReceiptText = `
============ Ukulima Honey Receipt ============
Receipt #: ${receiptNumber}
Date: ${date}

Customer: ${customerName}
Phone: ${contactNumber}
County: ${county}

Honey Type: ${honey_type}
Quantity: ${number_quantity} jars
Volume per Jar: ${volume_quantity}ml
Total Volume: ${number_quantity * volume_quantity}ml

Total Price: KES ${totalPrice.toFixed(2)}

Thank you for supporting Ukulima Honey!
==============================================
  `.trim();

  const display = document.getElementById("receiptDisplay");
  display.textContent = latestReceiptText;
}

function printReceipt() {
  if (!latestReceiptText) return alert("⚠️ No receipt available to print.");
  const win = window.open("", "Receipt", "width=600,height=600");
  win.document.write(`<pre style="font-family:monospace; white-space: pre-wrap;">${latestReceiptText}</pre>`);
  win.print();
}

async function submitSale() {
  await fetchInventory();

  const name = document.getElementById("customerName").value.trim();
  const rawPhone = document.getElementById("contactNumber").value.trim();
  const phone = normalizePhoneNumber(rawPhone);
  const county = document.getElementById("county").value.trim();
  const honeyType = document.getElementById("honeyType").value.trim().toLowerCase();
  const volume = parseInt(document.getElementById("unitVolume").value);
  const quantity = parseInt(document.getElementById("quantity").value);
  const totalVol = volume * quantity;
  const now = getLocalDateTime();

  if (!name || !phone || !county || isNaN(volume) || isNaN(quantity)) {
    return showError("❌ All fields required.");
  }

  if (!['raw', 'processed', 'herbal'].includes(honeyType)) {
    return showError("❌ Invalid honey type.");
  }

  if (totalVol > stock[honeyType]) {
    return showError(`❌ Stock insufficient. Have ${stock[honeyType]} ml`);
  }

  const totalPrice = totalVol * honeyPricePerMl;
  const cid = localStorage.getItem("loggedInUserId");
  if (!cid) return showError("❌ No cashier identity found.");

  const payload = {
    customerName: name,
    contactNumber: phone,
    county,
    number_quantity: quantity,
    volume_quantity: volume,
    totalPrice,
    date: now,
    honey_type: honeyType,
    customer_id: cid
  };

  try {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const rj = await res.json();
    if (!res.ok) throw new Error(rj.message || 'Sale failed.');

    const receipt = rj.receiptNumber || `UH-${rj.saleId}`;
    document.getElementById("status").textContent = "✅ Sale recorded. Receipt: " + receipt;
    generateReceipt({ ...payload, receiptNumber: receipt, date: now });

    if (currentAutofill?.id) {
      await deletePending(currentAutofill.id);
      currentAutofill = null;
    }

    document.getElementById("salesForm").reset();
    fetchInventory();
    fetchPendingOrders();
  } catch (err) {
    console.error(err);
    showError("❌ Could not record sale.");
  }
}

function showError(msg) {
  document.getElementById("status").textContent = msg;
}

async function cleanupOldOrders() {
  try {
    await fetch('/api/pending-orders/cleanup', { method: 'DELETE' });
  } catch (err) {
    console.error("Cleanup failed", err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchInventory();
  fetchPendingOrders();
  cleanupOldOrders();

  document.getElementById("submitSale").addEventListener("click", submitSale);
  document.getElementById("autofillBtn").addEventListener("click", () => {
    if (pendingOrders.length) autofillOrder(pendingOrders[0].id);
    else showError("❌ No pending orders.");
  });

  const printBtn = document.getElementById("printReceiptBtn");
  if (printBtn) {
    printBtn.addEventListener("click", printReceipt);
  }

  setInterval(fetchInventory, 10000);
  setInterval(fetchPendingOrders, 30000);
  setInterval(cleanupOldOrders, 86400000);
});
