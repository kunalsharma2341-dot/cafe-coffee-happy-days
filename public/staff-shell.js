(async () => {
  try {
    const response = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' });
    const me = await response.json();
    if (!response.ok) throw Error(me.error || 'Unable to check access.');
    if (!me.staff) {
      location.replace('/staff-login.html');
      return;
    }
    document.getElementById('staff-loading').hidden = true;
    document.getElementById('staff-app').hidden = false;
    const script = document.createElement('script');
    script.src = '/ordering.js';
    document.body.append(script);
    document.getElementById('staff-logout').addEventListener('click', async () => {
      const response = await fetch('/api/staff/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (response.ok) location.replace('/staff-login.html');
      else document.getElementById('updated').textContent = 'Sign out failed. Please retry.';
    });
  } catch (err) {
    document.getElementById('staff-loading').textContent = err.message;
  }
})();
