import { supabase } from './supabaseClient.js';

export async function invokeAiChat(message, words = []) {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      type: 'chat',
      payload: { message, words }
    }
  });

  if (error) throw error;
  return data;
}

export async function invokeAiWrongAnswers(word, definition, partOfSpeech) {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      type: 'generate-wrong-answers',
      payload: { word, definition, partOfSpeech }
    }
  });

  if (error) throw error;
  return data;
}
