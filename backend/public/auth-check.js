(function () {
  const TAB_SESSION_KEY = 'doubley_tab_auth';

  if (window.location.pathname.endsWith('/login.html')) return;

  if (!sessionStorage.getItem(TAB_SESSION_KEY)) {
    fetch('/api/auth/logout', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        window.location.replace('/login.html');
      });
    return;
  }

  fetch('/api/auth/check')
    .then((res) => res.json())
    .then((data) => {
      if (!data.authenticated) {
        sessionStorage.removeItem(TAB_SESSION_KEY);
        window.location.replace('/login.html');
      }
    })
    .catch(() => {
      sessionStorage.removeItem(TAB_SESSION_KEY);
      window.location.replace('/login.html');
    });
})();
