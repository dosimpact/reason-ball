# Fibonacci Tutorial 작업 규칙

저장소 공통 규칙은 루트 `AGENTS.md`를 따릅니다. 이 문서는 프로젝트 구현·문서 운영 규칙을 추가합니다.

## 변경 전

- 계획·구현·검토 전에 [문서 지도](docs/INDEX.md)와 관련 [stock 설계](docs/stock/business-design.md)를 읽습니다. 기술 변경은 [시스템·개발 설계](docs/stock/system-design.md)도 확인합니다.
- 편집 전에 `git status`를 확인하고 사용자 파일과 관련 없는 변경을 보존합니다.
- `master-plan.md`와 `docs/human-input/`의 사용자 입력은 임의로 덮어쓰지 않습니다. 사용자가 계획 수정을 요청하면 해당 범위만 반영하고 flow에 기록합니다.
- 원본 계획의 제안, 확정된 설계, 구현된 동작을 구분합니다.

## 구현·검증

- 설계를 먼저 확정하고 구현합니다. 파동 검증·Fibonacci·매매 계산은 차트 렌더링과 분리된 순수 함수로 설계합니다.
- [시스템·개발 설계](docs/stock/system-design.md)의 FSD 계층·도메인 슬라이스·공개 API 경계를 따릅니다. SLAP에 따라 함수 안에서 사용자 흐름의 단계와 외부 API·계산 세부 사항을 섞지 않습니다. 저수준 계산·변환·판정은 가능한 한 순수 함수로, I/O는 경계 함수로 분리합니다.
- [검증 안내](docs/validation/INDEX.md)를 확인하고 변경 유형에 맞는 검증을 실행합니다. 결과와 미검증 항목은 flow에 기록합니다.
- 소유한 테스트 서버와 임시 데이터만 사용합니다. 다른 개발 서버나 사용자 데이터를 종료·변경하지 않습니다.
- `.env`, 토큰, 로컬 데이터, 빌드·테스트 출력과 캐시는 커밋하지 않습니다.

## 문서화

- 문서 지도와 하위 진입 파일은 `INDEX.md`, 프로젝트 소개는 `README.md`로 유지합니다.
- 튜토리얼의 학습 내용·도메인 지식은 `docs/tutorials/`에서 Lesson별로 관리하고 [목차](docs/tutorials/INDEX.md)에 등록합니다. 제품·기술 구현 계약은 stock에 유지합니다.
- [비즈니스 설계](docs/stock/business-design.md)와 [시스템·개발 설계](docs/stock/system-design.md)는 각각 하나의 통합 stock 문서로 유지합니다. 확정된 현재 상태를 stock만으로 이해할 수 있게 갱신합니다.
- 변경의 날짜·맥락·이유·영향 stock·검증 결과·후속 상태를 `docs/flow/`에 새 기록으로 남깁니다. 완료된 flow는 수정하지 않고 후속 기록으로 대체합니다.
- 문서 운영 규칙은 프로젝트 개발 문서에 적용합니다.

## 개발 명령과 현재 범위

- 루트에서 `pnpm --filter fibonacci-tutorial dev` (4310)와 `storybook` (6310)을 사용합니다.
- `test`는 순수 함수, `lint`는 ESLint와 FSD import 경계, `typecheck`는 Next 타입을 검증합니다.
- `test:integration`은 앱·Storybook 빌드, Bruno·Playwright, 동시 Replay·서버 재시작 복원을 소유한 임시 서버/데이터로 실행합니다.
- 실행 스키마는 `src/entities`입니다. `docs/stock/tutorial-schema.ts`는 후속 확장 모델 초안입니다.
- 2026-09-27 기준 10개 챕터·44개 유닛, 더미·Binance Spot 소스, 계획 revision·평가·회고·JSON 내보내기가 구현되었습니다. 검증 결과는 [커리큘럼 검증](docs/validation/curriculum.md)과 [전략 모니터링 검증](docs/validation/strategy-monitoring.md)을 기준으로 기록합니다.
- 독립 전략은 `/monitoring`에서 작성·백테스트·포워드 감시를 제공하며 [독립 전략 검증](docs/validation/standalone-strategy.md)을 확인합니다.
- 로컬 교육용 단일 서버·JSON 저장 범위와 실제 주문·다중 서버·4000봉 초과 사후 평가 같은 후속 범위를 구분합니다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
