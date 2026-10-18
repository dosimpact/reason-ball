# Next.js OpenUI frontend

Node.js 20.9+가 필요하다. 설치·빌드에 Python이나 백엔드 소스가 필요하지 않다.

```bash
npm ci
cp .env.example .env  # 최초 설정 시에만
npm run dev
```

UI: http://localhost:3042

`.env`의 `LANGGRAPH_API_URL`로 실행 중인 백엔드에 연결한다(기본 `http://127.0.0.1:2034`). `LANGGRAPH_ASSISTANT_ID` 기본값은 `agent`다. 원격 배포 인증이 필요하면 LANGSMITH_API_KEY를 설정한다. OPENAI_API_KEY는 이 프로젝트에 두지 않는다.

`src/app/page.tsx`의 기존 React/OpenUI 화면과 `src/app/api/chat/route.ts`의 `createLangChainStreamResponse` 프록시를 유지한다. 프록시가 protocol v2 `custom:openui` 채널을 AG-UI SSE로 전달한다.

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

`src/library.ts`를 읽어 이 프로젝트 안의 `src/generated/system-prompt.txt`와 명세만 만든다. 빌드·실행 시 자동 생성하지 않는다. 컴포넌트 계약이 바뀌면 새 프롬프트를 백엔드의 `agent/system-prompt.txt` 자산으로 전달하고 통합 검증한다.
