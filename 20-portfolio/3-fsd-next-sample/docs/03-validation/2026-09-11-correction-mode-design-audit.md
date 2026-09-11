# LEARN-06 교정 모드 상세 요구사항 감사

작성일: 2026-09-11

## 증거 범위와 상태

이 문서는 읽기 전용 소스 감사 결과다. 이 감사에서 브라우저, 실제 AI, Supabase 통합 테스트를 실행하지 않았다. 아래 테스트 제안은 실행 결과가 아니며 LEARN-06을 VERIFIED로 승격하는 근거가 아니다.

부모의 Tier Verify 조사에서 graph 프로젝트 목록에는 todo/proxy만 존재했고 대상 web 프로젝트는 인덱싱되지 않았다. `src/widgets/chat-workspace`, `src/features/learning-assistance`, `tests/e2e/live` 범위의 `check_index_coverage`는 notindexed를 반환했다. 해당 범위와 관련 실제 파일을 직접 읽는 방식으로 대체했다. web graph generation은 없으며 그래프 완전성을 주장하지 않는다.

권위 있는 요구사항은 `docs/01-business/character-english-chat.business.md`의 LEARN-06 표와 상세 11.3이다. 표는 짧은 교정과 상세 설명 토글을 요구하고, 상세 절은 모드별 시점, 초급자 오류 처리, 설명량·답변 길이 설정까지 요구한다. 표만 충족해 전체 요구를 충족했다고 판정하면 안 된다.

## 현재 구현과 실제 공백

| 요구사항 | 직접 읽은 구현 근거 | 판정과 공백 |
| --- | --- | --- |
| gentle: 대화를 계속한 뒤 한 줄 코칭 | `apps/web/src/entities/learner/model/preferences.ts`의 `learningPreferenceInstructions`는 short supportive correction을 지시 | 프롬프트 부분 구현. 역할극 답변 이후 한 줄 코칭이라는 순서가 명시되지 않았으며 실제 응답 E2E가 없다. |
| immediate: 중요한 오류 즉시 교정하고 다시 말할 기회 | 같은 함수는 current mistake promptly를 지시 | 재발화 기회가 명시되지 않았으며 사용자 수정 문장까지 이어지는 검증이 없다. |
| summary: 대화 중 개입 최소화, 종료 후 종합 | 같은 함수는 learner asks 또는 lesson review까지 피드백을 모으도록 지시. 미션 결과에는 corrections 표시 | 실제 중간 비개입과 종료 종합을 연결한 검증이 없다. 조사한 자유 대화 경로에는 명시적인 종료/종합 복습 동작이 없다. |
| 초급자의 의미 전달에 영향 없는 사소한 오류를 매번 지적하지 않기 | 수동 assistance 프롬프트는 at most one important issue를 지시 | 일반 채팅 정책에는 해당 제한이 명시되지 않았고 여러 턴 실동작 검증이 없다. |
| 한국어 설명량과 답변 길이 설정 | strict `learningPreferencesSchema`, `LearnerSettings`의 설정 입력 목록 | 두 설정 필드와 UI가 없다. 실제 설정 기능을 구현해야 한다. |
| 짧은 교정과 상세 설명 토글 | `LearningHelpResult`의 brief와 `<details>` explanation | 수동 도움말에 구현돼 있으며 기존 live spec이 검증한다. 자동 교정 모드의 증거로 확대할 수 없다. |

## 서버와 UI 호출 경계

- `apps/web/src/app/api/ai/chat/route.ts`: 운영 요청에서 서버가 인증 사용자의 저장된 학습 설정을 읽고 실제 공급자 지시에 `learningPreferenceInstructions`를 결합한다. 클라이언트가 운영 요청에 learnerPreferences를 직접 제공하는 것은 거부한다.
- `apps/web/src/entities/learner/model/preferences.ts`: gentle/immediate/summary 저장값은 존재한다. CEFR·목표·관심사·교정 모드가 프롬프트에 반영된다. 교정 모드에 따른 UI 상태 기계는 이 모델에 없다.
- `apps/web/src/widgets/learner-settings/ui/learner-settings.tsx`: 교정 방식 선택·저장은 가능하지만 한국어 설명량과 답변 길이 입력은 없다.
- `apps/web/src/features/learning-assistance/ui/message-learning-help.tsx`: 사용자가 버튼을 눌러 별도 도움말을 요청한다. 모드에 따른 자동 요청이나 시점 분기는 없다.
- `apps/web/src/app/api/ai/learning-assistance/route.ts`: 설정에서 CEFR만 사용한다. 명시적인 사용자 교정 요청은 summary에서도 허용하는 것이 요구사항과 양립한다.
- `apps/web/src/features/learning-assistance/ui/learning-help-result.tsx`: 한국어 짧은 피드백, 영어 제안, 접힌 한국어 상세 설명, 입력창에 덧붙이기를 제공한다. 결과는 이 UI의 로컬 상태이며 reload 복원을 제공하지 않는다.

