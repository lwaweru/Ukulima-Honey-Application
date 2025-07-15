// Handle login form submission
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get values from form inputs
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value.trim();
  const rememberMe = document.getElementById("rememberMe").checked;

  // Basic validation
  if (!email || !password || !role) {
    alert("Please fill in all fields including the role.");
    return;
  }

  try {
    // Send login request to backend
    const response = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password, role }) // Now includes role
    });

    const data = await response.json();

    if (response.ok && data.user) {
      const { email: userEmail, role, customer_id } = data.user;

      // Store user data in localStorage
      localStorage.setItem("loggedInUserEmail", userEmail);
      localStorage.setItem("loggedInUserRole", role);
      localStorage.setItem("loggedInUserId", customer_id);

      console.log("✅ Logged in as:", role);

      // Remember Me: store or clear remembered email
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      // Redirect based on role
      if (role === "Customer") {
        window.location.href = "Shop.html";
      } else if (role === "Admin") {
        window.location.href = "Admin.html";
      } else if (role === "Cashier") {
  window.location.href = "CashierDashboard.html"; // ✅ New redirect
      } else {
        alert("❌ Unknown role: " + role);
      }
    } else {
      alert(data.message || "Login failed. Please check your credentials and role.");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("Error connecting to the server. Please try again later.");
  }
});

// Toggle password visibility with eye icon
document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("password");
  const togglePasswordIcon = document.getElementById("togglePasswordIcon");

  if (passwordInput && togglePasswordIcon) {
    togglePasswordIcon.addEventListener("click", function () {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);

      // Toggle icon style
      this.classList.toggle("fa-eye");
      this.classList.toggle("fa-eye-slash");
    });
  }
});

// Load remembered email on page load
document.addEventListener("DOMContentLoaded", function () {
  const rememberedEmail = localStorage.getItem("rememberedEmail");
  if (rememberedEmail) {
    document.getElementById("email").value = rememberedEmail;
    document.getElementById("rememberMe").checked = true;
  }
});
