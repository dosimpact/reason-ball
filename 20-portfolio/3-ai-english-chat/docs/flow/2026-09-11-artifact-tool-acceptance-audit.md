# REF-21~34 도구·Artifact 명시 수용 조건 감사

2026-09-11 작성. 범위는 `docs/stock/business-design.md:172–185`의 14개 행이다. 제품·테스트·주 진행표는 수정하지 않고 이 문서만 추가했다. 최신 전체99(session35926)는 작성 시 진행 중이므로 통과 근거에 포함하지 않는다.

부모의 그래프 확인에서 todo/proxy만 인덱싱되었고 웹 coverage는 not indexed였다. 웹 generation·심볼·완전한 그래프 coverage는 없으며 정확한 요구 문서와 아래 소스·spec을 직접 대조했다. 브라우저/원격 요청은 수행하지 않았다.

## 실행 증거와 판정 범위

증거 원장은 `docs/flow/2026-09-11-live-e2e-progress.md`다.

- **E1** `:367–369`: 당시 전체 **66 PASS / 11.1분**. **E2** `:554–556`: 당시 전체 **89 PASS / 17.5분**. 실제 Supabase·OAuth AI·Open-Meteo를 사용하는 역사적 실행이며 현재99 전체 통과를 뜻하지 않는다.
- **E3** `:565–575`: terminal observation 수정 후 observability+stream-recovery+tool-approval **4 PASS / 1.1분**. 실제 서버 로그와 첨부를 비교한 정상2·모델 거절1·취소1·재시도1의 5건 상관관계 확인. DB 취소를 error로 잘못 기록한 최초 실행은 별도 실패 증거로 보존되었다.
- **E4** `:589–599`: Artifact 버전 이전/다음/최신·diff·CSV 복사를 포함한 artifact-storage **6 PASS / 1.3분**.
- **E5** `:601–606`: Code 원문/실제 실행 출력 복사와 거절 복구 **1 PASS / 12.7초**.

`VERIFIED 후보`는 그 행의 명시 수용 조건을 직접 확인한 증거가 있다는 제안이다. 이미지 공급자 성공이나 모든 언어·모든 오류·모든 파일 유형을 함께 완료했다고 뜻하지 않는다. 실행 결과를 중복 합산하지 않으며 주 진행표는 변경하지 않았다. 아래 테스트는 `apps/web/tests/e2e/live/` 기준이다.

## 행별 대조

