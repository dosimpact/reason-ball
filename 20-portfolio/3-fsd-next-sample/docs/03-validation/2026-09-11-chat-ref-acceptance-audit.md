# CHAT-01~09 / REF-01~20 명시 수용 조건 감사

작성일: 2026-09-11. 범위는 `docs/01-business/character-english-chat.business.md:126–171`의 29개 행과 관련 본문 `:283–285,410–411,488–489`이다. CHAT-10은 부모 작업이므로 제외했다. 제품·테스트·주 진행표를 변경하지 않았다.

그래프 Verify 시도는 부모가 전달했다. 현재 프로젝트 목록에는 todo/proxy만 있고 웹의 chat-workspace/live 경로 coverage도 project not indexed다. 웹 generation·심볼·완전한 그래프 coverage는 얻지 못했으며, 아래 판단은 정확한 문서·소스·live spec 읽기 대조다. 새로운 브라우저/서비스 요청은 수행하지 않았다.

## 판정 의미와 실행 근거

`VERIFIED 후보`는 **그 행의 명시 조건**을 실행 증거가 직접 다룬다는 제안이다. 모든 환경·보안 공격·오류 조합이나 상위 release 완료 선언이 아니다. 특히 business.md:148은 REF를 최종 gate로 규정하므로 CHAT 요약 행이 충족되어도 미완료 REF는 사라지지 않는다. `유지`는 이미 VERIFIED인 행이다. `PARTIAL 유지`에는 임의의 “모든 조합” 대신 아래 실제 남은 조건을 썼다.

근거 원장은 `docs/03-validation/2026-09-11-live-e2e-progress.md`다.

- **E1** `:367–369`: 당시 고정된 실제 66개 전체 **66 PASS / 11.1분**. 기존 auth/chat/chat-actions/chat-management/guest-ai/clipboard/첨부/tool/network 사례의 역사적 증거.
- **E2** `:438`: rich-content/chat/branch-conflict/shell 관련 **10 PASS / 1.7분**. `:443–451`: malformed rich content **3 PASS**, 첨부 편집 최종 **1 PASS / 23.8초**.
- **E3** `:554–556`: 당시 고정 코드 전체 **89 PASS / 17.5분**. JPEG/PDF·rich content·미션·typed tool 등 당시 포함 테스트의 근거. 초기 실패가 있던 OCR fixture 기록은 이 최종 결과와 구분되어 보존된다.
- **E4** `:638–644`: home-resume+shell **4 PASS / 27초**. `:679–685`: 모바일 키보드 캐릭터/미션 **2 PASS / 13.6초**.
- **E5** `:692–696`: 프록시 재실행 후 게스트 세션·기존 선택 모델·실제 전송/편집/재생성 **3 PASS / 30.9초**.
- **E6** `:699–708`: public RLS 최초 **2 PASS / 16.6초**, 제목 불변 강화 후 public **PASS**. 모델 initial exact-label locator 실패는 별도 보존; 최종 모델 독립성 **1 PASS / 20.5초**. 실패 실행을 전체 PASS로 바꾸지 않았다.

부모가 시작한 최신 전체 99개 실행(session 35926)은 이 감사 작성 시 **진행 중**이다. 그 결과를 이 문서의 PASS 근거로 사용하지 않는다. 서로 다른 실행을 합산하여 최신 전체 통과라고 부르지 않는다. 아래 spec 경로는 `apps/web/tests/e2e/live/` 기준이다.

## CHAT 요약 행

