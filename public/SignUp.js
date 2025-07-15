document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const response = await fetch("http://localhost:3000/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "Customer" })
    });

    const data = await response.json();

    if (response.ok) {
      alert("✅Registration successful! Please log in.");
      window.location.href = "SignIn.html";
    } else {
      alert(data.message || "Registration failed.");
    }
  } catch (err) {
    console.error("Signup error:", err);
    alert("Error connecting to server.");
  }
});

// 🔐 Show/hide password toggle with eye icon
document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("password");
  const toggleIcon = document.getElementById("toggleSignUpPasswordIcon");

  if (!passwordInput || !toggleIcon) return;

  toggleIcon.addEventListener("click", function () {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleIcon.classList.toggle("fa-eye");
    toggleIcon.classList.toggle("fa-eye-slash");
  });
});
