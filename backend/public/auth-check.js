(function () {
  const TAB_SESSION_KEY = 'doubley_tab_auth';

  if (window.location.pathname.endsWith('/login.html')) return;

  function goLogin() {
    sessionStorage.removeItem(TAB_SESSION_KEY);
    window.location.replace('/login.html');
  }

  function markTabAuthenticated() {
    sessionStorage.setItem(TAB_SESSION_KEY, '1');
  }

  function checkCookieSession() {
    return fetch('/api/auth/check')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.authenticated) {
          markTabAuthenticated();
          return true;
        }
        goLogin();
        return false;
      })
      .catch(() => {
        goLogin();
        return false;
      });
  }

  // New tabs (target=_blank) do not share sessionStorage. Recover from cookie
  // instead of logging the user out of every open tab.
  if (!sessionStorage.getItem(TAB_SESSION_KEY)) {
    checkCookieSession();
    return;
  }

  checkCookieSession();
})();
