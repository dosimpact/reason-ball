
## 문서

- 현재 제품 설계: [business-design.md](docs/stock/business-design.md)
- 현재 시스템 설계: [system-design.md](docs/stock/system-design.md)
- Push UI Message 구현 1 pager: [25번 예제 가이드](src/examples/25-push-ui-message/README.md)
- 변경 이력: [docs/flow/](docs/flow/)
- 학습 로드맵: [goal.md](goal.md)

## 설치

```
uv sync
```

## 실행  

```
  1. 환경 파일 준비:

  cp .env.example .env

  .env에 최소한 OPENAI_API_KEY를 넣으세요.

  2. LangGraph 서버 실행:

  uv run langgraph dev --host 0.0.0.0 --port 2931 --tunnel

  프론트 코드가 기본적으로 http://localhost:2931을 보도록 되어 있어서 포트는 2931이 맞습니다.

  3. 다른 터미널에서 React 앱 실행:

  pnpm dev
```

## 그래프 폴더

`graphs/`는 화면의 학습 그룹에 맞춰 `mvp`(01–07), `core`(08–20, 48–49),
`generative_ui`(21–28), `artifact`(29–34), `copilotkit`(35–47)으로 나뉩니다.
등록 경로는 `langgraph.json`, 상세 구조는 [시스템 설계](docs/stock/system-design.md#sdk-graph-groups-graph-package-layout)를 참고하세요.
