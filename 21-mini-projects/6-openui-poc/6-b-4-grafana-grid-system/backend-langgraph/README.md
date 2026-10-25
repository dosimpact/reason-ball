# Filing Studio Python LangGraph 백엔드

Python 3.12 및 [uv](https://docs.astral.sh/uv/)만 필요

```bash
uv sync --frozen
cp .env.example .env  # 최초 설정 시에만
# .env에 OPENAI_API_KEY를 설정한다.
uv run langgraph dev --port 2041 --no-browser
```

- API: http://127.0.0.1:2041
- API 문서: http://127.0.0.1:2041/docs
- 모델: OPENAI_MODEL, 기본 `gpt-4.1-mini`
- 기본 그래프: `langgraph.json` → `agent/graph.py:graph`. 대시보드 요청은 custom HTTP app의 build_dashboard_graph를 사용한다.
- 도구: `agent/documents.py`의 실제 PDF 검색 search_documents. 기존 mock 도구는 비교 그래프에 등록하지 않는다.
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

## 문서 준비와 검색

백엔드 `.env`에 OPENAI_API_KEY를 설정한다. 아래 명령은 실제 임베딩 API를 호출한다.

```bash
uv sync --frozen
# 기본 샘플 보고서 3개 다운로드 + documents/의 로컬 PDF 준비
uv run prepare-documents
# NVIDIA 전년도 공식 연차보고서도 함께 준비 (다중 연도 비교)
uv run prepare-documents --include-history
# 현재 검토용 연간·분기 자료를 모두 유지하여 인덱스 재구축
uv run prepare-documents --include-history --include-quarterly
# 로컬 PDF만 준비
uv run prepare-documents --no-samples --documents-dir ./documents
```

결과는 기본적으로 `data/documents.sqlite`에 저장한다. 재실행은 선택한 문서 전체로 DB를 교체하며 기존 DB를 병합하지 않는다. 실패 시 이전 DB를 보존한다. `--data-dir`로 바꿨다면 서버도 같은 절대 경로의 `DOCUMENT_DATA_DIR`를 설정해야 한다. PDF 텍스트 레이어를 읽으며 OCR은 포함하지 않는다.

그래프에 등록된 `search_documents`의 입력 예:

```json
{"query":"total revenue and growth", "document_ids":[], "passages_per_document":2}
```

빈 document_ids는 전체 문서를 뜻한다. 결과에는 문서 ID/이름/기간, found와 페이지별 text/score/url이 포함된다. 로컬 PDF에는 URL이 없으며, found=false는 낮은 검색 점수이지 사실 부재의 확정이 아니다. API 키와 DB는 백엔드만 소유한다. PDF/DB는 Git에서 제외한다.

`uv run pytest`는 실제 PDF 추출·SQLite와 로컬 HTTP API fixture를 사용해 준비 CLI와 도구 호출을 검증한다. 실제 OpenAI 품질 검증은 별도다. UI에는 Documents와 비교 채팅, 영구 대화 저장이 연결되어 있다.

## 비교 API와 대화 저장

langgraph.json의 http.app으로 agent/app.py를 같은 2041 서버에 탑재한다. /comparison/documents, /comparison/chat, /comparison/threads/*를 제공한다. 요청마다 현재 문서 목록으로 그래프 프롬프트를 구성하고 Python LangGraph v3 스트림을 AG-UI SSE로 전달한다. conversations.sqlite는 documents.sqlite와 별개여서 문서 재준비로 대화를 삭제하지 않는다. 중단된 도구 호출은 다음 실행에서 정리한다. 로컬 단일 프로세스 데모이며 인증/멀티프로세스 동시성은 범위 밖이다.

## 대시보드와 SEC 경로

`agent/app.py`의 `/dashboard/*`가 Chat·Canvas 요청을 처리하며 `/comparison/*`는 승계한 비교 API다. `agent/settings.py`는 외부 환경변수 → 프로젝트 루트 `.env` → 백엔드 `.env` 순으로 설정한다. `OPENAI_API_KEY`, `SEC_USER_AGENT`를 준비한다. SEC 원문은 `sec.sqlite`, Canvas/대화는 `conversations.sqlite`, PDF 검색 인덱스는 `documents.sqlite`로 분리한다.

카탈로그 생성 경로는 frontend의 `src/shared/ui/openui/generated/system-prompt.txt`다. [상위 README](../README.md)의 동기화 명령을 사용한다. SEC 직접 수집의 현재 검증 한계는 [구현 현황](../docs/stock/implementation-status.md)을 따른다. 이번 README 정비에서 외부 API 수집은 다시 실행하지 않았다.
