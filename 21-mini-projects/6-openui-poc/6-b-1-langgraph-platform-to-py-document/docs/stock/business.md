# 제품 설계

## DOC-001 프로젝트 범위

기존 `6-langgraph-platform-to-py`를 보존하고 `6-b-1-langgraph-platform-to-py-document`에서 document-comparison cookbook을 Python LangGraph로 이관했다. Next.js/OpenUI는 UI와 HTTP 프록시를, Python은 모델 실행·문서 처리·검색·대화 저장을 담당한다.

## DOC-002 문서 준비와 근거 검색

`uv run prepare-documents`는 NVIDIA/AMD/Intel 샘플 보고서와 backend-langgraph/documents의 PDF를 준비한다. 페이지별 텍스트를 임베딩하고 search_documents가 문서별 근거, 페이지, 출처 URL과 found를 반환한다. found는 유사도 0.3 기준이며 사실 존재/부재의 확정이 아니다. 로컬 PDF에는 외부 URL이 없고 스캔 문서 OCR은 포함하지 않는다. 검색 실패는 근거 없음과 구분한다.

## DOC-003 비교 UI와 모델 동작

문서 목록 화면은 이름, 보고 기간, 페이지·구절 수와 원본 PDF 링크를 표시한다. 비교 채팅은 표, 차트, 누락·차이 Callout, 페이지별 Sources, Follow-up 질문, Behind the scenes 도구 표시, 테마와 사이드바를 제공한다. 모델은 비교 기준별로 검색하고 근거가 부족하면 표현을 바꿔 재검색한다. 추정 수치를 보고서 사실로 쓰지 않도록 지시한다. 생성형 모델이므로 모든 답변의 사실 정확성을 보장하지 않으며 출처를 확인해야 한다.

## DOC-004 대화 보존

대화 생성·목록·이름 변경·삭제·메시지 복원을 제공한다. 대화와 모델/도구 이력은 Python SQLite에 영구 저장하며 서버 재시작과 화면 새로고침 후 복원한다. 새 질문만 브라우저에서 받고 과거 이력은 서버에서 읽는다. 중단/실패 시 완료된 부분을 저장하고 다음 실행에서 미완성 도구 호출을 제거한다. 같은 대화의 실행 중 추가 요청/변경/삭제는 409로 거절한다.

## PY-004 실행과 자격 증명

백엔드 2035, 프런트엔드 3043. OPENAI_API_KEY는 backend-langgraph/.env만 소유하며 Git 제외. 실제 Chat Completions와 text-embedding-3-small을 사용한다. OPENAI_MODEL 기본값은 gpt-4.1-mini.

## PY-005~008 독립 프로젝트와 UI 계약

두 프로젝트는 HTTP로만 연결한다. PDF·DB·환경·의존성은 각 프로젝트가 소유한다. 프런트엔드 카탈로그/비교 규칙으로 생성한 시스템 프롬프트를 백엔드 자산에 명시적으로 동기화한다. 현재 문서 목록은 Python이 요청마다 추가한다.

## 범위 제한

로컬 단일 프로세스 데모이며 사용자 계정·배포 인증·OCR·웹 PDF 업로드는 원본과 같이 포함하지 않는다. Mock 날씨/주가/웹 검색 코드는 회귀 참고용으로 남아 있지만 비교 에이전트에는 등록하지 않는다.

## DOC-PATH-001 정식 프로젝트 경로

정식 경로는 `21-mini-projects/6-openui-poc/6-b-1-langgraph-platform-to-py-document/`다. 구 `6-2-langgraph-platform-to-py-document`의 소스·설정을 통합하고 빈 구 경로를 제거했다. 포트 2035/3043과 기존 API 계약을 유지하며 PDF·검색 DB·대화 DB·환경 파일은 보존한다. [복구 기록](../flow/2026-10-26-path-recovery.md)을 참조한다.
