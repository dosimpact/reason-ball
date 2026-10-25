# OpenUI PoC 예제 모음

각 하위 프로젝트는 Python 백엔드와 Next.js 프런트엔드를 독립적으로 설치·실행한다. 목적에 맞는 예제를 고른 뒤 해당 README의 두 터미널 실행 절차를 따른다.

| 프로젝트 | 목적 | 백엔드 / UI 포트 | 프런트엔드 설치 도구 |
|---|---|---|---|
| [6-a-1-openui-langgraph-py](6-a-1-openui-langgraph-py/README.md) | 기본 OpenUI 채팅 + Python DeepAgents | 2034 / 3042 | pnpm |
| [6-a-2-openui-langgraph-py-intelligent-ui](6-a-2-openui-langgraph-py-intelligent-ui/README.md) | Intelligent UI 채팅·문서 업로드 보고서·Lib Story | 2036 / 3044 | npm |
| [6-a-3-openui-shadcn-langgraph-py](6-a-3-openui-shadcn-langgraph-py/README.md) | shadcn 카탈로그 기반 OpenUI 채팅 | 2038 / 3046 | pnpm |
| [6-b-1-langgraph-platform-to-py-document](6-b-1-langgraph-platform-to-py-document/README.md) | PDF 검색·문서 비교·SQLite 대화 저장 | 2035 / 3043 | pnpm |
| [6-b-2-open-ui-sec-with-intelligent-ui](6-b-2-open-ui-sec-with-intelligent-ui/README.md) | PDF 문서 비교 + 통합 Intelligent UI 카탈로그 | 2038 / 3046 | npm |
| [6-b-3-lite-canvas-ux](6-b-3-lite-canvas-ux/README.md) | 대화 + 공급업체 리포트 Canvas·인용·인쇄 | 2040 / 3048 | npm |
| [6-b-4-grafana-grid-system](6-b-4-grafana-grid-system/README.md) | Filing Studio: SEC 연구·Chat + 그리드 Canvas | 2041 / 3049 | npm |

A 계열은 UI 카탈로그와 Python 연결 비교, B 계열은 문서 검색·리포트·Canvas 응용 예제다. 모든 예제가 같은 카탈로그나 저장소를 공유하지는 않는다. **A-3와 B-2는 2038/3046 포트를 공유하므로 기본 설정으로 동시에 실행하지 않는다.**

## 읽기와 실행 순서

1. 하위 README에서 기능 범위, 포트와 설치 도구를 확인한다.
2. `docs/stock/business.md`와 `system.md`에서 현재 제품·구현 계약을 확인한다.
3. `frontend/README.md`, `backend-langgraph/README.md`에서 개별 명령을 확인한다.
4. `docs/flow/`는 날짜별 결정·검증 이력이다. 복사된 과거 이력과 현재 프로젝트의 검증을 구분한다.

OpenAI 키와 모델 실행은 각 Python 백엔드가 소유한다. 문서 인덱싱·smoke·일부 E2E는 실제 API 비용이 발생한다. 환경 파일은 최초에만 복사하고, PDF·SQLite·localStorage 등 실행 데이터는 보존한다. 현재 실행 중인 서버는 이 문서에서 보장하지 않는다.

이동 후 `.next` 재생성 및 Python 실행 경로 복구는 각 프로젝트의 **새 환경 설정과 디렉터리 이동** 절을 참고한다. 전체 루트의 `pnpm install` 대신 각 독립 프로젝트의 잠금 파일과 실행 명령을 사용한다.

[원본 참조 프로젝트](original-reference/README.md) · [README 점검 결과](docs/flow/2026-10-25-readme-audit.md)
