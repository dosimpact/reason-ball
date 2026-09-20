# 원격 Supabase 비즈니스 케이스 인벤토리 — 2026-09-11

## 검증 계약

검증 대상 URL은 **http://dodonet.iptime.org:13000/** 이다. 실제 앱 UI → 실제 Route Handler → 실제 Supabase Auth/Postgres/Storage 경계를 통과해야 한다. 성공 응답을 `page.route().fulfill()`이나 localStorage fixture로 대체한 테스트는 이 계약의 실연동 PASS가 아니다. 실패 주입은 별도 복원력 사례로 표시한다. AI mock은 Auth/DB 실연동을 증명할 수 있지만 실제 AI 생성·도구·음성 품질까지 증명하지 않는다.

이 문서는 실행 결과가 아니라 **요구사항 및 검사 범위**다. 기획서 §8/§17의 모든 명시 ID를 보존한다. API 존재나 UI 버튼 존재를 기능 완료로 판정하지 않는다. 과거 validation 문서의 VERIFIED/DEFERRED_BY_USER는 당시 환경의 역사이며 현재 실연동 증거가 아니다. 현재 사용자는 실제 Supabase 검증을 요구했다.

## 근거와 조사 한계

- 기준: `docs/stock/business-design.md`, `docs/stock/system-design.md`, 프로젝트/웹 `AGENTS.md`.
- 실제 라우트 전수 목록: `apps/web/src/app/**/page.tsx`, `route.ts`. 화면은 `/`, `/characters`, `/characters/new`, `/characters/:id`, `/characters/:id/edit`, `/missions`, `/missions/new`, `/missions/:id`, `/missions/:id/edit`, `/chat/:characterId`, `/history`, `/profile`, `/shared/:token`.
- 실제 기능 근거: `features/auth-session/ui/auth-session.tsx`, `app/api/auth/email/route.ts`, `features/character-create/ui/character-builder.tsx`, `features/mission-create/ui/mission-builder.tsx`, `widgets/chat-workspace/ui/chat-workspace.tsx`, `features/chat-artifact/ui/*`, `app/profile/page.tsx`, `widgets/learner-settings`, `widgets/learning-notebook`, `widgets/saved-missions`, `widgets/creator-library`, `features/audio-playback`, `features/learning-assistance`, `app/api/ai/chat/route.ts`, `shared/api/learning/contracts.ts`.
- Graph MCP 도구가 제공되지 않아 generation/coverage를 확인할 수 없었다. 문서/라우트 목록과 관련 소스 읽기·문자열 검색으로 대체했다. 모든 내부 함수/DB 정책을 전수 감사한 것은 아니다. 다른 에이전트가 기존 E2E를 감사하므로 이 문서는 기존 테스트 PASS 여부를 재판정하지 않는다.
- 아래 `구현 경로 있음`은 대응 화면/API가 있다는 의미이며 세부 수용 기준의 완성·성공은 **미검증**이다. `부분/미구현`은 확인된 차이를 적는다. `운영/외부 미검증`은 추가 외부 증거가 필요하다.

## 스펙 분할과 실제 수용 시나리오

모든 저장 사례는 테스트 전용 사용자/콘텐츠를 만들고 UI 응답의 ID와 DB 소유자/행을 연결한다. 새 브라우저 context로 다른 사용자도 검사한다. 정리 시 테스트가 만든 ID만 삭제하고, 공유 seed나 기존 사용자 데이터는 수정하지 않는다. 각 묶음은 desktop과 360px에서 중요한 조작을 반복한다.

