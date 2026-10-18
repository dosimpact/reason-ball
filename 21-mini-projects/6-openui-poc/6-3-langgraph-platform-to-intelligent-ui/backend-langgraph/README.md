# Python LangGraph backend

Python 3.12 및 [uv](https://docs.astral.sh/uv/)만 필요 

```bash
uv sync --frozen
cp .env.example .env  # 최초 설정 시에만
# .env에 OPENAI_API_KEY를 설정한다.
uv run langgraph dev --port 2036 --no-browser
```

- API: http://127.0.0.1:2036
- API 문서: http://127.0.0.1:2036/docs
- 모델: OPENAI_MODEL, 기본 `gpt-4.1-mini`
- 그래프: `langgraph.json` → `agent/graph.py:graph`
- 도구: `agent/tools.py`의 mock 날씨·주가·검색
- 스트림: `agent/streaming.py`가 Python protocol 이벤트를 AG-UI `custom:openui`로 변환한다.
- 프롬프트: `agent/system-prompt.txt`는 함께 배포하는 자산이다. 실행 시 프런트엔드 파일을 읽거나 Node를 호출하지 않는다.

## 검증

```bash
uv run pytest
uv run ruff check agent tests
uv build  # 프롬프트를 포함한 독립 sdist/wheel 생성
```

단위 테스트에는 실제 API 키가 필요하지 않다. 실제 통합 검증은 HTTP 클라이언트에서 수행한다(함께 제공된 frontend의 `npm run test:smoke` 사용 가능).

## 배포

이 디렉터리만 LangGraph 배포 대상으로 사용한다. `langgraph.json`, Python 코드, `pyproject.toml`/`uv.lock`, 프롬프트 자산이 모두 포함되어 있다. 배포 환경에는 OPENAI_API_KEY를 별도로 설정한다. 로컬 `.env`, `.venv`, 개발 서버 상태는 Git에서 제외한다. Cloud 배포 자체는 수행하지 않았다.

## 프롬프트 계약 변경

현재 프롬프트는 OpenUI react-ui 0.18.1의 라이브러리에서 생성했다. 컴포넌트 계약을 변경할 때만 frontend에서 `npm run generate`로 새 프롬프트를 만들고, 그 결과물을 이 프로젝트의 `agent/system-prompt.txt`에 명시적으로 반영한다. 이는 개발 시 자산 갱신이며 두 프로젝트의 실행·설치 의존성이 아니다.

참고: [Python DeepAgents](https://docs.langchain.com/oss/python/deepagents/quickstart), [LangGraph 스트리밍](https://docs.langchain.com/oss/python/langgraph/streaming).
