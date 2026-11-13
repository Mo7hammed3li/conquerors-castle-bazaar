# Assistant button disappearing after sign-in — findings and fix

## What was checked
- `src/routes/__root.tsx`: the assistant is mounted once in the root layout, outside all pages, with no conditions.
- `src/components/AssistantChat.tsx`: the round button has no sign-in, role or screen-size condition. Only the panel content changes after sign-in.
- `variant="gold"` in `src/components/ui/button.tsx` is only a gradient, shadow and bold text. Nothing in it hides the button or depends on sign-in.
- `src/styles.css`: nothing hides fixed elements. The `dark` and `rtl` settings on the page are fixed and do not change on sign-in.
- `src/lib/auth.tsx` only stores data. `UsernameReminder` is an inline banner, not an overlay. The toast area sits at the top centre. No other app element is fixed in place.
- Live check in the preview, signed out and then signed in (on `/` and `/account`, at desktop 1280px and phone 390px widths): the button was there each time, in the same spot, and it was the top element at its centre.

## Most likely cause
In Arabic, `start-5` puts the button in the **bottom-right** corner. On the published site, other things sit in that corner above all page content: the hosting badge ("Edit with Lovable" or the Vercel toolbar), browser chat or password widgets, and some extensions. They often appear only after the page finishes loading or after a redirect. Sign-in redirects you to `/account`, which can bring them up. Our app's code does not hide the button. Something outside the app is most likely covering it. I can't see your live site from here, so this isn't confirmed.

## Smallest safe fix
In `src/components/AssistantChat.tsx` only:
- Move the button and the panel to the bottom-left corner by changing `start-5` to `end-5` (and `sm:start-5` to `sm:end-5` on the panel).
- Raise the button's layer from `z-50` to `z-[60]` so app popups never cover it.
- Add a little safe-area space at the bottom for phones: `bottom-[calc(1.25rem+env(safe-area-inset-bottom))]`.

Then re-run the signed-out and signed-in check at both screen sizes.

## Intended visibility
Everyone sees the button. Anyone who isn't signed in gets a sign-in prompt inside it. Every signed-in member can chat: customers, sellers and staff.

No database, sign-in setting or deployment changes.
