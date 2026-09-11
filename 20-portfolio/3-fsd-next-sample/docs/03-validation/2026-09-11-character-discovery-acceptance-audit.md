# 캐릭터·발견 수용 기준 감사

2026-09-11. 범위는 CHAR-01~10, DISC-01~04와 해당 상세 여정이다. 제품·테스트·주 검증표는 수정하지 않았다. 부모의 최신 전체 99개 실행(session 35926)은 진행 중이므로 이 감사에서 PASS로 사용하지 않는다.

## 증거와 판정 원칙

- 원문: `docs/01-business/character-english-chat.business.md:193`의 CHAR 10행, `:268`의 DISC 4행, `:290`의 캐릭터 생성 상세 여정. 상세 여정에 실제로 적힌 성격 자유 서술/정도 설정, 외형 설명 입력, 세 턴 샘플, 게시 정책 검사는 생략하지 않는다.
- 그래프 Verify 제한: 부모가 확인한 프로젝트는 todo/proxy뿐이다. 웹 대상 coverage 요청도 not indexed다. 웹 generation/심볼/coverage 증거가 없으므로 아래 정확한 파일을 직접 읽었다. 전체 저장소의 부재를 증명했다고 주장하지 않는다.
- 실행 원장: `docs/03-validation/2026-09-11-live-e2e-progress.md:556`의 전체89 PASS는 당시 고정 코드의 역사적 증거다. 이후 `:644` home-resume+shell 4 PASS, `:654` profile counts 2 PASS, `:674` home-discovery 1 PASS 및 discovery/level 회귀6 PASS, `:685` 모바일 캐릭터/미션 키보드2 PASS를 각각 독립 증거로 사용한다. 합산을 단일 전체 실행으로 표현하지 않는다.
- VERIFIED 후보는 원문에 적힌 수용 범위를 만족하는 실행 증거가 있다는 뜻이다. 모든 브라우저·모든 동시 조합·대규모 전역 순위·AI 이미지 생성까지 관련 없는 조건을 추가하지 않는다. 주 원장의 상태는 이 문서가 직접 변경하지 않는다.

## ID별 대조

경로는 프로젝트 루트 기준이다. `live/`는 `apps/web/tests/e2e/live/`, `src/`는 `apps/web/src/`를 뜻한다.

