# 전체 아키텍처 다이어그램

- 날짜: 2026-09-20. 범위: tech-shared.
- 요청: 빈 overall-architecture.excalidraw.png에 현재 전체 아키텍처 작성.
- 변경: Next.js host, Nest BFF의 SEC/remote 경계, FastAPI/LangGraph, SEC EDGAR, 모델/OAuth proxy, PostgreSQL public/langgraph 스키마, Neo4j, 관측 도구 및 Winston 출력 배치. 실제 통합되지 않은 BFF 파일 로그 수집은 연결하지 않고 명시.
- 산출물: stock/tech-shared/overall-architecture.excalidraw 및 기존 overall-architecture.excalidraw.png. PNG tEXt 청크에 Excalidraw scene을 삽입해 편집 가능 형식 보존.
- stock: [시스템 설계](../stock/tech-shared/system-design.md)에 두 파일 링크 추가.
- 검증: PNG 렌더 육안 확인, Excalidraw JSON 54개 요소 확인, PNG embedded scene zlib 복원 및 JSON 원본 byte 일치 확인. 코드/런타임 변경 없음.