| ID | 명시 수용 조건 | 권고 | 실제 증거와 정확한 잔여 조건 |
|---|---|---|---|
| REF-21 | 다단계 server tool·typed state UI | PARTIAL 유지 | `tool-approval.spec.ts:17–48`의 실제 승인 대기→server weather 결과/거절→reload, DB typed parts는 E2/E3. `app/api/ai/chat/route.ts`는 SDK tool과 stopWhen(stepCountIs(5))를 사용한다. 그러나 현재 테스트는 승인 후 assistant의 후속 문장이 해당 실제 결과를 사용하는지 직접 단언하지 않는다. “다른 모든 도구” 대신 **도구 입력→실제 결과→후속 assistant** 한 완결 사이클을 증명하면 된다. 서로 다른 도구 2개를 반드시 쓰라는 요구는 없다. |
| REF-22 | Allow/Deny와 후속 대화 | PARTIAL 유지 | tool-approval은 두 결정과 실행/비실행, 저장된 approval/output state, 단일 user turn, reload를 확인한다. 실제 결정 후 후속 assistant 텍스트 또는 다음 사용자 턴을 주고 정상 대화가 이어지는지의 직접 증거를 보강한다. 모든 네트워크 조합을 이 행에 추가하지 않는다. |
| REF-23 | weather 성공·거절·실패 UI | PARTIAL 유지 | 성공과 거절은 E2/E3. `entities/chat/ui/message-content.tsx:23`에 output-error와 준비 상태 표시가 있지만 live 성공/거절 두 사례에 실제 오류 상태 단언은 없다. 과거 Open-Meteo 연결 실패로 suite가 실패한 사실 자체는 오류 UI 복구 성공 증거가 아니다. |
| REF-24 | Text/Code/Image/Sheet workspace 생성 | PARTIAL 유지 | artifact-storage:37–117은 Text/Code/Sheet 생성·autosave·restore·private access; 실제 AI 편집은 artifact-ai. E2/E4. Image workspace의 실제 생성 경로 검증은 빠져 있다. **Text/Code/Sheet 전체를 AI가 처음부터 생성해야 한다**는 조건은 이 행에 없다. Image 원본 생성/편집 성공은 별도 REF-30에도 남는다. |
| REF-25 | 직접 편집·targeted edit·rewrite·autosave | VERIFIED 후보 | artifact-storage:41 직접 편집/autosave, artifact-ai:4–89의 실제 Text/Code 선택 영역 다듬기와 원문 경계 보존·명시 적용·버전/DB/reload, artifact-conflict:6 stale AI 적용/수동 저장409·초안 보존. E2/E4. 모든 Artifact 종류×모든 편집 모드를 추가 조건으로 만들지 않는다. |
| REF-26 | 이전/다음·diff·복원·최신 복귀 | VERIFIED 후보 | artifact-storage:148–224가 실제 Sheet A/B/C의 인접 이전/다음/최신·diff B↔C·편집/전체 DB버전/current_version 불변·reload를 확인한다. :41–117은 Text/Code/Sheet 복원 시 이전 버전 불변과 새 버전 추가를 확인한다. E4. Image 성공 자체를 이 공통 버전 조작 행의 추가 조건으로 요구하지 않는다(REF-30은 별도 미완료). |
| REF-27 | 문서와 문법·문장 suggestion 적용 | VERIFIED 후보 | artifact-ai:4–89의 Text rewrite/grammar는 실제 provider 응답을 표시하고 적용 전 저장 불변, 명시 적용 후 저장·원문 범위/전체 교정문 비교·reload를 확인한다. artifact-storage의 Text 문서 저장과 함께 E2/E4. 전체 문서 신규 AI 생성은 원문에 없다. |
| REF-28 | Code 편집·격리 실행·output/error·copy | VERIFIED 후보 | artifact-storage:121–146 실제 VM 42 출력·호스트 globals 차단·throw·무한 루프 제한·후속 성공, :226 이후 원문/실제 console+return 출력 복사·거절 복구, artifact-ai Code targeted edit 후42 실행·reload. E2/E4/E5. 모든 프로그래밍 언어 실행은 필수 조건이 아니다. |
| REF-29 | 표 편집·정리·분석·CSV copy | VERIFIED 후보(현재 단순 CSV 범위) | artifact-storage:70–82 실제 셀 편집/trim/크기, artifact-ai analysis 실제 supplied CSV 분석·원문 불변, artifact-storage:148 이후 native copy에 정확한 최신 내용 전달 및 DB불변. E2/E4. 다운로드는 부가 기능이며 원문 필수는 copy다. `artifact-workspace.tsx:69–74`의 split/join은 인용 콤마·셀 내부 개행을 지원하지 않으므로 범용 RFC CSV 준수는 주장하지 않는다. 이 제한은 사용자 데이터 호환성 과제로 남긴다. |
| REF-30 | Image 생성·편집·버전·저장/재조회 | MISSING-LIVE 유지 | 실제 Image 생성·편집 성공 증거가 없다. 수동 PNG 보상/첨부의 실제 Storage 성공은 이 기능의 성공 대체물이 아니다. 이미 확인된 공급자 미디어 지원 제약을 그대로 보존하며 이 감사에서 같은 endpoint 재확인을 반복하지 않는다. |
| REF-31 | chat/message/vote/artifact/**suggestion**/stream reload | PARTIAL 유지 | chat·feedback·file·Artifact·완료 스트림/실패 복원은 E2/E3/E4. **적용 전 Artifact suggestion**은 `artifact-assistance.tsx:10`의 컴포넌트 state이고, API `app/api/ai/artifact-assistance/route.ts:36–39`는 결과를 반환할 뿐 저장하지 않는다. `artifact-ai.spec.ts` 마지막 assertion도 reload 후 artifact-ai-result가 사라짐을 확인한다. 적용 결과 영속성은 원 suggestion 영속성을 대신하지 않는다. 학습 도움말 임시 정책은 별도 도메인 규칙이며 Artifact suggestion gate를 지우는 근거가 아니다. |
| REF-32 | 인증·소유권·user/IP rate limit·bot 방어·allowlist | PARTIAL 유지 | safety-report:57–81 실제 계정별 첨부429/retry 헤더·타 계정 독립, :85 이후 media 인증/Origin 거부, authority/rls 및 observability의 invalid-model 거부. E2/E3. 직접 **IP 한도와 bot 방어**의 허용/거절 실환경 증거가 없다. `shared/api/ai/guard.ts`의 프로세스 Map limiter와 인증/Origin 체크를 bot 판별로 간주하지 않는다. 분산 한도/모든 유료 등급은 이 REF 행 자체의 새 조건으로 넣지 않는다. |
| REF-33 | chat/upload/tool/artifact/storage별 설명·retry | PARTIAL 유지 | network/stream recovery, attachment-composer의 upload 실패/재시도, artifact-conflict의 충돌/초안·저장 안내는 E2/E3. tool 오류 뒤 retry와 실제 저장 서비스 실패 후 안내·복구가 직접 비어 있다. 오류를 설명하는 source 존재와 실패 주입 없이 성공만 실행한 것을 같은 증거로 취급하지 않는다. 모든 오류 조합 대신 각 명시 I/O 경계의 한 실패/복구 사례가 적절하다. |
| REF-34 | request/stream/**tool/cost**/error 상관 추적 | PARTIAL 유지 | observability:5 이후 실제 요청ID/owned generation/assistantID·invalid-model 안전 오류, E3의 실제 duration/outcome 단일 terminal 로그까지 직접 확인한다. **toolCallId별 실행과 비용**을 같은 요청/stream에 연결하는 기록은 미완성이다. usage token이 있어도 요금으로 환산한 cost와 동일하지 않다. 모든 tracing SaaS 구축·무기한 로그 보존을 새 조건으로 추가하지 않는다. |