| ID | 실제 원문 범위 | 소스·테스트와 실행 증거 | 판정 |
|---|---|---|---|
| CHAR-01 | 이름/소개/성격/목표/관계/말투/교육 태도/금지 지침 입력. 상세 여정은 성격 자유 서술·따뜻함/유머/엄격함 정도도 명시 | `live/creator.spec.ts:53`은 이름·역할·목표 필수 검증과 입력 보존. `:9`의 전체 필드는 API fixture로 넣으며 전체 UI 입력 왕복 증거가 아니다. `src/features/character-create/ui/character-builder.tsx:92`, `:281`, `:289`에 구조화 입력이 있으나 성격은 태그 선택이다. 전체89 증거에 포함 | **PARTIAL**. 핵심 필드 전체 UI 저장/복원 검증 공백. 자유 서술·정도 설정은 현재 builder 범위에서 제품 공백 |
| CHAR-02 | 프롬프트로 복수 이미지 후보 생성, 직접 선택 후 저장; 실패 시 입력/선택 보존 | `live/creator.spec.ts:53`은 생성 필요 안내까지. builder `:88`, `:91`, `:220`, `:312`는 후보/명시 선택 경로. 원장 `:489`의 실제 images/generations 404로 현재 공급자 생성 성공 증거 없음 | **PARTIAL / 공급자 성공 차단**. 수동 PNG·이미지 입력 OCR은 생성 성공의 대체가 아님 |
| CHAR-03 | 원본/게시 자산 정책에 맞는 Storage 버킷·경로 업로드 | `live/creator.spec.ts:73` private draft→private published→public version, `:95` private 경로, `:112` public 경로, `:117` 기존 원본 다운로드. 실제 원본 파일 생성·새 경로·기존 버전 원본 유지, 전체89 PASS. `live/discovery-navigation.spec.ts:165` 실제 표시 이미지 디코딩/실패 복구도 존재 | **VERIFIED 후보**. 저장 정책 자체는 실제 수동 PNG로 검증됨. AI 생성 주체 성공은 CHAR-02의 별도 공백이지 이 저장 정책의 추가 조건이 아님 |
| CHAR-04 | 입력을 구조화된 버전에 저장하고 런타임 프롬프트로 컴파일 | `src/shared/api/supabase/publishing.ts:200`~`:245`에서 persona/teaching/prohibited를 구조화 및 system prompt로 컴파일. `live/creator.spec.ts:73` 버전 포인터/수정 이름 보존. 실제 채팅은 통과하지만 각 authored 지침→고정 버전→컴파일 프롬프트의 내용 대조는 없음 | **PARTIAL / 테스트 공백**. 임의 모델 응답 품질 평가를 필수로 추가할 필요는 없고 저장 지침과 런타임 사용 버전 대조면 구체적 다음 검사 가능 |
| CHAR-05 | 게시 전 외형·공개 정보·짧은 대화 샘플. 상세 여정은 프로필 카드와 세 턴 샘플 | builder `:312`의 character-preview에는 선택 이미지/이름/관계/성격과 고정 인사 한 문장만 존재. creator 테스트는 기존 이미지/이름 복원이지 세 턴 미리보기 단언이 아님 | **PARTIAL / 제품·테스트 공백**. 세 턴 샘플 자체가 현재 preview에 없음 |
| CHAR-06 | draft/published/archived 상태와 불변 게시 버전 | `live/creator.spec.ts:73`~`:146` UI 초안→게시→새 버전→공개 변경→보관, 이전 버전/원본 유지, 비소유자 수정403, 보관 편집 불가. 전체89 PASS. `apps/web/tests/db/published-parent-delete.mjs:35` 이후 게시 버전 직접 UPDATE/DELETE 거절을 확인하며 원장 `:668` 전체 DB 계약 PASS도 기록 | **VERIFIED 후보**. 불변성은 실제 lifecycle E2E와 별도 DB 계약 증거를 구분해 결합한다. 모든 동시 편집 조합을 추가 요구하지 않음 |
| CHAR-07 | 검색/태그/난이도/인기·신규 필터/상세 | `live/discovery-navigation.spec.ts:62`~`:98` 실제 catalog 정렬·검색·레벨·관심사·상세; 인기/신규 둘 다 검사. `live/home-discovery.spec.ts:63` 실제 대화3개와 삭제 후2개로 인기 지표를 검증. 원장 `:674` 두 관련 실행 PASS | **VERIFIED 후보**. 기존 '실제 인기 집계 별도' 사유는 후속 증거로 해소됨 |
| CHAR-08 | 저장한 캐릭터를 홈·프로필에서 재접근 | `live/learning.spec.ts:67`~`:89` 즐겨찾기 UI/DB→홈→프로필→reload→해제 DB 및 발견 목록 복원. 전체89 PASS | **VERIFIED 유지**. 주 원장도 이미 VERIFIED |
| CHAR-09 | 잠긴 이미지와 해금된 이미지 구분 | `live/reward-preservation.spec.ts:82` locked 실루엣/원본 비노출, `:170` 원본 접근, `:182` ready/해금 표기; `live/mission-completed-edit.spec.ts` 완료 대화 편집 뒤 gallery 보존. 원장 `:496` completed-edit PASS, `:634` reward-preservation PASS, `:654` 강화 회귀 PASS | **VERIFIED 후보**. 캐릭터별 전용 gallery 페이지는 원문에 없는 추가 조건 |
| CHAR-10 | 이미지/텍스트 입력 검토, 신고, 비공개 전환 정책; 게시 정책 검사 | `live/safety-report.spec.ts:7`~`:55` 신고·중복·본인 신고403·일반 사용자 moderation403, 자원 불변. 원장 `:295` PASS와 전체89. `src/app/api/characters/[id]/report/route.ts:109` 이후 관리자 경로는 있으나 허용 관리자 처리 성공은 미실행. publishing `:239`의 안전 prompt 문구는 입력/게시 검토 실행 증거가 아님 | **PARTIAL**. 운영 처리 성공/검토 결과·공개 목록 차단 및 입력 콘텐츠 검토 부족 |
| DISC-01 | 오늘 추천·이어하기·인기·초급 미션·진도 요약 | `live/home-discovery.spec.ts:7` 관심사 변경/reload·공개 범위·초급선별·실제 인기; `live/home-resume.spec.ts` 미션/자유 대화 정확한 동일 ID; `live/learning-activity.spec.ts` 및 learning/reward 테스트의 실제 프로필 수치. 원장 `:644`, `:654`, `:674` PASS | **PARTIAL / 작은 화면 검증 공백**. 추천·이어하기·인기·초급은 증거 충분. `live/shell.spec.ts:33`은 홈 summary 가시성·테마를 확인하지만, 홈 전용 `src/widgets/learning-progress/ui/learning-summary.tsx:15`의 실제 streak/분/XP 표시값 단언은 해당 live 범위에서 찾지 못했으며 프로필 수치 검증을 홈 화면 증거로 치환하지 않음. 100개 API 목록 상한·전역 부하·매일 추천 교체는 추가 필수 조건으로 만들지 않음 |
| DISC-02 | 검색·복수 필터·빈 결과·상세 | `live/learning.spec.ts:114`, `live/discovery-navigation.spec.ts:62`, `:134` 실제 검색/복합 필터/빈 결과 및 상세. 원장 `:674`, `:685` 관련 회귀 PASS | **VERIFIED 후보**. 이 행은 인기 집계 정확성을 추가로 요구하지 않음 |
| DISC-03 | 검색·장소/난이도/시간 필터·상세 | `live/discovery-navigation.spec.ts:100` 및 `:212` 실제 복합 필터·검색·빈 결과 복구·상세. 원장 `:674`, `:685` PASS | **VERIFIED 후보** |
| DISC-04 | 키보드와 모바일에서 검색·필터·카드 접근 | `live/discovery-navigation.spec.ts:62` desktop Tab/Enter, `:134`와 `:212` 360px 문자 입력·검색·필터·Enter 상세 및 viewport 검사. 원장 `:685` 2 PASS | **VERIFIED 후보**. 실제 Chromium 문자 선택 경로를 검증했으며 native 방향키·전 모바일 기종 보장은 아님. 원문의 접근 가능 조건에 모든 브라우저 행렬을 덧붙이지 않음 |

