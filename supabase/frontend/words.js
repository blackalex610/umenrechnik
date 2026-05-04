import { supabase } from './supabaseClient.js';

const FREE_WORD_LIMIT = 300;

function makeWordLimitError(limit = FREE_WORD_LIMIT) {
  const err = new Error(`FREE_WORD_LIMIT_REACHED: Free users can store up to ${limit} words. Upgrade to Premium for unlimited words.`);
  err.code = 'FREE_WORD_LIMIT_REACHED';
  err.limit = limit;
  return err;
}

export async function getWordLimitStatus() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Not authenticated');

  const userId = userData.user.id;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;

  const tier = profile?.tier || 'free';
  if (tier === 'premium') {
    return {
      tier,
      currentCount: null,
      limit: null,
      canAdd: true
    };
  }

  const { count, error: countError } = await supabase
    .from('words')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countError) throw countError;

  const currentCount = Number(count || 0);
  const limit = FREE_WORD_LIMIT;
  return {
    tier,
    currentCount,
    limit,
    canAdd: currentCount < limit
  };
}

export async function fetchWords() {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addWord({ word, definition, part_of_speech, folder = null, source = 'manual' }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Not authenticated');

  const limitStatus = await getWordLimitStatus();
  if (!limitStatus.canAdd) {
    throw makeWordLimitError(limitStatus.limit || FREE_WORD_LIMIT);
  }

  const payload = {
    user_id: userData.user.id,
    word,
    definition,
    part_of_speech,
    folder,
    source
  };

  const { data, error } = await supabase
    .from('words')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    const msg = String(error?.message || '');
    if (msg.includes('FREE_WORD_LIMIT_REACHED')) {
      throw makeWordLimitError(FREE_WORD_LIMIT);
    }
    throw error;
  }
  return data;
}

export async function updateWord(id, updates) {
  const { data, error } = await supabase
    .from('words')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWord(id) {
  const { error } = await supabase
    .from('words')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
