# Intelligent UI + Python LangGraph

두 개의 독립 프로젝트다. 각 폴더에 별도 의존성, 환경변수, 실행·검증 명령이 있으며 HTTP로만 연결한다.

```text
6-a-2-openui-langgraph-py-intelligent-ui/
├── backend-langgraph/  # Python 3.12 + uv + LangGraph / DeepAgents
│   ├── agent/         # 그래프, 도구, 스트림 변환기, 프롬프트 자산
│   ├── tests/
│   ├── .env.example
│   ├── pyproject.toml
│   ├── uv.lock
│   └── langgraph.json
├── frontend/          # Next.js + React + OpenUI
│   ├── src/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
└── docs/              # 두 프로젝트의 통합 설계와 변경 기록
```

```text
Browser → frontend /api/chat → backend-langgraph (Python)
        ← AG-UI SSE          ← protocol v2 custom:openui
```

## 실행

터미널 1 — Python 백엔드:

```bash
cd backend-langgraph
uv sync --frozen
# 최초 설정 시에만: cp .env.example .env
# .env에 OPENAI_API_KEY 설정
uv run langgraph dev --port 2036 --no-browser
```

터미널 2 — Next.js 프런트엔드:

```bash
cd frontend
npm ci
npm run generate
# 최초 설정 시에만: cp .env.example .env
npm run dev
```

http://localhost:3044 에 접속한다. 프런트엔드의 `LANGGRAPH_API_URL` 기본값은 `http://127.0.0.1:2036`다. 각 프로젝트는 자신의 폴더만 복사해도 설치·실행 가능하다. 백엔드에는 Node.js가, 프런트엔드 설치·빌드에는 Python이 필요하지 않다.

날씨·주가·검색 도구는 mock 데이터다. OpenAI 모델 호출은 실제 API를 사용한다. 키는 `backend-langgraph/.env`에만 두고, 프런트엔드는 백엔드 주소와 배포 인증 설정만 갖는다.

## 검증

```bash
# backend-langgraph에서
uv run pytest
uv run ruff check agent tests

# frontend에서
npm test
npm run lint
npm run typecheck
npm run verify
npm run test:smoke  # 두 서버 실행 필요, 실제 OpenAI API 사용
```

## 문서

- [백엔드 안내](backend-langgraph/README.md)
- [프런트엔드 안내](frontend/README.md)
- [제품 설계](docs/stock/business.md)
- [시스템 설계](docs/stock/system.md)
- [Python 전환 기록](docs/flow/2026-10-18-python-migration.md)
- [프로젝트 분리 및 최종 검증](docs/flow/2026-10-18-project-split.md)

코드 구조를 읽을 때는 [시스템 설계](docs/stock/system.md)를 참고한다.

프롬프트를 Python 자산에 동기화한 후 실행 중인 Python 서버를 재시작해야 한다. 텍스트 자산 변경만으로 자동 재로드되지 않을 수 있다.

## Intelligent UI 이관
UI 원본은 `22-reverse-engineering/open-intelligent-ui`이며 src/lib 43개 파일을 그대로 복사했다. 지도/사진/함수/액션/브라우저 저장을 포함하고, 모델 실행은 Python으로 연결했다. 라이선스는 frontend/INTELLIGENT-UI-LICENSE에 있다. 개발 중 전체 UI 예제는 http://127.0.0.1:3044/gallery 에서 확인한다.

[현재 시스템 설계](docs/stock/system.md) · [검증 및 알려진 한계](docs/flow/2026-10-18-intelligent-ui-python.md)

## 분석 문서를 인터랙티브 보고서로 보기

http://localhost:3044 의 **보고서 만들기**에서 MD/HTML/TXT 파일을 선택하고 생성한다. 벤더 분석 표를 인식하면 원문 수치로 KPI·차트·캠페인 필터·제약 시간 슬라이더·조치 체크리스트·근거 탐색을 구성하고 Python 모델이 별도 해설 카드를 추가한다. 원문과 수치 충돌을 보존하며, 필터·체크 상태는 새로고침 후 복원된다. 파일 경로만 채팅에 붙여 넣어서는 문서를 읽지 않는다.

두 서버를 실행한 상태에서 `frontend`의 `npm run test:e2e:reports`로 일반 질문/보고서 전환과 UI 회귀를 검사한다. 샘플 파일을 자동으로 읽지 않는다. HTML 검증 보고서는 `frontend/output/playwright/report/index.html`에 생성된다.

[보고서 설계와 한계](docs/stock/business.md#iui-005-원문-기반-인터랙티브-벤더-보고서) · [구현 및 검증 기록](docs/flow/2026-10-20-interactive-vendor-reports.md)

`docs/vendors/`의 Markdown 8개는 수동 업로드용 샘플이다. 샘플 파일을 읽는 자동 검사와 일괄 히스토리 생성 스크립트는 제거했다. 앱의 대화·UI 상태 저장은 계속 localStorage를 사용한다.

보고서는 탭 없이 모든 섹션을 세로로 표시한다. 저장된 벤더 보고서도 새로고침 후 다시 열면 같은 형식으로 표시된다. `⌘P → PDF로 저장`으로 출력하며, 전체 내용을 원하면 캠페인/근거 필터를 전체로, 최소 제약 시간을 0으로 돌린다. 인쇄 시 채팅 메뉴·입력기는 숨기고 넓은 근거 표는 항목별 세로 레코드로 표시한다.

## 질문 의도에 따른 자동 생성
매 메시지를 모델이 분류해 일반 UI 또는 보고서 전용 프롬프트로 전달한다. 예를 들어 “Plan a relaxed afternoon exploring Lisbon, with three stops and a map”은 일반 여행 UI, 이후 “방금 일정을 한국어 여행 검토 보고서로 바꿔줘”는 이전 답변 기반의 연속 보고서다. 짧은 프로젝트 현황도 보고서로 요청할 수 있다. 보고서에 대한 한두 문장 설명 요청은 일반 응답으로 처리한다.

`frontend`의 `npm run generate` 후 `src/generated/system-prompt.txt`와 `report-system-prompt.txt`를 각각 `backend-langgraph/agent/`에 명시적으로 복사·비교하고 Python 서버를 재시작한다. `intent-prompt.txt`는 Python 소유의 분류 지침이다. 그래프 ID 기본값은 agent/report/intent이며 프런트엔드 환경변수 예시는 해당 `.env.example`에 있다. 의도 분류 호출이 한 번 추가되며 실패 시 오류를 표시한다. `npm run test:e2e:reports`에는 Lisbon 일반→보고서→후속 설명, 짧은 문서, 무관한 이전 문서 제외 검사가 포함된다.