| 묶음 | 구체적인 수용 결과 |
|---|---|
| origin-session | 외부 HTTP 최초 방문에서 JS hydration 오류 없음; 게스트 자동 생성 후 새로고침/다른 경로에서도 같은 사용자 ID; API 오류가 빈 데이터로 숨겨지지 않음; 원격 주소 정상 쓰기와 미등록 Origin 거부 |
| shell-theme | 상단 새 채팅 **버튼** 클릭 후 새 UUID의 DB 대화 생성; keyboard 진입; dark→light 두 방향에서 아이콘과 computed color 변화; reload 유지; 모바일 메뉴/포커스/입력창 가림 없음 |
| account | 실제 이메일 계정 로그인·잘못된 자격 증명·로그아웃·세션 복원; 게스트 이메일 연결은 인증 메일→callback→같은 owner와 기록 보존까지 별도 검증; 인증 메일 없이 API 호출만 성공하면 전체 연결 PASS 금지 |
| discovery | 홈 추천/이어하기/진도→상세; 캐릭터 검색+태그+수준+정렬, 미션 검색+장소+수준+시간+정렬; 빈 결과→필터 해제; 키보드/모바일 카드 진입 |
| library | 즐겨찾기 추가/해제→홈·프로필·reload; 저장 미션 추가/해제→프로필·reload; 비가시 미션은 내용 누출 없이 해제; 실패 재시도는 같은 의도 유지 |
| preferences | 닉네임/목표/CEFR/관심 상황/교정/voice/rate/autoplay 저장→reload; 다른 계정 분리; 두 탭 revision 충돌은 편집 초안 보존; 채팅/TTS의 저장 설정 소비 |
| chat-basics | 추천 질문/직접 입력→user+assistant 행 저장; 다중 줄/Enter/submit/초안 복원/전송 초기화; 자동 제목·수동 이름 저장; 모델 검색·capability·선택 reload; 새 대화는 기존 대화 보존 |
| chat-stream | text/reasoning/tool 실제 part 점진 표시; stop/cancel 상태; 오류 retry와 reload 중복 메시지 없음; 이미 저장된 응답은 재조회로 복원; 승인 체크포인트 복원 후 Allow/Deny 후속 실행 |
| chat-actions | copy; up/down/reason 저장 reload; 사용자 메시지 편집→이후 branch 교체; 마지막 답변 재생성→원본/버전 정책과 무중복; `/new /clear /rename /model /theme /delete /purge` 실제 영속 결과 |
| history-sharing | 날짜 그룹/페이지네이션/대화 재개; private/unlisted/public 접근을 소유자·타인·미인증별 검사; 링크 철회·삭제 후 읽기 거부; 개별/전체 삭제 확인 취소 및 확정 reload; 삭제 범위 타인 불변 |
| attachments | JPEG/PNG picker·paste·preview·remove; 실제 Storage 업로드→메시지 저장→reload 이미지 로드; 파일 종류/크기/vision 제약; 실패 입력 보존→retry; 타인 attachment 접근 거부; 문서 지원은 별도 계약 확인 |
| artifact-text-code | Text/Code 생성→직접 편집/autosave→reload; targeted rewrite·문법 suggestion; 이전/최신/diff/복원; code 성공/error/timeout·격리·copy; 타인 읽기/수정 거부 |
| artifact-sheet-image | Sheet cell 편집/clean/analyze/CSV; Image 생성·편집·실제 Storage/버전 reload; 다운로드; 저장 충돌/오류 후 입력 보존 retry |
| character-creator | 모든 builder 입력·유효성·다음/이전·preview; AI 후보 선택→Storage→draft 저장→내 생성물; published 새 버전→기존 대화 고정 버전 유지; archive→신규 시작 차단·기존 기록 유지; 비소유자 편집 차단 |
| mission-creator | AI 구조화 초안→목표/표현/예시/단계 편집·순서·빈 입력 validation; 난이도/역할/시간/보상/선수 조건 저장; draft→publish→새 버전→archive; 권한 경계·기존 실행 고정 버전 |
| mission-learning | 상세 목표/표현/단계/시간/보상→새 실행+대화 원자 생성; double-click/retry 무중복; 선수 미션 미충족 차단·충족 시작; 최소 CEFR gate 별도 미구현; 목표/단계 표시와 reload 일치 |
| learning-help | 현재 단계 힌트·다른 단계 미리 연습·`/hint /goal`; 기존 초안에만 덧붙이고 자동 전송/진행 변경 없음; 메시지 재표현/답변 추천/교정+설명 토글·원문 보존·실패 retry |
| mission-result-reward | 실제 사용자 대화→평가 기준/4축/근거→불합격 계속 연습 또는 합격 완료; 결과 reload; 완료 응답 유실 retry 시 XP/해금 1회; 재도전 새 run·최고점 유지; 잠금 원본 URL 비노출; 획득 이미지 재조회·archive 뒤 접근 정책 |
| notebook-progress | 표현/교정/단어 저장→유형 필터/reload; 중복 원문 기존 메모 보존; 다른 사용자 분리; 원본 대화 삭제 뒤 스냅샷 유지; 미션 복습 메모 저장→프로필; 표현 수/완료/XP/UTC streak/최근7일 시간 일치 |
| audio | 실제 Speech 성공→loading/playing/pause/replay; 다른 버블 재생 시 첫 음성 정지; 동일 내용 cache hit; 편집 후 cache 무효화; 저장 voice/rate 반영; autoplay는 새 완료 응답만; 오류 재시도·AI 음성 고지 |
| report-guard | 자기 테스트 캐릭터 신고→실제 report 저장; 비인증/타인/owner 주입/잘못된 모델/교차 출처 거부; 사용자/IP rate limit 오류와 재시도 안내; 실제 moderation/quota/관찰성은 개별 운영 증거 필요 |

