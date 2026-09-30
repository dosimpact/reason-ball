# 미디어 검증 비용 제한

- 날짜: 2026-09-30
- 사용자 결정: TTS 실제 검증 허용. 이미지 실제 생성10회 이내. 영상은 건당3초·5회 이내. 이후 이미지/영상은 mock으로 검증한다.
- 영향: `MEDIA-GOOGLE-01/02`, 실연동 검증 운영.
- 이전 턴은 구현·검증·커밋이 있었으므로 progress. 이번에는 비용 제한과 테스트 보호 장치를 추가하며 실제 이미지/영상 요청은 보내지 않는다.

## 호출 예산과 실행 보호

[검증 원장](../stock/media-validation-budget.json)은 이미지6/10, 영상0/5로 보수적으로 시작한다. 이미지6회에는 Google 실패3회(403 한 번,429 두 번)와 내장 imagegen 데모 초상3회까지 포함했다. Google 호출만 세면3회지만 전체 이미지 비용 의도를 존중해 초상 제작도 차감한다. 이는 청구 금액이나 성공 생성 수가 아닌 요청 예산이다.

`tests/e2e/live/media-budget.ts`가 파일 잠금 아래 호출 전에 예약하고 실패·중단에도 반환하지 않는다. E2E 외 직접 호출도 같은 원장에 먼저 기록해야 한다. 작업용 원장은 일반 사용자 요청의 전역 과금 제한을 구현하지 않는다.

TTS용 `PLAYWRIGHT_GOOGLE_MEDIA=1`만으로 이미지를 호출하지 않는다. 이미지는 `PLAYWRIGHT_GOOGLE_IMAGE=1`과 남은 예산이 필요하다. Google 이미지 SDK 재시도는0이다. 영상에는 기존 명시적 opt-in뿐 아니라 길이·잔여 횟수 검사를 추가했다.

## 3초 제약

[공식 Veo 문서](https://ai.google.dev/gemini-api/docs/veo?hl=ko)의 Veo3.1 Fast 지원 길이는4·6·8초다. 현재 API 구현은8초를 요청하므로3초 한도에서는 live 영상 테스트를 fixture 시작 전 skip한다. 지원하지 않는3초를 시도하거나 더 긴 영상을 생성 후 자르지 않는다. 사용자에게3초 유지/mock 또는4초 허용 선택을 물었으며 답변 전에는3초 제한을 유지한다.

이미지의 기존 Free Tier 한도0(429)은 여전히 미해결이다. 무의미한 재시도를 하지 않는다. TTS의 기존 실제 생성·재생 PASS는 유지한다.

## 검증

- 이번 변경의 실제 이미지/영상 호출0회.
- 계약313 PASS, typecheck PASS. 계약은 임시 원장으로 한도 초과·4/8초 거절과 예약 보존을 검사했다.
- `PLAYWRIGHT_GOOGLE_MEDIA=1 PLAYWRIGHT_GOOGLE_VIDEO=1 pnpm test:e2e google-media.spec.ts --grep 'decodes a Google image|playable MP4'`: 2 SKIP. 이미지 별도 opt-in 없음과 영상3초 제한이 fixture 시작 전 차단됨을 확인했다. 원격 계정이나 생성 요청을 만들지 않았다.
- 실제 공급자 성공과 mock/skip을 구분한다.
