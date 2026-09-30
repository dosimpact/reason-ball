# 2026-09-30 비운영 AI Playground

## 배경과 변경

사용자 요구 Talkie 디자인 전환 중 기본 채팅·이미지·TTS를 빠르게 확인할 별도 playground를 추가한다. `/admin/playground`는 서버 렌더링 페이지로 서버 `NODE_ENV` 또는 `APP_RUNTIME_MODE`가 production이면 404다. 공개 환경 플래그와 AI mock 선택으로 이 제한을 해제할 수 없다. `/api/admin/playground/chat`, `/image`, `/speech`도 동일 정책을 가장 먼저 적용한다.

UI는 기존 Button, 정제된 RichText를 재사용한다. 이미지·음성 API는 기존 제품 API를 호출하므로 인증, 신뢰 Origin, 한도, 공급자 선택 및 오류 계약을 그대로 유지한다. 채팅은 기존 서버 AI capability를 사용하되 임시 20메시지 이내 대화이며 Supabase에 저장하지 않는다. 실제 요청은 인증된 계정만 허용하고 명시적 mock에서만 테스트 인증 생략을 따른다. 이름 admin은 운영 관리자 권한 확대를 의미하지 않는다.

결과는 화면 메모리에만 남고 자동 재생하지 않는다. 생성 중단·탭 변경·unmount는 요청을 취소하고 늦은 결과를 무시한다. 음성 Blob URL은 교체·unmount 때 해제한다. 입력과 이전 결과를 오류 발생 시 보존한다. 실제 공급자 비용 발생 가능성을 안내한다.

## 제품 이미지·음성 연결 확인

- `features/character-create/ui/character-builder.tsx`는 `/api/ai/image`에 명시적 요청을 보내 3개 후보를 만들고 사용자 선택을 저장 흐름에 넘긴다. 새 Google 이미지 어댑터는 이 기존 계약을 유지하면 자동으로 이 경로에 연결된다.
- `widgets/chat-workspace`의 assistant 메시지와 `learning-notebook`, `learner-settings`는 기존 AudioPlaybackButton을 사용한다. Google 음성 어댑터는 기존 speech 계약과 legacy voice 매핑을 유지해야 한다.
- Playground의 테스트 성공은 이 제품 저장·캐시·권한 흐름 전체 성공이나 실제 공급자 언어 품질을 보증하지 않는다.

## 영향받는 저량

- business-design: CHAR-02, TTS-01~08 및 비운영 개발 도구 요구사항 추가.
- system-design: 화면/HTTP 경계, AI 공급자 및 운영 모드 제한.
- test-design: 비운영 UI와 production API 거절 검증을 분리.
- 저량 동기화는 상위 작업에서 통합한다.

## 검증과 남은 작업

- `pnpm --filter @ai-english-chat/web test:contracts playground-policy.spec.ts`: 2 PASS (브라우저 없는 Node 정책 계약).
- scoped ESLint: 오류 0, generated data URL img 1 warning.
- typecheck: playground 오류 없음. 작업 중 홈 페이지의 누락 Play import 오류 1개는 상위 작업에서 수정 중.
- `tests/security/playground.spec.ts`: production HTTP 거절 회귀 작성, 실행 대기.
- 브라우저 UI, 실제 Google 이미지·음성 성공은 실행 대기. Google key 미설정으로 실제 공급자 검증 완료로 표시하지 않는다.
