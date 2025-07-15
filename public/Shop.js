// Shop.js

const BASE_URL = "http://localhost:3000"; // You can change this for production

// Store selected items in this array
const cart = [];

// Add item to cart
function addToCart(type, volume, price, qtyId) {
  const qtyInput = document.getElementById(qtyId);
  const quantity = parseInt(qtyInput.value);

  if (!quantity || quantity <= 0) {
    alert("❌ Please enter a valid quantity.");
    return;
  }

  // Check for existing item (same type & volume)
  const existingItem = cart.find(item => item.type === type && item.volume === volume);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ type, volume, price, quantity });
  }

  alert(`✅ Added ${quantity} x ${volume}ml of ${type} to cart.`);
  qtyInput.value = '';
}

// Proceed to checkout
function proceedToCheckout() {
  if (cart.length === 0) {
    alert("❌ Your cart is empty.");
    return;
  }

  localStorage.setItem('ukulimaCart', JSON.stringify(cart));
  alert("🛒 Proceeding to checkout...");
  window.location.href = "Reference.html";
}

// Logout
function logout() {
  localStorage.clear();
  alert("✅ You have been logged out...");
  window.location.href = "SignIn.html";
}

// Attach to window
window.addToCart = addToCart;
window.proceedToCheckout = proceedToCheckout;
window.logout = logout;
window.submitRemark = submitRemark;

// Submit Remark
async function submitRemark() {
  const remarkText = document.getElementById('customerRemark').value.trim();
  const email = localStorage.getItem('loggedInUserEmail');

  if (!remarkText) {
    alert("❌ Please enter a remark before submitting.");
    return;
  }

  if (!email) {
    alert("❌ Unable to find logged-in user. Please log in again.");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/remarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_email: email, remark: remarkText })
    });

    // Check if the response is not HTML (error page)
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      console.error('Non-JSON response:', text);
      throw new Error("Server returned an unexpected response.");
    }

    const data = await res.json();

    if (res.ok) {
      alert('✅ Thank you! Your remark was submitted.');
      document.getElementById('customerRemark').value = '';
    } else {
      alert(`❌ Error: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('Remark submission failed:', err);
    alert('❌ Something went wrong submitting your remark.');
  }
}

// Set the order creation timestamp (replace this with actual order timestamp from backend)

  
