# 2026-10-18 Intelligent UI Python 확장

- 결정(IUI-001~004/101~104): Python 예제를 독립 복사하고 `open-intelligent-ui`의 카탈로그·채팅·테마·localStorage·gallery/preview·미디어 API를 이관했다. analytics와 모델 route는 제외하고 Python/AG-UI HTTP 경계를 유지했다. 포트는 2036/3044로 분리했다.
- 보존: 원본 `src/lib` 43개 파일의 바이트 일치와 MIT 라이선스를 확인했다. 설치·캐시는 새 프로젝트에서 재생성하고 vitest alias/UTC 설정을 이관했다.
- 교훈: 오래된 프롬프트를 메모리에 가진 서버는 자산 동기화 후 재시작해야 한다. 잘못된 `$state` 참조와 Text 크기 출력을 보고 Python 지침을 보강했으나 자유 생성의 정확성을 보장하지는 않는다.
- 당시 검증: Python 13 tests/Ruff, frontend 318 tests/typecheck/build 및 lint 0 errors/기존 warning 5. 실제 주가·검색·후속 대화·400·지원 크기를 명시한 카운터 smoke PASS. Chrome에서 증가/새로고침 상태 복원, gallery 45개 오류 없음, Lisbon 미디어 API 200을 확인했다.
- 경계: 키 값은 기록하지 않았고 원본·다른 서버는 보존했다. 외부 리소스의 지속 가용성과 모든 자연어 출력은 미보장. 현재 상태는 [stock](../stock/system.md)을 따른다.
