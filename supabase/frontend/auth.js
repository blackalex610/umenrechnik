import { supabase } from './supabaseClient.js';

export async function signInWithGoogle() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const redirectTo = isLocal
    ? `${window.location.origin}/app.html`
    : 'https://umenrechnik.vercel.app/app.html';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  });
  if (error) throw error;

  if (!data?.url) {
    throw new Error('OAuth URL missing from Supabase response');
  }
  window.location.assign(data.url);
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    // AuthSessionMissingError is expected when no user is logged in — not a real error
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('session')) return null;
    throw error;
  }
  return data.user;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null, session);
  });
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
