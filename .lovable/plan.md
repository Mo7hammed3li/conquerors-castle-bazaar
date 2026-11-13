# Assistant button disappearing after sign-in — findings and fix plan

## What the code does today (checked)
- The assistant is mounted once in the root layout (`src/routes/__root.tsx` line 133), outside every page, so it does not depend on which page you land on after sign-in (`/auth` sends you to `/account`).
- `src/components/AssistantChat.tsx`: the round button has **no** sign-in or role condition. It always renders. Only the panel content changes: signed-out visitors see "سجّل الدخول لاستخدام المساعد", signed-in members see the chat.
- Intended visibility: the button for everyone; chatting for every signed-in member (customer, seller, staff). Staff only get different suggestion chips.
- Nothing else in the app uses a fixed position or a higher layer, so no app element covers it.
- The preview has no runtime or console errors logged.

## Likely causes (not yet confirmed)
1. **The production site is running an older version.** If the live site (Vercel) was built from a commit before the assistant, or from a different branch, the button would not be there at all. The "appeared once" could have been a preview tab.
2. **A page crash after sign-in.** If loading roles or profile throws during render, the root error screen replaces the whole layout, so the header and button disappear together. If the header was still visible, this is ruled out.
3. **Covered at the bottom-right corner.** In Arabic, `start-5` puts the button on the bottom **right**, the same corner where hosting badges or browser/OS widgets appear on the live site.

## Steps
1. In the preview, sign in as the existing account with a browser script, open `/` and `/account` on desktop and mobile widths, and take screenshots to confirm the button shows signed-in.
2. Ask the user which URL showed the bug (preview, Lovable published, or Vercel) and whether the header was still visible.
3. Apply the smallest fix that matches:
   - Old version: no code change; redeploy the latest commit later, with your approval.
   - Crash: catch the failed role/profile load in `src/lib/auth.tsx` and keep the layout.
   - Covered: move the button to the bottom-left (`end-5`) and raise its layer, in `AssistantChat.tsx` only.
4. Re-check with screenshots signed-in and signed-out.

No database, sign-in setting or deployment changes.
