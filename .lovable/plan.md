# Mo7hammed AI assistant (Gemini): read-only

## What I checked
- **App type:** the app runs on TanStack Start, and its server code runs on the Worker. There is no `supabase/functions` folder, so the project has **no Edge Functions** today. Server logic already lives in `createServerFn` (`src/lib/marketplace.functions.ts`) behind `requireSupabaseAuth`.
- **Database connection:** the `.env` file points to the external project `ypixymbktqiyoskryfbc`. The running sandbox has no `SUPABASE_URL` / `VITE_SUPABASE_URL` set to either project, so this environment can't confirm which database the preview really uses. **Step 1 is to confirm this before building.**
- **Secrets:** `GEMINI_API_KEY` is not set. The only secrets are the managed `LOVABLE_API_KEY` and `LOVABLE_CRON_SECRET`.

## Recommended backend path
Use a TanStack server function, not a Supabase Edge Function. It works the same with either database, matches how the app's existing actions work, and runs on the server only.
- New `src/lib/assistant.functions.ts` with `askAssistant = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])`.
  - It reads `process.env.GEMINI_API_KEY` inside the handler only and calls the Gemini REST API with `fetch`, so no new package is needed.
  - It validates input with zod: message up to 1000 characters, history of up to 10 turns.
  - It builds the context with `context.supabase` (RLS applies as the user). That context is the user's roles and permissions plus up to 10 matching approved listings when the user is searching. The model sees only data the user is already allowed to read.
  - The system prompt is in Arabic first. The assistant has no tools and no ability to write or change data. It must answer only from the supplied listings and must never invent prices or statistics. Staff get general operating guidance only.
- Alternative, only if you insist on Supabase: `supabase/functions/assistant/index.ts`, which checks the JWT with `auth.getUser()` and reads the key from Supabase Secrets. It must be deployed in the external project.

## Session check and usage limits
- The bearer token is verified by `requireSupabaseAuth` (`getClaims`). Signed-out users get a sign-in prompt and no call is made.
- Banned accounts are refused, using `profiles.is_banned`.
- New table `assistant_usage (user_id, day, count)`, written only through a SECURITY DEFINER RPC `assistant_consume_quota()`, with no direct grants.
  - Daily limit: 30 for customers and sellers, 100 for staff.
  - Short burst limit: at most 5 messages per minute.
  - The RPC runs before Gemini is called, so the free quota is protected.
- The message and reply text are not stored. Only the counters are kept.

## Interface
- `src/components/AssistantChat.tsx`: a floating gold button that opens a side panel, mounted once in `src/routes/__root.tsx`. It works right-to-left, fits phones and shows a clear "AI" label.
- Suggested questions change by role: "how do I list?", "find a castle level X", and for staff, "how do I review a listing?".
- Listing results show as links to `/listings/$id`.
- Fallback: if the key is missing or the quota runs out, the panel shows an honest message instead of a fake answer.

## Files
- New: `src/lib/assistant.functions.ts`, `src/lib/assistant-prompt.ts` (prompt plus context builder), `src/components/AssistantChat.tsx`, `src/test/assistant-prompt.test.ts`, and a migration for `assistant_usage` and its RPC.
- Edited: `src/routes/__root.tsx` (mount the panel) and `src/lib/i18n.tsx` (text).

## What I need from you
1. Confirm which database the preview should use: Lovable Cloud or the external `ypixymbktqiyoskryfbc`. The `assistant_usage` migration will be applied there.
2. Create a free key in Google AI Studio and add it as `GEMINI_API_KEY` in Project Settings → Secrets. If you choose the Edge Function route, it goes in the external project's Supabase Secrets instead. I will never put it in a `VITE_` variable, in code or on GitHub.
3. Confirm the daily limits (30 / 100) and model (`gemini-2.5-flash`, free tier). Free-tier limits are set by Google and can change.

## Verification
- Unit tests for the prompt builder: it never adds listings the user isn't allowed to read, and empty results lead to "no data" instead of made-up answers.
- Run the quota RPC through SQL to confirm that limit plus one is refused.
- Signed-in check in the browser: send a question, see a reply, and confirm the key never appears in browser code (search the built client files for the key name).
