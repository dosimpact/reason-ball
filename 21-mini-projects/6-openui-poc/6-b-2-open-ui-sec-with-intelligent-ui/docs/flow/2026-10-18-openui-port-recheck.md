# OpenUI Python 이관 재검토 — 2026-10-18

- 맥락: 원본 패키지 전체가 아닌 현재 에이전트에 필요한 기능의 추출 정확성을 재검토했다.
- 대상: PY-002 통신과 이벤트, PY-008 프롬프트 자산.
- 방법: 원본 설치 JS 패키지와 Python 변환기의 언어별 입력 형태를 맞춰 6개 시나리오 출력 비교, 원본 spec/options로 프롬프트 재생성, Python 단위 테스트와 Ruff 실행.
- 결과: 정상 텍스트, 도구 인자 snapshot/결과, 도구 오류, 사용자 메시지 제외는 일치. 빈 텍스트 이벤트와 최종 output 없는 도구 출력 조각은 차이가 있다. 현재 mock 도구는 후자 경로를 사용하지 않는다.
- 프롬프트: 기본 프롬프트는 끝 줄바꿈만 다름. 원본 generateSystemPrompt의 instructions 옵션은 결과에 영향을 주지 않았으며, Python은 추가 지시문을 붙인다.
- 검증: pytest 13개 및 Ruff 통과. 이동 전 경로를 가진 pytest 실행 파일은 실패하여 `uv run python -m pytest`로 실행했다.
- 범위: 실제 provider/browser 검증 및 전체 패키지 동등성 검증은 미실행. 구현 수정 없음.
- Stock 검토: system.md의 PY-002 제한 범위(Chat Completions, provider 도구 제외) 및 PY-008 자산 방식과 일치하여 설계 변경 없음.
- 후속: 도구 출력 스트리밍 또는 provider 도구 도입 시 변환기 확장 필요. 로컬 가상환경 실행 파일 경로 복구 필요.
- 상세: [Report.md](../../Report.md).
