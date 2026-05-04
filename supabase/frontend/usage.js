import { supabase } from './supabaseClient.js';

export async function getTodayUsage() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .rpc('get_today_ai_usage', { p_user_id: userData.user.id });

  if (error) throw error;
  if (!data || data.length === 0) {
    return {
      used: 0,
      limit: 10,
      tier: 'free',
      isUnlimited: false
    };
  }

  const row = data[0] || {};
  const isUnlimited = Boolean(row.is_unlimited);

  return {
    used: Number(row.used ?? 0),
    limit: isUnlimited ? null : Number(row.limit_value ?? 10),
    tier: row.tier || (isUnlimited ? 'premium' : 'free'),
    isUnlimited
  };
}
