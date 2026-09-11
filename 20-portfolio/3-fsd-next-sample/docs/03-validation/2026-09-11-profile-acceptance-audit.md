# 프로필과 복습 노트 명시 수용 기준 재감사

2026-09-11. 범위는 PROFILE-01/02/03/05와 직접 인접한 LEARN-12이다. 원문에는 PROFILE-06 또는 NOTE-* 요구 ID가 없다. PROFILE-04는 부모 작업 범위다.

그래프 Verify 확인 결과는 부모가 전달한 최신 list_projects/coverage 결과를 사용했다. todo/proxy만 색인되어 있고 웹 앱은 미색인이다. 웹 generation·symbol·coverage를 확인할 수 없어 아래 정확한 문서·테스트·제품 소스를 직접 읽었다. 브라우저/API 실행과 제품/테스트/주 행렬 수정은 하지 않았다.

실행 기준은 `2026-09-11-live-e2e-progress.md:722`의 전체 **99 PASS, 20.1분, 세션35926 종료0** 및 해당 문서의 기존 개별 통과 기록이다. 현재 부모의 홈/프로필 강화 실행 **51201은 진행 중**이므로 본 감사의 통과 근거에 포함하지 않는다. 파일의 새 단언과 과거 실행의 통과 범위를 구분한다.

| ID와 원문 | 실제 단언과 실행 근거 | 판단 |
| --- | --- | --- |
| PROFILE-01 — 닉네임, 목표, CEFR, 관심 상황, 음성/교정 선호 설정 (`docs/01-business/character-english-chat.business.md:272`) | `apps/web/tests/e2e/live/learning.spec.ts:32`에서 전체 설정을 UI로 변경하고 learner_preferences.settings 객체의 정확한 값과 reload 후 각 입력/체크박스를 검사한다. 표시 이름을 프로필 heading에서도 확인한다. `preferences-conflict.spec.ts`의 기존 계정 분리/revision 충돌 증거는 추가 보강이다. 전체99에 포함. | **VERIFIED 유지**. 실제 음성 재생은 이 설정 저장 요구의 추가 조건이 아니다. |
| PROFILE-02 — 완료 미션, 연속 학습, 학습 시간, 표현 수 표시 (`business.md:273`) | `learning-activity.spec.ts`의 기존 실제 15초 활동 pulse·60초 이상 누적·중단 후 DB active_minutes와 프로필 학습 시간/연속 학습 reload 단언. `learning.spec.ts:148`의 notebook 사례는 고유 표현 0→2, DB에는 3종 기록, API expressionCount와 프로필 표시 및 reload/원본 삭제 후2를 확인한다. reward-preservation의 기존 완료0→1/중복 완료 후1과 함께 ledger:651–655의 **2 PASS /49.5초**, 이후 전체99 PASS가 근거다. | **VERIFIED 유지**. 이번 새 홈 요약 단언은 DISC-01 보강이며 진행 중 실행51201을 이 근거에 섞지 않는다. 장기간 다중 날짜/임의 시간대를 필수로 추가하지 않는다. |
| PROFILE-03 — 즐겨찾기 캐릭터, 저장 미션, 대화 기록, 복습 노트 (`business.md:274`) | `learning.spec.ts:69` 캐릭터 DB favorite→홈→프로필→reload→제거, `:93` 미션 저장→프로필→reload→제거, `:148` 표현/단어/교정 기록→프로필 학습 표현→reload. `chat.spec.ts:58` 실제 대화 제목 저장→/history에 정확한 항목→같은 대화 ID와 메시지 재접근. 전체99 PASS. | **VERIFIED 유지**. 모든 네 항목을 프로필의 단일 탭에 강제하라는 문구는 없다. business.md:344는 모바일 기록/프로필을 별도 탐색 대상으로 명시한다. 현재 profile/page.tsx:20,54–73의 라이브러리와 별도 /history 조합을 결함으로 발명하지 않는다. |
| PROFILE-05 — 내 캐릭터·미션의 초안/게시/수정 진입 (`business.md:276`) | `creator.spec.ts:47` openCreations가 프로필 '내 생성물'에서 정확한 소유 항목을 찾는다. `:73` 캐릭터 초안 표시→편집 링크→게시→DB 게시/current_version 변경→reload→수정/보관; `:149`, 특히188–209는 미션에서 같은 프로필 진입과 저장된 단계/게시/새 버전을 확인한다. 전체99 PASS. | **VERIFIED 유지**. AI 생성 성공은 별도 CHAR/MISSION 요구다. |
| LEARN-12 — 대화에서 표현·교정·단어를 저장하고 프로필에서 열람 (`business.md:238`) | `learning.spec.ts:148` 실제 소유 대화의 사용자 메시지를 API로 저장한 후, 그 메시지의 '복습 기록 저장' UI에서 expression/word/correction 세 종류를 저장한다. 원문·교정 전 문장·메모를 DB와 프로필에서 확인하고 필터/reload/원본 purge 이후에도 유지한다. 중복은 원래 메모를 덮어쓰지 않으며 다른 계정 notebook은 빈 결과다. 전체99 PASS, ledger:651–655의 강화 실행도 통과. | **VERIFIED 승격 후보**. 실제 사용자 작성 대화 메시지에서 저장하는 요구이며 AI가 세 종류를 생성해야 한다는 조건은 없다. '모든 오류 조합'은 명시 수용 기준이 아니다. |