## 기존 테스트가 증명하는 것

`apps/web/tests/e2e/live/learning.spec.ts`는 summary 선택·저장·재로딩을 확인한다. 실제 공급자의 교정 시점이나 순서를 확인하지 않는다.

`apps/web/tests/e2e/live/learning-help.spec.ts`는 실제 공급자의 correction/rephrase/reply, 한국어 설명 토글, 원문·미전송 입력 보존을 검증한다. 모드별 비교나 자동 교정 시점을 검증하지 않는다. reload 후 도움말 결과가 사라지는 현재 계약도 명시적으로 검사한다.

## 충실한 구현 경로

1. 기존 서버 프롬프트와 스트리밍 경계를 유지하면서 모드별 정책을 구체화한다. gentle은 역할극을 이어간 뒤 짧은 코칭, immediate는 중요한 현재 오류와 재발화 요청, summary는 대화 중 개입을 최소화하고 요청/종료 시 종합을 제공한다. 초급자에게 사소한 오류를 매번 지적하지 않는 정책도 포함한다.
2. 한국어 설명량과 답변 길이를 실제 학습 설정에 추가한다. strict schema, 기존 저장값의 호환 복원, 저장 API, 설정 UI, 서버 프롬프트를 함께 연결한다. 기존 소유권·revision 충돌 정책과 미션 판정의 서버 권위를 유지한다.
3. 미션 종료 평가의 교정과 summary 선택을 실제 흐름으로 연결해 검증한다. 자유 대화에도 명시적인 종료/복습 경로를 제공하고, 서버가 소유자의 저장된 대화에서 종합 교정을 만든다. 클라이언트가 임의 평가 대화를 주입하거나 자유 대화에 보상을 생성하지 않도록 한다.
4. 새로운 자동 카드나 추가 AI 요청을 의무로 가정하지 않는다. 요구사항은 학습 행동과 시점을 요구하므로 기존 응답 구조로 충실하게 제공할 수 있는지 먼저 검증한다. 별도 구조화 교정 UI가 필요하다면 원문 보존, 오류·재시도, 메시지 귀속, 복원 정책을 명시한다.

## 실제 E2E 작성·실행 범위

대상은 `http://dodonet.iptime.org:13000/`, 실제 Supabase와 실제 OAuth AI 공급자다. 한 worker에서 순차로 수행하고 불필요한 추가 브라우저를 열지 않는다. 모드 변경마다 독립 대화를 만들며 계정·fixture 정리는 기존 소유 데이터 규칙을 따른다.

1. gentle 저장 → 역할극에서 중요한 오류 제출 → 역할 답변 이후 짧은 코칭 → DB 메시지와 화면 일치 → reload 동일 내용.
2. immediate 저장 → 같은 종류의 오류 제출 → 현재 오류 교정 및 재발화 요청 → 사용자가 수정 문장을 전송 → 원문을 덮어쓰지 않고 다음 대화 진행.
3. summary 저장 → 오류가 포함된 여러 턴 → 중간 교정 개입 최소화 → 미션 종료 또는 자유 대화 복습 → 실제 사용자 발화에 대응하는 종합 교정.
4. 초급자의 의미 전달에 지장 없는 사소한 오류를 여러 턴 제출 → 매 턴 모두 지적하지 않는지 확인. 중요한 오류와 구분되는 입력 fixture가 필요하다.
5. 한국어 설명량·답변 길이를 각각 변경 → 저장·reload → 다음 실제 AI 응답 반영. 설정 문자열 존재만으로 공급자 행동을 통과 처리하지 않는다.
6. 기존 수동 교정·상세 설명 열기/닫기·원문과 미전송 초안 보존을 회귀 검사한다. summary에서도 명시적 수동 요청이 가능한지 확인한다.
7. 자동 교정이나 종합 복습에 새 저장/생성 경로를 추가했다면 다른 계정 조회·변조 거부, 응답 유실 재시도 중복 방지, 오류 후 초안/대화 보존을 검사한다.

