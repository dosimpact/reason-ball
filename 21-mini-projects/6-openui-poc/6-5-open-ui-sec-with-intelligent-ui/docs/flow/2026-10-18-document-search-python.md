# DOC-002 Python 문서 준비와 검색 — 2026-10-18

- 요청: 독립 복사본에서 Python 문서 준비 명령과 search_documents 도구를 구현하고 검증.
- 구현: pypdf 페이지 추출, 1200/200 청크, OpenAI embeddings, atomic SQLite 교체, 샘플 다운로드 및 로컬 PDF 입력, 출처 링크, 문서별 검색과 found 기준. CLI entry point 및 LangGraph 도구 등록.
- 결정: 원본 검색 반환 계약을 유지한다. 데이터는 새 백엔드 소유. 로컬 PDF ID 충돌 방지를 위한 해시, 모델/차원 메타데이터 검증 추가. 원본 mtime 캐시 대신 호출마다 DB snapshot 사용.
- Stock 동기화: business/system DOC-001 현재 상태와 DOC-002 동작/경계 반영. README/AGENTS 사용 명령 추가.
- 검증: pytest 29개 통과(문서 기능 16개 포함), 설치된 CLI를 임의 cwd에서 실행하고 실제 OpenAI SDK를 로컬 HTTP fixture에 연결해 PDF→임베딩→SQLite→LangChain 도구 검색 확인. 기존 스트림/도구 회귀 테스트 포함. Ruff 및 frozen install, wheel/sdist 빌드 확인.
- 제한: 환경/새 .env에 키 없음. 실제 OpenAI 호출, 샘플 PDF 다운로드·추출 품질, 실제 모델 자동 도구 선택 및 브라우저 흐름은 미검증. 기존 키 사용 범위를 질문했으나 아직 답변 없음. 로컬 HTTP fixture 검증을 실제 provider 성공으로 해석하지 않는다.
- 남은 범위: 비교 전용 UI, 문서 목록 API, 동적 문서 목록을 포함한 비교 프롬프트, 영구 대화 저장.