## 가장 강한 실제 공백 세 가지

1. **AI 후보 생성·선택·저장 성공(CHAR-02)**: 실제 공급자 endpoint 부재가 확인됐다. 유효한 이미지 공급자로 서로 다른 복수 후보를 만들고, 무선택 저장 차단→선택→Storage/대표 이미지 일치까지 검사해야 한다. 별도 외형 설명 입력도 상세 여정에 명시되어 있으나 현재 builder는 구조화된 성격/목표로 prompt를 구성하므로 명시 입력 UX 여부를 함께 해결한다. 키 준비 없이 수동 PNG를 생성 성공으로 바꾸지 않는다.
2. **게시 전 세 턴 샘플(CHAR-05), authored 입력의 충실한 왕복(CHAR-01/04)**: 현재 preview는 고정 인사 한 문장이다. 이는 원문에 적힌 세 턴보다 부족한 제품 차이다. 성격 자유 서술/정도 설정도 상세 여정과 차이가 있다. 핵심 입력을 실제 UI로 저장하고 고정 버전의 공개 정보·컴파일 지침을 대조하는 테스트도 추가할 수 있다. '모든 시각적 조합' 같은 무한 조건은 필요 없다.
3. **검토 후 운영 조치의 성공(CHAR-10)**: 현재 증거는 신고 및 무권한 거부다. 임시 fixture에 허용 관리자 검토→정해진 review/private 상태·발견 목록/외부 조회 차단을 확인하는 성공 경로가 필요하다. 이미지·텍스트 입력/게시 검토가 실제로 어떤 정책 엔진/규칙을 거치는지도 구현 기준으로 명시하고 검사해야 한다. 안전 prompt 한 줄은 이 기능을 대체하지 않는다.

## 원장 반영 제안

기존 CHAR-08 유지 외에 CHAR-03/06/07/09와 DISC-02/03/04는 위의 구체적 근거로 VERIFIED 승격 후보다. 나머지 CHAR-01/02/04/05/10과 DISC-01은 공백을 유지한다. DISC-01은 이미 실제 데이터가 있는 learning/reward 흐름에서 홈 summary의 표시값과 reload를 대조하면 되는 작은 추가 검사다. 최신 전체99 실행 결과가 확정되면 부모가 변경 후 회귀 성공 여부를 확인하여 주 원장에 반영한다. 이 감사는 실행 중 suite의 성공을 선반영하지 않는다.
