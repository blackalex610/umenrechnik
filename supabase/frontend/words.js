import { supabase } from './supabaseClient.js';

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

  if (error) throw error;
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
