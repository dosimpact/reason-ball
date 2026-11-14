# 시작가이드 서비스 실행 표 보완

- 날짜: 2026-11-14
- 요청: human-docs 시작가이드의 application 시작하기 구간에 나머지 서비스 추가.
- 권한: 사용자 명시 요청에 따라 해당 구간만 human-docs 수정 금지의 예외로 편집.
- 변경: Host/BFF/두 Remote/FastAPI/LangGraph dev의 작업 디렉터리·명령·포트·역할 추가. 현 infra `.env`의 공개 포트와 내부 전용 서비스 설명 추가.
- 근거: 각 package.json, Vite 설정, 세 앱 환경 파일, infra 환경 파일 및 기존 Docker 공개 포트 확인 결과.
- 현재 stock: [Workspace](../stock/tech-shared/workspace.md), 기존 포트 계약 변경 없음.
- 검증: 편집 구간을 설정과 대조, 추가 내용의 비밀값 없음 확인. 런타임 변경 없으므로 서버 실행 테스트 미적용.
- 기존 가이드 앞부분은 보존하고 현재 환경에서는 새 접속 표를 사용하도록 명시.
