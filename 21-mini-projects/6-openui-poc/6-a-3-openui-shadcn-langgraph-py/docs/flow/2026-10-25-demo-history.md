# 2026-10-25 use case별 shadcn history

- 요구사항 SHADCN-002: 생성된 shadcn generative UX를 use case별 thread history에서 볼 수 있게 채운다.
- 배경: 기존 메모리 저장소는 새로고침 후 기록을 잃고, 자동화 브라우저에만 기록을 남기면 사용자 브라우저에서는 볼 수 없다.
- 변경: 실제 Python 모델 API로 7개 use case의 OpenUI Lang 응답을 생성해 demo-threads.json에 저장. 주식 비교는 실제 get_stock_price 도구 4회 결과를 포함한다. 사용자 화면은 한국어 중심이다.
- 저장: 전용 localStorage namespace로 한 번 seed하고 기존 기록을 병합 보존한다. seed marker로 삭제한 예제 부활을 방지한다. 기존 대화·키·브라우저 전체 저장소는 삭제하지 않았다. 저장 실패 시 세션 메모리로 계속 동작한다.
- 근거: frontend/output/demo-history/*.sse; 예제 생성은 pnpm generate:history로 재현 가능하며 실행 중인 Python API와 모델 키가 필요하다. 페이지 로드에서는 모델을 호출하지 않는다.
- 검증 PASS: 프로덕션 빌드, 타입 검사, lint (기존 경고 3개), Chrome E2E 2개 (14.1초): 7개 기록 전환·Card 렌더·새로고침 복원·페이지 오류 없음; 새 대화에서 실제 Python 도구 → shadcn 탭·표 연동도 통과.
- 시각 확인: 생성된 RSVP 폼과 7종 차트 쇼케이스 스크린샷 확인. frontend/output/playwright/shadcn-demo-v1-*.png 및 HTML report 참조.
- UI 범위: 7개 기록의 root Card 렌더와 기록 복원을 검사했다. 각 폼 항목·모든 차트 탭·오버레이의 개별 동작 전수 검증은 아니다.
- 개발 서버가 이전 빌드 이후 느려진 상태라 소유한 프런트엔드만 종료하고 .next를 정리해 재시작했다. 데이터와 환경변수는 보존했다.
- stock 반영: business.md SHADCN-002, system.md SHADCN-002, README 사용 안내.
