# Next.js OpenUI frontend

Node.js 20.9+가 필요하다. 설치·빌드에 Python이나 백엔드 소스가 필요하지 않다.

```bash
npm ci
npm run generate
cp .env.example .env  # 최초 설정 시에만
npm run dev
```

UI: http://localhost:3045

`.env`의 `LANGGRAPH_API_URL`로 실행 중인 백엔드에 연결한다(기본 `http://127.0.0.1:2037`). `LANGGRAPH_ASSISTANT_ID` 기본값은 `agent`다. 기존 /api/chat 경로는 LANGSMITH_API_KEY를 지원한다. 새 Canvas 경로는 로컬 PoC이며 원격 배포 인증은 구현 범위 밖이다. OPENAI_API_KEY는 이 프로젝트에 두지 않는다.

`src/features/manage-canvas`가 위젯 저장·복원, 이벤트 분배와 데이터 갱신을 담당한다. 화면은 `/api/workspace/*`를 통해 Python에 연결하고 일반 Chat은 AG-UI로 변환한다. 이전 호환 경로인 `src/app/api/chat/route.ts`의 `createLangChainStreamResponse` 프록시를 유지한다. 프록시가 protocol v2 `custom:openui` 채널을 AG-UI SSE로 전달한다.

## 검증

```bash
npm run lint
npm run typecheck
npm run verify
```

두 서버를 실행한 상태에서 통합 검증:

```bash
npm run test:smoke
# UI 주소 변경 시:
CHAT_TEST_URL=http://localhost:3050 npm run test:smoke
```

실제 OpenAI API를 사용하므로 호출 비용이 발생한다. 도구 호출·인자·결과, 텍스트 스트리밍, 정상 종료, 후속 대화, 400 오류를 검증한다. `output/validation/`에 SSE와 결과를 저장하며 Git에서는 제외한다.

pnpm을 사용하는 경우 이 폴더에서 `pnpm install --frozen-lockfile`로 설치할 수 있다. 루트 프로젝트 의존성은 사용하지 않는다.

## 컴포넌트 프롬프트 변경

```bash
npm run generate
```

`src/app/config/library.ts`를 읽어 이 프로젝트 안의 `generated/system-prompt.txt`와 명세만 만든다. 빌드·실행 시 자동 생성하지 않는다. 컴포넌트 계약이 바뀌면 새 프롬프트를 백엔드의 `agent/system-prompt.txt` 자산으로 전달하고 통합 검증한다.

프롬프트를 Python 자산에 동기화한 후 실행 중인 Python 서버를 재시작해야 한다. 텍스트 자산 변경만으로 자동 재로드되지 않을 수 있다.

## FSD 구조와 검사

- `app/`: Next.js 라우트 adapter. `pages/README.md`는 FSD의 `src/pages`가 Pages Router로 인식되지 않도록 유지합니다.
- `src/app`: 앱 설정·layout·서버 API.
- `src/pages`: Chat, gallery, preview 화면.
- `src/features/manage-canvas`: thread 저장·스트리밍·Canvas 조작.
- `src/entities/analysis`: 조회/차트 계약·artifact 저장·렌더러.
- `src/shared`: 범용 OpenUI 컴포넌트·함수와 API/config/lib.

`npm run lint:fsd`로 Steiger를 실행합니다. `npm run verify`는 구조 검사 후 production build를 수행합니다. `steiger.config.mjs`에 두 업무 slice의 단일 사용처 병합 권고 예외만 명시하며 import/public API 규칙은 유지합니다.

Chat에 DuckDB 분석 차트를 요청하면 차트별 `Add to Canvas` 버튼이 표시됩니다. 클릭 시 활성 탭에 복사하며 이후 필터/새로고침은 Canvas에만 적용됩니다. 생성 카탈로그는 `generated/`, 생성 진입점은 `src/app/config/library.ts`입니다.
