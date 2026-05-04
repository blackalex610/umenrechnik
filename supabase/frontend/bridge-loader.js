window.supabaseBridgeReady = window.supabaseBridgeReady || import('./bridge.js')
  .then(() => {
    // bridge.js sets window.supabaseBridgeReady = init().then(...) during module execution.
    // Chain onto that promise so we properly wait for init() to complete.
    if (window.supabaseBridgeReady && typeof window.supabaseBridgeReady.then === 'function') {
      return window.supabaseBridgeReady;
    }
    return window.supabaseBridge || null;
  })
  .catch((err) => {
    console.error('Failed to load Supabase bridge module:', err);
    return null;
  });
