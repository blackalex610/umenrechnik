import { supabase } from './supabaseClient.js';
import { signInWithGoogle, getCurrentUser, onAuthStateChange, signOutUser } from './auth.js';
import { fetchWords, addWord, updateWord, deleteWord } from './words.js';
import { saveQuizResultRemote, fetchQuizHistory } from './progress.js';

function toLegacyUser(user) {
  if (!user) return null;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'User';
  return {
    sub: user.id,
    name: fullName,
    email: user.email || null,
    picture: user.user_metadata?.avatar_url || null
  };
}

function setSessionMirror(user) {
  const legacyUser = toLegacyUser(user);
  if (legacyUser) {
    sessionStorage.setItem('user', JSON.stringify(legacyUser));
  } else {
    sessionStorage.removeItem('user');
  }
}

function normalizeWord(row) {
  return {
    id: row.id,
    word: row.word,
    definition: row.definition,
    partOfSpeech: row.part_of_speech,
    folder: row.folder,
    timestamp: new Date(row.created_at).getTime()
  };
}

async function syncWords(localWords) {
  const remote = await fetchWords();
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const remoteByKey = new Map(remote.map((r) => [`${r.word.toLowerCase()}::${r.part_of_speech}`, r]));

  const localIds = new Set();
  const localKeys = new Set();

  for (const item of localWords) {
    const key = `${String(item.word || '').toLowerCase()}::${item.partOfSpeech}`;
    localKeys.add(key);

    const payload = {
      word: item.word,
      definition: item.definition,
      part_of_speech: item.partOfSpeech,
      folder: item.folder || null,
      source: 'manual'
    };

    if (item.id && remoteById.has(item.id)) {
      localIds.add(item.id);
      await updateWord(item.id, payload);
      continue;
    }

    const remoteMatch = remoteByKey.get(key);
    if (remoteMatch) {
      localIds.add(remoteMatch.id);
      await updateWord(remoteMatch.id, payload);
      item.id = remoteMatch.id;
    } else {
      const inserted = await addWord(payload);
      item.id = inserted.id;
      localIds.add(inserted.id);
    }
  }

  for (const row of remote) {
    const key = `${row.word.toLowerCase()}::${row.part_of_speech}`;
    if (!localIds.has(row.id) && !localKeys.has(key)) {
      await deleteWord(row.id);
    }
  }

  return true;
}

async function invokeAi(type, payload) {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { type, payload }
  });
  if (error) throw error;
  return data;
}

async function structureWords(rawText) {
  const data = await invokeAi('structure-words', { raw_text: rawText });
  return data?.content || '';
}

async function init() {
  const user = await getCurrentUser();
  setSessionMirror(user);
  onAuthStateChange((nextUser) => {
    setSessionMirror(nextUser);
  });

  return {
    getCurrentUser: async () => toLegacyUser(await getCurrentUser()),
    signInWithGoogle,
    signOutUser,
    fetchWordsLegacy: async () => (await fetchWords()).map(normalizeWord),
    syncWords,
    saveQuizResult: async ({ score, totalQuestions, selectedWords, quizType = 'multiple' }) =>
      saveQuizResultRemote({
        quiz_type: quizType,
        score,
        total_questions: totalQuestions,
        words_count: selectedWords.length,
        details: { word_ids: selectedWords.map((w) => w.id).filter(Boolean) }
      }),
    fetchQuizHistory: async (limit = 10) => {
      const rows = await fetchQuizHistory(limit);
      return rows.map((r) => ({
        date: r.created_at,
        score: r.score,
        totalQuestions: r.total_questions,
        percentage: Math.round(Number(r.percentage || 0)),
        wordsCount: r.words_count
      }));
    },
    invokeAi,
    structureWords
  };
}

window.supabaseBridgeReady = init().then((api) => {
  window.supabaseBridge = api;
  return api;
}).catch((err) => {
  console.error('Supabase bridge init failed:', err);
  return null;
});
