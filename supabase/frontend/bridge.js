import { supabase } from './supabaseClient.js';
import { signInWithGoogle, getCurrentUser, onAuthStateChange, signOutUser } from './auth.js';
import { fetchWords, addWord, updateWord, deleteWord } from './words.js';
import { saveQuizResultRemote, fetchQuizHistory } from './progress.js';
import { upsertCurrentUserProfile } from './profiles.js';
import { getTodayUsage } from './usage.js';

function toLegacyUser(user) {
  if (!user) return null;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'User';
  return {
    sub: user.id,
    name: fullName,
    email: user.email || null,
    picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
  };
}

function setSessionMirror(user) {
  const legacyUser = toLegacyUser(user);
  if (legacyUser) {
    // Authenticated user must never remain in guest mode.
    localStorage.removeItem('isGuest');
    sessionStorage.setItem('user', JSON.stringify(legacyUser));
  } else {
    sessionStorage.removeItem('user');
  }
  // Notify the main script to re-render the auth UI (avatar, name, etc.)
  window.dispatchEvent(new CustomEvent('supabaseAuthMirror', { detail: legacyUser }));
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeUpsertProfile(user, source) {
  if (!user) return;
  try {
    // Never block auth/UI on profile writes.
    await Promise.race([
      upsertCurrentUserProfile(user),
      sleep(4000)
    ]);
  } catch (e) {
    console.warn(`Profile upsert failed (${source}):`, e);
  }
}

async function resolveInitialUser() {
  const hasOAuthParams =
    window.location.hash.includes('access_token') ||
    /[?&](code|access_token)=/.test(window.location.search);

  // Fast path: if Supabase already restored session from storage, use it.
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) return data.session.user;
  } catch (e) {
    console.warn('getSession failed during init:', e);
  }

  if (!hasOAuthParams) {
    try {
      return await getCurrentUser();
    } catch {
      return null;
    }
  }

  // OAuth callback may complete before or after listeners are attached.
  let sub = null;
  const eventPromise = new Promise((resolve) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session?.user)) {
        resolve(session?.user ?? null);
      }
    });
    sub = subscription;
  });

  const pollPromise = (async () => {
    for (let i = 0; i < 30; i += 1) {
      await sleep(300);
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) return data.session.user;
      } catch {
        // Keep polling on transient failures.
      }
    }
    return null;
  })();

  const user = await Promise.race([eventPromise, pollPromise, sleep(10000).then(() => null)]);
  if (sub) {
    try { sub.unsubscribe(); } catch (_) {}
  }

  if (user) return user;
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

function createBridgeApi() {
  return {
    getCurrentUser: async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) return toLegacyUser(data.session.user);
      } catch {
        // Fall back to getUser call below.
      }
      return toLegacyUser(await getCurrentUser());
    },
    signInWithGoogle,
    signOutUser,
    fetchWordsLegacy: async () => (await fetchWords()).map(normalizeWord),
    syncWords,
    saveQuizResult: async ({ score, totalQuestions, selectedWords, quizType = 'multiple' }) =>
      saveQuizResultRemote({
        quiz_type: quizType,
        score,
        total_questions: totalQuestions,
        words_count: Array.isArray(selectedWords) ? selectedWords.length : 0,
        details: {
          word_ids: Array.isArray(selectedWords)
            ? selectedWords.map((w) => w?.id).filter(Boolean)
            : []
        }
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
    structureWords,
    getTodayUsage
  };
}

async function init() {
  const api = createBridgeApi();

  // Register continuous auth sync immediately.
  onAuthStateChange((nextUser) => {
    setSessionMirror(nextUser);
    void safeUpsertProfile(nextUser, 'auth change');
  });

  // Hydrate initial auth state in the background so bridge startup cannot hang.
  void resolveInitialUser()
    .then((user) => {
      setSessionMirror(user);
      void safeUpsertProfile(user, 'init');
    })
    .catch((e) => {
      console.warn('Initial auth hydration failed:', e);
      setSessionMirror(null);
    });

  return api;
}

window.supabaseBridgeReady = init().then((api) => {
  window.supabaseBridge = api;
  return api;
}).catch((err) => {
  console.error('Supabase bridge init failed:', err);
  return null;
});
