# Document comparison frontend

Next.js/OpenUI 화면과 Python 백엔드로의 HTTP 프록시다. API 키, PDF, SQLite, 모델·검색 실행은 Python이 소유한다.

```bash
npm ci
npm run generate
# 최초 설정 후 LANGGRAPH_API_URL=http://127.0.0.1:2038 확인
npm run dev
# 또는
npm run verify
npm start
```

http://localhost:3046. LANGGRAPH_API_URL 기본값은 http://127.0.0.1:2038. /api/chat, /api/documents, /api/threads는 Python /comparison/*에 연결된다. 브라우저는 openAIMessageFormat + agUIAdapter를 사용하고 restStorage로 대화를 복원한다.

```bash
npm run generate
cp src/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt
cmp src/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt
npm run lint
npm run typecheck
npm run verify
npm run test:smoke
```

smoke는 실행 중인 두 서버와 준비된 문서 DB가 필요하며 실제 OpenAI를 호출한다. 문서 목록·검색·페이지 출처·후속 질문·이력 저장·대화 이름 변경/삭제·잘못된 요청을 확인한다. 검증 대화 하나를 남기고 폐기용 대화만 삭제한다. 결과는 output/validation에 저장한다.
