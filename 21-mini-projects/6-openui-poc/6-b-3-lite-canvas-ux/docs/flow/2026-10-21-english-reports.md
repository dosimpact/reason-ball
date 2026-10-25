# 2026-10-21 영문 리포트 지원

- 요청: 6-7 서비스를 실행하고 영문 리포트를 서비스 링크에서 확인할 수 있도록 추가.
- 변경: 라우터 언어 선택, 저장/재생성 언어 유지, 영어 제목·생성 지침·출처 footer, 첫 화면 영문 interactive/PDF 요청.
- 이유: 기존 한국어 고정 프롬프트를 언어 상태로 분리하고 수치 원문 보존 계약을 유지한다.
- Stock: LCU-015, LCU-116 및 추천 질문 개수 동기화.
- 검증: backend pytest 35 PASS, Ruff PASS; frontend typecheck PASS, 331 tests PASS, lint 오류 0/기존 경고 4. production build PASS. 실제 provider/브라우저 확인 완료.
- 실제 첫 생성에서 원문 배열의 한국어 KPI/조치가 본문에 남는 것을 발견하여 숫자 보존 검증을 갖춘 표시용 문자열 번역을 추가했다. 원문과 숫자 필드는 보존한다.

- 첫 번역 검증은 번역 결과의 숫자 토큰을 원문 순서와 엄격하게 비교했다. 실제 영문 interactive/PDF 요청에서 오류를 확인해 숫자 표식 보호/복원으로 수정했다. 실패를 숨기거나 검증을 제거하지 않았다.

- 최종 실제 검증: interactive `d5420f95-6456-4820-9169-1f3649e47e42`, PDF `bb715d2a-ff9a-4fbe-af81-601146fc6e58` 모두 ready/en/발행 상태. 별도 공유 페이지에서 본문 lang=en, 한국어 잔류 없음, 차트 각각 5개. interactive 필터 선택 시 차트 변경, 390px 화면 가로 overflow 없음. PDF 본문 동적 컨트롤 0개 및 실제 PDF 파일 생성.
- 증거: `frontend/output/validation/english-reports.json`, `frontend/output/playwright/english-shared.png`, `english-mobile.png`, `english-pdf-report.png`, `english-report.pdf` (로컬 Git 제외).
- 서비스: 사용자 직접 확인을 위해 FE 3048, LangGraph 2040 실행 유지. 다른 프로젝트 서버와 Docker는 변경하지 않음.