| ID | 원문 조건 | 권고 | 직접 증거 / 정확한 잔여 범위 |
|---|---|---|---|
| CHAT-01 | 익명 체험, 회원 인증 | VERIFIED 후보(요약 범위) | `auth.spec.ts:22–64,67–95` 익명 UID/reload·실패 로그인 보존·기존 회원 전환·logout, `guest-ai.spec.ts:6` 실제 익명 채팅·저장. E1/E3/E5. 회원 **권장**을 반드시 모든 창작 금지로 재해석하지 않는다. 익명→신규 회원 동일 UID 연결은 REF-02의 실제 미완료 gate로 유지한다. |
| CHAT-02 | 캐릭터/선택 미션 대화 생성·목록·재개 | VERIFIED 후보 | `chat.spec.ts:41–95`, `learning-journey.spec.ts` 미션 대화 저장, `home-resume.spec.ts` 미션/자유 대화 동일 ID·메시지/DB 불변. E1/E3/E4. 날짜 그룹·pagination은 별도 REF-18에 남긴다. |
| CHAT-03 | Vercel AI SDK UI 메시지 스트림 | VERIFIED 후보 | `chat.spec.ts:97`, `stream-recovery.spec.ts:27–38` 실제 텍스트를 받은 뒤 중지, DB cancelled, 재시도. 실제 route의 streamText→toUIMessageStream 경로도 존재. E3/E5. “장시간 모든 오프라인”은 이 행의 조건이 아니다. |
| CHAT-04 | 허용 카탈로그, 대화별 선택, 기본값 | VERIFIED 유지 | `chat-actions.spec.ts:156` 실제 defaultModelId∈items, A 기본→다른 모델, B 기본 독립 유지, 두 실제 AI 헤더/assistant DBmodel, 각 reload. E6 최종 성공. |
| CHAT-05 | 이미지/문서 첨부와 파트 표시 | VERIFIED 후보 | `attachment-composer.spec.ts:116`, `jpeg-attachment.spec.ts`, `pdf-attachment.spec.ts` 실제 PNG/JPEG/PDF 업로드·모델 입력·DB/파일 재조회·화면 복원. E3. 암호화/스캔/다중 페이지 PDF 전체를 이 요약 행에 추가하지 않는다. |
| CHAT-06 | 사용자 편집 후 분기, 마지막 답변 재생성 | VERIFIED 후보 | `chat.spec.ts:97,176` 단일 및 실제 3턴 중간 분기, `chat-branch-conflict.spec.ts`, `chat-actions.spec.ts:94` 폐기 답변 피드백 연결 제거, attachment-edit. E2/E3/E5. 모든 미션/첨부 동시 조합은 별도 위험 범위다. |
| CHAT-07 | 좋아요/싫어요·선택 사유 저장 | VERIFIED 후보 | `chat-actions.spec.ts:54–90` null 사유 upvote→downvote+사유→reload→취소·타 계정 거부. E1/E3. 명시 조건에 직접 대응한다. |
| CHAT-08 | private/unlisted/public 정책과 공유 링크 | PARTIAL 유지 | `rls.spec.ts:22,79`, chat-management의 실제 토큰 읽기·public 직접 읽기·소유권·private 철회는 E6까지 충족. 다만 현재 사용자에게 보이는 share-link는 잘못된 `lingua.local`이며 외부 HTTP 복사 버튼은 no-op 가능. business.md:488의 취소 가능 조건도 API만 검증했고 사용자 UI 경로는 없다. |
| CHAT-09 | 소유자 삭제·연결된 개인 데이터 정책 | PARTIAL 유지 | `chat-management.spec.ts:87–150`, `chat.spec.ts:127–174` 소유자 범위 확인/취소/영속 삭제는 E1/E3. “전체 동시 삭제” 대신, 실제 첨부 있는 대화 삭제 후 기존 보호 다운로드·공유 링크 접근 및 연결 기록 정책을 직접 확인하는 것이 남은 조건이다. 물리 Storage 즉시 삭제를 원문이 정하지 않았으므로 임의로 요구하지 않는다. business.md:489는 삭제와 보존의 차이 설명도 요구한다. |

## REF 상세 gate

