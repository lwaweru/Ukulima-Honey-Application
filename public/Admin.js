// Ukulima Honey Admin.js - Fully Updated and Synced with server.js

const BASE_URL = "http://localhost:3000";
const honeyPricePerMl = 1.1115;

let stock = { raw: 0, processed: 0, herbal: 0 };
let currentCustomerId = null;

document.addEventListener("DOMContentLoaded", async () => {
  ["raw", "processed", "herbal"].forEach(type => {
    updateInventoryDisplay(type);
    document.getElementById(`${type}AddBtn`).addEventListener("click", () => addInventory(type));
  });

  await fetchInventory();
  await fetchCustomerIdIfMissing();
  await fetchCustomers();
  await fetchPendingOrders(); // 👈 Load pending orders
  setInterval(fetchInventory, 10000);
});

function toHoneyType(type) {
  if (type === "raw") return "Raw Honey";
  if (type === "processed") return "Processed Honey";
  if (type === "herbal") return "Herbal Honey";
  return "";
}

async function getProductIdsByType(honeyType) {
  try {
    const response = await fetch(`${BASE_URL}/api/products`);
    const products = await response.json();
    return products.filter(p => (p.product_type || "").trim().toLowerCase() === honeyType.trim().toLowerCase())
                   .map(p => p.product_id);
  } catch (err) {
    console.error("Error fetching products:", err);
    return [];
  }
}

async function getProductById(productId) {
  try {
    const res = await fetch(`${BASE_URL}/api/products/${productId}`);
    return await res.json();
  } catch (err) {
    console.error(`Error getting product ${productId}:`, err);
    return { volume_ml: 0 };
  }
}

async function updateInventoryDisplay(type) {
  const honeyType = toHoneyType(type);
  try {
    const [productIds, inventoryResponse] = await Promise.all([
      getProductIdsByType(honeyType),
      fetch(`${BASE_URL}/api/inventory`)
    ]);
    const inventory = await inventoryResponse.json();

    let totalVolume = 0;
    for (const item of inventory) {
      if (productIds.includes(item.product_id)) {
        const product = await getProductById(item.product_id);
        const added = item.stock_quantity * (product.volume_ml || 0);
        totalVolume += added;
      }
    }

    document.getElementById(`${type}InventoryDisplay`).textContent = `${Math.round(totalVolume)} ml`;
    stock[type] = totalVolume;
  } catch (err) {
    console.error(`Error updating ${honeyType} inventory:`, err);
    const display = document.getElementById(`${type}InventoryDisplay`);
    if (display) display.textContent = "Error loading inventory.";
  }
}

