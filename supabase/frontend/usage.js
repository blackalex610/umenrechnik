import { supabase } from './supabaseClient.js';

export async function getTodayUsage() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .rpc('get_today_ai_usage', { p_user_id: userData.user.id });

  if (error) throw error;
  if (!data || data.length === 0) {
    return { used: 0, limit: 50 };
  }

  return {
    used: Number(data[0].used ?? 0),
    limit: Number(data[0].limit_value ?? 50)
  };
}
