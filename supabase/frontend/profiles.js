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