AI 문장을 정확히 한 문자열로 고정하지 않는다. 그러나 비어 있지 않은 영어 응답이나 프롬프트의 모드 이름만 검사해 의미 요구를 대체하지 않는다. 모드별 순서·교정 대상·재발화 요청·종료 종합의 실제 행동을 확인하고 DB 메시지와 대조한다. 자동 판정이 충분하지 않으면 실행 산출물의 실제 응답을 검토해 증거와 한계를 기록한다.

## 별도 REF-05 작업의 현황 메모

이 문서를 작성하는 시점에 부모가 `SuggestedConversations`의 `sourceConversationId` prop을 연결했다. pending intent 영속화와 unmount 이후 늦은 탐색 억제 구현의 실제 runtime 검증은 부모의 진행 중인 세션 `69953`에 맡겼다. 이 문서는 그 실행 결과를 판정하지 않는다. 문서 작성 중 앱 코드 수정, 브라우저 실행, 테스트 실행은 하지 않았다.


## 후속 구현 (2026-09-11)

위 표는 구현 전 감사 시점의 공백을 보존한 것이다. 후속 작업에서 저장 설정에 한국어 설명량·답변 길이, 모드별 교정 순서·재발화·사소한 오류 정책과 자유 대화 종료 복습을 구현했다. validator 확장 migration `20260910231152_learner_response_preferences.sql`을 원격 적용했으며 과거 9필드 JSON·revision은 유지한다.

복습 요청은 새 API나 평가 테이블 없이 기존 사용자 메시지/outbox/스트림 저장 경로를 사용한다. 서버의 준비된 권한 확인 이력에서 실제 사용자 원문만 추출하며 미션에는 특별 복습 분기를 적용하지 않고 도구도 비활성화한다. 복습은 대화 보관이나 보상 발급이 아니다. 사용자 원문은 그대로 남고 이후에도 대화를 계속할 수 있다.

독립 소스 리뷰에서 입력창 내용이 복습 요청 문구와 동일할 때 기존 draftAfterTransmission이 초안을 지우는 예외를 발견했다. 선택적 preserveDraft outbox 필드로 버튼이 생성한 전송 의도를 영속화했다. 기존 일반 전송과 레거시 기록은 원래 초안 삭제 정책을 유지하며, 잘못된 플래그는 원본 기록을 남기고 거부한다. 실제 브라우저 시나리오는 같은 문구의 초안과 공백을 유지한 채 복습·새로고침을 검사한다.

최초 실검증에서는 올바른 영어 쉼표 변형과 Markdown 목록 기호를 검사식이 구분하지 못해 실패했다. 교정 대상과 원문 검사는 유지하면서 표현 형식만 정규화했다. 다음 실행에서는 brief 설정인데 영어 문법 설명만 생성되는 실제 정책 불일치를 확인했다. 서버 저장 설정이 일반 캐릭터 언어 지침보다 우선함을 명시하고 brief/detailed의 한국어 설명 지시를 보강했다. 단순 비어 있지 않은 응답으로 판정 기준을 낮추지 않았다. 최종 종료 상태와 실제 첨부 응답 검토는 live E2E 진행 원장을 따른다.

최종 후속 결과: 강화된 실제 교정 모드5개 PASS(42520, 1.8분), 직전 수동/레거시 도움말을 포함한7개 PASS(72122, 2.3분). 실제 첨부 문장에서 brief 한국어1문장/detailed 한국어3문장과 두 원문에 대응하는 summary 종합을 확인했다. 위의 최초 감사 공백은 이 후속 증거 범위에서 해소되어 진행 원장의 LEARN-06을 VERIFIED로 갱신했다. 두 실행은 중복되므로 단순 합산하지 않는다. 전체 비즈니스 목표는 미완료다.
