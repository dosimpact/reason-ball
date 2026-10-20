# SEC Intelligent UI Host

- 경로: `/sec-chat` → `src/features/sec-chat/SecChat.tsx`.
- 전송: `/api/sec-chat/[...path]`가 `SEC_CHAT_API_URL`(기본 `http://127.0.0.1:8000`)로 제한된 SEC 경로만 중계한다. 서버 API 키는 브라우저에 전달하지 않는다.
- 화면: 회사 검색 → 최신 10-K 다운로드 또는 저장 원문 열기 → 7개 질문 가이드와 자유 질문 → 같은 공시의 후속 질문. 회사 변경 시 대화 범위를 새 공시로 바꾼다.
- `stream.ts`는 AG-UI RUN_FINISHED, TEXT_MESSAGE_CONTENT, RUN_ERROR를 처리한다. 현재 카탈로그 `library.toJSONSchema()`로 검증한 OpenUI만 `AnswerView`의 Renderer에 전달한다. 별도 복사된 parser spec은 없다.
- `intelligent-ui/`는 6-3의 OpenUI 컴포넌트·함수·스타일 카탈로그를 복사한 소스다. SEC 페이지·전송·근거 프로그램은 새 구현이다. 형제 프로젝트에 런타임 의존하지 않는다. 범용 카탈로그의 지도/이미지 API는 이 페이지의 답변 생성 경로에서 사용하지 않는다.
- 새 OpenUI는 Zod 4.4.3, 기존 호스트 스키마는 `zod3` 별칭으로 원래 3.25.76을 유지한다. Playwright CLI와 test를 같은 1.64.1로 고정한다.
- 현재 UI 대화는 메모리 상태이며 새로고침으로 복원되지 않는다. 백엔드의 세션도 재시작 시 사라진다. 로컬 단일 사용자 기능이며 사용자 인증/계정별 격리는 추가하지 않았다.
- 실행: `pnpm --filter reason-hwang-fe-host dev`. 검증: `test:sec-chat:views`, 작업 전용 스택 URL을 `SEC_LIVE_BASE_URL`로 지정한 `test:sec-chat:live`.
- 도메인 계약과 완료 상태는 [SEC 설계](../../us-corporate-filings/intelligent-ui.md)를 따른다.

## 로컬 실행

PostgreSQL·Neo4j와 모델 provider가 준비된 상태에서 workspace root의 별도 터미널 세 개로 실행한다. 기존 `.env`의 SEC 수집 설정을 사용하며 키는 서버에만 둔다.

```bash
pnpm --filter @reason-hwang/bff-apps dev
# 별도 터미널: 검증에 사용한 로컬 OAuth proxy의 경우
SEC_CHAT_MODEL_BASE_URL=http://127.0.0.1:2890/v1 SEC_CHAT_MODEL=gpt-5.6-luna pnpm --filter reason-hwang-langgraph-fast dev
# 별도 터미널
SEC_CHAT_API_URL=http://127.0.0.1:8000 pnpm --filter reason-hwang-fe-host dev
```

접속: `http://127.0.0.1:2800/sec-chat`. 다른 provider를 쓰면 LangGraph 환경의 `SEC_CHAT_MODEL_BASE_URL`, `SEC_CHAT_MODEL`, `SEC_CHAT_API_KEY`를 해당 서비스에 맞춘다. 이 문서의 로컬 주소는 검증 당시 구성이다.
