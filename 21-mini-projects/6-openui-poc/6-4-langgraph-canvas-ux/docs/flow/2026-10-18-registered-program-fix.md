# 2026-10-18 REG-FIX-01 — 메모·입력 폼 생성 오류 수정

## 문맥과 원인

사용자 요청: `채팅에 Canvas에 추가할 수 있는 메모와 입력 폼을 만들어줘`.
기존 서버는 `program.lstrip().startswith("root =")`를 강제했다. OpenUI는 상태·변수 선언을 root 앞에 허용하므로 정상 프로그램도 실패했다. 실제 provider 관찰에서는 로컬 `FormExample` 변수를 `FormExample()`로 호출한 출력도 있었다. Form 자체는 등록 컴포넌트이며 미지원 요소가 아니다.

## 변경과 판단

- 첫 행 강제 대신 문자열 리터럴을 제외한 root Col 선언 확인, 전체 코드 펜스 정규화.
- packaged catalog의 컴포넌트·함수·액션 이름 확인. wrapper 중첩·알 수 없는 호출 차단.
- 실패 이유를 모델에 전달해 한 번만 재생성. 실패 시 명시적 안내, 불완전 결과 게시 금지.
- 로컬 변수 참조, 폼 상태 선언 예시, 호스트 Canvas 버튼 책임을 생성 프롬프트에 명시.
- Python 독립 실행 경계를 유지하며 Node/parser 런타임 의존성을 추가하지 않았다. 이 검사는 완전한 문법 검사기가 아니고 최종 OpenUI parser 검증은 기존 frontend가 유지한다.
- 카탈로그 계약 변경이 없어 생성 asset 동기화는 필요 없다.

## 검증

- Python 회귀: root 이전 변수, 공백, 펜스, 문자열 안 호출 예시, 실제 Form/Reset 지원, 미등록 호출·wrapper·길이·root 누락 차단, 재시도 성공/소진.
- frontend registry 단위 6개 PASS. root 이전 Form/input 선언 파싱 포함.
- Chrome E2E 3개 PASS (11.2초): 실제 provider 원문 요청→editable content→Canvas 복사→reload 및 기존 DnD/삭제/교차 thread 거부.
- 초기 실행은 보완 중 액션 allowlist 누락으로 실패했고 수정했다. 후속 테스트는 Canvas 탭 이름 textbox를 잘못 선택해 실패했으며 widget 내부 입력으로 locator 범위를 수정했다. 최종 3개는 재시도 없이 통과했다.
- 보고서: `frontend/output/form-fix-report/index.html`, 화면: `frontend/output/playwright/registry-form-fix.png`.
- 검증 전용 2047/3055 사용. 사용자 기존 서버는 종료하지 않는다. 과거 localStorage 실패 메시지는 보존하며 새 요청으로 생성한다.

- Python 전체 70개 PASS (52.21초), Ruff PASS, frontend typecheck PASS, git diff --check PASS.

## Stock 반영

`business.md`, `system.md`, `canvas-system/canvas-system.md`의 REG-FIX-01에 동기화했다. 모델이 만들 수 있는 모든 프로그램의 정확성을 보장하는 변경은 아니다.