## 명시 요구사항 전수 매핑

우선순위 P0는 진입·세션·핵심 저장/권한, P1은 나머지 제품 흐름, P2는 운영/품질 gate다. 낮은 우선순위가 범위 제외를 뜻하지 않는다.

| ID | 요구 기능 | 수용 결과(원문 기준) | 현재 구현 판정 | 우선순위 | 권장 스펙 묶음 |
|---|---|---|---|---|---|
| CHAT-01 | 게스트/회원 인증 | 체험은 익명 사용자, 동기화·창작·공개는 회원 권장 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | origin-session / account |
| CHAT-02 | 새 대화와 대화 기록 | 캐릭터 및 선택 미션 단위로 대화 생성·목록·재개 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / history-sharing |
| CHAT-03 | 스트리밍 응답 | Vercel AI SDK UI 메시지 스트림 사용 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / history-sharing |
| CHAT-04 | 모델 선택 | 허용된 모델 카탈로그에서 대화별 선택, 기본값 제공 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-05 | 첨부파일 | 이미지/문서 첨부와 메시지 파트 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-06 | 메시지 편집·재생성 | 사용자 메시지 편집 후 분기, 마지막 답변 재생성 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-07 | 응답 평가 | 좋아요/싫어요와 선택적 사유 저장 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-08 | 공개 범위·공유 | private/unlisted/public 정책과 공유 링크 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-09 | 대화 삭제 | 소유자만 삭제, 연결된 개인 데이터 정책 적용 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / history-sharing |
| CHAT-10 | 추천 프롬프트 | 캐릭터·미션·학습 단계별 다음 발화 제안 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-11 | 도구 호출 | 미션 상태 조회, 표현 힌트, 평가, 사전/상황 정보 도구 | 부분: chat route에 weather만 등록; 미션/사전 도구 미구현 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-12 | 아티팩트 | 긴 학습 노트, 단어장, 미션 요약을 별도 패널로 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-13 | 스트림 복구 | 새로고침/네트워크 단절 뒤 진행 중 응답 복구 정책 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-14 | 사용량 제한 | 사용자 등급 및 비용별 속도·일일 생성 제한 | 부분: 속도 제한과 등급별 일일 quota 구분 필요 | P1 | chat-basics / chat-actions / history-sharing |
| CHAT-15 | 멀티모달 메시지 | text/file/tool/reasoning 등 파트 기반 메시지 모델 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / history-sharing |
| REF-01 | 익명 게스트 세션 | 로그인 전 제한된 채팅과 기록 유지 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | origin-session / account |
| REF-02 | 가입·로그인·로그아웃 | 게스트를 회원으로 연결해 기존 데이터 보존 | 부분: email link API/메일 callback 경로 있음; UI 비밀번호 설정 폼 없음 | P1 | chat-basics / chat-actions / artifact-* |
| REF-03 | 반응형 app shell | desktop/mobile sidebar, 새 채팅, 키보드 접근 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | shell-theme |
| REF-04 | 테마 | light/dark 전환과 다음 방문 유지 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | shell-theme |
| REF-05 | 새 채팅·추천 질문 | 추천 클릭으로 고유 대화 시작 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | shell-theme |
| REF-06 | Composer | 여러 줄, Enter/submit, draft 보존, 전송 후 초기화 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / artifact-* |
| REF-07 | Slash command | `/new`, `/clear`, `/rename`, `/model`, `/theme`, `/delete`, `/purge` 실제 동작 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-08 | 모델 선택 | 검색·선택·저장과 vision/tools/reasoning capability 안내 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-09 | 스트리밍 | text/reasoning/tool part를 점진 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-10 | 생성 제어 | waiting/thinking/error, Stop, Retry | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / artifact-* |
| REF-11 | 스트림 재개 | reload/연결 단절 뒤 중복 없이 이어 받기 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / artifact-* |
| REF-12 | typed message parts | text, reasoning, file, tool-call/result 저장·복원 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-13 | rich content | Markdown, code, table, math를 안전하게 표현 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-14 | 첨부파일 | JPEG/PNG 선택·붙여넣기·preview·제거·오류·vision 제한 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-15 | 메시지 액션 | copy와 assistant up/down vote | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-16 | 메시지 편집 | 편집 지점 이후 분기를 교체하고 재생성 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-17 | 제목 | 첫 메시지 자동 제목과 수동 이름 변경 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-18 | 기록 | 날짜 그룹, pagination, 대화 재개 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-19 | 삭제 | 개별/전체 삭제 확인과 영속 반영 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / artifact-* |
| REF-20 | 공개·공유 | private/public 링크와 비소유자 read-only 화면 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / artifact-* |
| REF-21 | 도구 실행 | 다단계 server tool과 typed state UI | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-22 | 도구 승인 | 민감 도구 Allow/Deny와 후속 대화 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-23 | 날씨 도구 | 성공·거절·실패 UI를 포함한 예시 tool | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-24 | Artifact 생성 | Text, Code, Image, Sheet workspace | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-25 | Artifact 편집 | 직접 편집, targeted edit, rewrite, autosave | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-26 | Artifact 버전 | 이전/다음, diff, 복원, 최신 복귀 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-27 | Text Artifact | 문서와 문법·문장 suggestion 적용 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-28 | Code Artifact | 편집, 격리 실행, output/error, copy | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-29 | Sheet Artifact | 표 편집, 정리, 분석, CSV copy | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-30 | Image Artifact | 이미지 생성, 편집, 버전, 저장·재조회 | 운영/외부 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-31 | 영속성 | chat/message/vote/artifact/suggestion/stream reload 복원 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | chat-basics / chat-actions / artifact-* |
| REF-32 | 비용 보호 | 인증, 소유권, 사용자/IP rate limit, bot 방어, model allowlist | 부분: 인증/출처/model 경계 있음; bot/분산 quota 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-33 | 오류 복구 | chat/upload/tool/artifact/storage별 설명과 retry | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | chat-basics / chat-actions / artifact-* |
| REF-34 | 관찰 가능성 | request/stream/tool/cost/error 상관 추적 | 운영/외부 미검증 | P2 | chat-basics / chat-actions / artifact-* |
| CHAR-01 | 캐릭터 생성 단계 | 이름, 소개, 성격, 목표, 관계, 말투, 교육 태도, 금지 지침 입력 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | character-creator / discovery |
| CHAR-02 | AI 프로필 이미지 생성 | 프롬프트로 복수 후보 생성, 하나를 선택해 저장 | 운영/외부 미검증 | P1 | character-creator / discovery |
| CHAR-03 | Supabase Storage 저장 | 원본/게시 자산 정책에 맞는 버킷과 경로에 업로드 | 운영/외부 미검증 | P1 | character-creator / discovery |
| CHAR-04 | 캐릭터 모델링 | 입력값을 구조화된 버전으로 저장하고 런타임 프롬프트로 컴파일 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | character-creator / discovery |
| CHAR-05 | 미리보기 | 게시 전에 외형, 공개 정보, 짧은 대화 샘플 확인 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | character-creator / discovery |
| CHAR-06 | 초안·게시·버전 | draft/published/archived 상태와 불변 게시 버전 유지 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | character-creator / discovery |
| CHAR-07 | 캐릭터 발견 | 검색, 태그, 난이도, 인기/신규 필터 및 상세 페이지 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | character-creator / discovery |
| CHAR-08 | 즐겨찾기 | 캐릭터를 저장하고 홈·프로필에서 다시 접근 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | character-creator / discovery |
| CHAR-09 | 보상 갤러리 | 잠긴 이미지와 해금된 이미지를 구분해 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | character-creator / discovery |
| CHAR-10 | 안전 정책 | 이미지/텍스트 입력 검토, 신고와 비공개 전환 정책 | 부분: 신고 UI/API 있음; 실제 moderation 운영 미검증 | P1 | character-creator / discovery |
| MISSION-01 | 미션 생성 단계 | 상황, 학습 수준, 역할, 목표, 필수 표현, 단계, 성공 조건 입력 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-creator / mission-learning |
| MISSION-02 | AI 초안 | 주제 한 줄로 구조화된 미션 초안과 예시 대화 생성 | 운영/외부 미검증 | P1 | mission-creator / mission-learning |
| MISSION-03 | 편집·검증 | 단계 순서, 빈 목표, 수준 부적합 표현을 검사 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-creator / mission-learning |
| MISSION-04 | 보상 설정 | 완료 시 해금할 캐릭터 이미지와 조건 설정 | 운영/외부 미검증 | P1 | mission-creator / mission-learning |
| MISSION-05 | 초안·게시·버전 | draft/published/archived와 게시 버전 유지 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-creator / mission-learning |
| MISSION-06 | 미션 발견 | 장소, 난이도, 소요 시간, 캐릭터, 인기/신규 필터 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-creator / mission-learning |
| MISSION-07 | 미션 상세 | 목표, 권장 표현, 단계, 예상 시간, 보상 미리보기 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-creator / mission-learning |
| MISSION-08 | 학습 적합성 | Pre-A1~A2 어휘·문장 길이·지원 힌트 정책 | 운영/외부 미검증 | P1 | mission-creator / mission-learning |
| MISSION-09 | 선행 조건 | 선택적인 선수 미션과 레벨 요구 사항 | 부분: 선수 조건 존재; 최소 CEFR 필드/시작 gate 미구현 | P1 | mission-creator / mission-learning |
| MISSION-10 | 재도전 | 최고 결과는 보존하고 새로운 실행을 시작 가능 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-creator / mission-learning |
| LEARN-01 | 미션 시작 | 캐릭터·미션 컨텍스트로 새 실행과 대화 생성 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | mission-learning / mission-result-reward / learning-help |
| LEARN-02 | 목표 추적 | 진행 중/완료한 목표와 현재 단계를 UI에 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-learning / mission-result-reward / learning-help |
| LEARN-03 | 역할 일관성 | 캐릭터 성격·말투와 미션 역할을 응답 전반에 유지 | 운영/외부 미검증 | P2 | mission-learning / mission-result-reward / learning-help |
| LEARN-04 | 초급자 스캐폴딩 | 단계별 힌트, 추천 답변, 쉬운 재표현 제공 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-learning / mission-result-reward / learning-help |
| LEARN-05 | 턴 평가 | 의미 전달, 문법, 어휘, 자연스러움을 근거와 함께 평가 | 부분: 수동 평가의 축별 사용자 근거·점수·DB/UI 복원 실연동 통과; 턴 단위 피드백 경계·의미적 정확도는 별도 | P1 | mission-learning / mission-result-reward / learning-help |
| LEARN-06 | 교정 방식 | 대화를 끊지 않는 짧은 교정과 상세 설명 토글 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-learning / mission-result-reward / learning-help |
| LEARN-07 | TTS | 캐릭터 메시지 버블을 눌러 해당 영어 문장을 재생 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-learning / mission-result-reward / learning-help |
| LEARN-08 | 재생 상태 | 로딩, 재생 중, 실패, 다시 재생을 접근 가능하게 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-learning / mission-result-reward / learning-help |
| LEARN-09 | 완료 판정 | 필수 목표 달성과 사용자 의사를 근거로 서버가 판정 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | mission-learning / mission-result-reward / learning-help |
| LEARN-10 | 결과 화면 | 달성 목표, 잘한 점, 교정, 새 표현, 다음 추천 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-learning / mission-result-reward / learning-help |
| LEARN-11 | 보상 해금 | 성공 실행과 보상 자산을 멱등적으로 연결 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | mission-learning / mission-result-reward / learning-help |
| LEARN-12 | 복습 노트 | 대화에서 표현·교정·단어를 저장하고 프로필에서 열람 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-learning / mission-result-reward / learning-help |
| TTS-01 | 버블 음성 재생 | assistant/character bubble의 명시적 버튼으로 재생 | 운영/외부 미검증 | P1 | audio |
| TTS-02 | 재생 토글 | 같은 메시지를 다시 누르면 pause/play | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | audio |
| TTS-03 | 단일 재생 | 다른 버블을 누르면 기존 음성 정지 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | audio |
| TTS-04 | 개인화 | 캐릭터 voice와 사용자 속도/자동재생 설정 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | audio |
| TTS-05 | 접근 가능한 상태 | loading/playing/paused/error를 이름과 live 상태로 제공 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | audio |
| TTS-06 | 캐시 | message version, voice, model, text hash가 같으면 재사용 | 운영/외부 미검증 | P1 | audio |
| TTS-07 | 편집 무효화 | 메시지가 바뀌면 이전 음성 캐시를 사용하지 않음 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | audio |
| TTS-08 | 고지 | 사용자가 듣는 음성이 AI 생성임을 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | audio |
| REWARD-01 | 원자적 해금 | 미션 합격과 같은 서버 트랜잭션에서 1회 발급 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | mission-result-reward |
| REWARD-02 | 멱등성 | retry/중복 callback/reload에도 XP와 자산 중복 없음 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | mission-result-reward |
| REWARD-03 | 잠금 표현 | 미해금 원본 URL 없이 silhouette/blur preview만 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-result-reward |
| REWARD-04 | 성공 경험 | 해금 상태와 캐릭터 반응을 명확히 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-result-reward |
| REWARD-05 | Gallery | 프로필에서 획득 근거와 원본을 다시 열람 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-result-reward |
| REWARD-06 | 보존 정책 | 원본 미션/캐릭터 archive 뒤에도 획득 정책을 유지 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | mission-result-reward |
| DISC-01 | 홈 | 오늘의 추천, 이어하기, 인기 캐릭터, 초급 미션, 진도 요약 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | discovery |
| DISC-02 | 캐릭터 찾기 | 검색 및 복수 필터, 빈 결과, 상세 진입 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | discovery |
| DISC-03 | 미션 찾기 | 검색 및 장소/난이도/시간 필터, 상세 진입 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | discovery |
| DISC-04 | 통합 탐색 | 키보드와 모바일에서도 검색·필터·카드 접근 가능 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | discovery |
| PROFILE-01 | 사용자 프로필 | 닉네임, 목표, CEFR, 관심 상황, 음성/교정 선호 설정 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | preferences / library / notebook-progress |
| PROFILE-02 | 학습 진도 | 완료 미션, 연속 학습, 학습 시간, 표현 수 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | preferences / library / notebook-progress |
| PROFILE-03 | 라이브러리 | 즐겨찾기 캐릭터, 저장 미션, 대화 기록, 복습 노트 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | preferences / library / notebook-progress |
| PROFILE-04 | 보상 컬렉션 | 해금 이미지, 잠긴 이미지, 획득 근거 표시 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | preferences / library / notebook-progress |
| PROFILE-05 | 창작물 관리 | 내 캐릭터·미션의 초안/게시/수정 진입 | 구현 경로 있음; 세부 수용 기준 미검증 | P1 | preferences / library / notebook-progress |
| NFR-01 | 반응형 | 360px 모바일부터 데스크톱까지 핵심 여정 사용 가능 | 구현 경로 있음; 세부 수용 기준 미검증 | P2 | report-guard / 전체 주요 흐름 |
| NFR-02 | 접근성 | 키보드 탐색, 명시적 레이블, 상태 알림, 색상 외 정보 제공 | 구현 경로 있음; 세부 수용 기준 미검증 | P2 | report-guard / 전체 주요 흐름 |
| NFR-03 | 체감 성능 | 즉시 낙관 UI, 스트리밍 상태, 이미지 지연 로딩/대체 UI | 운영/외부 미검증 | P2 | report-guard / 전체 주요 흐름 |
| NFR-04 | 복원력 | 생성 실패 시 입력 보존, 재시도, 중복 보상 방지 | 구현 경로 있음; 세부 수용 기준 미검증 | P0 | report-guard / 전체 주요 흐름 |
| NFR-05 | 개인정보 | 비공개 기본값, 최소 수집, 삭제/내보내기 경로 | 부분: 삭제 경로 있음; 내보내기/보존 정책 경로 미확인 | P0 | report-guard / 전체 주요 흐름 |
| NFR-06 | 안전 | 입력·출력·이미지 정책, 신고, 미성년자 친화 기본값 | 부분: 신고/guard 있음; 운영 moderation 미검증 | P2 | report-guard / 전체 주요 흐름 |
| NFR-07 | 비용 통제 | 사용자/기능별 한도, 이미지·TTS·대화 사용량 계측 | 부분: rate limit과 비용 원장/등급 quota 구분 필요 | P2 | report-guard / 전체 주요 흐름 |
| NFR-08 | 검증 가능성 | 외부 시스템 mock과 안정적인 test id/role 기반 E2E | 구현 경로 있음; 세부 수용 기준 미검증 | P2 | report-guard / 전체 주요 흐름 |
| NFR-09 | 관찰 가능성 | 요청·생성 job·오류·지연을 상관 ID로 추적 | 운영/외부 미검증 | P2 | report-guard / 전체 주요 흐름 |
| NFR-10 | 국제화 준비 | UI 문자열과 학습 언어/설명 언어를 분리 가능하게 설계 | 학습/설명 필드는 분리됨; UI 문구 resource 경계 미완성. 전체 번역·언어 전환 메뉴를 원문 요구로 추가하지 않음 | P2 | report-guard / 전체 주요 흐름 |