| ID | 원문 조건 | 권고 | 직접 증거 / 정확한 잔여 범위 |
|---|---|---|---|
| REF-01 | 로그인 전 제한된 채팅·기록 유지 | VERIFIED 후보 | guest-ai 실제 익명 채팅/동일 UID·저장/reload, auth 익명 세션. E1/E3/E5. 세션 장기 만료 전체는 추가 조건이 아니다. 등급별 quota 전체는 CHAT-14다. |
| REF-02 | 게스트 회원 연결, 기존 데이터 보존 | PARTIAL 유지 | `auth.spec.ts:35–64`는 **다른 기존 회원 계정으로 전환**하며 게스트 데이터 접근이 끊기는 것을 확인한다. 동일 익명 UID의 신규 회원 연결 증거가 아니다. 실제 이메일/PKCE 수신과 연결 전후 UID·대화·진도 보존이 필요하며 메일 수신 자격 증명이 현재 외부 제약이다. |
| REF-03 | desktop/mobile sidebar·새 채팅·키보드 | VERIFIED 후보 | shell:27,53 및 discovery-navigation의 데스크톱/360px 실제 키보드 검색·카드 이동, chat:41 새 대화. E3/E4. 모든 화면/해상도 조합으로 확대하지 않는다. |
| REF-04 | light/dark·다음 방문 유지 | VERIFIED 유지 | shell:27 양방향 아이콘/실제 색·reload. E4/E5와 별도 shell 기록. |
| REF-05 | 추천 클릭으로 고유 대화 시작 | PARTIAL 유지 | chat:41 고유 새 대화와 chat-actions:28–36 기존 대화 추천 삽입은 각각 증거가 있다. 그러나 추천 클릭 자체가 새 고유 대화를 시작한다는 단일 결과는 검증되지 않는다. 현재 추천 버튼은 기존 composer의 setInput만 호출한다(`chat-workspace.tsx:1131`). 원문 의미를 “기존 대화의 다음 문장”으로 몰래 바꾸지 말고 시작 추천 흐름을 별도로 구현/검증한다. |
| REF-06 | 여러 줄·Enter/submit·초안 보존·전송 후 초기화 | VERIFIED 후보 | chat-actions:30–51 Enter/ShiftEnter/전송 후 empty, mission-runs:88–108 기존 초안+힌트/reload, network-recovery:5 실패 초안·재시도, attachment-composer. E1/E3. 모든 IME를 추가 gate로 만들지 않는다. |
| REF-07 | 명시된 7개 slash 실제 동작 | PARTIAL 유지 | chat-management:111–145 및 chat:131–152는 `/new,/clear,/delete,/purge`를 실행한다. 제목 변경은 관리 UI, 모델·테마는 일반 UI로 검증됐지만 `/rename,/model,/theme` 문자 명령 경로의 직접 live 증거가 없다. `chat-workspace.tsx:661–700`의 실제 명령 경로를 대상으로 UI·DB·reload 검증이 필요하다. |
| REF-08 | 모델 검색·선택·저장·vision/tools/reasoning 안내 | PARTIAL 유지 | chat-actions:24 검색/선택, E6 저장/독립성; attachment-composer:49 capability 기반 vision 차단 증거. 그러나 실제 카탈로그 각 capability 값과 화면의 세 안내가 일치한다는 전용 단언은 없다. AI가 해당 기능을 전부 생성해야 한다는 조건으로 확대할 필요는 없다. |
| REF-09 | text/reasoning/tool 점진 표시 | PARTIAL 유지 | stream-recovery:27–32 실제 text 중간 출력, tool-approval:23–42 승인 대기→결과 전이. reasoning의 실제 스트림 표시 증거는 없음. 모델이 공개 reasoning 요약을 공급하지 않는 경우 억지로 합성하지 말고 공급자 지원 제약을 기록한다. |
| REF-10 | waiting/thinking/error·Stop·Retry | PARTIAL 유지 | 실제 Stop·cancelled·재시도와 네트워크 오류 복구는 E3 및 후속 observation 검증. waiting/thinking의 구체적 상태 표시를 직접 단언하지 않는다. 모든 키보드 조합 대신 이 명시 상태가 잔여다. |
| REF-11 | reload/연결 단절 뒤 중복 없이 재개 | PARTIAL 유지 | network-recovery:5 전송 전 실패, :71 완료 응답 유실 후 추가 AI 없이 복원, stream-recovery:32 Stop **후** reload/명시 retry는 E3. 생성이 진행 중일 때 Stop 없이 reload/연결 단절하는 한 사례가 비어 있다. 동일 토큰 스트림 ID 유지나 장시간 OS 오프라인을 새 조건으로 만들지 않는다. |
| REF-12 | text/reasoning/file/tool-call/result 저장·복원 | PARTIAL 유지 | text/file는 attachment, 승인 요청/결과/거부는 tool-approval:17–48, E3. reasoning 파트 실제 DB·reload 증거가 없다. '모든 혼합 순서' 대신 빠진 타입을 명시한다. |
| REF-13 | Markdown/code/table/math 안전 표현 | VERIFIED 후보 | rich-content:33,79,111 실제 저장 내용·모바일 overflow·위험 HTML/URL·malformed 수식/코드 원문 유지·후속 실제 턴. E2/E3. 전체 XSS corpus 완성을 뜻하지 않는다. |
| REF-14 | JPEG/PNG 선택·붙여넣기·preview·제거·오류·vision 제한 | VERIFIED 후보 | attachment-composer:22,49,116과 jpeg-attachment의 실제 MIME별 업로드/전송/reload. E3. clipboard paste는 테스트가 명시한 DOM paste이며 OS 클립보드 전체 연동으로 확대하지 않는다. 파일 형식×모든 동작의 임의 Cartesian 조합을 필수로 만들지 않는다. |
| REF-15 | copy와 assistant up/down | VERIFIED 후보 | clipboard:22 네이티브 명령 실제 호출/문자열/결과·초안, :48 실패 안내, chat-actions:54 투표. E1/E3. share-link 복사 버그는 별도 공유 경로이며 메시지 copy 증거를 부정하지 않는다. |
| REF-16 | 편집점 이후 분기 교체·재생성 | VERIFIED 후보 | chat:97,176, chat-branch-conflict와 feedback branch 검사. E2/E3/E5. |
| REF-17 | 첫 메시지 자동 제목·수동 이름 변경 | PARTIAL 유지 | chat:58/chat-management:37은 수동 제목 및 기록 반영. 현재 생성 제목은 캐릭터/미션 기본 제목(`chat-workspace.tsx:113`), 이후 저장 경로에는 첫 메시지 기반 자동 제목 변경 증거가 없다. 자동 제목은 실제 구현/검증 공백이며 AI로 생성해야 한다는 조건은 없다. |
| REF-18 | 날짜 그룹·pagination·재개 | PARTIAL 유지 | history 재개 E3/E4는 충족. `app/history/page.tsx`의 날짜 그룹/4개 page·더 보기 UI를 실제 서로 다른 날짜/여러 기록으로 확인하는 live 사례는 없다. 단순 한 기록 재개를 pagination 증거로 사용하지 않는다. |
| REF-19 | 개별/전체 삭제 확인·영속 반영 | VERIFIED 후보 | chat-management:87–150 확인/취소/잘못된 확인문구·소유자 범위, chat:127–174 실제 DB/재조회. E1/E3. Storage 물리 정리 등 CHAT-09 정책까지 함께 완료라고 하지 않는다. |
| REF-20 | private/public 링크·타 사용자 read-only | PARTIAL 유지 | 실제 공개/비공개·토큰·다른 브라우저 composer 부재·권한 거부는 E6. 화면 표시/복사 링크를 다른 브라우저에 전달하는 사용자 경로가 아직 올바르지 않음. 행 자체에 revoke **UI**가 명시된 것은 아니나 business.md:488에 링크 취소 가능이 별도로 명시되어 있다. |

