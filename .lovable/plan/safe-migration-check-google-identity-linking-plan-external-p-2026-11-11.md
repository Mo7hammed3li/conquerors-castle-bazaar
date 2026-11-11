# Safe migration check + Google identity linking plan (external project ypixymbktqiyoskryfbc)

## Findings (read-only, verified this turn)
- The preview is NOT connected to `https://ypixymbktqiyoskryfbc.supabase.co`. Runtime env (`VITE_SUPABASE_URL`, `SUPABASE_URL`) and `.env` all point to the Lovable Cloud backend.
- The string `ypixymbktqiyoskryfbc` appears nowhere in the project code or config.
- Current Google sign-in (`src/routes/auth.tsx`) uses the Lovable managed broker (`lovable.auth.signInWithOAuth`). That broker only issues sessions for the Lovable Cloud backend; it cannot sign in to, or link identities on, the external project.
- No `signInWithOtp` or `linkIdentity` code exists yet.
- I cannot read users of the external project from here (no access to its keys or admin API). The account olppolkol@gmail.com / UID 62c82d24-... and its customer + owner roles must be confirmed by you in the external dashboard, or by a read-only query once the app points there.

## Prerequisites you do in the external Supabase dashboard (no code)
1. Auth > Providers > Google: enable with your own Google OAuth client ID/secret; add `https://ypixymbktqiyoskryfbc.supabase.co/auth/v1/callback` as an authorized redirect URI in Google Cloud.
2. Auth > Settings: enable **Manual Linking** (required for `linkIdentity`).
3. Auth > URL Configuration: add the preview URL and `/auth/link-google` to Redirect URLs.
4. Email OTP enabled (email provider on). Keep the external project's own email sending as is.
5. Confirm the target user row exists with that email and UID, and that `account_roles` has `customer` and `owner` for that UID.

## Connecting the preview to the external project (separate approval step)
- Lovable Cloud manages this project's connection files; they cannot be hand-pointed elsewhere while Cloud is attached, and Cloud cannot be detached. Options:
  - A. A separate Lovable project (or a draft/branch remixed without Cloud) that connects the external Supabase project via the Supabase connector. Old Lovable Cloud stays untouched.
  - B. Keep this project on Cloud and run the linking flow from a local/branch build that uses the external URL + publishable key from its own env.
- No main merge, no publish, no Cloud disablement in either option. I need you to pick A or B before build.

## Linking flow (to build after approval, in the external-connected build)
1. New public page `/auth/link-google`:
   - Step 1 — verify target account: `supabase.auth.signInWithOtp({ email: 'olppolkol@gmail.com', options: { shouldCreateUser: false } })`, then `verifyOtp({ email, token, type: 'email' })`. `shouldCreateUser:false` guarantees no second user is created.
   - Guard: after verification, `getUser()`; abort unless `user.id === '62c82d24-eed1-409d-96ef-129344755401'`. Show UID before/after.
   - Step 2 — link: `supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: origin + '/auth/link-google?done=1' } })` from that same session (direct Supabase call, not the Lovable broker).
   - Step 3 — on return: `getUser()` again, assert same UID, list `user.identities` showing `email` + `google`; read `account_roles` (RLS-scoped own-row read) and show `customer` and `owner` still present.
2. Failure handling: if Google email differs or identity already belongs to another user, Supabase returns `identity_already_exists` — show it, do nothing else. Never delete or merge users.
3. Afterwards, the `/auth` Google button in the external build switches from the Lovable broker to `supabase.auth.signInWithOAuth({ provider: 'google' })`, which now resolves to the same UID.

## Verification
- Read-only SQL in external project: `select id,email from auth.users where email='olppolkol@gmail.com'` returns exactly 1 row with the target UID; `auth.identities` for that UID shows email + google; `account_roles` still has customer + owner; user count unchanged.

## Not done / risks
- External project state (users, roles, RLS, functions) is unverified from here; schema parity with Lovable Cloud is unknown.
- OTP emails depend on the external project's mail settings and rate limits.
- No code, database, or settings change happens until you approve and choose option A or B.
