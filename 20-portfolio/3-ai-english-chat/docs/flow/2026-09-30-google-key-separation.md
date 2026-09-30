# Google 키 구분과 실제 음성 검증

- 날짜: 2026-09-30
- 영향: `MEDIA-GOOGLE-01/02`, `TTS-01~08`, `DEV-PLAYGROUND-01`.
- 배경: 사용자가 기존 키는 Cloud Text-to-Speech 전용이며 이미 음성 생성에 성공한 키라고 설명했다. 초기 Gemini 요청의403을 키 자체의 문제로 해석해서는 안 된다.

## 확정된 설정

| 설정 | 서비스 | 현재 선택 |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini Developer API / Generative Language | 새 AI Studio 키를 원본에서 워크트리로 반영 |
| `GOOGLE_TTS_API_KEY` | Cloud Text-to-Speech | 기존 TTS 전용 키를 별도 보관 |
| `AI_IMAGE_PROVIDER=google` | Gemini 이미지 | 유지 |
| `AI_SPEECH_PROVIDER=google` | Gemini TTS | 사용자 최종 설정 유지 |
| `AI_SPEECH_PROVIDER=google-cloud-tts` | 선택 가능한 Cloud TTS Chirp3 HD | 기본 선택이 아님 |

원본 환경 파일은 수정하지 않았다. 중간에 워크트리에서 Cloud TTS를 선택했지만, 이후 사용자의 새 키·최종 provider 설정을 반영해 Gemini TTS로 복귀했다. `chirp-3-hd` 임시 model override도 제거했다. Cloud TTS를 사용하려면 해당 provider와 `AI_SPEECH_MODEL=chirp-3-hd`를 명시한다. 두 공급자 사이 자동 fallback은 없다. 키 값은 문서·Git에 기록하지 않는다.

## 구현과 근거

- `google/cloud-speech.ts`는 고정 `https://texttospeech.googleapis.com/v1/text:synthesize`에 서버 키 헤더를 보낸다. `en-US-Chirp3-HD-*` 음성, LINEAR16/WAV, 말하기 속도를 사용한다. 기존 marin 등의 음성 설정을 Google 음성으로 매핑한다.
- LINEAR16 응답에는 WAV 헤더가 이미 있으므로 다시 PCM→WAV로 감싸지 않는다. UTF-8 5,000바이트 입력 한도, 잘못된 WAV와 공급자 오류를 검사한다. 이미지·채팅에는 Cloud TTS provider를 허용하지 않는다.
- [Cloud TTS REST](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize), [Chirp3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd), [Gemini 키](https://ai.google.dev/gemini-api/docs/api-key), [Gemini 결제](https://ai.google.dev/gemini-api/docs/billing)를 확인했다.
- Gemini-TTS는 Cloud TTS API로도 제공되지만 별도의 모델·권한 계약이다. 이번 선택적 Cloud 어댑터는 Chirp3 HD이며 Gemini-TTS 성공으로 혼동하지 않는다.

## 실제 공급자 결과

1. 새 Gemini 키: Gemini TTS `gemini-3.8-flash-tts` 성공, WAV196,146바이트.
2. 기존 Cloud TTS 키: Chirp3 HD Kore 성공, WAV64,620바이트, 속도0.8.
3. 이미지 `gemini-3.1-flash-image`: 429. 오류가 명시한 원인은 `Free Tier`의 입력 토큰/분 한도0이다. 새 키의 인증403과 구분한다. 결제/할당량 확인을 사용자에게 요청했다.
4. 영상: 실제 생성·MP4 검증 미실행. 이미지의429를 영상의 실제 응답으로 기록하지 않는다.

계약311 PASS, typecheck PASS, lint 오류0·img 경고5.

## 인증된 Playground 실연동

`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3322 PLAYWRIGHT_GOOGLE_MEDIA=1 pnpm test:e2e google-media.spec.ts --grep 'plays its generated'`: **1 PASS, 11.6초**, worker1/retry0. 소유한 개발 서버와 실제 원격 Supabase 테스트 계정을 사용했다. `X-AI-Provider=google`, `audio/wav`, 플레이어에 설치된 blob의 RIFF/WAVE 헤더, 양수 duration, `play()` 후 증가한 currentTime을 확인했다. 테스트 계정은 삭제했고 ledger는 `[]`다.

첫 테스트는 tabpanel과 select의 label 중복으로 요청 전에 실패해 combobox role을 명시했다. 다음 실행에서는 Chromium network response body가 비어 있었지만 응답 Content-Length와 UI blob은 존재했다. 테스트를 실제 플레이어 blob의 바이트를 읽도록 고친 뒤 WAV와 재생을 확인했다. 공급자 성공을 가정해 assertion을 제거하지 않았다.

[화면](evidence/2026-09-30-talkie/google/gemini-playground.png), [실제 재생한 WAV](evidence/2026-09-30-talkie/google/gemini-playground.wav). 이는 이미지·영상 생성 또는 실제 메시지의 Storage 캐시까지 검증한 결과는 아니다.

## 후속 상태

- [시스템 저량](../stock/system-design.md)의 서비스·키 경계를 동기화한다.
- [테스트 저량](../stock/test-design.md)에 최신 공급자 결과와 남은 이미지·영상 gate를 반영한다.