총 29행에서 VERIFIED 후보 14행, 기존 VERIFIED 유지 2행, PARTIAL 유지 13행을 제안한다. 이는 주 진행표 갱신이 아니며 현재 전체 114행 분류를 바꾸지 않았다. 소스/실행 범위가 바뀌면 후보를 다시 대조해야 한다.

## 가장 우선할 실제 공백 3개

1. **사용 가능한 공유 링크/철회 경로**: `apps/web/src/widgets/chat-workspace/ui/chat-workspace.tsx:1158`의 표시 URL은 `lingua.local/shared/...`; 복사는 `navigator.clipboard?.writeText(...)`라 현재 HTTP에서는 silent no-op 가능하다. 실제 origin URL 표시·공유 copyText 경로·성공/실패 안내를 연결하고, 버튼 복사 결과로 별도 브라우저 read-only 진입→소유자 철회→재조회 거절을 확인한다. 이미 부모가 같은 버그를 확인했다. 현재 전체 실행 중이므로 수정하지 않았다.
2. **첫 메시지 자동 제목(REF-17)**: 새 저장 대화에 짧은 실제 사용자 메시지를 보낸 후 목록/헤더/DB 제목이 해당 내용에 맞게 정해지고 reload에서도 유지되는 사례가 필요하다. 두 번째 메시지가 수동 제목을 덮어쓰지 않는 경계도 함께 확인한다. 현재 기본 캐릭터 제목과 수동 rename 증거를 자동 제목 PASS로 바꾸지 않는다.
3. **게스트→신규 회원 연결(REF-02)**: 실제 메일 확인/PKCE를 끝낸 뒤 UID·기존 대화·학습 기록이 유지되는 흐름이 남아 있다. 기존 확인 회원에 signIn한 후 게스트 데이터 접근 차단을 검증한 auth 테스트로 대체할 수 없다. 외부 메일 수신 경로가 준비되기 전에는 성공을 주장하지 않는다. 그동안 실행 가능한 `/rename,/model,/theme`와 history pagination, capability UI 검증을 진행할 수 있다.

학습 포인트: 명시된 gate와 임의 강건성 조합을 구분한다. 요약 CHAT 충족은 세부 REF 완료를 대신하지 않는다. 실제 API 긍정 경로와 사용자가 공유/가입을 끝내는 UI 경로를 분리해 평가한다.

다음 단계: 부모가 현재 전체99 실행 종료 후 이 후보표를 검토하고, 위 실제 공백을 독립적인 실환경 사례로 보완한다.
