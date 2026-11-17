# 2026-11-17 LangGraph OSS 스키마·API 문서 보완

사용자가 지정한 human-docs의 PostgreSQL, API Spec list, Langgraph dev 차이 절을 채웠다. 기존 worker 설명과 사용자 편집은 유지했다.

기본 migration과 runtime_queue DDL에서 테이블·추가 열·제약·인덱스를 반영하고, 실제 server router에서 method/path를 추출했다. checkpoint 저장과 metadata projection, API 등록과 지원 동등성을 구분했다. 최신 기준은 [runtime stock](../stock/tech-shared/3-langgraph-fast/fastapi-runtime.md)이며 구현·stock 동작 변경은 없다.

검증: 소스 정의와 문서 대조 및 git diff --check PASS. 서버·DB·모델·브라우저를 실행하지 않았다. 실제 운영 DB introspection이나 실행 API 재검증 결과로 주장하지 않는다.
