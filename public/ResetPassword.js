const resetButton = document.querySelector('button');
const emailInput = document.querySelector('input[type="email"]');

resetButton.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    alert('Please enter your email.');
    return;
  }

  try {
    const response = await fetch('/api/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (response.ok) {
      alert('✅ Reset link sent! Check your email.');
    } else {
      alert(`❌ ${data.message}`);
    }
  } catch (error) {
    console.error(error);
    alert('❌ Something went wrong.');
  }
});
