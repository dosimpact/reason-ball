# Rain Room 프로젝트 규칙

## Way of Working

- ALWAYS 최상위 제품 기획은 `aidlc/spaces/default/knowledge/documents/business-book.md`에서 관리한다. 작업 전에 읽고 사용자가 확정한 현재 방향을 같은 작업에서 반영한다.
- ALWAYS 문서는 최신 스펙만 간결하게 유지한다. 변경 이력·과거 요청 ID·폐기된 대안·검수 로그를 누적하지 않고 해당 내용을 바로 갱신한다. 문서 구성은 `knowledge/documents/README.md`를 따른다.
- ALWAYS 사용자의 직접 결정은 다시 승인받도록 요구하지 않는다. AI는 그 방향 안에서 세부 기획과 구현을 구체화하며, 미정인 사업 판단을 임의로 확정하지 않는다. 기존 AI-DLC 단계·승인 설정은 별도로 따른다.
- ALWAYS 기획은 `gpt-6-astra`, 구현은 `gpt-6.1-sol` 서브에이전트를 사용한다. 구현 위임에는 모델·파일 소유권·검증 기준을 명시하고 실제와 다른 모델 사용을 주장하지 않는다.

## Testing Posture

- ALWAYS 디자인은 `knowledge/documents/design-system.md`와 현재 앱을 기준으로 검토한다. 모바일·PC의 주요 상태를 Playwright와 PNG로 확인하고 생성 증거는 `artifacts/`에 둔다.
- ALWAYS 검증용 브라우저는 동시에 최대 한 개로 제한하고 종료·실패 시 생성한 페이지·컨텍스트·브라우저를 정리한다. 사용자의 기존 브라우저는 종료하지 않는다.
- ALWAYS 실행하지 못한 검증은 미검증으로 명시한다. CPU 합성·DOM 테스트·실제 브라우저·실기기 결과를 구분하며 캡처나 시각적 일치율을 만들어내지 않는다.

## Code Style

- ALWAYS pnpm workspace + Turborepo를 사용하며 React 웹은 `apps/web`, Expo Development Build WebView 앱은 `apps/mobile`에 둔다.
- ALWAYS 웹은 FSD 계층과 공개 API를 지키고 Steiger 구조 검사를 통과시킨다. Tailwind CSS·공용 shadcn/ui를 사용하며 Biome은 포맷팅 중심으로 유지한다.
- NEVER `sample/` 원본을 앱 런타임·빌드·검증 음원으로 import하거나 수정하지 않는다. 명시적인 수동 반입에서만 읽고 서비스 에셋에 독립 복제본을 만든다.

## Tech Stack

- ALWAYS 모바일·WebView 우선으로 설계하고 태블릿·PC를 함께 지원한다. 전체화면은 앱 내부 뷰포트 UI이며 브라우저 Fullscreen API로 제어하지 않는다.
- ALWAYS 저장·카탈로그 ID는 표시 이름·번역·배열 순서와 분리하고 기존 ID를 유지한다. 음악은 유효한 카테고리·서로 다른 태그3개 이상을 가지며 추정 분류와 사용자 제공 태그를 구분한다.
- ALWAYS 공간은 고유 인테리어와 동물 서식지를 관리한다. 동물의 자율 행동과 클릭 전용 수집 오브제를 분리하고 숨겨진 오브제에 발견 힌트를 넣지 않는다.
- ALWAYS SVG 저작 원본과 레거시 자원은 사용자 검토 후 삭제 결정 전까지 유지한다. 그림 변경 시 Pixi 파생 자산·원본 해시와 반응형 구도를 검증한다.
- ALWAYS 백그라운드 오디오·타이머 동작과 네이티브 출시 준비는 대상 OS·WebView에서 확인한 범위만 완료로 표시한다.
