// Example replacements for script.js logic
// Import these in places where local/session storage logic currently exists.

import { signInWithGoogle, getCurrentUser, signOutUser } from './auth.js';
import { fetchWords, addWord, updateWord, deleteWord } from './words.js';
import { saveQuizResultRemote, fetchQuizHistory } from './progress.js';
import { getTodayUsage } from './usage.js';
import { invokeAiChat } from './ai.js';

// 1) Sign in button replacement (index.html)
export async function onGoogleSignInClick() {
  await signInWithGoogle();
}

// 2) Replace loadUserDictionary()
export async function loadUserDictionaryFromDb(setWords, updateWordList) {
  const user = await getCurrentUser();
  if (!user) throw new Error('No authenticated user');

  const dbWords = await fetchWords();
  const normalized = dbWords.map((w) => ({
    id: w.id,
    word: w.word,
    definition: w.definition,
    partOfSpeech: w.part_of_speech,
    folder: w.folder,
    timestamp: new Date(w.created_at).getTime()
  }));

  setWords(normalized);
  updateWordList();
}

// 3) Replace add-word flow
export async function addWordToDb(wordObj, setWords, updateWordList) {
  const inserted = await addWord({
    word: wordObj.word,
    definition: wordObj.definition,
    part_of_speech: wordObj.partOfSpeech,
    folder: wordObj.folder ?? null,
    source: 'manual'
  });

  setWords((prev) => [
    {
      id: inserted.id,
      word: inserted.word,
      definition: inserted.definition,
      partOfSpeech: inserted.part_of_speech,
      folder: inserted.folder,
      timestamp: new Date(inserted.created_at).getTime()
    },
    ...prev
  ]);

  updateWordList();
}

// 4) Replace delete flow
export async function deleteWordInDb(wordId, setWords, updateWordList) {
  await deleteWord(wordId);
  setWords((prev) => prev.filter((w) => w.id !== wordId));
  updateWordList();
}

// 5) Replace quiz history save/load
export async function saveQuizResultDb(score, totalQuestions, selectedWords, quizType = 'multiple') {
  await saveQuizResultRemote({
    quiz_type: quizType,
    score,
    total_questions: totalQuestions,
    words_count: selectedWords.length,
    details: {
      word_ids: selectedWords.map((w) => w.id).filter(Boolean)
    }
  });
}

export async function getQuizHistoryDb(limit = 10) {
  return fetchQuizHistory(limit);
}

// 6) Replace chat API calls
export async function askAi(message, words) {
  const usage = await getTodayUsage();
  if (usage.used >= usage.limit) {
    throw new Error('Daily AI limit reached. Please try again tomorrow.');
  }

  return invokeAiChat(message, words);
}

// 7) Replace signOut()
export async function signOutAndRedirect() {
  await signOutUser();
  window.location.href = 'index.html';
}
