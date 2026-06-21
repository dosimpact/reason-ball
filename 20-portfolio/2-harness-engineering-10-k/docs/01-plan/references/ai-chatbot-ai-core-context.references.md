# ai-chatbot AI 기능 핵심 컨텍스트 (구현용)

## 목적
- `2.benchmark/ai-chatbot`에서 실제 동작 중인 AI 기능만 추려서, `1.control-panel` 구현에 바로 재사용 가능한 형태로 정리한다.

## 1) AI 런타임 핵심 구조
- 모델 추상화: `lib/ai/providers.ts`
- 게이트웨이 기반 모델 라우팅: `@ai-sdk/gateway` 사용
- 추론 모델 처리: `-thinking` suffix 모델은 reasoning middleware로 `thinking` 파트를 추출해서 UI로 전달
- 모델 카탈로그: `lib/ai/models.ts` (`DEFAULT_CHAT_MODEL`, provider별 모델 목록)

## 2) 채팅 생성 파이프라인 (서버)
- 엔드포인트: `app/(chat)/api/chat/route.ts`
- 입력 검증: `app/(chat)/api/chat/schema.ts` (tool approval continuation까지 고려)
- 공통 흐름
1. 인증 확인 (`auth`)
2. 사용자 일일 메시지 한도 확인 (`entitlementsByUserType`, `getMessageCountByUserId`)
3. 채팅/메시지 저장
4. `streamText` 실행 + UI 메시지 스트림 생성
5. 응답 종료 후 assistant/tool 메시지 DB 반영

## 3) 프롬프트 정책
- 파일: `lib/ai/prompts.ts`
- 기본 프롬프트: 간결하고 즉시 실행형 응답
- 요청 힌트 주입: 사용자 위치(`lat/lon/city/country`)를 system prompt에 포함
- 모델별 분기
- reasoning 계열: tool 비활성 + 일반 프롬프트만 사용
- 일반 계열: artifact/tool 사용 지침 포함

## 4) Tool Calling + 승인 플로우
- 등록 툴: `getWeather`, `createDocument`, `updateDocument`, `requestSuggestions`
- 파일: `lib/ai/tools/*`, 연결점은 `app/(chat)/api/chat/route.ts`
- 핵심 규칙
- reasoning 모델은 `experimental_activeTools: []`로 툴 비활성
- `getWeather`는 `needsApproval: true` (UI에서 Allow/Deny)
- 승인 응답 후 자동 재호출: `components/chat.tsx`의 `sendAutomaticallyWhen`

## 5) Artifact(문서/코드/시트) 생성 구조
- 서버 핸들러 팩토리: `lib/artifacts/server.ts`
- 타입별 생성/수정 구현
- text: `artifacts/text/server.ts` (`streamText`, word chunk 스트리밍)
- code: `artifacts/code/server.ts` (`streamObject` + zod schema)
- sheet: `artifacts/sheet/server.ts` (`streamObject` + CSV schema)
- UI 반영 방식
- 서버가 `data-*` 파트(`data-id`, `data-kind`, `data-textDelta` 등) 전송
- 클라이언트 `DataStreamHandler`가 artifact 상태/콘텐츠를 실시간 반영

## 6) 구조화 출력(Structured Output)
- 대표 케이스: 문서 개선 제안
- 파일: `lib/ai/tools/request-suggestions.ts`
- `streamText + Output.array(zod)`로 suggestion 배열을 부분 스트리밍
- 제안 항목은 DB 저장 + UI에 `data-suggestion`으로 즉시 반영

## 7) 멀티모달 입력
- 사용자 입력: 텍스트 + 이미지 첨부 (`components/multimodal-input.tsx`)
- 업로드 API: `app/(chat)/api/files/upload/route.ts`
- JPEG/PNG, 5MB 제한, Vercel Blob 저장

## 8) 상태 저장/복구
- 채팅/메시지/문서/제안 저장: `lib/db/queries.ts`
- 타이틀 자동 생성: `app/(chat)/actions.ts`의 `generateTitleFromUserMessage`
- 스트림 재개 준비: `createResumableStreamContext` + stream ID 저장
- 참고: 현재 `app/(chat)/api/chat/[id]/stream/route.ts`는 204 응답만 구현

## 9) 안전장치/운영 포인트
- rate limit: user type별 일일 메시지 제한 (`lib/ai/entitlements.ts`)
- 오류 표준화: `lib/errors.ts` (`ChatSDKError`)
- 관측성: `experimental_telemetry` (production에서 활성)
- 최대 추론 스텝: `stopWhen: stepCountIs(5)`

## 10) control-panel 구현 우선순위 (권장)
1. 최소 채팅 루프 이식: `route.ts`의 auth -> validate -> `streamText` -> save
2. 모델 추상화 이식: `providers.ts`, `models.ts`
3. 툴 1개부터 도입: `getWeather`(승인 플로우 검증용)
4. artifact 1종(text) 우선 도입 후 code/sheet 확장
5. structured output(`requestSuggestions`) 마지막에 붙이기

## 11) 바로 재사용할 파일 단위
- 채팅 오케스트레이션: `app/(chat)/api/chat/route.ts`
- 요청 스키마: `app/(chat)/api/chat/schema.ts`
- 모델/프롬프트: `lib/ai/providers.ts`, `lib/ai/models.ts`, `lib/ai/prompts.ts`
- 툴: `lib/ai/tools/*.ts`
- artifact 서버: `lib/artifacts/server.ts`, `artifacts/*/server.ts`
- 스트림 UI 처리: `components/data-stream-handler.tsx`, `components/chat.tsx`, `components/message.tsx`

## 12) 구현 시 주의할 점
- reasoning 모델과 tool 모델을 섞어 쓰면 동작이 달라지므로 분기 정책을 먼저 고정해야 한다.
- tool approval continuation 스키마(`message` vs `messages`)를 그대로 유지하지 않으면 승인 후 대화가 끊긴다.
- artifact는 일반 chat 응답과 별도 `data-*` 스트림 프로토콜을 사용하므로, UI 동기화 코드를 같이 가져와야 한다.
