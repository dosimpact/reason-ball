# 2026-09-30 코드·생성물 정리

## 배경과 범위

저장소 정리 요청에 따라 사용 근거가 없는 템플릿 자산, 생성된 브라우저 테스트 산출물의 검사 범위, Artifact HTTP 조회의 페이지 검증 흐름을 점검했다. 제품 기능·원격 DB 계약·기존 테스트 증거는 유지한다. 관련 저량 절은 `docs/stock/system-design.md` 5.4(SLAP·순수함수)와 Artifact 저장·조회 설계, `docs/stock/test-design.md`의 브라우저 없는 계약 검사다.

## 변경과 이유

- `apps/web/public/`의 Next 기본 SVG 5개(`file`, `globe`, `next`, `vercel`, `window`)를 제거했다. 앱 소스, 테스트, 문서, 스크립트와 미션 자산에서 파일명 참조가 없었다. 이 디렉터리는 지식 그래프 인덱스 제외 범위이므로 실제 파일과 프로젝트 전체 텍스트 검색으로 확인했다. 코드에서 경로를 동적으로 조립하는 모든 가능성을 정적 검사만으로 증명하지는 않는다.
- 프로젝트와 앱의 `.gitignore`, 앱 ESLint 설정이 `playwright*report*/` 및 `test-results*/`를 무시하게 했다. 2026-09-29의 보존된 Playwright HTML·trace·실패 이미지 때문에 `eslint .`이 생성된 번들을 검사하며 실패하던 문제를 해결한다. 증거 파일 자체는 삭제하지 않았다.
- 원격 E2E의 분리된 production 출력인 `.next-live/`도 앱 Git·ESLint 검사에서 제외한다.
- `entities/chat/api/http-artifact-repository.ts`의 버전 및 목록 페이지 검증과 다음 cursor 검증을 순수 함수로 분리했다. 요청 순서, 페이지별 중복·snapshot 검사, 같은 오류 문구, 완료된 전체 목록만 반환하는 계약을 유지한다. 사용 중인 파일은 graph 검색과 source read로 확인했고, 해당 소스에 기록된 인덱스 결손은 없었다. 이는 그래프의 완전성을 뜻하지 않으므로 계약 테스트로 동작을 검증했다.

## 검증과 남은 작업

- `pnpm --filter @ai-english-chat/web test:contracts artifact-pagination.spec.ts --retries=0`: 8 PASS. 브라우저 없는 계약 검사이며 실제 Supabase E2E가 아니다.
- `pnpm --filter @ai-english-chat/web typecheck`: PASS.
- `pnpm --filter @ai-english-chat/web lint`: PASS, 기존 `<img>` 권고 경고 3건. 생성 보고서는 검사 대상에서 제외되었고 보존되었다.
- `git check-ignore -v`로 날짜별 Playwright 보고서·결과와 security 보고서가 새 패턴에 일치함을 확인했다.
- AI 오류 파서와 Supabase HTTP 파서 사이의 중복은 다른 작업 범위와 겹쳐 여기서 변경하지 않았다. 별도 소유자가 검토한다.

이 기록은 코드 정리 근거다. 제품 요구사항이나 DB migration은 변경하지 않았으며, 현재 상태를 설명하는 저량 문서와의 최종 동기화는 통합 작업에서 확인한다.

## 탐색 화면 후속 정리

같은 날짜의 실제 브라우저 캡처(`docs/flow/evidence/2026-09-30-ux-refactor/before/`)에서 캐릭터 상세가 관련 미션 전체를 한 번에 렌더링하고, 카탈로그가 최대 95개의 페이지 버튼을 늘어놓는 문제를 확인했다. 이 변경은 `CHAR-07`, `MISSION-06`, `MISSION-GUEST-BROWSE-01`의 탐색 UI와 관련된다.

- 캐릭터 상세는 관련 미션 최대 6개를 미리 보여 주고 `/missions?character=<id>`로 전체 목록을 연다. 자유 대화 버튼은 미션을 암묵적으로 고르지 않고 `/chat/<id>`로 이동한다. 미션 상세는 별도 버튼으로 남긴다. 대화 수를 학습자 수로 오인할 수 있는 `명 학습`을 `개 대화`로 정정하고, 페르소나와 연결되지 않은 London 대화 예시 및 무조건적 음성 지원 표시는 제거했다.
- 미션 탐색은 URL의 캐릭터 필터를 초기 상태에 반영한다. 장소 옵션은 선택한 카테고리의 실제 장소에서 구성하고 카테고리 변경 시 장소를 초기화한다. 페이지 탐색은 이전·페이지 선택·다음으로 제한하되 전체 페이지에 직접 접근할 수 있다. 중복 운영 설명을 줄이고 검색 입력의 어두운 테마 대비를 보완했다.
- 캐릭터 탐색은 최초 로딩·요청 오류·실제 빈 결과를 분리한다. 오류에서는 다시 시도할 수 있다.
- 캐릭터·미션 저작 화면의 mock·Route 구현 설명을 사용자에게 맞는 안내와 결과 이름으로 바꿨다. 생성 방식, 저장 동작, API 계약은 변경하지 않았다. 임시 UX 검증 계정 receipt는 `.gitignore`에서 제외한다.