async function addInventory(type) {
  const quantityInput = document.getElementById(`${type}Quantity`);
  const addedMl = parseInt(quantityInput.value);
  const honeyType = toHoneyType(type);

  if (isNaN(addedMl) || addedMl <= 0) return alert("Please enter a valid amount in ml.");

  try {
    const productIds = await getProductIdsByType(honeyType);
    const volumes = await Promise.all(productIds.map(getProductById));
    const totalUnitVolume = volumes.reduce((sum, p) => sum + (p.volume_ml || 0), 0);

    let addedTotalUnits = 0;
    for (let i = 0; i < productIds.length; i++) {
      const volume_ml = volumes[i].volume_ml || 0;
      const addUnits = Math.floor((addedMl * (volume_ml / totalUnitVolume)) / volume_ml);

      if (addUnits > 0) {
        await fetch(`${BASE_URL}/api/inventory/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: productIds[i], stock_quantity: addUnits })
        });
        addedTotalUnits += addUnits;
      }
    }

    const messageEl = document.getElementById(`${type}InventoryMessage`);
    if (messageEl) {
      messageEl.textContent = `${honeyType} inventory updated. Units added: ${addedTotalUnits}`;
    }

    quantityInput.value = "";
    await updateInventoryDisplay(type);
  } catch (error) {
    console.error("Inventory update error:", error);
    alert("Failed to update inventory.");
  }
}

function normalizeKenyanPhoneNumber(number) {
  number = number.trim().replace(/[\s-\(\)]/g, '');
  if (/^\+2547\d{8}$/.test(number)) return number;
  if (/^07\d{8}$/.test(number)) return '+254' + number.slice(1);
  if (/^01\d{8}$/.test(number)) return '+254' + number.slice(1);
  if (/^7\d{8}$/.test(number)) return '+254' + number;
  return null;
}

function getLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 19).replace('T', ' ');
}

async function fetchInventory() {
  await Promise.all(["raw", "processed", "herbal"].map(updateInventoryDisplay));
}

async function fetchCustomerIdIfMissing() {
  const email = localStorage.getItem('loggedInUserEmail');
  if (!currentCustomerId && email) {
    try {
      const res = await fetch(`${BASE_URL}/api/customers?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.length > 0) {
        const customer = data[0];
        currentCustomerId = customer.customer_id;
        localStorage.setItem('loggedInUserId', currentCustomerId);

        const nameInput = document.getElementById('customerName');
        const phoneInput = document.getElementById('contactNumber');

        if (nameInput) nameInput.value = customer.name || '';
        if (phoneInput) phoneInput.value = customer.contact_number || '';
      } else {
        console.warn("No customer found with email:", email);
      }
    } catch (err) {
      console.error("Failed to load customer ID:", err);
    }
  }
}

async function addSale() {
  await fetchCustomerIdIfMissing();
  await fetchInventory();

  const type = document.getElementById('honeyType').value;
  const numberQuantity = parseInt(document.getElementById('numberQuantity').value);
  const volumeQuantity = parseInt(document.getElementById('saleQuantity').value);
  const customerName = document.getElementById('customerName').value.trim();
  const contactInput = document.getElementById('contactNumber').value;
  const county = document.getElementById('county')?.value?.trim() || '';

  if (!customerName || !contactInput || !county || !numberQuantity || !volumeQuantity) {
    return alert('Please fill all fields.');
  }

  const contactNumber = normalizeKenyanPhoneNumber(contactInput);
  if (!contactNumber) return alert('Invalid phone number.');
  if (!currentCustomerId) return alert("Customer ID not loaded.");

  const totalMl = numberQuantity * volumeQuantity;
  if (totalMl > stock[type]) {
    return alert(`Insufficient stock. Available: ${stock[type]} ml`);
  }

  const totalPrice = totalMl * honeyPricePerMl;
  const now = getLocalDateTime();

  const saleData = {
    customerName,
    contactNumber,
    county,
    number_quantity: numberQuantity,
    volume_quantity: volumeQuantity,
    totalPrice,
    date: now,
    customer_id: currentCustomerId,
    honey_type: type
  };

  try {
    const response = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message);

    stock[type] -= totalMl;
    const inventoryDisplay = document.getElementById(`${type}InventoryDisplay`);
    if (inventoryDisplay) {
      inventoryDisplay.textContent = stock[type] + ' ml';
    }

    document.getElementById('receiptDetails').innerHTML = `
      <strong>Receipt No:</strong> ${result.receiptNumber || 'N/A'}<br>
      <strong>Date:</strong> ${now}<br>
      <strong>Customer Name:</strong> ${customerName}<br>
      <strong>Contact Number:</strong> ${contactNumber}<br>
      <strong>County:</strong> ${county}<br>
      <strong>Honey Type:</strong> ${type} Honey<br>
      <strong>Number of Jars:</strong> ${numberQuantity}<br>
      <strong>Volume per Jar:</strong> ${volumeQuantity} ml<br>
      <strong>Total Volume:</strong> ${totalMl} ml<br>
      <strong>Total Price:</strong> Ksh ${totalPrice.toFixed(2)}
    `;
    document.getElementById('receipt').style.display = 'block';

    document.getElementById('numberQuantity').value = '';
    document.getElementById('saleQuantity').value = '';
    document.getElementById('county').value = '';
  } catch (err) {
    alert('Could not save sale: ' + err.message);
    console.error(err);
  }
}

function printReceipt() {
  const content = document.getElementById('receipt').innerHTML;
  const original = document.body.innerHTML;
  document.body.innerHTML = content;
  window.print();
  document.body.innerHTML = original;
  location.reload();
}

function logoutAdmin() {
  alert('✅Admin Logging out...');
  localStorage.removeItem("loggedInUserEmail");
  localStorage.removeItem("loggedInUserId");
  localStorage.removeItem("loggedInUserRole");
  localStorage.removeItem("ukulimaCart");
  window.location.href = "SignIn.html";
}

function fetchCustomers() {
  fetch(`${BASE_URL}/api/customers`)
    .then(response => response.json())
    .then(customers => {
      const customerList = document.getElementById('customerList');
      customerList.innerHTML = '';

      customers.forEach(c => {
        const tr = document.createElement('tr');
        const statusBadge = c.status === 'Active'
          ? `<span class="badge bg-success">${c.status}</span>`
          : `<span class="badge bg-secondary">${c.status}</span>`;

        tr.innerHTML = `
          <td>${c.name}</td>
          <td>${c.email}</td>
          <td>${c.role}</td>
          <td>${statusBadge}</td>
          <td>${c.last_active ? new Date(c.last_active).toLocaleString() : 'Never'}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.customer_id})">
              <i class="fa fa-trash"></i> Delete
            </button>
          </td>
        `;
        customerList.appendChild(tr);
      });
    })
    .catch(err => console.error('Error loading customers:', err));
}

