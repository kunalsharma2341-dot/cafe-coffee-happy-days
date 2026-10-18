document.getElementById('staff-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = document.getElementById('login-submit'),
    feedback = document.getElementById('login-feedback');
  button.disabled = true;
  feedback.textContent = 'Signing in…';
  try {
    const response = await fetch('/api/staff/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('staff-password').value }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Sign-in failed.');
    document.getElementById('staff-password').value = '';
    location.replace('/staff');
  } catch (err) {
    feedback.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