## 실제 남은 작업

이 범위에서 추가 제품 기능이나 새 E2E를 요구할 근거는 찾지 못했다. 가장 직접적인 다음 작업은 LEARN-12 행의 과도한 `모든 오류 조합은 별도` 완료 제한을 제거하고, 위 명시 3종 저장/프로필 열람 증거로 VERIFIED 후보를 검토하는 것이다. 현재 PROFILE-01/02/03/05는 이미 VERIFIED이므로 중복 승격하거나 카운트를 다시 더하지 않는다.

PROFILE-06 또는 NOTE-*를 새로 만들어 추적하지 않는다. 인접 LEARN-05 턴 평가, LEARN-07/08 음성, REWARD/PROFILE-04는 이 감사에서 완료 처리하지 않는다. 원문 요구 전체 완료와 이번 제한된 프로필 수용 기준 충족을 구분한다.

## 추가 범위: LEARN-11 보상 멱등 연결

부모의 후속 요청으로 LEARN-11만 추가했다. 원문 `business.md:237`은 **성공 실행과 보상 자산을 멱등적으로 연결**하는 요구다.

`reward-preservation.spec.ts:125–141`은 실제 첫 완료 요청을 route.fetch로 전달하면서 동일 인증·본문으로 두 요청을 함께 보낸다. 응답 셋에서 최초 완료 하나와 replay 둘을 구분하고 실행·평가·해금·지급 값의 일치를 확인한다. `:183–196`은 reload 후 순차 replay의 alreadyCompleted=true, 해당 mission_run_id에 해금 행 하나와 실제 evaluation ID 연결, XP 한 번 증가, 실제 자산 ID와 원본 바이트 일치를 확인한다. `:233–240`은 제작자 보관 후 같은 assetId/unlockId와 원본을 다시 확인한다.

이 동시 최초 완료 사례는 ledger:633–635의 **1 PASS /30.7초 /종료0** 및 이후 전체99 PASS에 포함된다. 현재 추가 홈/프로필 실행51201의 보상 사례는 아직 결과를 받지 않았으므로 통과 근거로 합산하지 않는다.

**LEARN-11은 VERIFIED 승격 후보다.** '과거 XP 설정값 snapshot'과 '모든 재도전 지급 정책'은 이 한 줄 요구에 추가한 광범위한 완료 조건이다. 다른 명시 요구에 해당하면 그 행에서 평가해야 하며, 현재 성공 실행→한 해금→실제 자산의 멱등 연결을 미완료로 남길 이유가 되지 않는다. 수천 개 동시 요청이나 물리 SQL 대기를 증명했다고 주장하지 않는다.

즉시 다음 작업은 새 제품 구현이 아니라 LEARN-11/12 두 행의 기존 실제 통과 증거를 검토해 주 행렬의 승격 여부를 결정하는 것이다.
