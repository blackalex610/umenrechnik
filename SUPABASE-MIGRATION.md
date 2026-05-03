# Supabase Migration Plan (No Frameworks)

This document migrates your current LocalStorage/SessionStorage app to Supabase.
It is tailored to your current structure (`index.html`, `app.html`, `script.js`).

## What was added to this repo
- DB schema: `supabase/schema.sql`
- RLS policies: `supabase/rls.sql`
- Frontend modules:
  - `supabase/frontend/supabaseClient.js`
  - `supabase/frontend/auth.js`
  - `supabase/frontend/words.js`
  - `supabase/frontend/progress.js`
  - `supabase/frontend/usage.js`
  - `supabase/frontend/ai.js`
  - `supabase/frontend/bootstrap.js`
  - `supabase/frontend/migration-examples.js`
- Edge Function:
  - `supabase/functions/ai-chat/index.ts`
  - `supabase/functions/_shared/cors.ts`

## 1) Supabase project setup
1. Create project in Supabase.
2. In Auth -> Providers -> Google, enable Google OAuth.
3. Add redirect URLs:
   - `http://localhost:3000`
   - `http://localhost:3000/index.html`
   - `http://localhost:3000/app.html`
4. In Authentication -> URL Configuration, set Site URL to `http://localhost:3000`.

## 2) Database schema and relationships
Run SQL files in this order:
1. `supabase/schema.sql`
2. `supabase/rls.sql`

Tables and relationships:
- `profiles.user_id -> auth.users.id` (1:1)
- `words.user_id -> auth.users.id` (many per user)
- `progress.user_id -> auth.users.id` (many per user)
- `usage_daily.user_id -> auth.users.id` (one row per user/day)

## 3) Security (RLS)
RLS is enabled on all app tables.
Policies enforce: users can read/write only rows where `user_id = auth.uid()`.

## 4) Frontend auth (Google OAuth with Supabase)
1. Copy config file:
   - Copy `supabase/frontend/supabase.config.example.js`
   - Create `supabase/frontend/supabase.config.js`
2. Set values:

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

3. Replace current GSI button handling with:

```js
import { signInWithGoogle, getCurrentUser, signOutUser } from './supabase/frontend/auth.js';

await signInWithGoogle();
const user = await getCurrentUser();
await signOutUser();
```

Session persistence is handled by Supabase client config (`persistSession: true`).

## 5) Replace LocalStorage dictionary with DB queries
Use module functions in `supabase/frontend/words.js`.

- Add word: `addWord(...)`
- Delete word: `deleteWord(id)`
- Fetch words: `fetchWords()`
- Update word: `updateWord(id, updates)`

UI flow pattern:
1. DB write succeeds.
2. Update in-memory `words` array.
3. Call existing `updateWordList()`.

See full examples: `supabase/frontend/migration-examples.js`.

## 6) Replace quiz history storage
Use `supabase/frontend/progress.js`:
- Save result: `saveQuizResultRemote(...)`
- Fetch history: `fetchQuizHistory(limit)`

This replaces `localStorage.getItem(QUIZ_HISTORY_KEY)` and `localStorage.setItem(QUIZ_HISTORY_KEY, ...)`.

## 7) AI calls through Edge Functions (no API keys in frontend)
Use `supabase/frontend/ai.js`, which calls:
- `supabase.functions.invoke('ai-chat', ...)`

Edge function (`supabase/functions/ai-chat/index.ts`) does:
1. Verify authenticated user from JWT.
2. Increment/check daily quota via RPC `increment_ai_usage`.
3. Call OpenAI API with secret from function environment.
4. Return result to frontend.

### Deploy
```bash
supabase functions deploy ai-chat
supabase secrets set OPENAI_API_KEY=YOUR_KEY
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

## 8) Usage limits
Enforced server-side by DB function `increment_ai_usage(user_id, limit)`.
When over limit, edge function returns HTTP 429.

Frontend can display meter via `getTodayUsage()` from `supabase/frontend/usage.js`.

## 9) Minimal integration sequence for your existing script.js
Apply in this order to avoid regressions:
1. Auth migration first: replace `sessionStorage.getItem('user')` checks with `await getCurrentUser()`.
2. Dictionary migration second: replace `loadUserDictionary` and `saveUserDictionary` with DB calls.
3. Progress migration third: replace `saveQuizResult` and `updateQuizHistory` data source.
4. AI migration last: point all AI calls to `invokeAiChat` and related function types.

`supabase/frontend/migration-examples.js` contains direct replacement snippets for these paths.

## 10) Production notes
- Keep `anon` key in frontend (this is expected in Supabase).
- Never expose OpenAI key in frontend.
- Keep RLS enabled in production.
- Add stricter validation in Edge Function for payload shapes.
- Add rate limiting at reverse proxy or additional table counters if needed.
