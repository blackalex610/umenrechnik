import { supabase } from './supabaseClient.js';

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/app.html`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) throw error;
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
