# 2026-10-20 개발 서버 캐시 복구

- 상황(IUI-004/106): 3044에서 반복 새로고침·chunk 로딩 실패가 발생했다. Turbopack의 `Next.js package not found` 로그와 정상 패키지 resolve를 확인했다. React 상태 갱신 루프는 확인되지 않았다.
- 조치: 소유 frontend를 종료한 뒤 `.next`를 제거하고 재시작해 복구했다. 이전 경로가 남은 캐시가 원인으로 추정된다. 이동한 Python venv의 실행 경로는 `uv sync --frozen --reinstall`로 복구했다.
- 당시 검증: 캐시 없는 Chrome에서 환영 화면·입력·청크 로딩 정상, frontend 200/backend `/ok` 정상. 모델 호출은 재검증하지 않았다.
- 반영: [시스템 설계 IUI-106](../stock/system.md#iui-106-경로-이동-후-개발-환경-복구). 다른 서버와 브라우저 저장소는 보존했다.
