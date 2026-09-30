# Google media provider integration — 2026-09-30

## Context and requirements

The Talkie-inspired redesign needs character imagery, spoken dialogue and character video generation. This record covers `MEDIA-GOOGLE-01` (image/TTS/video provider), `MEDIA-VIDEO-01` (owner-bound async operation) and existing TTS/image contracts. It affects stock system design section 4 (AI), business media requirements, and test design provider release gates. Main agent owns the consolidated stock synchronization.

## Official API research and model decision

Research used live official pages on 2026-09-30:

- [Image generation](https://ai.google.dev/gemini-api/docs/image-generation): current Nano Banana 2 examples use `gemini-3.1-flash-image` and `POST /v1beta/interactions`, with `response_format` for aspect ratio and image size. Raw final outputs come from model_output step content; thought images are excluded.
- [Speech generation](https://ai.google.dev/gemini-api/docs/speech-generation): current TTS examples use `gemini-3.8-flash-tts` with Interactions. Text and speech_metadata style are separate; response audio format is WAV. REST outputs are `steps[].content[].data`.
- [Legacy Gemini 3.1 TTS model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-tts-preview): live page updated 2026-09-24 explicitly directs new workloads to Gemini 3.8 Flash TTS or Flash-Lite TTS. Older search snippets that recommend 2.5 Flash Preview do not establish current availability.
- [Veo](https://ai.google.dev/gemini-api/docs/veo): current model code table lists `veo-3.1-fast-generate-preview`, full `veo-3.1-generate-preview`, and `veo-3.1-lite-generate-preview`; REST creation uses predictLongRunning, operation polling and authenticated video download. Veo's older image example still uses the Nano Banana preview model; it does not supersede the current image guide.
- [generateContent reference](https://ai.google.dev/api/generate-content): legacy compatibility protocol remains implemented only when explicitly selecting preview/2.5 media IDs. Availability of those legacy models is not claimed.

Defaults therefore use **gemini-3.1-flash-image**, **gemini-3.8-flash-tts**, **veo-3.1-fast-generate-preview**. No price or latency claims were verified. Current model access, account billing and generated quality require a real key and live execution.

## Implementation and contracts

- `AI_IMAGE_PROVIDER=google` and `AI_SPEECH_PROVIDER=google` override media independently; existing chat/OAuth routing stays configured independently. Explicit mock application runtime always stays offline. Global AI_PROVIDER=google is intentionally not a supported chat configuration.
- Server credentials: `GOOGLE_GENERATIVE_AI_API_KEY`, with `GEMINI_API_KEY` fallback. There is no public key variable. `.env.example` documents Google media defaults; private `.env.local` was not printed or modified here.
- Existing `/api/ai/image` and `/api/ai/speech` auth, origin, rate-limit, cache and Storage ownership paths are preserved. Gemini adapters implement AI SDK v4 image/speech interfaces so existing creator, artifact and speech clients can reuse them.
- Image dimensions map to 1K output aspect ratios 1:1 / 2:3 / 3:2; exact requested pixel dimensions are not promised. Only PNG/JPEG/WebP generated output is accepted.
- Legacy PCM speech is wrapped as signed 16-bit little endian mono WAV at 24kHz. Existing voice aliases map to supported Gemini prebuilt voices. Speaking rate is a generative style instruction, not sample-accurate playback-rate enforcement. Current TTS requests ask for WAV directly.
- `POST /api/ai/video`: authenticated trusted-origin request `{prompt, aspectRatio}`. No owner, URI, operation or arbitrary model accepted. Fixed 8-second, 720p, single-video output. Returns `{operationToken,status:'pending',modelId,pollAfterMs:10000}`.
- `GET /api/ai/video?token=...`: verified authenticated user must match the HMAC-signed operation owner and one-hour expiration. Returns pending JSON or video/mp4 binary. Poll retries do not start a fresh generation. Invalid/tampered/other-owner tokens fail before provider calls.
- Provider download URI is checked against the fixed Gemini HTTPS files endpoint; at most three redirects are accepted to Gemini or Google Storage HTTPS hosts. API key is sent only to Gemini, stripped before Storage. Browser never receives credential or provider download URI. No arbitrary browser-supplied URL is fetched.
- Provider diagnostics are replaced by a safe generic GoogleMediaError response; no prompt, key or provider error body is logged. Transport calls have request cancellation plus a 120-second timeout.

## Validation

Command: `pnpm --filter @ai-english-chat/web test:contracts google-media.spec.ts google-video-route.spec.ts provider-policy.spec.ts`

**18/18 PASS**, Node contracts only. They cover existing provider inheritance/mock policy, current Interactions request/output shapes, legacy PCM WAV, image thought exclusion, missing/safety output, redacted 429 failure, async video parameters/polling, signed owner/expiry/tamper checks, no key on Storage redirects, arbitrary-host redirect rejection, POST auth/origin/rate-limit gates, strict owner input rejection, poll retry without new generation and provider start failure without fabricated token.

Scoped ESLint and project typecheck run after implementation; the main agent runs full combined validation. These mocked transport and route tests do **not** prove actual Supabase auth, billing access, current model availability for the user's account, real image/audio/video generation, quality or latency.

## Remaining gates and operating limits

- A real server Google API key was absent at inspection. Actual image/TTS/video success remains **NOT RUN**, not PASS. User supplies key via private worktree `apps/web/.env.local`; main agent owns live verification.
- Video POST has no durable request receipt/idempotency ledger: submitting it again can start another paid generation. Only polling is retry-safe. Failed/lost initial responses may leave an untracked provider operation. No exactly-once cost promise.
- Video output is ephemeral download, not persisted character/profile media; owner token expires in one hour. Google-host retention is provider-managed. Persisted generated image paths continue through existing authorized app contracts.
- Rate limits are process-local, not distributed cost quotas. Secret rotation invalidates old operation tokens. Model configuration, origin checks, ownership and public-key boundaries remain server responsibilities.
