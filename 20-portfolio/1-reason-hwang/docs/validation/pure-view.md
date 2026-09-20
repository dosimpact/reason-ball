# VAL-VIEW-001: 순수 View Storybook 검증

## 적용 범위

입력 props를 표시하거나 UI 이벤트를 전달하며, 업무 규칙·서버 연동·업무 상태 전이를 소유하지 않는 순수 View 컴포넌트를 변경하면 Storybook에서 반드시 테스트한다. 컴포넌트 내부의 열림/닫힘 같은 표현 상태도 검증한다.

## 절차

1. 기존 Storybook 설정과 story 관례를 확인하고 변경 컴포넌트의 story를 추가·수정한다.
2. 해당하는 기본·빈 값·긴 텍스트·로딩·오류·비활성 상태를 fixture/args로 재현한다. 실제 업무 로직이나 인증에 의존하지 않도록 View 입력을 통제한다.
3. Storybook을 실행하고 변경된 story를 실제 브라우저에서 열어 렌더링, 레이아웃, 관련 화면 크기와 키보드·클릭 동작을 확인한다. 상호작용이 있으면 기존 테스트 구성에 맞춰 `play` 검증 등을 사용한다.
4. 실행한 story ID와 상태, 예상/실제 결과, 필요한 스크린샷 또는 테스트 결과를 [공통 증거 규칙](README.md)에 따라 기록한다.

현재 host 실행 명령은 프로젝트 루트에서 `pnpm --filter reason-hwang-fe-host storybook`이다. 정적 빌드는 `pnpm --filter reason-hwang-fe-host build-storybook`으로 확인한다. 빌드 성공이나 story 작성만으로 테스트를 대신하지 않는다. 자동 실행은 해당 패키지에 실제 구성된 러너·스크립트를 확인해 사용한다.

업무 상태나 API 연동까지 포함한 동작은 [브라우저 검증](business-behavior.md)도 수행한다.
