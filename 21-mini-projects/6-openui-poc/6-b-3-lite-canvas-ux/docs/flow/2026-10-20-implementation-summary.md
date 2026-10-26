# 2026-10-20 Lite Canvas 핵심 변경·검증

사용자의 flow 압축 요청에 따라 20개 기록을 통합했다. 중간 진행 문구·반복 설명·실행 ID는 생략하고 결정·검증·제한을 보존한다. 현재 계약은 [제품 설계](../stock/business.md), [시스템 설계](../stock/system.md)가 기준이다. 이 요약 자체는 재검증 결과가 아니다.

## 출발점

- **LCU-001/101:** 6-3을 6-7로 복사(.env 포함), 원본 보존. 123개 앱·설정·자료 파일 byte 일치와 환경 파일 Git 제외 확인. 의존성·캐시·검증 산출물은 별도 생성.
- 이후 backend 2040/frontend 3048로 분리. 공급업체 8개 원문은 backend 패키지에 소유하며 형제 프로젝트나 frontend 파일을 런타임에서 읽지 않는다.

## Canvas

- **LCU-002~006/102~106:** 메인 LLM → report 서브그래프 → Canvas open → OpenUI custom SSE → Renderer. thread당 서버 ID 리포트 하나, 재생성 시 기존 ID/공개 링크 교체.
- SQLite는 리포트/발행 상태, checkpoint는 대화/원문/인용을 보관. 오래된 인용 거부, 실패 시 발행/인쇄 차단, 생성 중 새로고침은 polling 복원.
- 숫자 재작성 오류를 줄이기 위해 source 배열을 서버가 주입한다. 파서/참조/단위·구조 검사와 원문 수치 검토 후 최대 2회 수정. 검토에는 실제 원문·생성 뷰 인용을 요구해 모순 병기 오판을 줄였다.
- 생성 gpt-5.4 / 검토 gpt-5.4-mini 분리. 공유는 같은 Renderer, PDF는 브라우저 인쇄. SVG 크기·표 줄바꿈·인쇄 제외 영역을 보완했다.
- **당시 검증:** backend 23 tests, frontend 324 tests, Ruff/typecheck/build 통과; lint 오류 0/기존 경고 4. Chrome 2 tests에서 실제 생성·필터·드래그 인용·발행·재생성·복원 및 A4 6페이지 출력 확인.
- **증거:** `frontend/output/validation/{lifecycle-result,quote-state,browser-exchanges,production-print}.json`, `frontend/output/pdf/supplier-report.pdf`.

## 범용 UI와 화면

- **LCU-007/108:** 범용 ui 경로와 데모 도구 복원. chat format=openui, 폼/버튼 후속 대화, 저장·복원 지원. 기존 Canvas는 보존한다.
- **검증:** backend 25/frontend 328 tests, 빌드 통과. Chrome 3 tests: 실제 Lisbon 지도/마커 3개·복원, fixture 폼 상태 전달, 생성 중 복원. 증거 `frontend/output/validation/general-ui-result.json`.
- **LCU-107:** 중립 OpenUI 테마 복원, 다크/라이트 토글·저장, 인쇄 시 light 후 원래 테마 복귀. 빌드 및 홈/공유 화면 Chrome 확인.
- **LCU-008/109:** 데스크톱 좌우·모바일 상하 splitter, 최소 크기·키보드·초기화·저장. Chrome 회귀 3 tests 및 빌드 통과.
- **LCU-011/111:** 추천 질문 13개(리포트 2/공급업체 3/범용 8). 빌드 및 Chrome 그룹/펼침/정확한 요청 본문 확인; 요청 가로채기 검증으로 추가 모델 호출 없음.

## PDF

- **LCU-009~010/110:** LLM action과 report_mode를 구분. 새 생성 기본 interactive, 재생성 inherit는 기존 모드 유지. pdf는 탭/필터/입력/액션 없이 정적 전체 내용; 저장·공유에도 모드 유지.
- supplier_ui는 리포트 없이 원문을 조회해 채팅 UI로 답하며 Canvas를 교체하지 않는다. 도구 없는 직접 모델 스트리밍으로 수정 재시도의 빈 응답을 해결하고 Table/Each 지침 보강. 분석은 report 모델 사용.
- **검증:** backend 33/frontend 331 tests, Ruff/typecheck/build 통과; lint 오류 0/기존 경고 4. 실제 Chrome E2E 약 2.1분: 공급업체 질문 → PDF 리포트 → 후속 질문 모두 수정 0회, 본문 인터랙션 0개, 공유/Canvas 보존/pageerror 0 확인. 복원/splitter 회귀 3 tests 통과.
- PDF 표 너비·숫자 줄바꿈·중첩 카드 분할 조정 후 A4 7페이지 전체 육안 확인. 증거 `frontend/output/validation/pdf-supplier-{exchanges,result}.json`, `frontend/output/pdf/static-supplier-report.pdf`.

