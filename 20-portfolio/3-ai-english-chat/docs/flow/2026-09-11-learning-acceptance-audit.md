# 학습 명시 수용 기준 재감사

2026-09-11. 범위 LEARN-01/03/04/05/06/09/10. 부모의 최신 그래프 확인은 todo/proxy만 색인, 웹/live/entities 범위는 미색인이다. 웹 generation/coverage는 없으므로 원문·현재 테스트·관련 구현을 직접 읽었다. 제품·테스트·주 행렬 수정과 브라우저/API 실행은 하지 않았다.

실행 근거는 `2026-09-11-live-e2e-progress.md:722`의 전체99 PASS(35926 종료0,20.1분), 역할 일관성 `:549`의 최종1 PASS/29.2초, 평가축 `:560`의1 PASS/37.1초, 언어 도움 `:584`의 최종2 PASS/33.9초다. 후속 현재 진행 중인 다른 실행을 통과로 가정하지 않는다.

## 항목별 판단

| 항목과 원문 | 실제 근거 | 판단 |
| --- | --- | --- |
| LEARN-01 (`docs/stock/business-design.md:227`) “캐릭터·미션 컨텍스트로 새 실행과 대화 생성” | `apps/web/tests/e2e/live/mission-runs.spec.ts:33–72`: 실제 시작, owner/conversation/run/attempt DB 확인, reload 동일 실행, 명시 새 시도는 별도 실행·대화이며 원래 행 유지. `role-consistency.spec.ts:72–129`는 시작한 대화/실행의 실제 character_version_id/mission_version_id와 실제 역할 응답까지 확인한다. 전체99 통과. | **VERIFIED 후보**. 모든 동시 시작 조합은 원문 조건이 아니다. |
| LEARN-03 (`business.md:229`) “캐릭터 성격·말투와 미션 역할을 응답 전반에 유지” | `role-consistency.spec.ts:51–129`: 60단어/최대1질문 제한, 실제 V1 호텔 역할3턴, 안심하는 응답과 다음 행동, 도중 게시 V2 변경 후에도 원래 이름/역할 유지, DB pinned 버전/6메시지/reload 불변. 새 실행 V2 치과 역할 응답을 양성 대조한다. ledger549 최종1 PASS와 전체99 PASS. | **VERIFIED 후보**로 제한된 명시 역할 회귀는 충분하다. 이는 모든 입력/모델에서 완벽한 역할 유지라는 보장은 아니다. 그 보장을 요구하지 않으면서 기존 실제 회귀를 인정한다. |
| LEARN-04 (`business.md:230`) “단계별 힌트, 추천 답변, 쉬운 재표현 제공” | `mission-runs.spec.ts:77–109` 실제 저장된 단계 힌트 선택/삽입/reload, 진행·메시지 불변. `learning-help.spec.ts:32–83` 실제 교정·쉬운 재표현·추천 응답/영어문장/한국어 설명, 원문·초안 보존. 이 표 한 줄은 충족한다. 그러나 상세 `business.md:378–384`는 의도→핵심 표현→상황별 완성 문장 3단계와 결과에서 자립/도움 사용 구분을 명시한다. | **PARTIAL 유지**, 이유를 '모든 오류 조합'에서 상세 조건으로 정정. `mission-guidance-panel.tsx:21–29`는 단계당 단일 hint 문자열 선택/삽입이며 3단계 도움 깊이가 없다. 힌트 사용은 목표/보상에 영향이 없다고 표시하나 도움 사용 결과 구분까지 입증하지 않는다. |
| LEARN-05 (`business.md:231`) “의미 전달, 문법, 어휘, 자연스러움을 근거와 함께 평가” | `evaluation-axes.spec.ts:25–87` 명시 평가 시 4축 키/레이블/0..100 정수 점수, 실제 owner user DB 메시지 ID/정확한 인용/이유, rubric_scores와 UI/reload 일치. 다만 현재 키는 taskCompletion/appropriateness/grammar/vocabulary이며 상세 `business.md:356–366` 표에는 과업달성/이해가능성/문법/어휘·표현/**상호작용** 5항목이 있다. | **PARTIAL 유지**. 자동 매턴4축이라는 요구는 추가하지 않는다. 상세5항목과 현재4축의 의미 대응 및 독립 상호작용 피드백을 확인해야 한다. 현재 테스트는 근거 출처/형식 검증이지 두 사용자턴 각각의 독립 평가 또는 의미 품질 검증이 아니다. |
| LEARN-06 (`business.md:232`) “대화를 끊지 않는 짧은 교정과 상세 설명 토글” | `learning-help.spec.ts:46–78` 짧은 brief/영어 suggestion/상세 details 열기, 실제 메시지 불변, 명시 삽입 전 초안 불변. 상세 `business.md:370–374`는 gentle 대화후 한줄/immediate 즉시+다시말할기회/summary 종료후 묶기 정책을 명시한다. `entities/learner/model/preferences.ts:41–44`는 이 모드를 실제 프롬프트에 전달하지만 live 도움 사례는 기본 모드의 수동 도움만 요청한다. | **PARTIAL 유지**. 모드별 실행 결과 검증은 명시 상세 정책에 근거한 실제 공백이다. 단순 모든 오류조합은 추가하지 않는다. 설명을 여는 경로는 검증하지만 닫아 숨기는 역방향 단언은 현재 없다. |
| LEARN-09 (`business.md:235`) “필수 목표 달성과 사용자 의사를 근거로 서버가 판정” | `mission-evaluation-recovery.spec.ts:72–165`: 두 필수 목표 중 가격 질문이 없는 실제 사용자턴은 실패/무보상, 사용자가 계속 연습하여 가격질문을 추가하고 '미션 마치고 평가받기'로 명시 요청하면 성공. 두 완료 step의 evidence IDs는 실제 사용자 DB 메시지이며 과거/위조 transcript는409. 성공 상태/평가 ID/단일 보상 확인. 전체99 통과. | **VERIFIED 후보**. 사용자 의사는 평가 버튼 클릭으로 확인된다. 최종 조회 이후 모든 동시 변경 조합은 이 문장의 별도 필수 조건이 아니다. 상세9.4의 매턴 목표 갱신은 LEARN-02와 연결해 유지하고 이 행의 서버 완료 판정과 혼동하지 않는다. |
| LEARN-10 (`business.md:236`) “달성 목표, 잘한 점, 교정, 새 표현, 다음 추천 표시” | mission-ai와 mission-evaluation-recovery는 성공/실패·메모·reload·재시도·완료를 검증하지만 모든 열거 필드의 실제 UI값은 단언하지 않는다. `features/mission-reward/ui/mission-result-panel.tsx:98–129`는 strengths/improvements/corrections를 렌더하며 이후는 review note다. `features/mission-evaluation/ui/mission-evaluation-panel.tsx` 결과 분기는 결과패널, 실패 재개/재도전 버튼으로 구성된다. | **PARTIAL 유지**. 실제 결과의 달성 목표 목록·새 표현·다음 추천을 독립 결과 정보로 표시/검증하는 공백이 있다. 사용자가 직접 쓰는 복습 메모는 AI 새 표현 목록이 아니며 '새 시도로 다시 도전'은 다음 추천 미션이 아니다. |

## 우선순위가 높은 실제 후속 작업

1. **LEARN-10 결과 화면**: 실제 평가 결과에서 달성 목표/잘한점/교정/새 표현/추천 다음 미션을 각각 식별해 표시하고, 저장된 응답·목표 상태와 화면/reload를 비교한다. 다음 추천 클릭의 실제 목적지까지 확인한다. 현재 재시도 버튼만으로 대신하지 않는다.
2. **LEARN-04 상세 힌트**: 한 필수 단계에 의도→핵심 표현→상황별 완성 문장을 구분해 제공하고, 도움 사용 후 결과의 구분을 검증한다. 현재 단일 authored hint와 자유로운 AI 추천이 이 단계화 계약을 증명하지 않는다.
3. **LEARN-06 상세 교정 정책**: 같은 실제 오류를 각각 저장된 gentle/immediate/summary 설정으로 요청해 교정 시점/대화 흐름/종료 요약의 차이를 검증한다. 프롬프트에 설정값이 있다는 사실만으로 실행 정책을 완료 처리하지 않는다.

LEARN-01/03/09 후보3개는 주 행렬을 직접 바꾸지 않았다. LEARN-05에는 별도5축 상세 정의를 덮어쓰지 않는 설계 대응 확인이 필요하다. 매턴4축 자동 평가, 모든 모델/모든 입력/모든 오류 조합 같은 새 의무는 만들지 않는다.
