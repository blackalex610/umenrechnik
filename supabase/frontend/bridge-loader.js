window.supabaseBridgeReady = window.supabaseBridgeReady || import('./bridge.js').then(() => window.supabaseBridge).catch((err) => {
  console.error('Failed to load Supabase bridge module:', err);
  return null;
});