## 차트 해석과 UI 비중

- **LCU-013/113, 1차:** 각 차트 아래 관찰·의미·근거·한계를 설명하는 공통 지침 추가. 도입 3~5문장/KPI 2~4개로 서술 강화. 실제 공급업체1 PDF에서 KPI 4개·차트 5개와 별도 해석 문단, Chrome 렌더링 확인. 증거 `frontend/output/validation/narrative-report.{json,sse}`.
- **최종 재조정:** UI 부족 피드백으로 도입 2~3문장, KPI Grid 4~6개, 핵심 차트 3~4개+해석 2~3문장, 비교 표/우선순위 카드/상태 Badge를 균형 있게 사용하도록 변경. PDF 정적 제한 유지.
- **검증 경계:** 최종 재조정은 backend 33 tests/Ruff만 확인. 그 이전 실제 생성 결과를 최종 지침의 provider 검증으로 간주하지 않는다.

## 데이터 정리

- **LCU-112:** 원문 8개 파일·조회 ID를 supplier-01~08로 익명화. backend 33 tests 및 실행 카탈로그 API 확인.
- 잔여 캠페인명 13회, 상품 문구 7회, 추천 서비스명 20회를 샘플로 치환. 내부 URL 2개는 경로/쿼리를 제거한 example.invalid 링크로 변경.
- **검증:** backend 33 tests; 당시 커밋 후보 156파일 Gitleaks 탐지 0, 대상 문구 잔여 0, 원문 URL은 example.invalid만 존재. 과거 Git 이력 검사는 포함하지 않는다.
- **제한:** 이 명칭·링크 정리 작업에서는 사업 수치를 추가로 변환하지 않았다. 그 이전 수치 익명화 여부는 이 검사에서 검증하지 않았다. 과거 생성 리포트/체크포인트/PDF도 재작성하지 않았으며 Git 제외 상태다. 시크릿 탐지 0건은 공개 가능성 보증이 아니다.

## 남은 확인과 증거 범위

- 실제 리포트 provider 검증은 공급업체1 중심이며 8개 원문 추출은 단위 테스트 범위다. LLM 검토/생성은 확률적이고 최종 UI 비중 조정 결과는 추가 확인이 필요하다.
- 공유 localhost는 인터넷 배포가 아니며 날씨/주가/검색은 데모 데이터다. 외부 지도·이미지의 지속 가용성을 보장하지 않는다.
- 증거 경로는 프로젝트 루트 기준이며 `frontend/output/`은 Git 제외된 로컬 산출물이다. 위 테스트 숫자는 해당 변경 당시 기록이며 이번 문서 압축에서 다시 실행하지 않았다.

## 후속 상품·캠페인 익명화

- 사용자 요청으로 8개 원문의 상품명 표기 72곳·캠페인명 표기 118곳과 요약 상품명 38곳을 ID 기반 샘플 이름으로 통일하고 실제 숫자형 ID 61개도 치환했다. 원래 이름/ID 대응표는 저장소에 남기지 않는다.
- 공급업체5는 상품명에만 업체 이름이 있던 문제를 발견해 보고서 도입에 명시했다. 이름 제거 후에도 공급업체 8개 조회를 유지한다.
- 검증: 치환 전후 표 구조·숫자 셀·KPI/차트 수치·ID 출현 횟수 보존 확인. backend 33 tests 통과, 커밋 후보 138파일 Gitleaks 탐지 0건. 과거 생성 리포트/대화는 재작성하지 않는다.

## FBA 스타일 물류 용어 전환

- **LCU-014/114:** 사용자의 아마존 물류 스타일 요청에 따라 8개 원문에 FBA/FC 데모 맥락을 명시하고 재고 보충·구매 박스를 FBA 재고 보충·추천 오퍼로 통일했다.
- AWS 대신 물류 서비스인 FBA 명칭을 사용한다. 기존 광고 유형/목표 광고수익률 로직은 실제 Amazon Ads와 일대일 대응하지 않는 데모 규칙임을 명시했다. stock 제품/시스템 설계에 반영했다.
- 검증: 8개 원문의 숫자 토큰·표 행 수 보존, 대상 기존 서비스명 잔여 0, backend `uv run pytest -q` 33개 통과. 과거 저장 리포트/대화는 재작성하지 않는다.

## 갤러리 접근 제한 제거

- **LCU-115:** 사용자 요청으로 `/gallery`의 production `notFound()` 조건과 import를 제거했다. 테마 선택은 유지하고 시스템 stock에 반영했다. 실행 중인 서버는 재시작하지 않았다.
- 커밋 전 검증: backend 33 tests/Ruff, frontend 331 tests/typecheck 통과. ESLint 오류 0·기존 경고 4. 이번 변경에서 production 빌드/브라우저/provider 재검증은 하지 않았다.