검증: 웹 `typecheck`와 `lint` 통과(기존 `<img>` 권고 3건). mock 브라우저 E2E는 앱의 다른 Next 개발 서버가 `.next/dev`를 사용 중이어서 별도 서버를 시작하지 못했다. 그 서버를 재사용하거나 종료하지 않았다. 정규 mock E2E의 문자 그대로의 배지 기대값은 새 문구로 동기화했다. 원격 live E2E와 실제 Supabase 검증은 이 기록의 PASS 범위에 포함하지 않는다.

## 전체 live suite 실패에 따른 테스트 정정

같은 날짜 전체 live suite의 실패 위치를 확인해 테스트의 실행 환경 가정과 조회 순서를 정정했다. 이 변경은 앱 동작이나 원격 데이터를 수정하지 않는다.

- 클립보드 4개 실패: `localhost`는 secure context여서 `navigator.clipboard`가 존재한다. 외부 HTTP fallback을 검증하는 테스트에서 초기 스크립트로 이 API만 제외하고, 성공 시 실제 브라우저 `document.execCommand("copy")`를 계속 호출한다. 주입된 명령 실패 경로와 초안·버전 보존 검사는 유지한다. 이 검증은 외부 HTTP 호스트에서의 실측과 구분한다.
- `chat-actions.spec.ts`: 메시지 재조회 결과를 DB `sequence_number` 순서로 요청해 새로고침 전후의 같은 대화 순서를 비교한다. 행 내용 검사는 그대로 둔다.
- `discovery-navigation.spec.ts`: 모바일 키보드 테스트가 장소를 고르기 전에 실제 미션의 카테고리를 선택한다. 카테고리에 따라 장소 옵션이 제한되는 현재 탐색 UI 계약에 맞추고 키보드 접근성 검사를 계속 수행한다.

수정된 다섯 live spec 파일의 ESLint와 웹 typecheck는 통과했다. live E2E 재실행은 통합 실행자가 맡으며 이 정적 결과를 실제 원격 PASS로 표현하지 않는다.

## 채팅 하위 UI 테마 정리

실제 브라우저의 `before/chat.jpg`에서 채팅 상위 화면의 어두운 테마와 하위 입력·버튼 색상이 어긋나 텍스트 대비가 낮았다. `chat-model-selector.tsx`와 `suggested-conversations.tsx`의 경계, 입력, 선택, 추천 버튼과 보조 문구를 앱의 `card`, `background`, `foreground`, `muted`, `destructive` 색상 토큰으로 연결했다. 모델 검색, 지원·미지원·미확인 표시, 추천 대화 저장·복원 동작은 유지한다. 모델 기능 안내 중 공급자·배포 내부 용어는 사용자에게 필요한 출처 표현으로 줄였다. 웹 typecheck와 두 파일의 ESLint는 통과했으며 시각 확인은 통합 브라우저 검증에 남긴다.

## 프로필 어두운 테마 가독성

`after/profile.jpg`에서 프로필 학습 요약의 흰 카드가 어두운 테마의 흰 글씨를 상속해 수치·제목이 사라지고 선택된 탭도 배경과 구별되지 않는 문제가 확인됐다. 프로필 탭, 학습 진도 카드·그래프, 복습 메모와 각 탭의 생성물·표현·저장 미션·설정 카드에 `card`/`card-foreground`와 `border`/`muted-foreground` 토큰을 적용했다. 히어로의 검은 배경과 흰 글씨는 의도된 모습으로 유지한다. 기능·저장 계약은 바꾸지 않았고 웹 typecheck 및 수정한 여섯 파일의 ESLint가 통과했다. 시각 검증은 통합 브라우저에서 확인한다.

## 대화 기록 어두운 테마와 빈 상태

`after/history.jpg`에서 검색 입력과 기록 카드의 흰 배경에 글자가 거의 보이지 않았다. `history/page.tsx`의 입력·카드·배지·더 보기 버튼은 테마 토큰을 사용하고, 개인정보 안내 패널은 기존 짝 색상 조합을 유지한다. 기록의 `turnCount`는 메시지 배열 길이이므로 표시는 `메시지 N개`로 바로잡았다. 내용이 없는 대화의 공백 미리보기는 `아직 메시지가 없어요.`로, 검색어가 없는 실제 빈 기록과 검색 결과 없음은 각각 다른 안내로 표시한다. live pagination 테스트의 해당 문구 기대값도 동기화했다. 웹 typecheck와 두 파일의 ESLint는 통과했으며 브라우저 재확인은 통합 검증에서 한다.