## 완료를 막을 수 있는 실제 조건

1. 인증 메일/PKCE 연결은 실제 이메일 전달·허용 callback 주소·사용자 확인이 필요하다. 테스트용 admin 계정 생성으로 로그인 검증은 가능하지만 게스트→메일 연결 UI 전체 성공과 동일하지 않다.
2. `app/api/ai/chat/route.ts`는 capability가 tools인 모델에 weather만 제공한다. 기획 CHAT-11의 미션/표현/평가/사전 도구는 테스트만 추가해서 완료할 수 없다.
3. `shared/api/learning/contracts.ts` Mission에는 prerequisites만 있고 최소 CEFR 필드가 없다. 난이도 표시를 레벨 gate로 간주하면 안 된다.
4. 외부 HTTP 주소는 secure-context API(예: clipboard, 일부 브라우저 기능)의 제약을 실제 환경에서 노출할 수 있다. 테스트에 보안 컨텍스트 우회 플래그를 넣어 성공시킨 결과는 사용자 환경 성공이 아니다.
5. AI 공급자의 모델/tool/image/speech 지원 여부와 실제 언어 품질은 별도 실호출 증거가 필요하다. 모델 allowlist/capability를 테스트 편의를 위해 가짜로 확장하지 않는다.
6. 기획의 개인정보 export/보존, 비용 원장/분산 quota, moderation/i18n처럼 구현 자체가 부족한 항목은 테스트 SKIP을 PASS로 합산하지 않는다. 사용자 목표를 좁혀 “일부 대표 흐름=모든 비즈니스”로 기록하지 않는다.
7. 기획의 운영 KPI/수익 모델/제한 베타 운영은 브라우저 기능 시나리오와 구분한다. 범위 밖이라고 삭제하지 말고 운영 검증 미실행으로 유지한다.

## Learning Points

- UI/API의 존재, mock 성공, 실제 Supabase 성공은 서로 다른 증거다.
- 비즈니스별 저장·reload·다른 사용자 권한·실패 복구를 함께 연결해야 한다.
- 명시된 미구현 요구사항은 E2E 개수 증가만으로 완료되지 않는다.

## Next Step

상위 에이전트는 이 ID 인벤토리와 기존 E2E 감사 결과를 조합해 실제 URL 전용 spec에 사례를 연결하고, `pnpm test:e2e:supabase` 실행 결과에 각 ID의 PASS/FAIL/미구현/외부미검증을 기록한다.
