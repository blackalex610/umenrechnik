import { supabase } from './supabaseClient.js';

function profilePayloadFromUser(user) {
  const meta = user?.user_metadata || {};
  return {
    user_id: user.id,
    display_name: meta.full_name || meta.name || user.email || 'User',
    avatar_url: meta.avatar_url || meta.picture || null
  };
}

export async function upsertCurrentUserProfile(userOverride = null) {
  const user = userOverride || (await supabase.auth.getUser()).data.user;
  if (!user) return null;

  const payload = profilePayloadFromUser(user);
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getCurrentUserProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const user = authData?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, tier, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (data) return data;

  // Profile row might not exist yet for older users. Ensure it exists and defaults to free tier.
  return upsertCurrentUserProfile(user);
}

export async function getCurrentUserTier() {
  const profile = await getCurrentUserProfile();
  return profile?.tier || 'free';
}