async function deleteCustomer(id) {
  if (!confirm("Are you sure you want to delete this customer?")) return;

  try {
    const res = await fetch(`${BASE_URL}/api/customers/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (res.ok) {
      alert(data.message);
      fetchCustomers();
    } else {
      alert(data.message || "Failed to delete customer.");
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert("Error deleting customer.");
  }
}
//Remark like and delete
async function loadRemarks() {
  try {
    const res = await fetch('/api/remarks');
    const remarks = await res.json();
    const list = document.getElementById('remarksList');
    list.innerHTML = '';

    if (remarks.length === 0) {
      list.innerHTML = '<li>No remarks yet.</li>';
      return;
    }

    remarks.forEach(r => {
      const li = document.createElement('li');
      li.style.padding = '10px 0';
      li.innerHTML = `<strong>${r.customer_email}</strong>: ${r.remark} <br><small style="color: gray;">${new Date(r.created_at).toLocaleString()}</small>`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load remarks:', err);
  }
}
document.addEventListener('DOMContentLoaded', loadRemarks);
async function likeRemark(id) {
  try {
    const res = await fetch(`/api/remarks/like/${id}`, {
      method: 'POST'
    });

    const data = await res.json(); // ✅ now this works
    if (res.ok) {
      alert(data.message);
      loadRemarks();
    } else {
      alert(data.error || 'Failed to like remark');
    }
  } catch (err) {
    console.error('Like error:', err);
    alert('Error liking remark');
  }
}

//delete remark
async function deleteRemark(id) {
  if (!confirm("Are you sure you want to delete this remark?")) return;

  try {
    const res = await fetch(`/api/remarks/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      loadRemarks();
    } else {
      alert(data.error || 'Failed to delete remark');
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('Error deleting remark');
  }
}
//Finally load Remarks
async function loadRemarks() {
  try {
    const res = await fetch('/api/remarks');
    const remarks = await res.json();
    const list = document.getElementById('remarksList');
    list.innerHTML = '';

    if (remarks.length === 0) {
      list.innerHTML = '<li>No remarks yet.</li>';
      return;
    }

    remarks.forEach(r => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${r.customer_email}</strong>: ${r.remark}
        <br><small style="color: gray;">${new Date(r.created_at).toLocaleString()}</small>
        <br>
        <button class="btn btn-sm btn-outline-success me-2" onclick="likeRemark(${r.id})" ${r.liked ? 'disabled' : ''}>
          ${r.liked ? 'Liked' : 'Like'}
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteRemark(${r.id})" ${r.liked ? '' : 'disabled'}>
          Delete
        </button>
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load remarks:', err);
  }
}
async function fetchPendingOrders() {
  try {
    const res = await fetch(`${BASE_URL}/api/pending-orders`);
    const orders = await res.json();
    const container = document.getElementById("pendingOrdersList");
    container.innerHTML = "";

    if (!orders.length) {
      container.innerHTML = "<p class='text-muted'>No pending orders found.</p>";
      return;
    }

    orders.forEach(order => {
      const col = document.createElement("div");
      col.className = "col-md-6 mb-3";

      const createdAt = new Date(order.created_at);
      const expiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const remainingTime = expiresAt - now;
      const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);

      const countdown = remainingTime > 0
        ? `${days}d ${hours}h ${minutes}m left`
        : `<span class="text-danger">Expired</span>`;

      col.innerHTML = `
        <div class="card border-warning shadow-sm">
          <div class="card-body">
            <h5 class="card-title">${order.name}</h5>
            <p class="card-text">
              <strong>Phone:</strong> ${order.phone}<br>
              <strong>County:</strong> ${order.county}<br>
              <strong>Type:</strong> ${order.type}<br>
              <strong>Jars:</strong> ${order.quantity}<br>
              <strong>Volume/Jar:</strong> ${order.volume}ml<br>
              <strong>Total Volume:</strong> ${order.total_volume}ml<br>
              <strong>Total Price:</strong> Ksh ${Number(order.total_price).toFixed(2)}<br>
              <strong>Created At:</strong> ${new Date(order.created_at).toLocaleString()}<br>
              <strong>⏳ Countdown:</strong> ${countdown}
            </p>
            <button class="btn btn-sm btn-outline-primary me-2" onclick='autofillPendingOrder(${JSON.stringify(order)})'>
              Autofill
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick='deletePendingOrder(${order.id})'>
              Delete
            </button>
          </div>
        </div>
      `;
      container.appendChild(col);
    });
  } catch (err) {
    console.error("Failed to load pending orders:", err);
  }
}

function autofillPendingOrder(order) {
  document.getElementById("customerName").value = order.name;
  document.getElementById("contactNumber").value = order.phone;
  document.getElementById("county").value = order.county;
  document.getElementById("honeyType").value = order.type;
  document.getElementById("numberQuantity").value = order.quantity;
  document.getElementById("saleQuantity").value = order.volume;

  // Optionally scroll to sales form
  window.scrollTo({ top: 500, behavior: 'smooth' });

  // Delete it after autofill
  deletePendingOrder(order.id, true);
}

async function deletePendingOrder(id, silent = false) {
  try {
    const res = await fetch(`${BASE_URL}/api/pending-orders/${id}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (res.ok) {
      if (!silent) alert("Pending order deleted.");
      fetchPendingOrders(); // refresh list
    } else {
      alert(data.error || "Failed to delete order.");
    }
  } catch (err) {
    console.error("Error deleting order:", err);
    alert("Could not delete pending order.");
  }
}