# 2026-10-06 — UI-PUSH-LIST-25

Context: user found the progress cards excessive and requested simple listing.

Change: replace progress articles/card headers with semantic ul/li rows. Inline title, status, and summary with a small status icon; scoped CSS gives six-pixel spacing and natural wrapping without per-item borders or backgrounds. Unknown payload fallback also uses a list item.

Stock: business/system design UI-PUSH-CHAT-25; example plan synchronized.

Validation: TypeScript lint; no automated tests or live browser/provider checks.
