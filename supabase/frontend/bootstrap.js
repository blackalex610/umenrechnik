import { getCurrentUser, onAuthStateChange } from './auth.js';

async function initAuthGuards() {
  const isAppPage = window.location.pathname.endsWith('/app.html') || window.location.pathname.endsWith('app.html');
  const isIndexPage = window.location.pathname.endsWith('/index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('index.html');

  let user = null;
  try {
    user = await getCurrentUser();
  } catch (_e) {
    user = null;
  }

  if (isAppPage && !user) {
    window.location.href = 'index.html';
    return;
  }

  onAuthStateChange((nextUser) => {
    if (isAppPage && !nextUser) {
      window.location.href = 'index.html';
    }
    if (isIndexPage && nextUser) {
      const cta = document.getElementById('landing-cta');
      if (cta) {
        const note = document.getElementById('guest-note');
        if (note) {
          note.textContent = 'Влезли сте със Supabase. Можете да отворите приложението.';
        }
      }
    }
  });
}

void initAuthGuards();
