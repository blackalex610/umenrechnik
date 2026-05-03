import { supabase } from './supabaseClient.js';

export async function saveQuizResultRemote({ quiz_type, score, total_questions, words_count, details = {} }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('progress')
    .insert({
      user_id: userData.user.id,
      quiz_type,
      score,
      total_questions,
      words_count,
      details
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchQuizHistory(limit = 10) {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
