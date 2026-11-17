# 2026-11-17 LangGraph OSS worker 문서 갱신

사용자가 지정한 human-docs 문서 갱신 요청에 따라 해당 파일을 수정했다. 기존 사용자 변경(2줄 삭제)을 보존하고 최신 설명을 앞에 추가했다. 초기 본문은 초기 설계 기록으로 명시했다.

LG-OSS-MULTI-001의 현재 stock과 구현·검증 flow를 기준으로 프로세스/Task 구분, memory/postgres 모드, 전역 용량·lease·fencing·취소·장애 복구·SSE·배포 범위를 설명했다. graph11개와 Host 현재 경로·선택형 Canvas도 반영했다.

현재 stock은 [FastAPI runtime](../stock/tech-shared/3-langgraph-fast/fastapi-runtime.md)이며 구현 변경은 없다. 문서 링크·diff 확인만 수행하고 서버·DB·브라우저는 실행하지 않았다. 운영 서비스를 다중 worker로 전환하지 않았다.
