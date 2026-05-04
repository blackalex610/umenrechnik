import { supabase } from './supabaseClient.js';
import { signInWithGoogle, getCurrentUser, onAuthStateChange, signOutUser } from './auth.js';
import { fetchWords, addWord, updateWord, deleteWord } from './words.js';
import { saveQuizResultRemote, fetchQuizHistory } from './progress.js';
import { upsertCurrentUserProfile } from './profiles.js';

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

async function init() {
  // When the URL contains OAuth callback params (PKCE code exchange), Supabase handles
  // the exchange asynchronously. Calling getUser() before the exchange completes returns
  // null, so we wait for the first SIGNED_IN / INITIAL_SESSION auth state event instead.
  const hasOAuthParams =
    window.location.hash.includes('access_token') ||
    /[?&](code|access_token)=/.test(window.location.search);

  let user;
  if (hasOAuthParams) {
    // Strategy: SIGNED_IN / INITIAL_SESSION may fire before OR after we register the
    // listener (race with the Supabase client's async _initialize). Cover both cases:
    //   1. Register the event listener immediately so we catch future events.
    //   2. Simultaneously poll supabase.auth.getSession() — once the client finishes
    //      processing hash tokens it stores them in localStorage and getSession() returns
    //      the session even if we missed the event entirely.
    //   Whichever resolves first wins.
    let _sub;
    const eventPromise = new Promise((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session?.user)) {
          subscription.unsubscribe();
          resolve(session?.user ?? null);
        }
      });
      _sub = subscription;
    });

    const pollPromise = (async () => {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 300));
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) return data.session.user;
      }
      return null;
    })();

    user = await Promise.race([eventPromise, pollPromise]);
    // Clean up the event subscription if polling won the race.
    if (_sub) { try { _sub.unsubscribe(); } catch (_) {} }
    if (!user) user = await getCurrentUser();
  } else {
    user = await getCurrentUser();
  }

  if (user) {
    try {
      await upsertCurrentUserProfile(user);
    } catch (e) {
      console.warn('Profile upsert failed during init:', e);
    }
  }
  setSessionMirror(user);
  onAuthStateChange(async (nextUser) => {
    if (nextUser) {
      try {
        await upsertCurrentUserProfile(nextUser);
      } catch (e) {
        console.warn('Profile upsert failed on auth change:', e);
      }
    }
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