14행 중 VERIFIED 후보 5행, PARTIAL 유지 8행, MISSING-LIVE 유지 1행이다. 동시 진행 중인 최신 전체 실행과 무관하게 기존 실제 성공의 범위를 정확히 매핑한 제안이며, 주 진행표 수치는 변경하지 않았다.

## 우선할 실행 가능한 공백 3개

1. **Artifact suggestion reload(REF-31)**: 실제 provider grammar/rewrite를 생성한 뒤 적용하지 않고 reload한다. 같은 artifact/version·원문에 묶인 동일 suggestion이 복원되고, 적용하면 정확히 한 버전이 추가되는지 확인한다. 그동안 다른 탭이 source를 바꾸면 stale suggestion 적용을 차단해야 한다. 현재 제품은 reload 시 제안을 버리므로 저장·소유권/버전 연결의 제품 변경이 먼저 필요하다. 생성 과금을 반복하는 것이 저장 복원의 대안은 아니다.
2. **weather 실패→설명→후속 대화/재시도(REF-21/22/23/33)**: 실제 tool-call/approval 흐름에서 경계 하나만 명시적으로 실패시키고 output-error의 안전한 안내·원 대화 보존을 확인한다. 실패 해제 후 실제 Open-Meteo 결과와 그 결과에 기반한 후속 assistant를 확인한다. 성공/거절 테스트에 단순 오류 문자열을 붙여 성공으로 처리하지 않는다. 외부 네트워크 실패 주입은 parent가 통제할 수 있는 방법으로 설계하고 결과의 실제/주입 경계를 보고한다.
3. **tool·비용 상관관계(REF-34)**: 먼저 provider가 공급하는 usage와 적용 요금 정의를 확인하고, requestId→assistant generation→toolCallId→도구 결과/실패→최종 사용량/산정 비용을 동일한 안전 메타데이터 기록으로 연결한다. 가격이 없거나 provider 사용량이 누락된 경우 unknown으로 표시해야 하며 임의 0원을 기록하지 않는다. 실제 짧은 tool 대화 1회와 기록 비교가 적절한 회귀다.

학습 포인트: Artifact 편집 결과 저장과 제안 자체 저장은 다르다. 도구 실패가 실제로 발생했다는 사실만으로 오류 UI/복구 검증이 완료되지는 않는다. 사용량 토큰과 비용은 다른 관측값이다.

다음 단계: 부모가 현재 전체99 실행 종료 후 이 5개 VERIFIED 후보를 검토하고, 공급자 미디어 장애 재확인 대신 위 실행 가능한 명시 공백을 우선 처리한다.
